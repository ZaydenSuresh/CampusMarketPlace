const express = require('express');
const router = express.Router();
let supabase = null;

try {
  supabase = require('../database');
} catch (err) {
  console.warn("Database not available");
}

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

    if (!title || !description || price === undefined || !user_id) {
      return res.status(400).json({ error: 'Title, description, price, and user_id are required' });
    }

    if (!image_url) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const validCategories = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Appliances', 'Stationary', 'Tickets', 'Miscellaneous'];
    if (!category || !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const validConditions = ['New', 'Good', 'Fair', 'Worn', 'Damaged'];
    if (!condition || !validConditions.includes(condition)) {
      return res.status(400).json({ error: 'Invalid condition' });
    }

    const validSaleTypes = ['Sale', 'Trade', 'Either'];
    if (!sale_type || !validSaleTypes.includes(sale_type)) {
      return res.status(400).json({ error: 'Invalid sale_type' });
    }

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

// GET all listings
router.get('/', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
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

// GET all listings (no limit)
router.get('/all', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
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

// GET single listing
router.get('/:id', async (req, res) => {
  if (!checkDb()) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
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
    const { title, description, price, user_id, image_url, category } = req.body;

    const { data, error } = await supabase
      .from('listings')
      .update({ title, description, price, user_id, image_url, category })
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