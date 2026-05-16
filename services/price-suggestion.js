const supabase = require("../database");

//ADDED BY KHANYISILE
const DEFAULT_PRICE_SUGGESTIONS = [
  {
    category: "Textbooks",
    base_price: 450,
    source: "Stats SA CPI Education",
  },
  {
    category: "Electronics",
    base_price: 2500,
    source: "Stats SA CPI Electronics",
  },
  {
    category: "Furniture",
    base_price: 800,
    source: "Stats SA CPI Furniture",
  },
  {
    category: "Clothing",
    base_price: 350,
    source: "Stats SA CPI Clothing",
  },
  {
    category: "Appliances",
    base_price: 1200,
    source: "Stats SA CPI Appliances",
  },
  {
    category: "Stationary",
    base_price: 80,
    source: "Stats SA CPI Stationary",
  },
  {
    category: "Tickets",
    base_price: 300,
    source: "Stats SA CPI Recreation",
  },
  {
    category: "Miscellaneous",
    base_price: 200,
    source: "Stats SA CPI General Goods",
  },
];

//ADDED BY KHANYISILE
const CONDITION_MULTIPLIERS = {
  New: 1,
  Good: 0.85,
  Fair: 0.7,
  Worn: 0.5,
  Damaged: 0.3,
};

//ADDED BY KHANYISILE
async function seedPriceSuggestions() {
  const { data: existing } = await supabase
    .from("price_suggestions")
    .select("category");

  const existingCategories =
    existing?.map((item) => item.category) || [];

  const rowsToInsert = DEFAULT_PRICE_SUGGESTIONS.filter(
    (item) => !existingCategories.includes(item.category)
  );

  if (rowsToInsert.length === 0) {
    return {
      ok: true,
      inserted: 0,
      message: "No new categories to seed",
    };
  }

  const { data, error } = await supabase
    .from("price_suggestions")
    .insert(rowsToInsert)
    .select();

  if (error) {
    throw error;
  }

  return {
    ok: true,
    inserted: data.length,
    data,
  };
}

//ADDED BY KHANYISILE
async function getSuggestionForCategory(
  supabase,
  category,
  condition = "Good"
) {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select("*")
    .eq("category", category)
    .single();

  if (error || !data) {
    return null;
  }

  const multiplier =
    CONDITION_MULTIPLIERS[condition] || 0.85;

  const adjustedPrice = Number(
    (data.base_price * multiplier).toFixed(2)
  );

  return {
    category: data.category,
    base_price: data.base_price,
    condition,
    multiplier,
    adjusted_price: adjustedPrice,
    source: data.source,
  };
}

module.exports = {
  seedPriceSuggestions,
  getSuggestionForCategory,
};