/**
 * CryptoList.mjs
 * Fetches and renders cryptocurrency data from CoinGecko API
 */

import { formatCurrency, formatLargeNumber, getLocalStorage, setLocalStorage, showToast } from "./utils.mjs";
import { Favorites } from "./Favorites.mjs";

const COINGECKO_URL = "https://api.coingecko.com/api/v3";

// Template for a single crypto coin card
function coinCardTemplate(coin) {
    const change = coin.price_change_percentage_24h || 0;
    const changeClass = change >= 0 ? "change--up" : "change--down";
    const changeSign = change >= 0 ? "▲" : "▼";
    const isFav = Favorites.isFavorite("crypto", coin.id);

    return `
    <div class="coin-card" data-id="${coin.id}" data-price="${coin.current_price}" role="listitem">
      <div class="coin-card__rank">#${coin.market_cap_rank}</div>
      <img class="coin-card__icon" src="${coin.image}" alt="${coin.name}" loading="lazy" />
      <div class="coin-card__info">
        <span class="coin-card__name">${coin.name}</span>
        <span class="coin-card__symbol">${coin.symbol.toUpperCase()}</span>
      </div>
      <div class="coin-card__price">
        <span class="coin-price" id="coin-${coin.id}">
          $${formatCurrency(coin.current_price, coin.current_price < 1 ? 6 : 2)}
        </span>
        <span class="coin-card__change ${changeClass}">
          ${changeSign} ${Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <div class="coin-card__stats">
        <span>Cap: $${formatLargeNumber(coin.market_cap)}</span>
        <span>Vol: $${formatLargeNumber(coin.total_volume)}</span>
      </div>
      <button class="fav-btn ${isFav ? "fav-btn--active" : ""}"
        data-type="crypto" data-id="${coin.id}" title="Add to favorites">
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
        this.onCoinClick = null; // callback for coin detail
        this.portfolio = null;   // Portfolio instance reference
    }

    async init() {
        this.showSkeleton();
        await this.fetchCoins();
        this.render();
        this.startAutoRefresh();
    }

    async fetchCoins() {
        try {
            const res = await fetch(
                `${COINGECKO_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.coins = await res.json();
            this.filteredCoins = [...this.coins];
            setLocalStorage("cw-crypto-cache", { coins: this.coins, time: Date.now() });
        } catch (err) {
            // Fall back to cache
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
        const favIds = Favorites.getFavorites("crypto");

        // Sort: favorites first, then by market cap rank
        const sorted = [
            ...this.filteredCoins.filter(c => favIds.includes(c.id)),
            ...this.filteredCoins.filter(c => !favIds.includes(c.id)),
        ];

        this.container.innerHTML = sorted.map(coinCardTemplate).join("");
        this.bindFavoriteButtons();
        this.bindCoinClicks();
        this.updateTimestamp();
    }

    // Update prices in place with flash animation
    updatePrices() {
        this.coins.forEach(coin => {
            const el = document.getElementById(`coin-${coin.id}`);
            if (!el) return;
            const oldPrice = parseFloat(el.dataset.prev || 0);
            const newPrice = coin.current_price;
            el.dataset.prev = newPrice;
            el.textContent = `$${formatCurrency(newPrice, newPrice < 1 ? 6 : 2)}`;

            if (oldPrice && oldPrice !== newPrice) {
                const cls = newPrice > oldPrice ? "flash--up" : "flash--down";
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), 600);
            }
        });

        // Update portfolio prices too
        if (this.portfolio) this.portfolio.updatePrices(this.coins);

        this.updateTimestamp();
    }

    // Filter by search query
    filterBySearch(query) {
        const q = query.toLowerCase();
        this.filteredCoins = this.coins.filter(
            c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
        );
        this.render();
    }

    // Filter by gainer/loser/all
    filterByPerformance(type) {
        if (type === "gainers") {
            this.filteredCoins = this.coins.filter(c => (c.price_change_percentage_24h || 0) > 0);
        } else if (type === "losers") {
            this.filteredCoins = this.coins.filter(c => (c.price_change_percentage_24h || 0) < 0);
        } else {
            this.filteredCoins = [...this.coins];
        }
        this.render();
    }

    // Sort coins by field
    sortBy(field) {
        const sorted = [...this.filteredCoins];
        switch (field) {
            case "price":
                sorted.sort((a, b) => b.current_price - a.current_price);
                break;
            case "change":
                sorted.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
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
        }, 60000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    }

    showSkeleton() {
        this.container.innerHTML = Array(10).fill(0).map(() => `
      <div class="coin-card coin-card--skeleton">
        <div class="skeleton skeleton--icon"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--price"></div>
      </div>`).join("");
    }

    updateTimestamp() {
        const el = document.getElementById("crypto-updated");
        if (el) el.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
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

    bindCoinClicks() {
        this.container.querySelectorAll(".coin-card").forEach(card => {
            card.addEventListener("click", (e) => {
                if (e.target.classList.contains("fav-btn")) return;
                const id = card.dataset.id;
                const coin = this.coins.find(c => c.id === id);
                if (coin && this.onCoinClick) this.onCoinClick(coin);
            });
            card.style.cursor = "pointer";
        });
    }

    // Get all coins (used by Portfolio)
    getCoins() {
        return this.coins;
    }
}
