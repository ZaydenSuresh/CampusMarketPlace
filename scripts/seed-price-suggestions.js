//ADDED BY KHANYISILE
require("dotenv").config();//loads variables from .env to process.env(which contains the keys I need for this file)

const {
  seedPriceSuggestions,
} = require("../services/price-suggestion");//imports the seedP..S.. function from services/price-suggestion

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

//This file exists so you can run the database seeding process from the terminal without needing to start the whole application.