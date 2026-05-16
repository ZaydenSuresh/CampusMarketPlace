import { requireRole, logoutUser } from "/scripts/auth.js";

let allReviews = [];

const tableBody = document.getElementById("moderation-table-body");
const filterButtons = document.querySelectorAll(".filter-btn");
const logoutBtn = document.getElementById("logout-btn");

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function getReviewId(review) {
    return review.id || review.rating_id;
}

function getReviewerName(review) {
    return (
        review.reviewer_name ||
        review.rater_name ||
        review.rater?.name ||
        review.profiles?.name ||
        "Unknown reviewer"
    );
}

function getReviewedUserName(review) {
    return (
        review.reviewed_user_name ||
        review.rated_user_name ||
        review.rated_name ||
        review.rated?.name ||
        "Unknown user"
    );
}

function getItemTitle(review) {
    return (
        review.item_title ||
        review.listing_title ||
        review.transactions?.listings?.title ||
        review.listings?.title ||
        "Unknown item"
    );
}

function getReviewText(review) {
    return review.review || review.review_text || "";
}

function getStatus(review) {
    if (review.removed) return "removed";
    if (review.flagged) return "flagged";
    return "clean";
}

function getStatusBadge(review) {
    const status = getStatus(review);

    if (status === "removed") {
        return `<span class="status-badge status-removed">Removed</span>`;
    }

    if (status === "flagged") {
        return `<span class="status-badge status-flagged">Flagged</span>`;
    }

    return `<span class="status-badge status-clean">Clean</span>`;
}

function getActions(review) {
    const id = getReviewId(review);
    const status = getStatus(review);

    if (status === "removed") {
        return `
            <button class="small-btn done-action" disabled>
                Done
            </button>
        `;
    }

    if (status === "flagged") {
        return `
            <button class="small-btn safe-action" data-action="mark-safe" data-id="${id}">
                Mark Safe
            </button>

            <button class="small-btn remove-action" data-action="remove" data-id="${id}">
                Remove
            </button>
        `;
    }

    return `
        <button class="small-btn flag-action" data-action="flag" data-id="${id}">
            Flag
        </button>
    `;
}

function filterReviews(filter) {
    if (filter === "flagged") {
        return allReviews.filter((review) => review.flagged === true && review.removed !== true);
    }

    if (filter === "removed") {
        return allReviews.filter((review) => review.removed === true);
    }

    return allReviews;
}

function renderTable(filter = "all") {
    const reviews = filterReviews(filter);

    if (!reviews || reviews.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">No reviews found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = reviews
        .map((review) => {
            return `
                <tr>
                    <td>${escapeHtml(getReviewerName(review))}</td>
                    <td>${escapeHtml(getReviewedUserName(review))}</td>
                    <td>${escapeHtml(getItemTitle(review))}</td>
                    <td>★ ${escapeHtml(review.rating || "N/A")}</td>
                    <td class="review-text" title="${escapeHtml(getReviewText(review))}">
                        ${escapeHtml(getReviewText(review) || "No review text")}
                    </td>
                    <td>${getStatusBadge(review)}</td>
                    <td>
                        <div class="action-group">
                            ${getActions(review)}
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

async function loadModerationReviews() {
    try {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">Loading reviews...</td>
            </tr>
        `;

        const response = await fetch("/ratings/moderation");
        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Failed to load moderation reviews");
        }

        allReviews = data.ratings || [];
        renderTable("all");
    } catch (error) {
        console.error("Moderation load error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Failed to load reviews
                </td>
            </tr>
        `;

        alert(error.message || "Failed to load reviews");
    }
}

async function updateReview(action, id) {
    let endpoint = "";

    if (action === "flag") {
        endpoint = `/ratings/${id}/flag`;
    }

    if (action === "mark-safe") {
        endpoint = `/ratings/${id}/mark-safe`;
    }

    if (action === "remove") {
        const confirmed = confirm("Are you sure you want to remove this review?");
        if (!confirmed) return;

        endpoint = `/ratings/${id}/remove`;
    }

    if (!endpoint) return;

    try {
        const response = await fetch(endpoint, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
            throw new Error(data.error || "Failed to update review");
        }

        await loadModerationReviews();
    } catch (error) {
        console.error("Moderation action error:", error);
        alert(error.message || "Failed to update review");
    }
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        renderTable(button.dataset.filter);
    });
});

tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!id) {
        alert("Missing review ID");
        return;
    }

    button.disabled = true;
    await updateReview(action, id);
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", logoutUser);
}

async function initPage() {
    const user = await requireRole(["Admin"]);
    if (!user) return;

    await loadModerationReviews();
}

initPage();