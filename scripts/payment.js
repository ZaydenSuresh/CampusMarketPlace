//read query params from page url
const params        = new URLSearchParams(window.location.search);
const transactionId = params.get("transactionId") || params.get("transaction_id") || "";//get transaction id from url
const itemNameEl         = document.getElementById("itemName");//display item name
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

//format number as SA currency
function formatPrice(amount) {
    return `R ${Number(amount || 0).toFixed(2)}`;
}
//clear any msg currently shown
function clearMessage() {
    paymentMessage.textContent = "";
    paymentMessage.className   = "";
}
//show sccucess/error msg
function showMessage(text, type) {
    paymentMessage.textContent = text;
    paymentMessage.className   = type === "success" ? "success-message" : "error-message";//aplly css class depending on msg type
}
//enable/disable payment btn while request=pend
function setLoading(loading) {
    payBtn.disabled = loading;
    if (loading) {
        payBtn.textContent = "Processing…";//show loading text while payment is being processed
    } else {//restore btn text based on selected payment method
        const method = document.querySelector('input[name="paymentMethod"]:checked')?.value;
        payBtn.textContent = method === "cash" ? "Confirm Cash Payment" : "Pay Now";
    }
}
//fetch transaction from server
async function loadTransactionDetails() {//load transaction details from backend using transactionid
    if (!transactionId) {//stop when transaction id not found in url
        showMessage("No transaction specified", "error");
        return;
    }

    try {
        const res = await fetch(`/transactions/${transactionId}`, { credentials: "include" });//request transaction details from backend
        if (!res.ok) {//show message when error from server
            showMessage("Failed to load transaction details", "error");
            return;
        }
        //conv repsonse into js obj
        const tx = await res.json();
        //some api return listing as array/obj, this handles both
        const listing = Array.isArray(tx.listings) ? tx.listings[0] : tx.listings;
        //fill page w transacton/listing deets
        itemNameEl.textContent        = listing?.title || "Unknown Item";
        sellerNameEl.textContent      = `Seller: ${tx.seller?.name || "Unknown"}`;
        transactionTextEl.textContent = `Transaction: ${tx.id}`;
        itemPriceEl.textContent       = formatPrice(listing?.price || 0);
        totalPriceEl.textContent      = formatPrice(listing?.price || 0);
        window.__paymentPrice = Number(listing?.price || 0);
    } catch (err) {//handle network errors, server downtime/failed req
        showMessage("Network error loading transaction", "error");
    }
}
//update ui when user select diff pay method
function updatePaymentMethod(method) {
    // Update active state on radio labels
    methodOptions.forEach((opt) => opt.classList.remove("active"));//remove active styling from payment opts
    //acrive styling to selected payment opt
    const selectedRadio = document.querySelector(//find radio btn for selcted
    `input[name="paymentMethod"][value="${method}"]`
);
//find payment opt container wrapping radio btn
const selectedOption = selectedRadio.closest(".method-option");
//selected pay=active=highlighted
selectedOption.classList.add("active");

    // Show / hide detail sections//hide both payment deets first
    paystackDetails.classList.add("hidden");
    cashDetails.classList.add("hidden");
//if paystack selected
    if (method === "paystack") {
        paystackDetails.classList.remove("hidden");
        selectedMethodText.textContent = "Card (Paystack)";
        payBtn.textContent             = "Pay Now";
    }
//if cash selcted
    if (method === "cash") {
        cashDetails.classList.remove("hidden");
        selectedMethodText.textContent = "Cash";
        payBtn.textContent             = "Confirm Cash Payment";
    }

    clearMessage();
}
//run when payment btn clicked
payBtn.addEventListener("click", async () => {
  //get current selected payment method
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
                credentials: "include",//cookies, session info
                body: JSON.stringify({//js obj->json txt
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
        } //ck pg
        catch (_) {
            showMessage("Network error. Please try again.", "error");
            setLoading(false);
        }
        return;
    }

    if (selectedMethod === "cash") {
      //paym submission logic=seperate
        document.dispatchEvent(new CustomEvent("payment:submit", {
            detail: {
                transaction_id: transactionId,
                amount_paid:    paymentPrice,
                payment_method: "cash",
            }
        }));
    }
});

document.addEventListener("payment:submit", async (e) => {
    const detail = e.detail;//paym deets from cust event
    setLoading(true);//disable subm bn while subm payent
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
//update paym method section when user changes method
radioButtons.forEach((radio) => {
    radio.addEventListener("change", () => updatePaymentMethod(radio.value));
});

loadTransactionDetails();
updatePaymentMethod("paystack");