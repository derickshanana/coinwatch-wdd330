/**
 * main.js
 * CoinWatch application entry point
 * Initializes all modules, loads partials, handles tabs and theme
 */

import ExchangeRates from "./ExchangeRates.mjs";
import CurrencyConverter from "./CurrencyConverter.mjs";
import CryptoList from "./CryptoList.mjs";
import RateChart from "./RateChart.mjs";
import Portfolio from "./Portfolio.mjs";
import CoinDetail from "./CoinDetail.mjs";
import { animateCardEntrance } from "./animations.mjs";
import {
  getLocalStorage,
  setLocalStorage,
  loadHeaderFooter,
} from "./utils.mjs";

// ── Theme ───────────────────────────────────────────────────────────────────

function initTheme() {
  const saved = getLocalStorage("cw-theme") || "dark";
  document.documentElement.dataset.theme = saved;
  updateThemeBtn(saved);
}

function updateThemeBtn(theme) {
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
    btn.setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
    );
  }
}

function toggleTheme(chart) {
  const current = document.documentElement.dataset.theme || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  setLocalStorage("cw-theme", next);
  updateThemeBtn(next);
  // Redraw canvas chart in new theme colors
  if (chart) chart.redraw();
}

// ── Tab Switching ────────────────────────────────────────────────────────────

function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach((t) => {
        t.classList.remove("tab-btn--active");
        t.setAttribute("aria-selected", "false");
      });
      panels.forEach((p) => p.classList.remove("tab-panel--active"));

      tab.classList.add("tab-btn--active");
      tab.setAttribute("aria-selected", "true");

      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.classList.add("tab-panel--active");
    });
  });
}

// ── Main Init ────────────────────────────────────────────────────────────────

async function init() {
  // Apply theme before anything renders to prevent flash
  initTheme();

  // Load header and footer from partials, then init tabs & theme button
  await loadHeaderFooter(() => {
    initTheme(); // Re-apply theme so the button text is correct after header renders
    initTabs();
  });

  // ── Exchange Rates ──
  const ratesContainer = document.getElementById("rates-list");
  const ratesModule = new ExchangeRates(ratesContainer);
  await ratesModule.init();

  // Animate cards in on first render
  animateCardEntrance(ratesContainer.querySelectorAll(".rate-card"));

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
    // Click on a rate card to chart it vs the current base currency
    ratesContainer.addEventListener("click", async (e) => {
      const card = e.target.closest(".rate-card");
      if (!card || e.target.classList.contains("fav-btn")) return;
      const code = card.dataset.code;
      const base = ratesModule.getBaseCurrency();

      document.getElementById("chart-hint-card")?.classList.add("hidden");
      document.getElementById("chart-section")?.classList.remove("hidden");
      await chart.draw(base, code);
    });
  }

  // Chart pair selector (manual input)
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
      animateCardEntrance(ratesContainer.querySelectorAll(".rate-card"), 20);
    });
  }

  // ── Currency search ──
  const rateSearch = document.getElementById("rates-search");
  if (rateSearch) {
    rateSearch.addEventListener("input", () => {
      ratesModule.filterBySearch(rateSearch.value);
    });
  }

  // ── Theme toggle (wired after header loads so button exists) ──
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    toggleTheme(chart);
  });

  // ── Crypto List ──
  const cryptoContainer = document.getElementById("crypto-list");
  const cryptoModule = new CryptoList(cryptoContainer);
  await cryptoModule.init();

  // Animate crypto cards in
  animateCardEntrance(cryptoContainer.querySelectorAll(".coin-card"), 25);

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

  // ── Performance filter buttons ──
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
