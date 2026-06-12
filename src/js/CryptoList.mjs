/**
 * CryptoList.mjs
 * Fetches and renders cryptocurrency data from CoinGecko public API
 * Endpoint: GET https://api.coingecko.com/api/v3/coins/markets
 */

import {
    formatCurrency,
    formatLargeNumber,
    getLocalStorage,
    setLocalStorage,
    showToast,
} from "./utils.mjs";
import { Favorites } from "./Favorites.mjs";

const COINGECKO_URL = "https://api.coingecko.com/api/v3";

/**
 * Template for a single crypto coin card
 * @param {Object} coin - CoinGecko market data object
 */
function coinCardTemplate(coin) {
    const change = coin.price_change_percentage_24h || 0;
    const changeClass = change >= 0 ? "change--up" : "change--down";
    const changeSign = change >= 0 ? "▲" : "▼";
    const isFav = Favorites.isFavorite("crypto", coin.id);
    const decimals = coin.current_price < 0.01 ? 6 : coin.current_price < 1 ? 4 : 2;

    return `
  <div class="coin-card" data-id="${coin.id}" data-price="${coin.current_price}"
       role="listitem" tabindex="0" aria-label="${coin.name} price card">
    <div class="coin-card__rank" aria-label="Rank">#${coin.market_cap_rank}</div>
    <img class="coin-card__icon" src="${coin.image}" alt="${coin.name} logo" loading="lazy"
         width="32" height="32" />
    <div class="coin-card__info">
      <span class="coin-card__name">${coin.name}</span>
      <span class="coin-card__symbol">${coin.symbol.toUpperCase()}</span>
    </div>
    <div class="coin-card__price">
      <span class="coin-price" id="coin-${coin.id}" data-prev="${coin.current_price}">
        $${formatCurrency(coin.current_price, decimals)}
      </span>
      <span class="coin-card__change ${changeClass}" aria-label="24 hour change">
        ${changeSign} ${Math.abs(change).toFixed(2)}%
      </span>
    </div>
    <div class="coin-card__stats" aria-label="Market statistics">
      <span>Cap: $${formatLargeNumber(coin.market_cap)}</span>
      <span>Vol: $${formatLargeNumber(coin.total_volume)}</span>
    </div>
    <button class="fav-btn ${isFav ? "fav-btn--active" : ""}"
      data-type="crypto" data-id="${coin.id}"
      title="${isFav ? "Remove from favorites" : "Add to favorites"}"
      aria-label="${isFav ? "Remove" : "Add"} ${coin.name} ${isFav ? "from" : "to"} favorites"
      aria-pressed="${isFav}">
      ${isFav ? "★" : "☆"}
    </button>
  </div>`;
}

export default class CryptoList {
    constructor(containerEl) {
        this.container = containerEl;
        this.coins = [];
        this.filteredCoins = [];
        this.refreshInterval = null;
        this.onCoinClick = null; // callback for coin detail panel
        this.portfolio = null; // Portfolio instance reference
    }

    async init() {
        this.showSkeleton();
        await this.fetchCoins();
        this.render();
        this.startAutoRefresh();
    }

