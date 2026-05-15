const express = require("express");
const router = express.Router();

const { createSupabaseClient } = require("../lib/supabase");

const sanitizeHtml = require("sanitize-html");
const { body, param, validationResult } = require("express-validator");



// ======================================================
// SANITIZATION HELPERS
// ======================================================
function cleanInput(value) {
  if (typeof value !== "string") return value;

  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

function validateRequest(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      errors: errors.array()
    });

    return false;
  }

  return true;
}



// ======================================================
// FIND OR CREATE CONVERSATION
// ======================================================
async function findOrCreateConversation(
  supabase,
  senderId,
  receiverId
) {

  const { data: existingConv, error: existingError } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(user1_id.eq.${senderId},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${senderId})`
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingConv) {
    return existingConv.id;
  }

  const { data: createdConv, error: createError } = await supabase
    .from("conversations")
    .insert([
      {
        user1_id: senderId,
        user2_id: receiverId
      }
    ])
    .select("id")
    .single();

  if (createError || !createdConv) {
    throw new Error(
      createError?.message || "Conversation creation failed"
    );
  }

  return createdConv.id;
}



// ======================================================
// SEND MESSAGE
// ======================================================
router.post(
  "/send",

  [
    body("sender_name")
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 }),

    body("receiver_name")
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 }),

    body("sender_id")
      .optional()
      .isUUID(),

    body("receiver_id")
      .optional()
      .isUUID(),

    body("content")
      .isString()
      .isLength({ min: 1, max: 5000 })
  ],

  async (req, res) => {

    try {

      if (!validateRequest(req, res)) {
        return;
      }

      const supabase = createSupabaseClient(req, res);

      const {
        data: { user: sessionUser },
        error: sessionError
      } = await supabase.auth.getUser();

      if (sessionError || !sessionUser) {
        return res.status(401).json({
          error: "Not authenticated"
        });
      }


      // ======================================================
      // SANITIZE INPUTS
      // ======================================================
      let {
        receiver_name,
        receiver_id,
        content
      } = req.body;

      receiver_name = cleanInput(receiver_name);
      content = cleanInput(content);


      // ======================================================
      // REQUIRED CHECKS
      // ======================================================
      if (
        !content ||
        (!receiver_id && !receiver_name)
      ) {
        return res.status(400).json({
          error: "receiver identifier and content are required"
        });
      }


      const senderId = sessionUser.id;
      let receiverId = receiver_id || null;


      // ======================================================
      // FIND RECEIVER
      // ======================================================
      if (!receiverId) {

        const { data: receiver, error: receiverError } = await supabase
          .from("profiles")
          .select("id")
          .eq("name", receiver_name)
          .maybeSingle();

        if (receiverError || !receiver) {
          return res.status(404).json({
            error: "Receiver not found"
          });
        }

        receiverId = receiver.id;
      }


      // ======================================================
      // CREATE/FIND CONVERSATION
      // ======================================================
      let conversationId;

      try {

        conversationId = await findOrCreateConversation(
          supabase,
          senderId,
          receiverId
        );

      } catch (err) {

        return res.status(500).json({
          error: err.message
        });

      }


      // ======================================================
      // INSERT MESSAGE
      // ======================================================
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
  }
);



// ======================================================
// FIND OR CREATE CONVERSATION ROUTE
// ======================================================
router.post(
  "/conversation/find-or-create",

  [
    body("sender_name")
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 }),

    body("receiver_name")
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 }),

    body("sender_id")
      .optional()
      .isUUID(),

    body("receiver_id")
      .optional()
      .isUUID()
  ],

  async (req, res) => {

    try {

      if (!validateRequest(req, res)) {
        return;
      }

      const supabase = createSupabaseClient(req, res);

      const {
        data: { user: sessionUser },
        error: sessionError
      } = await supabase.auth.getUser();

      if (sessionError || !sessionUser) {
        return res.status(401).json({
          error: "Not authenticated"
        });
      }


      let {
        sender_name,
        receiver_name,
        sender_id,
        receiver_id
      } = req.body;

      sender_name = cleanInput(sender_name);
      receiver_name = cleanInput(receiver_name);


      if (
        (!sender_id && !sender_name) ||
        (!receiver_id && !receiver_name)
      ) {
        return res.status(400).json({
          error: "sender and receiver identifiers are required"
        });
      }


      let senderId = sender_id || null;
      let receiverId = receiver_id || null;


      // ======================================================
      // FIND SENDER
      // ======================================================
      if (!senderId) {

        const { data: sender, error: senderError } = await supabase
          .from("profiles")
          .select("id")
          .eq("name", sender_name)
          .maybeSingle();

        if (senderError || !sender) {
          return res.status(404).json({
            error: "Sender not found"
          });
        }

        senderId = sender.id;
      }


      // ======================================================
      // FIND RECEIVER
      // ======================================================
      if (!receiverId) {

        const { data: receiver, error: receiverError } = await supabase
          .from("profiles")
          .select("id")
          .eq("name", receiver_name)
          .maybeSingle();

        if (receiverError || !receiver) {
          return res.status(404).json({
            error: "Receiver not found"
          });
        }

        receiverId = receiver.id;
      }


      // ======================================================
      // EXTRA AUTH CHECK
      // ======================================================
      if (sessionUser.id !== senderId) {
        return res.status(403).json({
          error: "Unauthorized"
        });
      }


      const conversationId =
        await findOrCreateConversation(
          supabase,
          senderId,
          receiverId
        );

      return res.status(200).json({
        conversationId
      });

    } catch (err) {

      return res.status(500).json({
        error: err.message
      });

    }
  }
);



// ======================================================
// GET CONVERSATION MESSAGES
// ======================================================
router.get(
  "/conversation/:id",

  [
    param("id").isUUID()
  ],

  async (req, res) => {

    try {

      if (!validateRequest(req, res)) {
        return;
      }

      const supabase = createSupabaseClient(req, res);

      const {
        data: { user: sessionUser },
        error: sessionError
      } = await supabase.auth.getUser();

      if (sessionError || !sessionUser) {
        return res.status(401).json({
          error: "Not authenticated"
        });
      }

      const { id } = req.params;


      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", {
          ascending: true
        });

      if (error) {
        return res.status(500).json({
          error: error.message
        });
      }

      return res.json(data);

    } catch (err) {

      return res.status(500).json({
        error: err.message
      });

    }
  }
);



// ======================================================
// GET USER CONVERSATIONS
// ======================================================
router.get(
  "/conversations",

  async (req, res) => {

    try {

      const supabase = createSupabaseClient(req, res);

      const {
        data: { user: sessionUser },
        error: sessionError
      } = await supabase.auth.getUser();

      if (sessionError || !sessionUser) {
        return res.status(401).json({
          error: "Not authenticated"
        });
      }


      // ======================================================
      // FETCH CONVERSATIONS
      // ======================================================
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(
          `user1_id.eq.${sessionUser.id},user2_id.eq.${sessionUser.id}`
        );

      if (error) {
        return res.status(500).json({
          error: error.message
        });
      }

      return res.json(data);

    } catch (err) {

      return res.status(500).json({
        error: err.message
      });

    }
  }
);



module.exports = router;
