/**
 * ExchangeRates.mjs
 * Fetches and renders live currency exchange rates from Frankfurter API
 * API: https://api.frankfurter.dev/v1 (stable, free, no key required)
 */

import { formatCurrency, getLocalStorage, setLocalStorage, showToast } from "./utils.mjs";
import { Favorites } from "./Favorites.mjs";

// ✅ Correct base URL — v1 is the stable endpoint (same as legacy frankfurter.app)
const BASE_URL = "https://api.frankfurter.dev/v1";

// Supported currencies with display names and flag emojis
const CURRENCIES = {
    USD: { name: "US Dollar", flag: "🇺🇸" },
    EUR: { name: "Euro", flag: "🇪🇺" },
    GBP: { name: "British Pound", flag: "🇬🇧" },
    JPY: { name: "Japanese Yen", flag: "🇯🇵" },
    CAD: { name: "Canadian Dollar", flag: "🇨🇦" },
    AUD: { name: "Australian Dollar", flag: "🇦🇺" },
    CHF: { name: "Swiss Franc", flag: "🇨🇭" },
    CNY: { name: "Chinese Yuan", flag: "🇨🇳" },
    ZAR: { name: "South African Rand", flag: "🇿🇦" },
    INR: { name: "Indian Rupee", flag: "🇮🇳" },
    BRL: { name: "Brazilian Real", flag: "🇧🇷" },
    MXN: { name: "Mexican Peso", flag: "🇲🇽" },
    SGD: { name: "Singapore Dollar", flag: "🇸🇬" },
    NZD: { name: "New Zealand Dollar", flag: "🇳🇿" },
    SEK: { name: "Swedish Krona", flag: "🇸🇪" },
    NOK: { name: "Norwegian Krone", flag: "🇳🇴" },
    HKD: { name: "Hong Kong Dollar", flag: "🇭🇰" },
    DKK: { name: "Danish Krone", flag: "🇩🇰" },
};

/**
 * Build HTML template for a single currency rate card
 * @param {string} code - Currency code e.g. "EUR"
 * @param {number} rate - Numeric rate value
 * @param {string} baseCurrency - Base currency code
 */
function rateCardTemplate(code, rate, baseCurrency) {
    const info = CURRENCIES[code] || { name: code, flag: "💱" };
    const isFav = Favorites.isFavorite("currency", code);
    const decimals = code === "JPY" || code === "INR" ? 2 : 4;

    return `
  <div class="rate-card" data-code="${code}" data-rate="${rate}" role="listitem" tabindex="0"
       aria-label="${info.name} exchange rate">
    <div class="rate-card__header">
      <span class="rate-card__flag" aria-hidden="true">${info.flag}</span>
      <div class="rate-card__info">
        <span class="rate-card__code">${code}</span>
        <span class="rate-card__name">${info.name}</span>
      </div>
      <button class="fav-btn ${isFav ? "fav-btn--active" : ""}"
        data-type="currency" data-id="${code}"
        title="${isFav ? "Remove from favorites" : "Add to favorites"}"
        aria-label="${isFav ? "Remove" : "Add"} ${code} ${isFav ? "from" : "to"} favorites"
        aria-pressed="${isFav}">
        ${isFav ? "★" : "☆"}
      </button>
    </div>
    <div class="rate-card__rate">
      <span class="rate-value" id="rate-${code}" data-prev="${rate}">
        ${formatCurrency(rate, decimals)}
      </span>
      <span class="rate-card__base">per 1 ${baseCurrency}</span>
    </div>
  </div>`;
}

export default class ExchangeRates {
    constructor(containerEl) {
        this.container = containerEl;
        this.baseCurrency = "USD";
        this.rates = {};
        this.lastUpdated = null;
        this.refreshInterval = null;
    }

    /** Initialize: fetch rates and start auto-refresh */
    async init() {
        this.showSkeleton();
        await this.fetchRates();
        this.render();
        this.startAutoRefresh();
    }

