const express = require("express");
const router = express.Router();
const supabase = require("../database");

router.get("/:userId", async (req,res)=>{

const userId = req.params.userId;

const { data, error } = await supabase
.from("transactions")
.select("*")
.eq("status","completed");

if(error) return res.status(500).json({error:error.message});

const bought = data.filter(t => t.buyer_id == userId);
const sold = data.filter(t => t.seller_id == userId);

res.json({ bought, sold });

});

module.exports = router;