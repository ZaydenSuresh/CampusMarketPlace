const express = require('express'); //For creating routes
const router = express.Router(); //Router object for POST, GET etc.
const supabase = require('../database'); //For querying

//LISTINGS ARE REFERENCED BY ID

// Posting route creation
router.post('/', async (req, res) => {
    try {
        const { title, description, price, user_id } = req.body;

        if (!title || !description || !price || !user_id) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { data, error } = await supabase
            .from('listings')
            .insert([{ title, description, price, user_id }])
            .select('*');

        if (error) throw new Error(error.message);

        res.status(201).json({ ok: true, listing: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Getting all listings
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

// Read a selected listing
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

// Update selected listing
router.put('/:id', async (req, res) => {
    try {
        const { title, description, price, user_id } = req.body;

        const { data, error } = await supabase
            .from('listings')
            .update({ title, description, price, user_id })
            .eq('id', req.params.id)
            .select('*');

        if (error) throw new Error(error.message);

        res.json({ ok: true, listing: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove a listing
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

module.exports = router; //Routes available to server.js