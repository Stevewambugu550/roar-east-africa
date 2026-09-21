document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('guestReviews');
    const summary = document.getElementById('reviewSummary');
    const form = document.getElementById('reviewForm');
    const formMsg = document.getElementById('reviewFormMsg');
    if (!grid) return;

    const apiBase = (window.ROAR_CONFIG && window.ROAR_CONFIG.apiBase) || '/api/roar';
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

    async function loadReviews() {
        try {
            const res = await fetch(`${apiBase}/reviews`);
            if (!res.ok) throw new Error('Unable to load reviews.');
            const { reviews } = await res.json();
            if (!reviews || !reviews.length) {
                grid.innerHTML = '<p class="reviews-loading">Guest reviews will appear here as journeys are completed. Be among the first to travel with us.</p>';
                return;
            }
            const avg = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length;
            summary.innerHTML = `<strong>${avg.toFixed(1)} / 5</strong> average across ${reviews.length} guest review${reviews.length === 1 ? '' : 's'}. New reviews are approved by our team before appearing.`;
            grid.innerHTML = reviews.map(r => `
                <article class="review-card guest-card">
                    <div class="stars rating-stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>
                    <p>“${escapeHtml(r.review_text)}”</p>
                    <footer>
                        <strong>${escapeHtml(r.reviewer_name)}</strong>
                        ${r.reviewer_location ? `<span>${escapeHtml(r.reviewer_location)}</span>` : ''}
                        ${r.trip_name ? `<span class="trip-tag">${escapeHtml(r.trip_name)}</span>` : ''}
                        ${r.is_demo ? '<span class="sample-badge">Sample review</span>' : ''}
                    </footer>
                </article>`).join('');
        } catch {
            grid.innerHTML = '<p class="reviews-loading">Guest stories are temporarily unavailable.</p>';
        }
    }

    if (form) {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            formMsg.textContent = '';
            const payload = {
                reviewerName: document.getElementById('reviewName').value.trim(),
                reviewerLocation: document.getElementById('reviewLocation').value.trim(),
                tripName: document.getElementById('reviewTrip').value,
                rating: Number(document.getElementById('reviewRating').value),
                reviewText: document.getElementById('reviewText').value.trim(),
            };
            try {
                const res = await fetch(`${apiBase}/reviews`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Unable to submit review.');
                form.reset();
                formMsg.textContent = data.message || 'Thank you — your review will appear once approved.';
                formMsg.className = 'ok';
            } catch (error) {
                formMsg.textContent = error.message;
                formMsg.className = 'err';
            }
        });
    }

    loadReviews();
});
