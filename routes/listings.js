const express = require('express');
const router = express.Router();
let supabase = null;

try {
  supabase = require('../database');
} catch (err) {
  console.warn("Database not available");
}

// Ensures database connection exists before running any route
function checkDb() {
  if (!supabase) {
    return false;
  }
  return true;
}

// CREATE listing
router.post('/', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const { title, description, price, user_id, image_url, category, condition, sale_type } = req.body;

    // Ensures required fields exist before inserting into database
    if (!title || !description || price === undefined || !user_id) {
      return res.status(400).json({ error: 'Title, description, price, and user_id are required' });
    }

    // Ensures listing always has an image for UI consistency
    if (!image_url) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Validates category to maintain consistent filtering options in frontend
    const validCategories = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Appliances', 'Stationary', 'Tickets', 'Miscellaneous'];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validates condition so listings can be filtered reliably
    const validConditions = ['New', 'Good', 'Fair', 'Worn', 'Damaged'];
    if (!condition || !validConditions.includes(condition)) {
      return res.status(400).json({ error: 'Invalid condition' });
    }

    // Validates sale type for marketplace logic (sale, trade, or both)
    const validSaleTypes = ['Sale', 'Trade', 'Either'];
    if (!sale_type || !validSaleTypes.includes(sale_type)) {
      return res.status(400).json({ error: 'Invalid sale_type' });
    }

    // Inserts new listing into Supabase database
    const { data, error } = await supabase
      .from('listings')
      .insert([{
        title, description, price, user_id, image_url, category, condition, sale_type
      }])
      .select('*');

    if (error) throw new Error(error.message);
    res.status(201).json({ ok: true, listing: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all listings (limited for homepage display)
router.get('/', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    // Fetch latest listings for homepage UI
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) throw new Error(error.message);
    res.json({ ok: true, listings: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all listings (used for full marketplace view)
router.get('/all', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    // Fetches all listings without limit for full browsing page
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json({ ok: true, listings: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single listing by ID
router.get('/:id', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    // Retrieves one listing for detail page view
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw new Error(error.message);
    res.json({ ok: true, listing: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE listing
router.put('/:id', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const {
      title,
      description,
      price,
      user_id,
      image_url,
      category,
      condition,
      sale_type
    } = req.body;

    // Build update object dynamically to avoid overwriting fields with undefined
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = price;
    if (user_id !== undefined) updates.user_id = user_id;
    if (image_url !== undefined) updates.image_url = image_url;
    if (category !== undefined) updates.category = category;
    if (condition !== undefined) updates.condition = condition;
    if (sale_type !== undefined) updates.sale_type = sale_type;

    // Updates only provided fields in the database
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', req.params.id)
      .select('*');

    if (error) throw new Error(error.message);
    res.json({ ok: true, listing: data[0] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE listing
router.delete('/:id', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    // Permanently removes listing from database
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', req.params.id);

    if (error) throw new Error(error.message);
    res.json({ ok: true, message: 'Listing deleted' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;