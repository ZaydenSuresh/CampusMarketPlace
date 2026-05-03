import { requireRole, logoutUser } from "/scripts/auth.js";

// Chart instances (kept in scope to destroy before re-rendering)
let trendsChart = null;
let categoryChart = null;
let pieChart = null;
let currentPeriod = "week";

/**
 * Initialize the page
 * Checks admin access, then loads all dashboard data
 */
async function initPage() {
  const user = await requireRole(["Admin"]);
  if (!user) return;

  const welcomeEl = document.getElementById("welcome-name");
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome, ${user.name}`;
  }

  loadSummary();
  loadTrends(currentPeriod);
  loadCategories();
}

/**
 * Load summary statistics from /analytics/summary
 * Updates the 3 stat cards: total transactions, total value, avg/day
 */
async function loadSummary() {
  try {
    const response = await fetch("/analytics/summary");
    const result = await response.json();

    if (result.ok) {
      document.getElementById("total-transactions").textContent = result.total_transactions;
      document.getElementById("total-value").textContent = `R${result.total_value.toFixed(2)}`;
      document.getElementById("avg-per-day").textContent = `R${result.avg_per_day.toFixed(2)}`;
    }
  } catch (error) {
    console.error("Error loading summary:", error);
  }
}

/**
 * Load transaction trends from /analytics/transactions?period=X
 * Renders a line chart showing completed transactions over time
 * 
 * @param {string} period - "day", "week", or "month"
 */
async function loadTrends(period) {
  try {
    const response = await fetch(`/analytics/transactions?period=${period}`);
    const result = await response.json();

    if (result.ok) {
      renderTrendsChart(result.labels, result.data, period);
    }
  } catch (error) {
    console.error("Error loading trends:", error);
  }
}

/**
 * Render the line chart for transaction trends
 *
 * @param {string[]} labels - X-axis labels (dates/weeks/months)
 * @param {number[]} data - Y-axis values (transaction counts)
 * @param {string} period - Used for chart label
 */
function renderTrendsChart(labels, data, period) {
  const ctx = document.getElementById("trendsChart").getContext("2d");

  // Destroy previous chart instance to prevent canvas reuse error
  if (trendsChart) {
    trendsChart.destroy();
  }

  trendsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: `Completed Transactions (by ${period})`,
        data: data,
        borderColor: "#003b7e",
        backgroundColor: "rgba(0, 59, 126, 0.1)",
        tension: 0.3, // Smooth curve
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: "#003b7e",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          title: {
            display: true,
            text: "Completed Transactions",
            font: { size: 12, weight: "bold" },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
        x: {
          title: {
            display: true,
            text: "Time Period",
            font: { size: 12, weight: "bold" },
          },
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y}`;
            },
          },
        },
      },
    },
  });
}

/**
 * Load popular categories from /analytics/categories
 * Renders a horizontal bar chart + pie chart for value distribution
 */
async function loadCategories() {
  try {
    const response = await fetch("/analytics/categories");
    const result = await response.json();

    if (result.ok) {
      renderCategoryChart(result.categories);
      renderPieChart(result.categories);
    } else {
      console.error("Categories API error:", result.message);
    }
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

/**
 * Render horizontal bar chart for popular categories
 * 
 * @param {Object[]} categories - Array of { category, count, total_value }
 */
function renderCategoryChart(categories) {
  const ctx = document.getElementById("categoryChart").getContext("2d");
  const labels = categories.map(c => c.category);
  const counts = categories.map(c => c.count);

  // Destroy previous chart instance
  if (categoryChart) {
    categoryChart.destroy();
  }

   // Horizontal bar chart (indexAxis: "y")
  categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Transactions",
        data: counts,
        backgroundColor: "#c9a84c",
        borderColor: "#a88630",
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y", // Horizontal bars
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          title: {
            display: true,
            text: "Number of Transactions",
            font: { size: 12, weight: "bold" }
          },
          grid: {
            color: "rgba(0, 0, 0, 0.05)"
          }
        },
        y: {
          title: {
            display: true,
            text: "Category",
            font: { size: 12, weight: "bold" }
          },
          grid: {
            color: "rgba(0, 0, 0, 0.05)"
          }
        }
      },
    },
  });
}

/**
 * Render pie chart showing top 5 categories by total value + "Other" group
 *
 * @param {Object[]} categories - Array of { category, count, total_value }
 */
function renderPieChart(categories) {
  const ctx = document.getElementById("pieChart").getContext("2d");

  // Destroy previous chart instance
  if (pieChart) {
    pieChart.destroy();
  }

  // Sort by total_value descending, take top 5, group rest as "Other"
  const sorted = [...categories].sort((a, b) => b.total_value - a.total_value);
  const top5 = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  const labels = top5.map(c => c.category);
  const values = top5.map(c => c.total_value);

  // Add "Other" category if there are more than 5
  if (rest.length > 0) {
    const otherValue = rest.reduce((sum, c) => sum + c.total_value, 0);
    labels.push("Other");
    values.push(otherValue);
  }

  // Color palette for pie slices
  const colors = [
    "#003b7e", "#c9a84c", "#4ade80", "#f87171", "#60a5fa", "#a78bfa"
  ];

  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: "#ffffff",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b,0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return ` R${context.parsed.toFixed(2)} (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Export analytics data as CSV files
 * Downloads:
 * 1. transactions.csv - Raw completed transactions
 * 2. categories.csv - Popular categories with counts and total value
 */
async function exportCSV() {
  try {
    // Fetch both datasets in parallel
    const [txResponse, catResponse] = await Promise.all([
      fetch("/analytics/export"),
      fetch("/analytics/categories"),
    ]);

    const txResult = await txResponse.json();
    const catResult = await catResponse.json();

    // Export transactions CSV
    if (txResult.ok && txResult.transactions) {
      let txCSV = "Date,Listing Title,Category,Price,Buyer Name,Seller Name\n";
      txResult.transactions.forEach(tx => {
        const date = tx.created_at ? tx.created_at.split("T")[0] : "";
        const title = (tx.listings?.title || "").replace(/"/g, '""');
        const category = tx.listings?.category || "Uncategorized";
        const price = tx.listings?.price || 0;
        const buyer = (tx.buyer?.name || tx.buyer_id || "").replace(/"/g, '""');
        const seller = (tx.seller?.name || tx.seller_id || "").replace(/"/g, '""');
        txCSV += `"${date}","${title}",${category},${price},"${buyer}","${seller}"\n`;
      });
      downloadCSV(txCSV, "transactions.csv");
    }

    // Export categories CSV
    if (catResult.ok) {
      let catCSV = "Category,Transaction Count,Total Value\n";
      catResult.categories.forEach(c => {
        catCSV += `${c.category},${c.count},${c.total_value.toFixed(2)}\n`;
      });
      downloadCSV(catCSV, "categories.csv");
    }
  } catch (error) {
    console.error("Error exporting CSV:", error);
  }
}

/**
 * Helper: Trigger CSV file download
 * 
 * @param {string} csvContent - CSV string
 * @param {string} filename - Download filename
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Setup event listeners
 */
document.querySelectorAll(".period-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentPeriod = btn.dataset.period;
    loadTrends(currentPeriod);
  });
});

if (document.getElementById("export-btn")) {
  document.getElementById("export-btn").addEventListener("click", exportCSV);
}

if (document.getElementById("logout-btn")) {
  document.getElementById("logout-btn").addEventListener("click", logoutUser);
}

// Initialize the page when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
