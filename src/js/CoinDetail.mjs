/**
 * CoinDetail.mjs
 * Shows expanded details for a selected cryptocurrency in a modal/drawer
 */

import { formatCurrency, formatLargeNumber } from "./utils.mjs";

const COINGECKO_URL = "https://api.coingecko.com/api/v3";

function buildDetailHTML(coin, extraData) {
  const change = coin.price_change_percentage_24h;
  const changeClass = change >= 0 ? "change--up" : "change--down";
  const changeSign = change >= 0 ? "▲" : "▼";

  const description = extraData?.description?.en
    ? extraData.description.en.replace(/<[^>]*>/g, "").slice(0, 300) + "..."
    : "No description available.";

  return `
    <div class="coin-detail">
      <div class="coin-detail__header">
        <img src="${coin.image}" alt="${coin.name}" class="coin-detail__icon" />
        <div>
          <h2 class="coin-detail__name">${coin.name}
            <span class="coin-detail__symbol">${coin.symbol.toUpperCase()}</span>
          </h2>
          <span class="coin-detail__rank">Rank #${coin.market_cap_rank}</span>
        </div>
        <button class="coin-detail__close" id="coin-detail-close" aria-label="Close">&times;</button>
      </div>

      <div class="coin-detail__price-row">
        <span class="coin-detail__price">$${formatCurrency(coin.current_price)}</span>
        <span class="coin-detail__change ${changeClass}">${changeSign} ${Math.abs(change).toFixed(2)}% (24h)</span>
      </div>

      <div class="coin-detail__stats-grid">
        <div class="coin-detail__stat">
          <span class="coin-detail__stat-label">Market Cap</span>
          <span class="coin-detail__stat-value">$${formatLargeNumber(coin.market_cap)}</span>
        </div>
        <div class="coin-detail__stat">
          <span class="coin-detail__stat-label">24h Volume</span>
          <span class="coin-detail__stat-value">$${formatLargeNumber(coin.total_volume)}</span>
        </div>
        <div class="coin-detail__stat">
          <span class="coin-detail__stat-label">24h High</span>
          <span class="coin-detail__stat-value change--up">$${formatCurrency(coin.high_24h)}</span>
        </div>
        <div class="coin-detail__stat">
          <span class="coin-detail__stat-label">24h Low</span>
          <span class="coin-detail__stat-value change--down">$${formatCurrency(coin.low_24h)}</span>
        </div>
        <div class="coin-detail__stat">
          <span class="coin-detail__stat-label">All-Time High</span>
          <span class="coin-detail__stat-value">$${formatCurrency(coin.ath)}</span>
        </div>
        <div class="coin-detail__stat">
          <span class="coin-detail__stat-label">Circulating Supply</span>
          <span class="coin-detail__stat-value">${formatLargeNumber(coin.circulating_supply)}</span>
        </div>
      </div>

      <div class="coin-detail__description">
        <h3>About ${coin.name}</h3>
        <p>${description}</p>
      </div>

      <div class="coin-detail__links">
        ${extraData?.links?.homepage?.[0]
      ? `<a href="${extraData.links.homepage[0]}" target="_blank" rel="noopener" class="coin-detail__link">🌐 Website</a>`
      : ""}
        ${extraData?.links?.subreddit_url
      ? `<a href="${extraData.links.subreddit_url}" target="_blank" rel="noopener" class="coin-detail__link">📢 Reddit</a>`
      : ""}
      </div>
    </div>`;
}

export default class CoinDetail {
  constructor() {
    this.modal = null;
  }

  async show(coin) {
    // Remove existing modal
    this.close();

    // Create modal overlay
    const overlay = document.createElement("div");
    overlay.className = "coin-detail-overlay";
    overlay.id = "coin-detail-overlay";
    overlay.innerHTML = `<div class="coin-detail-drawer"><div class="coin-detail-loading">Loading details...</div></div>`;
    document.body.appendChild(overlay);
    this.modal = overlay;

    // Animate in
    requestAnimationFrame(() => overlay.classList.add("coin-detail-overlay--visible"));

    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.close();
    });

    // Fetch extra data from CoinGecko
    let extraData = null;
    try {
      const res = await fetch(`${COINGECKO_URL}/coins/${coin.id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
      if (res.ok) extraData = await res.json();
    } catch (err) {
      // Extra data optional
    }

    // Render full content
    const drawer = overlay.querySelector(".coin-detail-drawer");
    drawer.innerHTML = buildDetailHTML(coin, extraData);

    // Bind close button
    document.getElementById("coin-detail-close")?.addEventListener("click", () => this.close());

    // Close on Escape key
    this._keyHandler = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._keyHandler);
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove("coin-detail-overlay--visible");
    setTimeout(() => {
      this.modal?.remove();
      this.modal = null;
    }, 300);
    if (this._keyHandler) {
      document.removeEventListener("keydown", this._keyHandler);
    }
  }
}
