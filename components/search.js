// components/search.js

/**
 * Filters listings by search query and category
 * @param {Array} listings
 * @param {string} query
 * @param {string} category - "All" or specific category name
 * @returns {Array}
 */
export function filterListings(listings, query, category = 'All') {
    if (!Array.isArray(listings)) return [];
    
    let filtered = listings;
    
    // Filter by category first (if not "All")
    if (category && category !== 'All') {
        filtered = filtered.filter(listing => listing.category === category);
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