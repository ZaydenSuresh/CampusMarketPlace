const express = require('express');
const router = express.Router();
const supabase = require('../database');
const Message = require('../models/message');

router.post("/send", async (req, res) => {
  const { sender_name, receiver_name, content } = req.body;

  
  const { data: sender, error: sError } = await supabase
    .from("profiles")
    .select("id")
    .eq("name", sender_name)
    .maybeSingle();

  
  const { data: receiver, error: rError } = await supabase
    .from("profiles")
    .select("id")
    .eq("name", receiver_name)
    .maybeSingle();

  
  if (!sender || !receiver) {
    return res.status(404).json({
      error: "Sender or receiver not found",
      debug: { sender, receiver }
    });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        sender_id: sender.id,
        receiver_id: receiver.id,
        content
      }
    ])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

router.get("/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const { data: u1, error: e1 } = await supabase
      .from("profiles")
      .select("id")
      .eq("name", user1)
      .single();

    const { data: u2, error: e2 } = await supabase
      .from("profiles")
      .select("id")
      .eq("name", user2)
      .maybeSingle();

    if (e1 || e2 || !u1 || !u2) {
      return res.status(404).json({
        error: "One or both users not found"
      });
    }

    const { data, error } = await supabase
     .from("messages")
     .select("*")
     .or(
       `and(sender_id.eq.${u1.id},receiver_id.eq.${u2.id}),and(sender_id.eq.${u2.id},receiver_id.eq.${u1.id})`
     )
     .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;