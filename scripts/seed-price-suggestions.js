//ADDED BY KHANYISILE
require("dotenv").config();

const {
  seedPriceSuggestions,
} = require("../services/price-suggestion");

//ADDED BY KHANYISILE
async function runSeed() {
  try {
    const result = await seedPriceSuggestions();

    console.log("Seed completed:");
    console.log(result);

    process.exit(0);
  } catch (error) {
    console.error("Seed failed:");
    console.error(error);

    process.exit(1);
  }
}

//ADDED BY KHANYISILE
runSeed();