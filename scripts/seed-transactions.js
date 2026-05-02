require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const supabase = require('../database');

// Validate Supabase client is initialized
if (!supabase) {
  console.error('ERROR: Supabase client not initialized. Check SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

async function seedTransactions() {
  try {
    console.log('Starting transaction seeding...');

    // 1. Fetch valid foreign key references
    console.log('Fetching reference data...');
    
    // Fetch profiles (for buyer_id/seller_id)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(10);
    if (profilesError) throw new Error(`Profiles fetch failed: ${profilesError.message}`);
    if (profiles.length < 2) throw new Error('Need at least 2 profiles to create transactions');
    console.log(`Fetched ${profiles.length} profiles`);

    // Fetch listings (for listing_id, seller_id, type)
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, user_id, sale_type')
      .limit(10);
    if (listingsError) throw new Error(`Listings fetch failed: ${listingsError.message}`);
    if (listings.length < 1) throw new Error('Need at least 1 listing to create transactions');
    console.log(`Fetched ${listings.length} listings`);

    // Fetch trade slots (for slot_id)
    const { data: slots, error: slotsError } = await supabase
      .from('trade_slots')
      .select('id')
      .limit(10);
    if (slotsError) throw new Error(`Trade slots fetch failed: ${slotsError.message}`);
    if (slots.length < 1) throw new Error('Need at least 1 trade slot to create transactions');
    console.log(`Fetched ${slots.length} trade slots`);

    // 2. Generate mock transactions
    const transactions = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Helper to get random item from array
    const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Helper to generate random date between two dates
    const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

    // 15 Completed transactions (for analytics, spread over last 30 days)
    for (let i = 0; i < 15; i++) {
      const listing = getRandomItem(listings);
      const sellerId = listing.user_id;
      // Pick buyer that's not the seller if possible
      const availableBuyers = profiles.filter(p => p.id !== sellerId);
      const buyerId = availableBuyers.length > 0 ? getRandomItem(availableBuyers).id : getRandomItem(profiles).id;
      const slot = getRandomItem(slots);
      // Convert listing sale_type to lowercase to match transaction_type enum
      const type = listing.sale_type.toLowerCase();

      transactions.push({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listing.id,
        type: type,
        status: 'completed',
        dropoff_confirmed: true,
        collection_confirmed: true,
        slot_id: slot.id,
        created_at: getRandomDate(thirtyDaysAgo, now).toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // 5 In-progress transactions
    for (let i = 0; i < 5; i++) {
      const listing = getRandomItem(listings);
      const sellerId = listing.user_id;
      const availableBuyers = profiles.filter(p => p.id !== sellerId);
      const buyerId = availableBuyers.length > 0 ? getRandomItem(availableBuyers).id : getRandomItem(profiles).id;
      const slot = getRandomItem(slots);
      const type = listing.sale_type.toLowerCase();

      transactions.push({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listing.id,
        type: type,
        status: 'in_progress',
        dropoff_confirmed: false,
        collection_confirmed: false,
        slot_id: slot.id,
        created_at: getRandomDate(sevenDaysAgo, now).toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // 5 Pending transactions
    for (let i = 0; i < 5; i++) {
      const listing = getRandomItem(listings);
      const sellerId = listing.user_id;
      const availableBuyers = profiles.filter(p => p.id !== sellerId);
      const buyerId = availableBuyers.length > 0 ? getRandomItem(availableBuyers).id : getRandomItem(profiles).id;
      const slot = getRandomItem(slots);
      const type = listing.sale_type.toLowerCase();

      transactions.push({
        buyer_id: buyerId,
        seller_id: sellerId,
        listing_id: listing.id,
        type: type,
        status: 'pending',
        dropoff_confirmed: false,
        collection_confirmed: false,
        slot_id: slot.id,
        created_at: getRandomDate(sevenDaysAgo, now).toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // 3. Bulk insert transactions
    console.log(`Inserting ${transactions.length} mock transactions...`);
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactions)
      .select('id');

    if (error) throw new Error(`Insert failed: ${error.message}`);
    console.log(`Successfully inserted ${data.length} transactions`);
    process.exit(0);

  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
}

seedTransactions();
