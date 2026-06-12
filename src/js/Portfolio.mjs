/**
 * Portfolio.mjs
 * Allows users to track a personal crypto portfolio
 * Stores holdings in localStorage, calculates total value
 */

import { getLocalStorage, setLocalStorage, formatCurrency, formatLargeNumber, showToast } from "./utils.mjs";

const STORAGE_KEY = "cw-portfolio";

// Template for a portfolio holding row
function holdingTemplate(holding) {
    const value = holding.amount * holding.currentPrice;
    const change = holding.currentPrice - holding.buyPrice;
    const changePct = ((change / holding.buyPrice) * 100).toFixed(2);
    const changeClass = change >= 0 ? "change--up" : "change--down";
    const changeSign = change >= 0 ? "▲" : "▼";

    return `
    <tr class="portfolio-row" data-id="${holding.id}">
      <td class="portfolio-cell portfolio-cell--coin">
        <img src="${holding.image}" alt="${holding.name}" class="portfolio-icon" />
        <div>
          <span class="portfolio-name">${holding.name}</span>
          <span class="portfolio-symbol">${holding.symbol.toUpperCase()}</span>
        </div>
      </td>
      <td class="portfolio-cell portfolio-cell--mono">${holding.amount}</td>
      <td class="portfolio-cell portfolio-cell--mono">$${formatCurrency(holding.currentPrice)}</td>
      <td class="portfolio-cell portfolio-cell--mono">$${formatCurrency(holding.buyPrice)}</td>
      <td class="portfolio-cell portfolio-cell--mono ${changeClass}">
        ${changeSign} ${Math.abs(changePct)}%
      </td>
      <td class="portfolio-cell portfolio-cell--mono portfolio-cell--value">
        $${formatCurrency(value)}
      </td>
      <td class="portfolio-cell">
        <button class="portfolio-remove-btn" data-id="${holding.id}" aria-label="Remove ${holding.name}">✕</button>
      </td>
    </tr>`;
}

export default class Portfolio {
    constructor(containerEl, coins) {
        this.container = containerEl;
        this.coins = coins; // array from CryptoList
        this.holdings = getLocalStorage(STORAGE_KEY) || [];
    }

    init() {
        this.render();
        this.bindAddForm();
    }

    // Update current prices from live coin data
    updatePrices(coins) {
        this.coins = coins;
        this.holdings = this.holdings.map(h => {
            const live = coins.find(c => c.id === h.id);
            if (live) h.currentPrice = live.current_price;
            return h;
        });
        setLocalStorage(STORAGE_KEY, this.holdings);
        this.render();
    }

    render() {
        if (!this.container) return;

        if (this.holdings.length === 0) {
            this.container.innerHTML = `
        <div class="portfolio-empty">
          <span class="portfolio-empty__icon">📊</span>
          <p>Your portfolio is empty. Add a coin below to start tracking.</p>
        </div>`;
            this.updateTotals(0, 0);
            return;
        }

        // Update current prices
        const updated = this.holdings.map(h => {
            const live = this.coins.find(c => c.id === h.id);
            if (live) h.currentPrice = live.current_price;
            return h;
        });

        const totalValue = updated.reduce((sum, h) => sum + h.amount * h.currentPrice, 0);
        const totalCost = updated.reduce((sum, h) => sum + h.amount * h.buyPrice, 0);
        const totalPnl = totalValue - totalCost;

        this.container.innerHTML = `
      <div class="portfolio-table-wrapper">
        <table class="portfolio-table">
          <thead>
            <tr>
              <th>Coin</th>
              <th>Amount</th>
              <th>Current Price</th>
              <th>Buy Price</th>
              <th>P&L %</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${updated.map(holdingTemplate).join("")}
          </tbody>
        </table>
      </div>`;

        this.updateTotals(totalValue, totalPnl);
        this.bindRemoveButtons();
    }

    updateTotals(totalValue, totalPnl) {
        const valEl = document.getElementById("portfolio-total-value");
        const pnlEl = document.getElementById("portfolio-total-pnl");
        if (valEl) valEl.textContent = `$${formatCurrency(totalValue)}`;
        if (pnlEl) {
            pnlEl.textContent = `${totalPnl >= 0 ? "+" : ""}$${formatCurrency(totalPnl)}`;
            pnlEl.className = `portfolio-stat__value ${totalPnl >= 0 ? "change--up" : "change--down"}`;
        }
    }

    bindAddForm() {
        const form = document.getElementById("portfolio-add-form");
        if (!form) return;

        // Populate coin select with available coins
        const select = document.getElementById("portfolio-coin-select");
        if (select && this.coins.length > 0) {
            select.innerHTML = this.coins
                .map(c => `<option value="${c.id}" data-price="${c.current_price}" data-image="${c.image}" data-symbol="${c.symbol}">${c.name} (${c.symbol.toUpperCase()})</option>`)
                .join("");
        }

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const coinId = select.value;
            const amount = parseFloat(document.getElementById("portfolio-amount").value);
            const buyPrice = parseFloat(document.getElementById("portfolio-buy-price").value);

            if (!coinId || !amount || !buyPrice || amount <= 0 || buyPrice <= 0) {
                showToast("Please fill in all fields with valid values", "warning");
                return;
            }

            const coin = this.coins.find(c => c.id === coinId);
            if (!coin) return;

            // Check if already tracking this coin
            const existing = this.holdings.find(h => h.id === coinId);
            if (existing) {
                // Add to existing holding
                existing.amount += amount;
                existing.buyPrice = ((existing.buyPrice * (existing.amount - amount)) + (buyPrice * amount)) / existing.amount;
            } else {
                this.holdings.push({
                    id: coin.id,
                    name: coin.name,
                    symbol: coin.symbol,
                    image: coin.image,
                    amount,
                    buyPrice,
                    currentPrice: coin.current_price,
                });
            }

            setLocalStorage(STORAGE_KEY, this.holdings);
            this.render();
            form.reset();
            showToast(`${coin.name} added to portfolio!`, "info");
        });
    }

    bindRemoveButtons() {
        this.container.querySelectorAll(".portfolio-remove-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                this.holdings = this.holdings.filter(h => h.id !== id);
                setLocalStorage(STORAGE_KEY, this.holdings);
                this.render();
                showToast("Removed from portfolio", "info");
            });
        });
    }
}
