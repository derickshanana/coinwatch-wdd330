/**
 * RateChart.mjs
 * Renders a 7-day historical exchange rate chart using the Canvas API (no libraries)
 * Historical API: GET https://api.frankfurter.dev/v1/{start}..{end}?base=USD&symbols=EUR
 */

const BASE_URL = "https://api.frankfurter.dev/v1";

export default class RateChart {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext("2d");
        this.currentPair = null; // { from, to }
    }

    /**
     * Fetch 7-day historical rates from Frankfurter v1
     * Endpoint: GET /v1/YYYY-MM-DD..YYYY-MM-DD?base=FROM&symbols=TO
     * Response: { amount, base, start_date, end_date, rates: { "2026-06-01": { EUR: 0.92 }, ... } }
     */
    async fetchHistory(from, to) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);

        const fmt = (d) => d.toISOString().split("T")[0];
        const url = `${BASE_URL}/${fmt(start)}..${fmt(end)}?base=${from}&symbols=${to}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // data.rates: { "2026-06-05": { EUR: 0.92 }, "2026-06-06": { EUR: 0.915 }, ... }
            return data.rates;
        } catch (err) {
            console.error("RateChart fetch error:", err);
            return null;
        }
    }

    /** Draw the chart for a given currency pair */
    async draw(from, to) {
        this.currentPair = { from, to };
        this.drawLoading(from, to);

        const ratesData = await this.fetchHistory(from, to);

        if (!ratesData || Object.keys(ratesData).length === 0) {
            this.drawError(`Could not load ${from} → ${to} history`);
            return;
        }

        const dates = Object.keys(ratesData).sort();
        const values = dates.map((d) => ratesData[d][to]);

        if (values.length < 2) {
            this.drawError("Not enough data for this period");
            return;
        }

        this._renderChart(from, to, dates, values);
    }

    /** Internal: render the line chart once data is ready */
    _renderChart(from, to, dates, values) {
        const dpr = window.devicePixelRatio || 1;
        const display = { w: this.canvas.offsetWidth || 400, h: 220 };

        // Set physical pixel size for sharp rendering
        this.canvas.width = display.w * dpr;
        this.canvas.height = display.h * dpr;
        this.canvas.style.width = `${display.w}px`;
        this.canvas.style.height = `${display.h}px`;

        const ctx = this.ctx;
        ctx.scale(dpr, dpr);
        const W = display.w;
        const H = display.h;

        const pad = { top: 36, right: 20, bottom: 44, left: 64 };
        const w = W - pad.left - pad.right;
        const h = H - pad.top - pad.bottom;

        // ── Background ──
        const isDark = document.documentElement.dataset.theme !== "light";
        ctx.fillStyle = isDark ? "#1c1c2e" : "#ffffff";
        ctx.fillRect(0, 0, W, H);

        const minVal = Math.min(...values) * 0.9985;
        const maxVal = Math.max(...values) * 1.0015;
        const range = maxVal - minVal || 1;

        const xScale = (i) => pad.left + (i / (values.length - 1)) * w;
        const yScale = (v) => pad.top + h - ((v - minVal) / range) * h;

        // ── Grid lines ──
        const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
        const labelColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (i / 4) * h;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + w, y);
            ctx.stroke();
        }

        // ── Gradient fill ──
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
        grad.addColorStop(0, "rgba(26, 115, 232, 0.35)");
        grad.addColorStop(1, "rgba(26, 115, 232, 0.0)");

        ctx.beginPath();
        ctx.moveTo(xScale(0), yScale(values[0]));
        values.forEach((v, i) => ctx.lineTo(xScale(i), yScale(v)));
        ctx.lineTo(xScale(values.length - 1), pad.top + h);
        ctx.lineTo(xScale(0), pad.top + h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // ── Line ──
        ctx.beginPath();
        ctx.strokeStyle = "#1A73E8";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.moveTo(xScale(0), yScale(values[0]));
        values.forEach((v, i) => ctx.lineTo(xScale(i), yScale(v)));
        ctx.stroke();

        // ── Data points ──
        values.forEach((v, i) => {
            ctx.beginPath();
            ctx.arc(xScale(i), yScale(v), 3.5, 0, Math.PI * 2);
            ctx.fillStyle = "#1A73E8";
            ctx.fill();
            ctx.strokeStyle = isDark ? "#1c1c2e" : "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // ── Y-axis labels ──
        ctx.fillStyle = labelColor;
        ctx.font = `11px "Roboto Mono", monospace`;
        ctx.textAlign = "right";
        for (let i = 0; i <= 4; i++) {
            const val = minVal + (range * (4 - i)) / 4;
            const y = pad.top + (i / 4) * h;
            ctx.fillText(val.toFixed(4), pad.left - 8, y + 4);
        }

        // ── X-axis date labels ──
        ctx.textAlign = "center";
        ctx.font = "10px Arial, sans-serif";
        ctx.fillStyle = labelColor;
        const step = Math.max(1, Math.floor(dates.length / 5));
        const showIdx = [...new Set([0, ...dates.map((_, i) => i).filter((i) => i % step === 0), dates.length - 1])];
        showIdx.forEach((i) => {
            if (dates[i]) {
                const label = dates[i].slice(5); // MM-DD
                ctx.fillText(label, xScale(i), H - 8);
            }
        });

        // ── Chart title ──
        const textColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)";
        ctx.fillStyle = textColor;
        ctx.font = `bold 13px "Inter", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${from} → ${to}  (${dates.length}-day history)`, W / 2, 20);

        // ── Change badge ──
        const firstVal = values[0];
        const lastVal = values[values.length - 1];
        const changePct = ((lastVal - firstVal) / firstVal) * 100;
        const badgeColor = changePct >= 0 ? "#22c55e" : "#ef4444";
        const badgeText = `${changePct >= 0 ? "▲" : "▼"} ${Math.abs(changePct).toFixed(2)}%`;

        ctx.fillStyle = badgeColor;
        ctx.font = "bold 11px Arial, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(badgeText, W - pad.right, 20);
    }

    drawLoading(from, to) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const isDark = document.documentElement.dataset.theme !== "light";
        ctx.fillStyle = isDark ? "#1c1c2e" : "#ffffff";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
        ctx.font = "13px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
            `Loading ${from} → ${to} chart…`,
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }

    drawError(msg) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const isDark = document.documentElement.dataset.theme !== "light";
        ctx.fillStyle = isDark ? "#1c1c2e" : "#f5f7fa";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "#ef4444";
        ctx.font = "13px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⚠ " + msg, this.canvas.width / 2, this.canvas.height / 2);
    }

    /** Redraw current pair (called on theme change) */
    redraw() {
        if (this.currentPair) {
            this.draw(this.currentPair.from, this.currentPair.to);
        }
    }
}
