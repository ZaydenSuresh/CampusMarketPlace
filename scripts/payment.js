
const params        = new URLSearchParams(window.location.search);
const transactionId = params.get("transactionId") || params.get("transaction_id") || "";

// ─── DOM ──────────────────────────────────────────────────────────────────────
const itemNameEl         = document.getElementById("itemName");
const sellerNameEl       = document.getElementById("sellerName");
const transactionTextEl  = document.getElementById("transactionText");
const itemPriceEl        = document.getElementById("itemPrice");
const totalPriceEl       = document.getElementById("totalPrice");
const selectedMethodText = document.getElementById("selectedMethodText");
const methodOptions      = document.querySelectorAll(".method-option");
const radioButtons       = document.querySelectorAll('input[name="paymentMethod"]');
const paystackDetails    = document.getElementById("paystackDetails");
const cashDetails        = document.getElementById("cashDetails");
const payBtn             = document.getElementById("payBtn");
const paymentMessage     = document.getElementById("paymentMessage");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(amount) {
    return `R ${Number(amount || 0).toFixed(2)}`;
}

function clearMessage() {
    paymentMessage.textContent = "";
    paymentMessage.className   = "";
}

function showMessage(text, type) {
    paymentMessage.textContent = text;
    paymentMessage.className   = type === "success" ? "success-message" : "error-message";
}

function setLoading(loading) {
    payBtn.disabled = loading;
    if (loading) {
        payBtn.textContent = "Processing…";
    } else {
        const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        payBtn.textContent = method === "cash" ? "Confirm Cash Payment" : "Pay Now";
    }
}

// ─── Fetch Transaction from Server ────────────────────────────────────────────
async function loadTransactionDetails() {
    if (!transactionId) {
        showMessage("No transaction specified", "error");
        return;
    }

    try {
        const res = await fetch(`/transactions/${transactionId}`, { credentials: "include" });
        if (!res.ok) {
            showMessage("Failed to load transaction details", "error");
            return;
        }

        const tx = await res.json();

        const listing = Array.isArray(tx.listings) ? tx.listings[0] : tx.listings;

        itemNameEl.textContent        = listing?.title || "Unknown Item";
        sellerNameEl.textContent      = `Seller: ${tx.seller?.name || "Unknown"}`;
        transactionTextEl.textContent = `Transaction: ${tx.id}`;
        itemPriceEl.textContent       = formatPrice(listing?.price || 0);
        totalPriceEl.textContent      = formatPrice(listing?.price || 0);

        window.__paymentPrice = Number(listing?.price || 0);
    } catch (err) {
        showMessage("Network error loading transaction", "error");
    }
}

// ─── Payment Method Switching ─────────────────────────────────────────────────
function updatePaymentMethod(method) {
    // Update active state on radio labels
    methodOptions.forEach((opt) => opt.classList.remove("active"));
    document.querySelector(`input[name="paymentMethod"][value="${method}"]`)
        ?.closest(".method-option")
        ?.classList.add("active");

    // Show / hide detail sections
    paystackDetails.classList.add("hidden");
    cashDetails.classList.add("hidden");

    if (method === "paystack") {
        paystackDetails.classList.remove("hidden");
        selectedMethodText.textContent = "Card (Paystack)";
        payBtn.textContent             = "Pay Now";
    }

    if (method === "cash") {
        cashDetails.classList.remove("hidden");
        selectedMethodText.textContent = "Cash";
        payBtn.textContent             = "Confirm Cash Payment";
    }

    clearMessage();
}

// ─── Pay Button Click ─────────────────────────────────────────────────────────
// Handles the UI side of submission:
//   1. Validates price exists
//   2. If Paystack — opens popup, gets reference
//   3. Dispatches a custom event "payment:submit" with all data needed for the POST
//      so the backend integration can listen and handle the actual fetch call
payBtn.addEventListener("click", async () => {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    const paymentPrice = window.__paymentPrice || 0;

    if (paymentPrice <= 0) {
        showMessage("No payment amount available. Please try again.", "error");
        return;
    }

    clearMessage();
    setLoading(true);

    // Redirect to Paystack's secure checkout page
    if (selectedMethod === "paystack") {
      try {
            // initialize payment with paystack, the request is sent to the backend to get the authorization URL
            const res = await fetch("/payments/initialize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    transaction_id: transactionId,
                    amount_paid: paymentPrice,
                }),
            });

            const data = await res.json();

            if (!data.ok) {
                showMessage(data.message || "Failed to initialize payment", "error");
                setLoading(false);
                return;
            }

            window.location.href = data.authorization_url;
        } catch (_) {
            showMessage("Network error. Please try again.", "error");
            setLoading(false);
        }
        return;
    }

    if (selectedMethod === "cash") {
        document.dispatchEvent(new CustomEvent("payment:submit", {
            detail: {
                transaction_id: transactionId,
                amount_paid:    paymentPrice,
                payment_method: "cash",
            }
        }));
    }
});

// ─── payment:submit Listener ──────────────────────────────────────────────────
// Calls the backend POST /payments/pay when the Pay button dispatches the event
document.addEventListener("payment:submit", async (e) => {
    const detail = e.detail;

    setLoading(true);

    const timeout = setTimeout(() => {
        setLoading(false);
        showMessage("Request timed out. Please try again.", "error");
    }, 15000);

    try {
        const res = await fetch("/payments/pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                transaction_id: detail.transaction_id,
                amount_paid: detail.amount_paid,
                payment_method: detail.payment_method,
                paystack_reference: detail.paystack_reference || undefined,
            }),
        });

        const data = await res.json();

        clearTimeout(timeout);

        if (!data.ok) {
            showMessage(data.message || "Payment failed", "error");
            setLoading(false);
            return;
        }

        showMessage("Payment successful! Redirecting...", "success");
        setTimeout(() => window.location.href = "/student-transactions.html", 1500);
    } catch (err) {
        clearTimeout(timeout);
        showMessage("Network error. Please try again.", "error");
        setLoading(false);
    }
});

// ─── Event Listeners ──────────────────────────────────────────────────────────
radioButtons.forEach((radio) => {
    radio.addEventListener("change", () => updatePaymentMethod(radio.value));
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadTransactionDetails();
updatePaymentMethod("paystack");