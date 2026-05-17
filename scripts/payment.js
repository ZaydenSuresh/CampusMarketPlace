
const params        = new URLSearchParams(window.location.search);
const transactionId = params.get("transactionId") || params.get("transaction_id") || "";
const item          = params.get("item")           || "Marketplace Item";
const seller        = params.get("seller")         || params.get("sellerName") || "";
const price         = Number(params.get("price")   || 0);

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

// ─── Paystack Public Key ──────────────────────────────────────────────────────
const PAYSTACK_PUBLIC_KEY = "pk_test_ca823faa0dfc20a53b408f5b895c682d512f413b";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPrice(amount) {
    return `R ${Number(amount || 0).toFixed(2)}`;
}

export function clearMessage() {
    paymentMessage.textContent = "";
    paymentMessage.className   = "";
}

export function showMessage(text, type) {
    paymentMessage.textContent = text;
    paymentMessage.className   = type === "success" ? "success-message" : "error-message";
}

export function setLoading(loading) {
    payBtn.disabled = loading;
    if (loading) {
        payBtn.textContent = "Processing…";
    } else {
        const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        payBtn.textContent = method === "cash" ? "Confirm Cash Payment" : "Pay Now";
    }
}

// ─── Populate Page from URL Params ────────────────────────────────────────────
function loadPageDetails() {
    itemNameEl.textContent        = item;
    sellerNameEl.textContent      = `Seller: ${seller}`;
    transactionTextEl.textContent = `Transaction: ${transactionId || "Pending"}`;
    itemPriceEl.textContent       = formatPrice(price);
    totalPriceEl.textContent      = formatPrice(price);
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

// ─── Paystack Popup ───────────────────────────────────────────────────────────
// Opens Paystack's hosted iframe. Resolves with the reference string on success,
// rejects if the user closes / cancels the popup.
// Called by whoever handles the submit (backend dev or integration point).
export function openPaystackPopup() {
    const email = localStorage.getItem("email") || "test@witsmarketplace.co.za";

    return new Promise((resolve, reject) => {
        const handler = PaystackPop.setup({
            key:      PAYSTACK_PUBLIC_KEY,
            email,
            amount:   Math.round(price * 100), // rands → kobo/cents
            currency: "ZAR",
            ref:      `WM-${transactionId}-${Date.now()}`,
            onSuccess: (transaction) => resolve(transaction.reference),
            onCancel:  ()            => reject(new Error("Payment cancelled")),
        });
        handler.openIframe();
    });
}

// ─── Pay Button Click ─────────────────────────────────────────────────────────
// Handles the UI side of submission:
//   1. Validates price exists
//   2. If Paystack — opens popup, gets reference
//   3. Dispatches a custom event "payment:submit" with all data needed for the POST
//      so the backend integration can listen and handle the actual fetch call
payBtn.addEventListener("click", async () => {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    if (price <= 0) {
        showMessage("No payment amount available. Please try again.", "error");
        return;
    }

    clearMessage();
    setLoading(true);

    if (selectedMethod === "paystack") {
        let reference;
        try {
            reference = await openPaystackPopup();
        } catch (_) {
            showMessage("Payment was cancelled.", "error");
            setLoading(false);
            return;
        }

        // Dispatch event with everything needed for the POST
        document.dispatchEvent(new CustomEvent("payment:submit", {
            detail: {
                transaction_id:     transactionId,
                amount_paid:        price,
                payment_method:     "paystack",
                paystack_reference: reference,
            }
        }));
        return;
    }

    if (selectedMethod === "cash") {
        document.dispatchEvent(new CustomEvent("payment:submit", {
            detail: {
                transaction_id: transactionId,
                amount_paid:    price,
                payment_method: "cash",
            }
        }));
    }
});

// ─── Event Listeners ──────────────────────────────────────────────────────────
radioButtons.forEach((radio) => {
    radio.addEventListener("change", () => updatePaymentMethod(radio.value));
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadPageDetails();
updatePaymentMethod("paystack");