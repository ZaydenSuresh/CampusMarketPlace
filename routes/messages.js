const express = require("express");
const router = express.Router();
const supabase = require("../database");






router.post("/send", async (req, res) => {
  try {
    const { sender_name, receiver_name, content } = req.body;

    if (!sender_name || !receiver_name || !content) {
      return res.status(400).json({
        error: "sender_name, receiver_name and content are required"
      });
    }

    
    const { data: sender, error: senderError } = await supabase
      .from("profiles")
      .select("id")
      .eq("name", sender_name)
      .maybeSingle();

    
    const { data: receiver, error: receiverError } = await supabase
      .from("profiles")
      .select("id")
      .eq("name", receiver_name)
      .maybeSingle();

    if (senderError || receiverError || !sender || !receiver) {
      return res.status(404).json({
        error: "Sender or receiver not found"
      });
    }

    let conversationId = null;

    
    const { data: existingConv, error: existingError } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user1_id.eq.${sender.id},user2_id.eq.${receiver.id}),and(user1_id.eq.${receiver.id},user2_id.eq.${sender.id})`
      )
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        error: existingError.message
      });
    }

    
    if (existingConv) {
      conversationId = existingConv.id;
    }

    
    if (!conversationId) {
      const { data: createdConv, error: createError } = await supabase
        .from("conversations")
        .insert([
          {
            user1_id: sender.id,
            user2_id: receiver.id
          }
        ])
        .select("id")
        .single();

      if (createError || !createdConv) {
        return res.status(500).json({
          error: "Conversation creation failed",
          details: createError?.message
        });
      }

      conversationId = createdConv.id;
    }

    
    if (!conversationId) {
      return res.status(500).json({
        error: "conversationId was not generated"
      });
    }

    
    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          sender_id: sender.id,
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





router.get("/conversation/:id", async (req, res) => {
  try {
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