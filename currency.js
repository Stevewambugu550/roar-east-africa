(function () {
    const RATE_KES_PER_USD = 130; // Indicative planning rate — final quotes confirm the live rate

    function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function safeSet(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } }

    window.getRoarCurrency = function () {
        return safeGet('roar_currency') === 'kes' ? 'kes' : 'usd';
    };

    window.formatRoarPrice = function (usd) {
        const n = Number(usd) || 0;
        if (window.getRoarCurrency() === 'kes') {
            return 'KSh ' + Math.round(n * RATE_KES_PER_USD).toLocaleString('en-KE');
        }
        return '$' + n.toLocaleString('en-US');
    };

    function applyConvertedPrices() {
        const kes = window.getRoarCurrency() === 'kes';
        document.querySelectorAll('[data-convert]').forEach(el => {
            if (!el.dataset.origText) el.dataset.origText = el.textContent;
            const orig = el.dataset.origText;
            el.textContent = kes
                ? orig.replace(/\$\d[\d,]*(?:\s*USD)?/g, m => window.formatRoarPrice(Number(m.replace(/[^\d]/g, ''))))
                : orig;
        });
    }

    function updateToggleButtons() {
        const cur = window.getRoarCurrency();
        document.querySelectorAll('.currency-toggle [data-cur]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cur === cur);
        });
    }

    window.setRoarCurrency = function (cur) {
        safeSet('roar_currency', cur === 'kes' ? 'kes' : 'usd');
        applyConvertedPrices();
        updateToggleButtons();
        window.dispatchEvent(new CustomEvent('roar:currencychange', { detail: { currency: window.getRoarCurrency() } }));
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.currency-toggle [data-cur]').forEach(btn => {
            btn.addEventListener('click', () => window.setRoarCurrency(btn.dataset.cur));
        });
        applyConvertedPrices();
        updateToggleButtons();
    });
})();
