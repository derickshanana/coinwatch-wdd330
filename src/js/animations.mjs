/**
 * animations.mjs
 * Price change flash animations and UI transition helpers for CoinWatch
 * Provides centralized animation triggering for price updates
 */

/**
 * Flash an element green or red based on value direction.
 * Adds CSS class then removes it after animation completes.
 *
 * @param {HTMLElement} el - Element to animate
 * @param {number} oldVal  - Previous numeric value
 * @param {number} newVal  - New numeric value
 * @param {number} [duration=600] - Animation duration in ms
 */
export function flashPriceChange(el, oldVal, newVal, duration = 600) {
    if (!el || oldVal === 0 || oldVal === newVal) return;
    const cls = newVal > oldVal ? "flash--up" : "flash--down";
    el.classList.remove("flash--up", "flash--down"); // reset if already animating
    void el.offsetWidth; // force reflow to restart CSS animation
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), duration);
}

/**
 * Animate a card appearing (slide-in from below on first render)
 * Uses a staggered delay for each card to create a cascade effect.
 *
 * @param {NodeList|HTMLElement[]} cards - Collection of card elements
 * @param {number} [staggerMs=30] - Delay between each card
 */
export function animateCardEntrance(cards, staggerMs = 30) {
    Array.from(cards).forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(12px)";
        card.style.transition = "opacity 0.25s ease, transform 0.25s ease";

        setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, i * staggerMs);
    });
}

/**
 * Pulse-highlight a card when it receives a significant price move (>1%)
 *
 * @param {HTMLElement} cardEl - The coin/rate card element
 * @param {boolean} isUp       - true = green pulse, false = red pulse
 */
export function pulseCard(cardEl, isUp) {
    if (!cardEl) return;
    const cls = isUp ? "card-pulse--up" : "card-pulse--down";
    cardEl.classList.add(cls);
    setTimeout(() => cardEl.classList.remove(cls), 1000);
}

/**
 * Show a loading spinner inside a container element.
 * Removes itself once `cleanup()` is called on the returned object.
 *
 * @param {HTMLElement} containerEl - Parent element
 * @returns {{ cleanup: Function }}
 */
export function showSpinner(containerEl) {
    const spinner = document.createElement("div");
    spinner.className = "cw-spinner";
    spinner.setAttribute("aria-label", "Loading");
    spinner.setAttribute("role", "status");
    spinner.innerHTML = `<div class="cw-spinner__ring"></div>`;
    containerEl.appendChild(spinner);

    return {
        cleanup() {
            spinner.classList.add("cw-spinner--fade");
            setTimeout(() => spinner.remove(), 300);
        },
    };
}

/**
 * Animate a numeric counter from `start` to `end` over `duration` ms.
 * Useful for portfolio value changes.
 *
 * @param {HTMLElement} el       - Element whose textContent to update
 * @param {number}      start    - Starting value
 * @param {number}      end      - Ending value
 * @param {number}      duration - Animation duration in ms
 * @param {Function}    format   - Formatter function e.g. (v) => `$${v.toFixed(2)}`
 */
export function animateCounter(el, start, end, duration = 500, format = (v) => v.toFixed(2)) {
    if (!el) return;
    const startTime = performance.now();
    const range = end - start;

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = format(start + range * eased);
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}
