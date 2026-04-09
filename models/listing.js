const supabase = require('../database'); //Using supabase as database 

// Creating the listing using the table listings
async function createListing(listing) {
    const { data, error } = await supabase
        .from('listings')
        .insert([listing])
        .select('*');

    if (error) throw new Error(error.message);
    return data[0];
}
//Other files can use createListing function
module.exports = {
    createListing
};