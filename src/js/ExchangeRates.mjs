/**
 * ExchangeRates.mjs
 * Fetches and renders live currency exchange rates from Frankfurter API
 */

import { formatCurrency, getLocalStorage, setLocalStorage, showToast } from "./utils.mjs";
import { Favorites } from "./Favorites.mjs";

const BASE_URL = "https://api.frankfurter.dev/v2";

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
};

// Build HTML template for a single currency rate card
function rateCardTemplate(code, rate, baseCurrency) {
    const info = CURRENCIES[code] || { name: code, flag: "💱" };
    const isFav = Favorites.isFavorite("currency", code);
    return `
    <div class="rate-card" data-code="${code}" data-rate="${rate}">
      <div class="rate-card__header">
        <span class="rate-card__flag">${info.flag}</span>
        <div class="rate-card__info">
          <span class="rate-card__code">${code}</span>
          <span class="rate-card__name">${info.name}</span>
        </div>
        <button class="fav-btn ${isFav ? "fav-btn--active" : ""}"
          data-type="currency" data-id="${code}" title="Add to favorites">
          ${isFav ? "★" : "☆"}
        </button>
      </div>
      <div class="rate-card__rate">
        <span class="rate-value" id="rate-${code}">
          ${formatCurrency(rate, code === "JPY" ? 2 : 4)}
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
        this.refreshInterval = null;
    }

    // Initialize: fetch rates and start auto-refresh
    async init() {
        this.showSkeleton();
        await this.fetchRates();
        this.render();
        this.startAutoRefresh();
        this.bindFavoriteButtons();
    }

    // Fetch latest rates from Frankfurter API
    async fetchRates() {
        try {
            const res = await fetch(`${BASE_URL}/latest?from=${this.baseCurrency}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.rates = data.rates;
            this.lastUpdated = new Date();
            setLocalStorage("cw-rates-cache", { rates: this.rates, base: this.baseCurrency, time: Date.now() });
        } catch (err) {
            // Fall back to cached data if available
            const cached = getLocalStorage("cw-rates-cache");
            if (cached && cached.base === this.baseCurrency) {
                this.rates = cached.rates;
                showToast("Using cached rates — could not reach server", "warning");
            } else {
                showToast("Failed to load exchange rates", "error");
            }
        }
    }

    // Render all rate cards
    render() {
        const favCodes = Favorites.getFavorites("currency");
        const allCodes = Object.keys(this.rates).filter(c => CURRENCIES[c]);

        // Sort: favorites first, then alphabetical
        const sorted = [
            ...favCodes.filter(c => allCodes.includes(c)),
            ...allCodes.filter(c => !favCodes.includes(c)).sort(),
        ];

        this.container.innerHTML = sorted
            .map(code => rateCardTemplate(code, this.rates[code], this.baseCurrency))
            .join("");

        this.updateTimestamp();
        this.bindFavoriteButtons();
    }

    // Update only the rate values (for live refresh) with flash animation
    updateRateValues() {
        Object.entries(this.rates).forEach(([code, rate]) => {
            const el = document.getElementById(`rate-${code}`);
            if (!el) return;
            const oldVal = parseFloat(el.dataset.prev || 0);
            const newVal = rate;
            el.dataset.prev = newVal;
            el.textContent = formatCurrency(newVal, code === "JPY" ? 2 : 4);

            // Flash animation on change
            if (oldVal && oldVal !== newVal) {
                const cls = newVal > oldVal ? "flash--up" : "flash--down";
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), 600);
            }
        });
        this.updateTimestamp();
    }

    // Change the base currency and re-fetch
    async setBaseCurrency(code) {
        this.baseCurrency = code;
        this.showSkeleton();
        await this.fetchRates();
        this.render();
    }

    // Filter displayed cards by search query
    filterBySearch(query) {
        const q = query.toLowerCase();
        this.container.querySelectorAll(".rate-card").forEach(card => {
            const code = card.dataset.code.toLowerCase();
            const name = (CURRENCIES[card.dataset.code]?.name || "").toLowerCase();
            card.style.display = code.includes(q) || name.includes(q) ? "" : "none";
        });
    }

    // Auto-refresh every 60 seconds
    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.fetchRates();
            this.updateRateValues();
        }, 60000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    }

    // Show loading skeleton
    showSkeleton() {
        this.container.innerHTML = Array(8).fill(0).map(() => `
      <div class="rate-card rate-card--skeleton">
        <div class="skeleton skeleton--flag"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--rate"></div>
      </div>`).join("");
    }

    updateTimestamp() {
        const el = document.getElementById("rates-updated");
        if (el && this.lastUpdated) {
            el.textContent = `Updated: ${this.lastUpdated.toLocaleTimeString()}`;
        }
    }

    bindFavoriteButtons() {
        this.container.querySelectorAll(".fav-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const { type, id } = btn.dataset;
                Favorites.toggle(type, id);
                this.render();
            });
        });
    }

    // Get the current rates object (used by converter)
    getRates() {
        return this.rates;
    }

    getBaseCurrency() {
        return this.baseCurrency;
    }
}
