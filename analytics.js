// Roar East Africa lightweight, privacy-first interaction analytics.
// No cookies, personal data, fingerprinting, or third-party requests are used.
document.addEventListener('DOMContentLoaded', () => {
    function logAnalyticsEvent(category, action, label = '') {
        const event = {
            category,
            action,
            label,
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
        };
        console.info('[Roar Analytics]', event);
        window.dispatchEvent(new CustomEvent('roar:analytics', { detail: event }));
    }

    document.querySelectorAll('.pkg-btn').forEach((button, index) => {
        button.addEventListener('click', () => {
            const packageName = button.closest('.pkg-info')?.querySelector('h3')?.textContent.trim() || `Package ${index + 1}`;
            logAnalyticsEvent('Package', 'Click', packageName);
        });
    });

    document.querySelectorAll('.guide-cta').forEach(button => {
        button.addEventListener('click', () => {
            logAnalyticsEvent('Migration Guide', 'Season Inquiry', button.dataset.window || button.textContent.trim());
        });
    });

    document.querySelector('.whatsapp-float')?.addEventListener('click', () => {
        logAnalyticsEvent('Contact', 'WhatsApp Consultation');
    });

    document.getElementById('useEstimateBtn')?.addEventListener('click', () => {
        const packageName = document.getElementById('calcPackage')?.selectedOptions[0]?.dataset.name || 'Safari package';
        logAnalyticsEvent('Price Estimator', 'Use Estimate', packageName);
    });

    document.getElementById('safariLeadForm')?.addEventListener('submit', () => {
        logAnalyticsEvent('Lead', 'Safari Brief Submitted');
    });

    document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
        link.addEventListener('click', () => logAnalyticsEvent('Contact', 'Email Click'));
    });
});
