/**
 * CurrencyConverter.mjs
 * Live currency conversion using Frankfurter API rates
 */

import { formatCurrency } from "./utils.mjs";

export default class CurrencyConverter {
    constructor(formEl, exchangeRates) {
        this.form = formEl;
        this.exchangeRates = exchangeRates; // ExchangeRates instance
        this.resultEl = document.getElementById("converter-result");
    }

    init() {
        this.populateCurrencySelects();
        this.bindEvents();
    }

    // Populate from/to dropdowns with supported currencies
    populateCurrencySelects() {
        const currencies = [
            "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY",
            "ZAR", "INR", "BRL", "MXN", "SGD", "NZD", "SEK", "NOK"
        ];

        const fromSel = this.form.querySelector("#converter-from");
        const toSel = this.form.querySelector("#converter-to");

        currencies.forEach(code => {
            fromSel.insertAdjacentHTML("beforeend", `<option value="${code}">${code}</option>`);
            toSel.insertAdjacentHTML("beforeend", `<option value="${code}">${code}</option>`);
        });

        // Set sensible defaults
        fromSel.value = "USD";
        toSel.value = "EUR";
    }

    bindEvents() {
        // Convert on any input/select change
        this.form.addEventListener("input", () => this.convert());
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
        const amount = parseFloat(this.form.querySelector("#converter-amount").value);
        const from = this.form.querySelector("#converter-from").value;
        const to = this.form.querySelector("#converter-to").value;

        if (!amount || isNaN(amount) || amount <= 0) {
            this.resultEl.textContent = "";
            return;
        }

        if (from === to) {
            this.resultEl.innerHTML = `
        <span class="converter-result__amount">${formatCurrency(amount)}</span>
        <span class="converter-result__code">${to}</span>`;
            return;
        }

        try {
            // Use live API for accurate cross-currency conversion
            const res = await fetch(
                `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`
            );
            if (!res.ok) throw new Error("Fetch failed");
            const data = await res.json();
            const converted = data.rates[to];

            this.resultEl.innerHTML = `
        <div class="converter-result__row">
          <span class="converter-result__input">${formatCurrency(amount)} ${from}</span>
          <span class="converter-result__equals">=</span>
        </div>
        <div class="converter-result__row">
          <span class="converter-result__amount">${formatCurrency(converted)}</span>
          <span class="converter-result__code">${to}</span>
        </div>`;

            // Add animation class
            this.resultEl.classList.add("result--updated");
            setTimeout(() => this.resultEl.classList.remove("result--updated"), 500);

        } catch (err) {
            this.resultEl.textContent = "Conversion failed. Check your connection.";
        }
    }
}
