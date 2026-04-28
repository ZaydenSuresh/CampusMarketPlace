const API = "http://localhost:3000";

const bought = document.getElementById("bought-container");
const sold = document.getElementById("sold-container");

async function loadHistory() {

const userId = localStorage.getItem("userId");

const res = await fetch(`${API}/history/${userId}`);
const data = await res.json();

renderBought(data.bought);
renderSold(data.sold);
}

function renderBought(items){

if(!items.length){
bought.innerHTML = "<p>No completed purchases.</p>";
return;
}

bought.innerHTML = "";

items.forEach(t=>{

const card = document.createElement("article");
card.className = "history-card";

card.innerHTML = `
<h4>${t.title}</h4>
<p>Seller: ${t.seller_name}</p>
<p>Date: ${t.created_at}</p>

<button class="rate-btn"
onclick="location.href='/rate-user.html?transactionId=${t.id}&sellerId=${t.seller_id}'">
Rate Seller
</button>
`;

bought.appendChild(card);

});

}

function renderSold(items){

if(!items.length){
sold.innerHTML = "<p>No completed sales.</p>";
return;
}

sold.innerHTML = "";

items.forEach(t=>{

const card = document.createElement("article");
card.className = "history-card";

card.innerHTML = `
<h4>${t.title}</h4>
<p>Buyer: ${t.buyer_name}</p>
<p>Date: ${t.created_at}</p>
`;

sold.appendChild(card);

});

}

loadHistory();