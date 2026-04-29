const supabase = require('../database'); // Using supabase as database 

// Creating the listing using the table listings
async function createListing(listing) {
    
    const { data, error } = await supabase
        .from('listings')
        .insert([listing])
        .select('*');

    if (error) throw new Error(error.message);

    return data[0];
}

/**
 * Update listing status (available to reserved to unavailable)
 */
async function updateListingStatus(id, status) {
    const { data, error } = await supabase
        .from('listings')
        .update({ status })
        .eq('id', id)
        .select('*');

    if (error) throw new Error(error.message);

    return data[0];
}

// Export functions
module.exports = {
    createListing,
    updateListingStatus
};