    /**
     * Fetch latest rates from Frankfurter API
     * Endpoint: GET /v1/latest?base=USD
     * Response: { amount, base, date, rates: { EUR: 0.92, GBP: 0.79, ... } }
     */
    async fetchRates() {
        try {
            const res = await fetch(`${BASE_URL}/latest?base=${this.baseCurrency}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const data = await res.json();

            // v1 response: data.rates is a flat object of code → rate
            this.rates = data.rates;
            this.lastUpdated = new Date();
            setLocalStorage("cw-rates-cache", {
                rates: this.rates,
                base: this.baseCurrency,
                time: Date.now(),
            });
        } catch (err) {
            console.error("ExchangeRates fetch error:", err);
            // Fall back to cached data
            const cached = getLocalStorage("cw-rates-cache");
            if (cached && cached.base === this.baseCurrency) {
                this.rates = cached.rates;
                this.lastUpdated = new Date(cached.time);
                showToast("Using cached rates — could not reach server", "warning");
            } else {
                showToast("Failed to load exchange rates", "error");
            }
        }
    }

    /** Render all rate cards, favourites first then alphabetical */
    render() {
        if (!this.rates || Object.keys(this.rates).length === 0) {
            this.container.innerHTML = `
        <div class="empty-state">
          <span aria-hidden="true">⚠️</span>
          <p>Could not load exchange rates. Check your connection and try again.</p>
        </div>`;
            return;
        }

        const favCodes = Favorites.getFavorites("currency");
        const allCodes = Object.keys(this.rates).filter((c) => CURRENCIES[c]);

        // Favorites first, then remaining sorted alphabetically
        const sorted = [
            ...favCodes.filter((c) => allCodes.includes(c)),
            ...allCodes.filter((c) => !favCodes.includes(c)).sort(),
        ];

        this.container.innerHTML = sorted
            .map((code) => rateCardTemplate(code, this.rates[code], this.baseCurrency))
            .join("");

        this.updateTimestamp();
        this.bindFavoriteButtons();
    }

    /**
     * Update only the numeric values in-place with flash animation.
     * Avoids full re-render on auto-refresh to prevent layout shift.
     */
    updateRateValues() {
        Object.entries(this.rates).forEach(([code, rate]) => {
            const el = document.getElementById(`rate-${code}`);
            if (!el) return;

            const oldVal = parseFloat(el.dataset.prev || 0);
            const decimals = code === "JPY" || code === "INR" ? 2 : 4;
            el.dataset.prev = rate;
            el.textContent = formatCurrency(rate, decimals);

            // Flash animation only when value actually changed
            if (oldVal && oldVal !== rate) {
                const cls = rate > oldVal ? "flash--up" : "flash--down";
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), 600);
            }
        });
        this.updateTimestamp();
    }

    /** Change the base currency and re-fetch */
    async setBaseCurrency(code) {
        this.baseCurrency = code;
        this.showSkeleton();
        await this.fetchRates();
        this.render();
    }

    /** Filter displayed cards by search query */
    filterBySearch(query) {
        const q = query.toLowerCase().trim();
        this.container.querySelectorAll(".rate-card").forEach((card) => {
            const code = card.dataset.code.toLowerCase();
            const name = (CURRENCIES[card.dataset.code]?.name || "").toLowerCase();
            card.style.display = !q || code.includes(q) || name.includes(q) ? "" : "none";
        });
    }

    /** Auto-refresh every 60 seconds */
    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.fetchRates();
            this.updateRateValues();
        }, 60_000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    }

    /** Show skeleton loading placeholders */
    showSkeleton() {
        this.container.innerHTML = Array(8)
            .fill(0)
            .map(
                () => `
      <div class="rate-card rate-card--skeleton" aria-hidden="true">
        <div class="skeleton skeleton--flag"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--rate"></div>
      </div>`
            )
            .join("");
    }

    updateTimestamp() {
        const el = document.getElementById("rates-updated");
        if (el && this.lastUpdated) {
            el.textContent = `Updated: ${this.lastUpdated.toLocaleTimeString()}`;
        }
    }

    bindFavoriteButtons() {
        this.container.querySelectorAll(".fav-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const { type, id } = btn.dataset;
                Favorites.toggle(type, id);
                this.render();
            });
        });
    }

    /** Get the current rates object (used by converter) */
    getRates() {
        return this.rates;
    }

    getBaseCurrency() {
        return this.baseCurrency;
    }
}
