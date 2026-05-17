
const params        = new URLSearchParams(window.location.search);
const transactionId = params.get("transactionId") || params.get("transaction_id") || "";


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

// ─── State ────────────────────────────────────────────────────────────────────
let price            = Number(params.get("price") || 0);
let currentUserEmail = "test@witsmarketplace.co.za"; // overwritten by /auth/me

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

// ─── Pre-fill from URL Params (instant, before server responds) ───────────────
function preFill() {
    const item   = params.get("item")   || "Marketplace Item";
    const seller = params.get("seller") || params.get("sellerName") || "";

    itemNameEl.textContent        = item;
    sellerNameEl.textContent      = `Seller: ${seller}`;
    transactionTextEl.textContent = `Transaction: ${transactionId || "Pending"}`;
    itemPriceEl.textContent       = formatPrice(price);
    totalPriceEl.textContent      = formatPrice(price);
}

// ─── Load from Server ─────────────────────────────────────────────────────────
async function loadPaymentDetails() {
    if (!transactionId) {
        showMessage("No transaction ID found in URL.", "error");
        payBtn.disabled = true;
        return;
    }

    // Get logged-in user's email for Paystack popup
    try {
        const authRes = await fetch("/auth/me", { credentials: "include" });
        if (authRes.ok) {
            const authData = await authRes.json();
            currentUserEmail = authData?.user?.email || currentUserEmail;
        }
    } catch (_) { /* silently fall back to placeholder */ }

    // Get payment status for this transaction
    try {
        const res = await fetch(`/payments/${transactionId}`, { credentials: "include" });

        // 404 just means no payment made yet — that's fine, URL params fill the UI
        if (res.status === 404) return;

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showMessage(data.message || "Could not load payment details.", "error");
            return;
        }

        const data = await res.json();

        // Already fully paid — lock the form
        if (data.fully_paid) {
            showMessage("This transaction has already been fully paid.", "success");
            payBtn.disabled    = true;
            payBtn.textContent = "Already Paid";
            return;
        }

        // Outstanding shortfall — update price to remaining balance
        if (data.total_shortfall > 0) {
            price = data.total_shortfall;
            showMessage(`Outstanding shortfall: ${formatPrice(price)}`, "error");
            itemPriceEl.textContent  = formatPrice(price);
            totalPriceEl.textContent = formatPrice(price);
        }

    } catch (err) {
        console.error("Failed to load payment details:", err);
        // Non-fatal — URL params still fill the UI
    }
}

// ─── Payment Method UI ────────────────────────────────────────────────────────
function updatePaymentMethod(method) {
    methodOptions.forEach((opt) => opt.classList.remove("active"));
    document.querySelector(`input[name="paymentMethod"][value="${method}"]`)
        ?.closest(".method-option")
        ?.classList.add("active");

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
// Opens Paystack's hosted iframe. Resolves with reference on success,
// rejects if the user closes/cancels the popup.
function openPaystackPopup(amountToPay) {
    return new Promise((resolve, reject) => {
        const handler = PaystackPop.setup({
            key:      PAYSTACK_PUBLIC_KEY,
            email:    currentUserEmail,
            amount:   Math.round(amountToPay * 100), // rands → kobo/cents
            currency: "ZAR",
            ref:      `WM-${transactionId}-${Date.now()}`,
            onSuccess: (transaction) => resolve(transaction.reference),
            onCancel:  ()            => reject(new Error("Payment cancelled")),
        });
        handler.openIframe();
    });
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function handlePayment() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    if (!transactionId) {
        showMessage("Missing transaction ID.", "error");
        return;
    }

    if (price <= 0) {
        showMessage("No payment amount available. Please try again.", "error");
        return;
    }

    clearMessage();
    setLoading(true);

    try {
        const requestBody = {
            transaction_id:  transactionId,
            amount_paid:     price,
            payment_method:  selectedMethod,
        };

        // Paystack: open popup and get the reference before POSTing
        if (selectedMethod === "paystack") {
            try {
                requestBody.paystack_reference = await openPaystackPopup(price);
            } catch (_) {
                showMessage("Payment was cancelled.", "error");
                setLoading(false);
                return;
            }
        }

        // POST /payments/pay
        const res = await fetch("/payments/pay", {
            method:      "POST",
            credentials: "include",
            headers:     { "Content-Type": "application/json" },
            body:        JSON.stringify(requestBody),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || "Payment failed. Please try again.");
        }

        // Success
        showMessage("Payment confirmed successfully.", "success");
        payBtn.textContent = "Payment Complete";

        setTimeout(() => {
            window.location.href = "/student-transactions.html";
        }, 1500);

    } catch (err) {
        showMessage(err.message || "A network error occurred. Please try again.", "error");
        setLoading(false);
    }
}

// ─── Events ───────────────────────────────────────────────────────────────────
radioButtons.forEach((radio) => {
    radio.addEventListener("change", () => updatePaymentMethod(radio.value));
});

payBtn.addEventListener("click", handlePayment);

// ─── Init ─────────────────────────────────────────────────────────────────────
preFill();
updatePaymentMethod("paystack");
loadPaymentDetails(); // async — updates UI once server responds