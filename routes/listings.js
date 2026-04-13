const express = require('express');
const router = express.Router();
const supabase = require('../database');

// CREATE listing
router.post('/', async (req, res) => {
    try {
        // Extract all fields from request body
        const { title, description, price, user_id, image_url, category, condition, sale_type } = req.body;

        // Validate required fields - all fields are required
        if (!title || !description || price === undefined || !user_id) {
            return res.status(400).json({ error: 'Title, description, price, and user_id are required' });
        }

        // Validate image_url is provided
        if (!image_url) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        // Validate category enum - must be one of the allowed values
        const validCategories = ['Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Appliances', 'Stationary', 'Tickets', 'Miscellaneous'];
        if (!category || !validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        // Validate condition enum - must be one of the allowed values
        const validConditions = ['New', 'Good', 'Fair', 'Worn', 'Damaged'];
        if (!condition || !validConditions.includes(condition)) {
            return res.status(400).json({ error: 'Invalid condition' });
        }

        // Validate sale_type enum - must be one of the allowed values
        const validSaleTypes = ['Sale', 'Trade', 'Either'];
        if (!sale_type || !validSaleTypes.includes(sale_type)) {
            return res.status(400).json({ error: 'Invalid sale_type' });
        }

        // Insert listing into database with all required fields
        const { data, error } = await supabase
            .from('listings')
            .insert([{
                title,
                description,
                price,
                user_id,
                image_url,
                category,
                condition,
                sale_type
            }])
            .select('*');

        if (error) throw new Error(error.message);

        // Return created listing
        res.status(201).json({ ok: true, listing: data[0] });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all listings (6 most recent, sorted by creation time)
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false }) // Sort by newest first
            .limit(6); // Return only the 6 most recent listings

        if (error) throw new Error(error.message);

        res.json({ ok: true, listings: data });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all listings (no limit - used for search)
router.get('/all', async (req, res) => {
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
    try {
        const { title, description, price, user_id, image_url, category } = req.body;

        const { data, error } = await supabase
            .from('listings')
            .update({
                title,
                description,
                price,
                user_id,
                image_url,
                category
            })
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