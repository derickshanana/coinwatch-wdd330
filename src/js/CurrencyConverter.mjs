/**
 * CurrencyConverter.mjs
 * Live currency conversion using Frankfurter API v1
 * API: https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR
 */

import { formatCurrency } from "./utils.mjs";

// ✅ Consistent with ExchangeRates.mjs
const BASE_URL = "https://api.frankfurter.dev/v1";

export default class CurrencyConverter {
    constructor(formEl, exchangeRates) {
        this.form = formEl;
        this.exchangeRates = exchangeRates; // ExchangeRates instance
        this.resultEl = document.getElementById("converter-result");
        this._debounceTimer = null;
    }

    init() {
        this.populateCurrencySelects();
        this.bindEvents();
    }

    /** Populate from/to dropdowns with supported currencies */
    populateCurrencySelects() {
        const currencies = [
            "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY",
            "ZAR", "INR", "BRL", "MXN", "SGD", "NZD", "SEK", "NOK",
            "HKD", "DKK",
        ];

        const fromSel = this.form.querySelector("#converter-from");
        const toSel = this.form.querySelector("#converter-to");

        currencies.forEach((code) => {
            const opt1 = document.createElement("option");
            opt1.value = code;
            opt1.textContent = code;
            fromSel.appendChild(opt1);

            const opt2 = opt1.cloneNode(true);
            toSel.appendChild(opt2);
        });

        fromSel.value = "USD";
        toSel.value = "EUR";
    }

    bindEvents() {
        // Debounce on amount input to avoid hammering the API on every keystroke
        this.form.addEventListener("input", () => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this.convert(), 350);
        });
        this.form.addEventListener("change", () => this.convert());

        // Swap button
        const swapBtn = this.form.querySelector("#converter-swap");
        if (swapBtn) {
            swapBtn.addEventListener("click", () => {
                const fromSel = this.form.querySelector("#converter-from");
                const toSel = this.form.querySelector("#converter-to");
                [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
                this.convert();
            });
        }
    }

    async convert() {
        const amountInput = this.form.querySelector("#converter-amount");
        const amount = parseFloat(amountInput.value);
        const from = this.form.querySelector("#converter-from").value;
        const to = this.form.querySelector("#converter-to").value;

        if (!amount || isNaN(amount) || amount <= 0) {
            this.resultEl.innerHTML = "";
            return;
        }

        // Same currency — no API call needed
        if (from === to) {
            this.resultEl.innerHTML = `
        <div class="converter-result__row">
          <span class="converter-result__amount">${formatCurrency(amount)}</span>
          <span class="converter-result__code">${to}</span>
        </div>`;
            return;
        }

        // Show loading state
        this.resultEl.innerHTML = `<span class="converter-loading">Converting…</span>`;

        try {
            /**
             * Frankfurter v1 convert endpoint:
             * GET /v1/latest?base=USD&symbols=EUR&amount=100
             * Response: { amount: 100, base: "USD", date: "...", rates: { EUR: 92.00 } }
             */
            const url = `${BASE_URL}/latest?base=${from}&symbols=${to}&amount=${amount}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const converted = data.rates[to];

            if (converted === undefined) throw new Error("Currency not in response");

            const decimals = to === "JPY" || to === "INR" ? 0 : 2;

            this.resultEl.innerHTML = `
        <div class="converter-result__row">
          <span class="converter-result__input">${formatCurrency(amount)} ${from}</span>
          <span class="converter-result__equals">=</span>
        </div>
        <div class="converter-result__row">
          <span class="converter-result__amount">${formatCurrency(converted, decimals)}</span>
          <span class="converter-result__code">${to}</span>
        </div>`;

            // Pulse animation on update
            this.resultEl.classList.remove("result--updated");
            void this.resultEl.offsetWidth; // reflow to restart animation
            this.resultEl.classList.add("result--updated");
            setTimeout(() => this.resultEl.classList.remove("result--updated"), 500);

        } catch (err) {
            console.error("Converter error:", err);

            // Fallback: try to compute from cached rates in memory
            const rates = this.exchangeRates?.getRates();
            const base = this.exchangeRates?.getBaseCurrency();

            if (rates && Object.keys(rates).length > 0) {
                let converted;
                if (base === from && rates[to]) {
                    converted = amount * rates[to];
                } else if (base === to && rates[from]) {
                    converted = amount / rates[from];
                } else if (rates[from] && rates[to]) {
                    // Cross-rate via base
                    converted = (amount / rates[from]) * rates[to];
                }

                if (converted !== undefined) {
                    const decimals = to === "JPY" || to === "INR" ? 0 : 2;
                    this.resultEl.innerHTML = `
            <div class="converter-result__row">
              <span class="converter-result__input">${formatCurrency(amount)} ${from}</span>
              <span class="converter-result__equals">≈</span>
            </div>
            <div class="converter-result__row">
              <span class="converter-result__amount">${formatCurrency(converted, decimals)}</span>
              <span class="converter-result__code">${to}</span>
            </div>
            <p class="converter-result__note">Estimated from cached rates</p>`;
                    return;
                }
            }

            this.resultEl.innerHTML = `<p class="converter-error">Conversion failed. Check your connection.</p>`;
        }
    }
}
