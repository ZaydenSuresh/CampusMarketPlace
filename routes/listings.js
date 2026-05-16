const express = require("express");
const { createSupabaseClient } = require("../lib/supabase");

// ADDED BY KHANYISILE
const { getSuggestionForCategory } = require("../services/price-suggestion");

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

// Enrich ratings (UPDATED RULE: exclude removed)
async function enrichWithRatings(supabase, listings) {
  if (!listings || listings.length === 0) return listings;

  const sellerIds = [...new Set(listings.map((l) => l.user_id).filter(Boolean))];

  const { data: ratings, error } = await supabase
    .from("ratings")
    .select("rated_id, rating")
    .in("rated_id", sellerIds)
    .or("removed.is.null,removed.eq.false");

  if (error) return listings;

  const map = {};

  ratings?.forEach((r) => {
    if (!map[r.rated_id]) map[r.rated_id] = { sum: 0, count: 0 };
    map[r.rated_id].sum += r.rating;
    map[r.rated_id].count += 1;
  });

  return listings.map((l) => {
    const s = map[l.user_id];
    return {
      ...l,
      seller_average_rating: s
        ? Math.round((s.sum / s.count) * 100) / 100
        : null,
      seller_review_count: s ? s.count : 0,
    };
  });
}

// GET latest listings
router.get("/", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw new Error(error.message);

    const listings = await enrichWithRatings(supabase, data);

    return res.json({ ok: true, listings });
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

    if (error) throw new Error(error.message);

    const listings = await enrichWithRatings(supabase, data);

    return res.json({ ok: true, listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// SEARCH listings
router.get("/search", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { q, category, condition, minPrice, maxPrice, status, reserved_by, user_id } =
      req.query;

    let resolvedUserId = user_id;

    if (resolvedUserId === "me") {
      const user = await getCurrentUser(req, res);
      resolvedUserId = user?.id;
    }

    let query = supabase
      .from("listings")
      .select(`*, profiles:user_id (name)`)
      .order("created_at", { ascending: false });

    if (category && category !== "All") query = query.eq("category", category);
    if (condition && condition !== "All") query = query.eq("condition", condition);
    if (status && status !== "All") query = query.eq("status", status);
    if (reserved_by && reserved_by !== "All") query = query.eq("reserved_by", reserved_by);
    if (resolvedUserId && resolvedUserId !== "All") query = query.eq("user_id", resolvedUserId);
    if (minPrice) query = query.gte("price", parseFloat(minPrice));
    if (maxPrice) query = query.lte("price", parseFloat(maxPrice));

    if (q?.trim()) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const listings = await enrichWithRatings(supabase, data);

    return res.json({ ok: true, listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ADDED BY KHANYISILE — Card 10 FIXED ENDPOINT
router.get("/price-suggestion/:category", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { category } = req.params;
    const { condition = "Good" } = req.query;

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (!validConditions.includes(condition)) {
      return res.status(400).json({ error: "Invalid condition" });
    }

    const suggestion = await getSuggestionForCategory(
      supabase,
      category,
      condition
    );

    return res.json({ ok: true, suggestion });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET listing by ID
router.get("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw new Error(error.message);

    return res.json({ ok: true, listing: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// UPDATE listing
router.put("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const user = await getCurrentUser(req, res);

    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const { data: existing } = await supabase
      .from("listings")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (!existing) return res.status(404).json({ error: "Not found" });

    const updates = { ...req.body };

    const { data, error } = await supabase
      .from("listings")
      .update(updates)
      .eq("id", req.params.id)
      .select("*");

    if (error) throw new Error(error.message);

    return res.json({ ok: true, listing: data[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE listing
router.delete("/:id", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const user = await getCurrentUser(req, res);

    const { data: listing } = await supabase
      .from("listings")
      .select("user_id, status")
      .eq("id", req.params.id)
      .single();

    if (!listing) return res.status(404).json({ error: "Not found" });

    if (listing.user_id !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (listing.status !== "available" && listing.status !== null) {
      return res.status(400).json({ error: "Cannot delete active listing" });
    }

    await supabase.from("listings").delete().eq("id", req.params.id);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// RESERVE
router.post("/:id/reserve", async (req, res) => {
  const supabase = createSupabaseClient(req, res);

  try {
    const user = await getCurrentUser(req, res);

    const listingId = req.params.id;

    const { data: listing } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (!listing) return res.status(404).json({ error: "Not found" });

    if (listing.status !== "available") {
      return res.status(400).json({ error: "Not available" });
    }

    const { data: tx } = await supabase
      .from("transactions")
      .insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: listing.user_id,
        status: "pending",
        type: req.body.transaction_type,
      })
      .select("*");

    await supabase
      .from("listings")
      .update({ status: "reserved", reserved_by: user.id })
      .eq("id", listingId);

    return res.json({ ok: true, transaction: tx[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;