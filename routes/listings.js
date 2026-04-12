const express = require('express');
const router = express.Router();
const supabase = require('../database');

// CREATE listing
router.post('/', async (req, res) => {
    try {
        const { title, description, price, user_id, image_url, category } = req.body;

        // minimal required fields
        if (!title || !description || price === undefined) {
            return res.status(400).json({ error: 'Title, description and price are required' });
        }

        const { data, error } = await supabase
            .from('listings')
            .insert([{
                title,
                description,
                price,
                user_id: user_id || null,
                image_url: image_url || null,
                category: category || null
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
    try {
        const { data, error } = await supabase
            .from('listings')
            .select('*');

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