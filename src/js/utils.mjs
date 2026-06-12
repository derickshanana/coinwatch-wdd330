/**
 * utils.mjs
 * Shared utility functions for CoinWatch
 * @module utils
 */

/**
 * Retrieve data from localStorage
 * @param {string} key
 * @returns {any}
 */
export function getLocalStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

/**
 * Save data to localStorage
 * @param {string} key
 * @param {any} data
 */
export function setLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        console.warn("localStorage write failed for key:", key);
    }
}

/**
 * Format a number as a currency string
 * @param {number} amount
 * @param {number} decimals
 * @returns {string}
 */
export function formatCurrency(amount, decimals = 2) {
    if (amount === null || amount === undefined || isNaN(amount)) return "N/A";
    return Number(amount).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * Format large numbers with K/M/B suffixes
 * @param {number} num
 * @returns {string}
 */
export function formatLargeNumber(num) {
    if (!num || isNaN(num)) return "N/A";
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toString();
}

/**
 * Get a URL query parameter by name
 * @param {string} param
 * @returns {string|null}
 */
export function getParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Render a list of items into a parent element using a template function
 * @param {Function} templateFn
 * @param {HTMLElement} parentElement
 * @param {Array} list
 * @param {string} position
 * @param {boolean} clear
 */
export function renderListWithTemplate(
    templateFn,
    parentElement,
    list,
    position = "afterbegin",
    clear = false
) {
    if (!parentElement) return;
    const htmlStrings = list.map(templateFn);
    if (clear) {
        parentElement.innerHTML = "";
    }
    parentElement.insertAdjacentHTML(position, htmlStrings.join(""));
}

/**
 * Render a single HTML template string into a parent element
 * @param {string} template - HTML string
 * @param {HTMLElement} parentElement
 * @param {any} data - optional data passed to callback
 * @param {Function} [callback] - optional callback after render
 */
export function renderWithTemplate(template, parentElement, data, callback) {
    if (!parentElement) return;
    parentElement.innerHTML = template;
    if (callback) callback(data);
}

/**
 * Fetch an HTML partial file and return its text content
 * @param {string} path - Path to the partial HTML file
 * @returns {Promise<string>}
 */
export async function loadTemplate(path) {
    const res = await fetch(path);
    const template = await res.text();
    return template;
}

/**
 * Load header and footer partials into the page
 * Injects header.html into #main-header and footer.html into #main-footer
 * @param {Function} [headerCallback] - optional function called after header renders
 */
export async function loadHeaderFooter(headerCallback) {
    const [headerTemplate, footerTemplate] = await Promise.all([
        loadTemplate("/partials/header.html"),
        loadTemplate("/partials/footer.html"),
    ]);

    renderWithTemplate(
        headerTemplate,
        document.getElementById("main-header"),
        null,
        headerCallback || null
    );
    renderWithTemplate(
        footerTemplate,
        document.getElementById("main-footer")
    );
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'info'|'warning'|'error'|'success'} type
 */
export function showToast(message, type = "info") {
    const existing = document.getElementById("cw-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "cw-toast";
    toast.className = `cw-toast cw-toast--${type}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add("cw-toast--visible"));
    });

    setTimeout(() => {
        toast.classList.remove("cw-toast--visible");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

/**
 * Debounce a function call
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
