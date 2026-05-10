const express = require("express");
const router = express.Router();
const { createSupabaseClient } = require("../lib/supabase");

async function findOrCreateConversation(supabase, senderId, receiverId) {
  const { data: existingConv, error: existingError } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(user1_id.eq.${senderId},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${senderId})`
    )
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingConv) return existingConv.id;

  const { data: createdConv, error: createError } = await supabase
    .from("conversations")
    .insert([{ user1_id: senderId, user2_id: receiverId }])
    .select("id")
    .single();

  if (createError || !createdConv) {
    throw new Error(createError?.message || "Conversation creation failed");
  }

  return createdConv.id;
}

router.post("/send", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !sessionUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { sender_name, receiver_name, sender_id, receiver_id, content } = req.body;

    if (!content || (!sender_id && !sender_name) || (!receiver_id && !receiver_name)) {
      return res.status(400).json({
        error: "sender and receiver identifiers and content are required"
      });
    }

    let senderId = sender_id || null;
    let receiverId = receiver_id || null;

    if (!senderId) {
      const { data: sender, error: senderError } = await supabase
        .from("profiles")
        .select("id")
        .eq("name", sender_name)
        .maybeSingle();

      if (senderError || !sender) {
        return res.status(404).json({
          error: "Sender or receiver not found"
        });
      }

      senderId = sender.id;
    }

    if (!receiverId) {
      const { data: receiver, error: receiverError } = await supabase
        .from("profiles")
        .select("id")
        .eq("name", receiver_name)
        .maybeSingle();

      if (receiverError || !receiver) {
        return res.status(404).json({
          error: "Sender or receiver not found"
        });
      }

      receiverId = receiver.id;
    }

    let conversationId;

    try {
      conversationId = await findOrCreateConversation(supabase, senderId, receiverId);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    
    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          content: content
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    return res.status(201).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
});

router.post("/conversation/find-or-create", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !sessionUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { sender_name, receiver_name, sender_id, receiver_id } = req.body;

    if ((!sender_id && !sender_name) || (!receiver_id && !receiver_name)) {
      return res.status(400).json({
        error: "sender and receiver identifiers are required"
      });
    }

    let senderId = sender_id || null;
    let receiverId = receiver_id || null;

    if (!senderId) {
      const { data: sender, error: senderError } = await supabase
        .from("profiles")
        .select("id")
        .eq("name", sender_name)
        .maybeSingle();

      if (senderError || !sender) {
        return res.status(404).json({
          error: "Sender or receiver not found"
        });
      }

      senderId = sender.id;
    }

    if (!receiverId) {
      const { data: receiver, error: receiverError } = await supabase
        .from("profiles")
        .select("id")
        .eq("name", receiver_name)
        .maybeSingle();

      if (receiverError || !receiver) {
        return res.status(404).json({
          error: "Sender or receiver not found"
        });
      }

      receiverId = receiver.id;
    }

    const conversationId = await findOrCreateConversation(supabase, senderId, receiverId);

    return res.status(200).json({ conversationId });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});



router.get("/conversation/:id", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !sessionUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.get("/conversations/:name", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);

    const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !sessionUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name } = req.params;

    
    const { data: user } = await supabase
      .from("profiles")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





module.exports = router;
