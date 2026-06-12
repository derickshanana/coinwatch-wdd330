/**
 * RateChart.mjs
 * Renders a 7-day historical exchange rate chart using the Canvas API
 */

export default class RateChart {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext("2d");
    }

    // Fetch 7-day historical rates from Frankfurter API
    async fetchHistory(from, to) {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);

        const fmt = d => d.toISOString().split("T")[0];
        const url = `https://api.frankfurter.dev/v2/rates/${fmt(start)}..${fmt(end)}?from=${from}&to=${to}`;

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch failed");
            const data = await res.json();
            return data.rates;
        } catch (err) {
            return null;
        }
    }

    // Draw the chart for a currency pair
    async draw(from, to) {
        const ratesData = await this.fetchHistory(from, to);
        if (!ratesData) {
            this.drawError("Could not load historical data");
            return;
        }

        const dates = Object.keys(ratesData).sort();
        const values = dates.map(d => ratesData[d][to]);

        const padding = { top: 30, right: 20, bottom: 40, left: 60 };
        const w = this.canvas.width - padding.left - padding.right;
        const h = this.canvas.height - padding.top - padding.bottom;
        const ctx = this.ctx;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background
        ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue("--surface").trim() || "#1e1e2e";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const minVal = Math.min(...values) * 0.999;
        const maxVal = Math.max(...values) * 1.001;
        const range = maxVal - minVal || 1;

        const xScale = i => padding.left + (i / (values.length - 1)) * w;
        const yScale = v => padding.top + h - ((v - minVal) / range) * h;

        // Draw grid lines
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (i / 4) * h;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + w, y);
            ctx.stroke();
        }

        // Draw gradient fill under the line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + h);
        gradient.addColorStop(0, "rgba(26, 115, 232, 0.4)");
        gradient.addColorStop(1, "rgba(26, 115, 232, 0.0)");

        ctx.beginPath();
        ctx.moveTo(xScale(0), yScale(values[0]));
        values.forEach((v, i) => ctx.lineTo(xScale(i), yScale(v)));
        ctx.lineTo(xScale(values.length - 1), padding.top + h);
        ctx.lineTo(xScale(0), padding.top + h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = "#1A73E8";
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.moveTo(xScale(0), yScale(values[0]));
        values.forEach((v, i) => ctx.lineTo(xScale(i), yScale(v)));
        ctx.stroke();

        // Draw data points
        values.forEach((v, i) => {
            ctx.beginPath();
            ctx.arc(xScale(i), yScale(v), 3, 0, Math.PI * 2);
            ctx.fillStyle = "#1A73E8";
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });

        // Y-axis labels
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "11px monospace";
        ctx.textAlign = "right";
        for (let i = 0; i <= 4; i++) {
            const val = minVal + (range * (4 - i)) / 4;
            const y = padding.top + (i / 4) * h;
            ctx.fillText(val.toFixed(4), padding.left - 6, y + 4);
        }

        // X-axis date labels (show first, middle, last)
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "10px Arial";
        const showIdx = [0, Math.floor(dates.length / 2), dates.length - 1];
        showIdx.forEach(i => {
            if (dates[i]) {
                const label = dates[i].slice(5); // MM-DD
                ctx.fillText(label, xScale(i), this.canvas.height - 8);
            }
        });

        // Chart title
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${from} → ${to} (7 days)`, this.canvas.width / 2, 18);
    }

    drawError(msg) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(msg, this.canvas.width / 2, this.canvas.height / 2);
    }
}
