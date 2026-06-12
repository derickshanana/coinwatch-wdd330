/**
 * main.js
 * CoinWatch entry point
 * Initializes all modules, handles tab switching and theme toggle
 */

import ExchangeRates from "./ExchangeRates.mjs";
import CurrencyConverter from "./CurrencyConverter.mjs";
import CryptoList from "./CryptoList.mjs";
import RateChart from "./RateChart.mjs";
import Portfolio from "./Portfolio.mjs";
import CoinDetail from "./CoinDetail.mjs";
import { getLocalStorage, setLocalStorage } from "./utils.mjs";

// ── Theme ──────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = getLocalStorage("cw-theme") || "dark";
  document.documentElement.dataset.theme = saved;
  updateThemeBtn(saved);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  setLocalStorage("cw-theme", next);
  updateThemeBtn(next);
}

// ── Tab Switching ──────────────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.remove("tab-btn--active"));
      panels.forEach((p) => p.classList.remove("tab-panel--active"));
      tab.classList.add("tab-btn--active");
      document
        .getElementById(`panel-${target}`)
        ?.classList.add("tab-panel--active");
    });
  });
}

// ── Main Init ──────────────────────────────────────────────────────────────
async function init() {
  initTheme();
  initTabs();

  // Theme toggle
  document
    .getElementById("theme-toggle")
    ?.addEventListener("click", toggleTheme);

  // ── Exchange Rates ──
  const ratesContainer = document.getElementById("rates-list");
  const ratesModule = new ExchangeRates(ratesContainer);
  await ratesModule.init();

  // ── Currency Converter ──
  const converterForm = document.getElementById("converter-form");
  if (converterForm) {
    const converter = new CurrencyConverter(converterForm, ratesModule);
    converter.init();
  }

  // ── Rate Chart ──
  const chartCanvas = document.getElementById("rate-chart");
  const chart = chartCanvas ? new RateChart(chartCanvas) : null;

  if (chart) {
    ratesContainer.addEventListener("click", async (e) => {
      const card = e.target.closest(".rate-card");
      if (!card || e.target.classList.contains("fav-btn")) return;
      const code = card.dataset.code;
      const base = ratesModule.getBaseCurrency();

      // Hide hint card, show chart
      document.getElementById("chart-hint-card")?.classList.add("hidden");
      document.getElementById("chart-section")?.classList.remove("hidden");

      await chart.draw(base, code);
    });
  }

  // Chart pair selector (manual currency pair input)
  const chartFromSel = document.getElementById("chart-from");
  const chartToSel = document.getElementById("chart-to");
  const chartDrawBtn = document.getElementById("chart-draw-btn");

  if (chartDrawBtn && chartFromSel && chartToSel && chart) {
    chartDrawBtn.addEventListener("click", async () => {
      document.getElementById("chart-hint-card")?.classList.add("hidden");
      document.getElementById("chart-section")?.classList.remove("hidden");
      await chart.draw(chartFromSel.value, chartToSel.value);
    });
  }

  // ── Base currency selector ──
  const baseSel = document.getElementById("base-currency-select");
  if (baseSel) {
    baseSel.addEventListener("change", async () => {
      await ratesModule.setBaseCurrency(baseSel.value);
    });
  }

  // ── Currency search ──
  const rateSearch = document.getElementById("rates-search");
  if (rateSearch) {
    rateSearch.addEventListener("input", () => {
      ratesModule.filterBySearch(rateSearch.value);
    });
  }

  // ── Crypto List ──
  const cryptoContainer = document.getElementById("crypto-list");
  const cryptoModule = new CryptoList(cryptoContainer);
  await cryptoModule.init();

  // ── Coin Detail Modal ──
  const coinDetail = new CoinDetail();
  cryptoModule.onCoinClick = (coin) => coinDetail.show(coin);

  // ── Portfolio ──
  const portfolioContainer = document.getElementById("portfolio-holdings");
  if (portfolioContainer) {
    const portfolio = new Portfolio(
      portfolioContainer,
      cryptoModule.getCoins(),
    );
    portfolio.init();
    cryptoModule.portfolio = portfolio;
  }

  // ── Crypto search ──
  const cryptoSearch = document.getElementById("crypto-search");
  if (cryptoSearch) {
    cryptoSearch.addEventListener("input", () => {
      cryptoModule.filterBySearch(cryptoSearch.value);
    });
  }

  // ── Performance filter ──
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("filter-btn--active"));
      btn.classList.add("filter-btn--active");
      cryptoModule.filterByPerformance(btn.dataset.filter);
    });
  });

  // ── Sort control ──
  const sortSel = document.getElementById("crypto-sort");
  if (sortSel) {
    sortSel.addEventListener("change", () => {
      cryptoModule.sortBy(sortSel.value);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
