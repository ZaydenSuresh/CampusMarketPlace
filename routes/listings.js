const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

const router = express.Router();

const BUCKET_NAME = "listing-images";

const validCategories = [
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Appliances",
  "Stationary",
  "Tickets",
  "Miscellaneous",
];

const validConditions = ["New", "Good", "Fair", "Worn", "Damaged"];
const validSaleTypes = ["Sale", "Trade", "Either"];

function isValidBase64Image(imageBase64) {
  return (
    typeof imageBase64 === "string" &&
    imageBase64.startsWith("data:") &&
    imageBase64.includes(";base64,")
  );
}

function decodeBase64Image(imageBase64) {
  const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image format");
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  return { mimeType, buffer };
}

function createSafeFilePath(userId, imageName, mimeType) {
  let extension = "jpg";

  if (imageName && imageName.includes(".")) {
    extension = imageName.split(".").pop().toLowerCase();
  } else if (mimeType) {
    const mimeParts = mimeType.split("/");
    if (mimeParts[1]) {
      extension = mimeParts[1].toLowerCase();
    }
  }

  const safeExt = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `${userId}/${timestamp}-${randomPart}.${safeExt}`;
}

async function uploadBase64Image(supabase, { userId, imageName, imageBase64 }) {
  if (!userId || !imageBase64) {
    throw new Error("Missing userId or imageBase64");
  }

  if (!isValidBase64Image(imageBase64)) {
    throw new Error("Invalid image data");
  }

  const { mimeType, buffer } = decodeBase64Image(imageBase64);
  const filePath = createSafeFilePath(userId, imageName, mimeType);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: mimeType || "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("Could not get uploaded image URL");
  }

  return data.publicUrl;
}

