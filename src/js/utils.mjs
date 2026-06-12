/**
 * utils.mjs
 * Shared utility functions for CoinWatch
 */

// Retrieve data from localStorage
export function getLocalStorage(key) {
    return JSON.parse(localStorage.getItem(key));
}

// Save data to localStorage
export function setLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Format a number as currency string
export function formatCurrency(amount, decimals = 2) {
    if (amount === null || amount === undefined) return "N/A";
    return Number(amount).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

// Format large numbers with K/M/B suffixes
export function formatLargeNumber(num) {
    if (!num) return "N/A";
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toString();
}

// Get URL query parameter
export function getParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Render a list using a template function
export function renderListWithTemplate(
    templateFn,
    parentElement,
    list,
    position = "afterbegin",
    clear = false
) {
    const htmlStrings = list.map(templateFn);
    if (clear) {
        parentElement.innerHTML = "";
    }
    parentElement.insertAdjacentHTML(position, htmlStrings.join(""));
}

// Show a toast notification
export function showToast(message, type = "info") {
    const existing = document.getElementById("cw-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "cw-toast";
    toast.className = `cw-toast cw-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add("cw-toast--visible"));

    setTimeout(() => {
        toast.classList.remove("cw-toast--visible");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