    /**
     * Fetch top 50 coins by market cap from CoinGecko
     * Rate limit: ~30 req/min on free tier — 60s interval keeps us well under
     */
    async fetchCoins() {
        try {
            const params = new URLSearchParams({
                vs_currency: "usd",
                order: "market_cap_desc",
                per_page: "50",
                page: "1",
                sparkline: "false",
                price_change_percentage: "24h",
            });
            const res = await fetch(`${COINGECKO_URL}/coins/markets?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            this.coins = await res.json();
            this.filteredCoins = [...this.coins];
            setLocalStorage("cw-crypto-cache", { coins: this.coins, time: Date.now() });
        } catch (err) {
            console.error("CryptoList fetch error:", err);
            const cached = getLocalStorage("cw-crypto-cache");
            if (cached) {
                this.coins = cached.coins;
                this.filteredCoins = [...this.coins];
                showToast("Using cached crypto data", "warning");
            } else {
                showToast("Failed to load cryptocurrency data", "error");
            }
        }
    }

    render() {
        if (this.filteredCoins.length === 0) {
            this.container.innerHTML = `
        <div class="empty-state">
          <span aria-hidden="true">🔍</span>
          <p>No coins match your search. Try a different term.</p>
        </div>`;
            return;
        }

        const favIds = Favorites.getFavorites("crypto");

        // Favorites first, rest sorted by existing order (market cap)
        const sorted = [
            ...this.filteredCoins.filter((c) => favIds.includes(c.id)),
            ...this.filteredCoins.filter((c) => !favIds.includes(c.id)),
        ];

        this.container.innerHTML = sorted.map(coinCardTemplate).join("");
        this.bindFavoriteButtons();
        this.bindCoinClicks();
        this.updateTimestamp();
    }

    /** Update prices in-place with flash animation (avoids full re-render) */
    updatePrices() {
        this.coins.forEach((coin) => {
            const el = document.getElementById(`coin-${coin.id}`);
            if (!el) return;

            const oldPrice = parseFloat(el.dataset.prev || 0);
            const newPrice = coin.current_price;
            const decimals = newPrice < 0.01 ? 6 : newPrice < 1 ? 4 : 2;

            el.dataset.prev = newPrice;
            el.textContent = `$${formatCurrency(newPrice, decimals)}`;

            if (oldPrice && oldPrice !== newPrice) {
                const cls = newPrice > oldPrice ? "flash--up" : "flash--down";
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), 600);
            }
        });

        // Propagate new prices to portfolio
        if (this.portfolio) this.portfolio.updatePrices(this.coins);
        this.updateTimestamp();
    }

    /** Filter by search query (name or symbol) */
    filterBySearch(query) {
        const q = query.toLowerCase().trim();
        this.filteredCoins = q
            ? this.coins.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
            )
            : [...this.coins];
        this.render();
    }

    /** Filter by performance: all | gainers | losers */
    filterByPerformance(type) {
        switch (type) {
            case "gainers":
                this.filteredCoins = this.coins.filter(
                    (c) => (c.price_change_percentage_24h || 0) > 0
                );
                break;
            case "losers":
                this.filteredCoins = this.coins.filter(
                    (c) => (c.price_change_percentage_24h || 0) < 0
                );
                break;
            default:
                this.filteredCoins = [...this.coins];
        }
        this.render();
    }

    /** Sort coins by field */
    sortBy(field) {
        const sorted = [...this.filteredCoins];
        switch (field) {
            case "price":
                sorted.sort((a, b) => b.current_price - a.current_price);
                break;
            case "change":
                sorted.sort(
                    (a, b) =>
                        b.price_change_percentage_24h - a.price_change_percentage_24h
                );
                break;
            case "market_cap":
            default:
                sorted.sort((a, b) => b.market_cap - a.market_cap);
        }
        this.filteredCoins = sorted;
        this.render();
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.fetchCoins();
            this.updatePrices();
        }, 60_000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    }

    showSkeleton() {
        this.container.innerHTML = Array(10)
            .fill(0)
            .map(
                () => `
      <div class="coin-card coin-card--skeleton" aria-hidden="true">
        <div class="skeleton skeleton--icon"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--price"></div>
      </div>`
            )
            .join("");
    }

    updateTimestamp() {
        const el = document.getElementById("crypto-updated");
        if (el) el.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
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

    bindCoinClicks() {
        this.container.querySelectorAll(".coin-card").forEach((card) => {
            card.style.cursor = "pointer";
            card.addEventListener("click", (e) => {
                if (e.target.classList.contains("fav-btn")) return;
                const id = card.dataset.id;
                const coin = this.coins.find((c) => c.id === id);
                if (coin && this.onCoinClick) this.onCoinClick(coin);
            });
            // Keyboard accessibility
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }

    /** Get all coins (used by Portfolio) */
    getCoins() {
        return this.coins;
    }
}
