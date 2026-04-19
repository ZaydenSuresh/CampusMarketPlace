// components/search.js

/**
 * Filters listings by search query and category
 * @param {Array} listings
 * @param {string} query
 * @param {Object} filters - { category, condition, minPrice, maxPrice }
 * @returns {Array}
 */
export function filterListings(listings, query, filters = {}) {
    if (!Array.isArray(listings)) return [];
    
    const { category = 'All', condition = 'All', minPrice, maxPrice } = filters;
    let filtered = listings;
    
    // Filter by category first (if not "All")
    if (category && category !== 'All') {
        filtered = filtered.filter(listing => listing.category === category);
    }
  
    // Filter by condition
    if (condition !== 'All') {
        filtered = filtered.filter(listing => listing.condition === condition);
    }
    
    // Filter by Price Range
    if (minPrice) {
        filtered = filtered.filter(listing => listing.price >= parseFloat(minPrice));
    }
  
    if (maxPrice) {
        filtered = filtered.filter(listing => listing.price <= parseFloat(maxPrice));
    }
    
    // Then filter by search query
    if (!query || query.trim() === "") return filtered;
    
    const lowerQuery = query.toLowerCase().trim();
    
    return filtered.filter((listing) => {
        const title = (listing.title || "").toLowerCase();
        const description = (listing.description || "").toLowerCase();
        
        return title.includes(lowerQuery) || description.includes(lowerQuery);
    });
}