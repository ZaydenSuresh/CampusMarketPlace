const supabase = require('../database'); //Using supabase as database 

// Creating the listing using the table listings
async function createListing(listing) {
    
    // Sends a new listing object to the Supabase 'listings' table
    // and inserts it as a new record in the database, including category, sale_status, etc.
    const { data, error } = await supabase
        .from('listings')
        .insert([listing])
        .select('*');


    if (error) throw new Error(error.message);

    // Returns the newly created listing (first item in returned array)
    return data[0];
}

//Other files can use createListing function
module.exports = {
    createListing
};