async function getCurrentUser(req, res) {
  const supabase = createSupabaseClient(req, res);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

// CREATE listing
router.post("/", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      sale_type,
      imageName,
      imageType,
      imageBase64,
    } = req.body;

    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!title || !description || price === undefined) {
      return res
        .status(400)
        .json({ error: "Title, description, and price are required" });
    }

    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (!condition || !validConditions.includes(condition)) {
      return res.status(400).json({ error: "Invalid condition" });
    }

    if (!sale_type || !validSaleTypes.includes(sale_type)) {
      return res.status(400).json({ error: "Invalid sale_type" });
    }

    if (!imageBase64 || !imageName) {
      return res.status(400).json({ error: "Image is required" });
    }

    const image_url = await uploadBase64Image(supabase, {
      userId: user.id,
      imageName,
      imageType,
      imageBase64,
    });

    const { data, error } = await supabase
      .from("listings")
      .insert([
        {
          title,
          description,
          price,
          user_id: user.id,
          image_url,
          category,
          condition,
          sale_type,
        },
      ])
      .select("*");

    if (error) {
      throw new Error(error.message);
    }

    return res.status(201).json({ ok: true, listing: data[0] });
  } catch (err) {
    console.error("Create listing error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET latest listings
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, listings: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET all listings
router.get("/all", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, listings: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET listings based on search parameters
router.get("/search", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const {
      q,
      category,
      condition,
      minPrice,
      maxPrice,
      status,
      reserved_by,
      user_id,
    } = req.query;

    let query = supabase
      .from("listings")
      .select(
        `
        *,
        profiles:user_id (name)
      `,
      )
      .order("created_at", { ascending: false });

    if (category && category !== "All") {
      query = query.eq("category", category);
    }

    if (condition && condition !== "All") {
      query = query.eq("condition", condition);
    }

    if (status && status !== "All") {
      query = query.eq("status", status);
    }

    if (reserved_by && reserved_by !== "All") {
      query = query.eq("reserved_by", reserved_by);
    }

    if (user_id && user_id !== "All") {
      query = query.eq("user_id", user_id);
    }

    if (minPrice && minPrice !== "") {
      query = query.gte("price", parseFloat(minPrice));
    }

    if (maxPrice && maxPrice !== "") {
      query = query.lte("price", parseFloat(maxPrice));
    }

    if (q && q.trim() !== "") {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, listings: data });
  } catch (err) {
    console.error("Search listings error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET single listing by ID
router.get("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, listing: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// UPDATE listing
router.put("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      sale_type,
      imageName,
      imageType,
      imageBase64,
    } = req.body;

    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { data: existingListing, error: existingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (existingError || !existingListing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (category !== undefined) {
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }
      updates.category = category;
    }

    if (condition !== undefined) {
      if (!validConditions.includes(condition)) {
        return res.status(400).json({ error: "Invalid condition" });
      }
      updates.condition = condition;
    }

    if (sale_type !== undefined) {
      if (!validSaleTypes.includes(sale_type)) {
        return res.status(400).json({ error: "Invalid sale_type" });
      }
      updates.sale_type = sale_type;
    }

    if (imageBase64) {
      const image_url = await uploadBase64Image(supabase, {
        userId: user.id,
        imageName,
        imageType,
        imageBase64,
      });

      updates.image_url = image_url;
    }

    const { data, error } = await supabase
      .from("listings")
      .update(updates)
      .eq("id", req.params.id)
      .select("*");

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, listing: data[0] });
  } catch (err) {
    console.error("Update listing error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE listing
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    // "getCurrentUser": Retrieves the authenticated user's details from the session. This is vital for security.
    const user = await getCurrentUser(req, res);

    // Fetch the listing to check ownership and status
    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("user_id, status")
      .eq("id", id)
      .single();

    // This is a safety check that ensures the server doesn't crash by confirming the item actually exists in the database before trying to delete it.
    if (fetchError || !listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Security check: Only the owner can delete
    if (listing.user_id !== user.id) {
      return res
        .status(403)
        .json({ error: "Unauthorized: You don't own this listing" });
    }

    // Safety check: Prevent deleting if an active transaction exists
    if (listing.status !== "available" && listing.status !== null) {
      return res.status(400).json({
        error: "Cannot delete item: It is currently reserved or sold.",
      });
    }

    // Perform the deletion
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, message: "Listing deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: err.message });
  }
});
// RESERVE / BUY listing
router.post("/:id/reserve", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const listingId = req.params.id;
    const { transaction_type } = req.body;

    if (!["sale", "trade"].includes(transaction_type)) {
      return res.status(400).json({ error: "Invalid transaction type" });
    }

    const user = await getCurrentUser(req, res);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const buyerId = user.id;

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.status !== "available") {
      return res.status(400).json({ error: "Listing not available" });
    }

    if (listing.user_id === buyerId) {
      return res.status(400).json({ error: "Cannot reserve your own listing" });
    }

    const { data: existingTransactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("listing_id", listingId)
      .neq("status", "completed")
      .neq("status", "cancelled");

    if (txError) throw new Error(txError.message);

    if (existingTransactions && existingTransactions.length > 0) {
      return res.status(400).json({
        error: "Listing already has an active transaction",
      });
    }

    const { data: transaction, error: insertError } = await supabase
      .from("transactions")
      .insert([
        {
          listing_id: listingId,
          buyer_id: buyerId,
          seller_id: listing.user_id,
          type: transaction_type,
          status: "pending",
          slot_id: null,
          dropoff_confirmed: false,
          collection_confirmed: false,
        },
      ])
      .select("*");

    if (insertError) throw new Error(insertError.message);

    const { error: updateError } = await supabase
      .from("listings")
      .update({
        status: "reserved",
        reserved_by: buyerId,
      })
      .eq("id", listingId);

    if (updateError) throw new Error(updateError.message);

    return res.json({
      ok: true,
      message: "Listing reserved",
      transaction: transaction[0],
    });
  } catch (err) {
    console.error("Reserve error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
