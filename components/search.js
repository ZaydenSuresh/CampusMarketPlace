// components/search.js

/**
 * Filters listings by search query
 * @param {Array} listings
 * @param {string} query
 * @returns {Array}
 */
export function filterListings(listings, query) {
    if (!Array.isArray(listings)) return [];
    if (!query || query.trim() === "") return listings;

    const lowerQuery = query.toLowerCase().trim();

    return listings.filter((listing) => {
        const title = (listing.title || "").toLowerCase();
        const description = (listing.description || "").toLowerCase();

        return title.includes(lowerQuery) || description.includes(lowerQuery);
    });
}