const express = require("express");
const router = express.Router();

const { createSupabaseClient } = require("../lib/supabase");

// GET /seller-history/:userId
router.get("/:userId", async (req, res) => {
  try {
    const supabase = createSupabaseClient(req, res);
    const { userId } = req.params;

    // Get seller profile
    const { data: seller, error: sellerError } = await supabase
      .from("profiles")
      .select("id, name, created_at")
      .eq("id", userId)
      .single();

    if (sellerError || !seller) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    // 2. Get completed transactions for this seller
    // Avoided Supabase joins because schema relationship names are causing errors.
    const { data: transactions, error: transactionsError } = await supabase
      .from("transactions")
      .select("id, created_at, buyer_id, listing_id, seller_id, status")
      .eq("seller_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (transactionsError) {
      throw transactionsError;
    }

    // Get ratings for this seller, excluding removed reviews
    const { data: ratings, error: ratingsError } = await supabase
      .from("ratings")
      .select("id, rater_id, rated_id, rating, review, created_at, flagged, removed")
      .eq("rated_id", userId)
      .or("removed.is.null,removed.eq.false")
      .order("created_at", { ascending: false });

    if (ratingsError) {
      throw ratingsError;
    }

    // Fetch listing details manually
    const listingIds = [
      ...new Set((transactions || []).map((t) => t.listing_id).filter(Boolean)),
    ];

    let listings = [];

    if (listingIds.length > 0) {
      const { data: listingData, error: listingsError } = await supabase
        .from("listings")
        .select("id, title, price, image_url")
        .in("id", listingIds);

      if (listingsError) {
        throw listingsError;
      }

      listings = listingData || [];
    }

    // Fetch buyer profiles manually
    const buyerIds = [
      ...new Set((transactions || []).map((t) => t.buyer_id).filter(Boolean)),
    ];

    let buyers = [];

    if (buyerIds.length > 0) {
      const { data: buyerData, error: buyersError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", buyerIds);

      if (buyersError) {
        throw buyersError;
      }

      buyers = buyerData || [];
    }

    // Fetch reviewer profiles manually
    const reviewerIds = [
      ...new Set((ratings || []).map((r) => r.rater_id).filter(Boolean)),
    ];

    let reviewers = [];

    if (reviewerIds.length > 0) {
      const { data: reviewerData, error: reviewersError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", reviewerIds);

      if (reviewersError) {
        throw reviewersError;
      }

      reviewers = reviewerData || [];
    }

    // Calculate average rating
    const totalRatings = (ratings || []).length;

    const averageRating =
      totalRatings === 0
        ? 0
        : Number(
            (
              ratings.reduce((sum, item) => sum + Number(item.rating), 0) /
              totalRatings
            ).toFixed(2)
          );

    // Format completed transactions for frontend
    const completedTransactions = (transactions || []).map((transaction) => {
      const listing = listings.find((l) => l.id === transaction.listing_id);
      const buyer = buyers.find((b) => b.id === transaction.buyer_id);

      return {
        id: transaction.id,
        item_title: listing?.title || "Unknown item",
        item_price: listing?.price || 0,
        item_image: listing?.image_url || "",
        buyer_name: buyer?.name || "Unknown buyer",
        date: transaction.created_at,
      };
    });

    // Format reviews for frontend
    const formattedReviews = (ratings || []).map((item) => {
      const reviewer = reviewers.find((r) => r.id === item.rater_id);

      return {
        id: item.id,
        reviewer_name: reviewer?.name || "Anonymous user",
        rating: item.rating,
        review: item.review || "",
        date: item.created_at,
        flagged: item.flagged || false,
      };
    });

    return res.json({
      ok: true,
      seller: {
        id: seller.id,
        name: seller.name || "Unknown seller",
        member_since: seller.created_at,
      },
      rating: {
        average: averageRating,
        total: totalRatings,
      },
      reviews: formattedReviews,
      completed_transactions: completedTransactions,
    });
  } catch (error) {
    console.error("Seller history error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to load seller history",
      details: error.message,
    });
  }
});

module.exports = router;