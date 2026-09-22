document.addEventListener('DOMContentLoaded', () => {
    const KES_RATE = 130; // mirrors currency.js indicative rate
    const account = window.roarAccount;

    const TRIPS = [
        { id: 'sky-safari', name: 'The Sky Safari & Mara Migration', cat: 'Signature Safari', img: 'images/sky-safari.webp',
          options: [{ label: '7 Days / 6 Nights', usd: 2950 }] },
        { id: 'grand-savanna', name: 'Grand Savanna & Diani Waters', cat: 'Signature Safari', img: 'images/bush-coast.webp',
          options: [{ label: '10 Days / 9 Nights', usd: 4200 }] },
        { id: 'iconic-conservancies', name: "Kenya's Iconic Conservancies", cat: 'Signature Safari', img: 'images/maasai-mara.webp',
          options: [{ label: '10 Days / 9 Nights', usd: 8750 }] },
        { id: 'mara-big-five', name: 'Maasai Mara Big Five Safari', cat: 'Safari', img: 'images/maasai-mara.webp',
          options: [{ label: '3 Days / 2 Nights', kes: 46500 }, { label: '4 Days / 3 Nights', kes: 62000 }] },
        { id: 'mara-migration', name: 'Mara Migration River Crossing Special', cat: 'Safari · Jul–Oct', img: 'images/migration-crossing.webp',
          options: [{ label: '4 Days / 3 Nights', kes: 98000 }, { label: '5 Days / 4 Nights', kes: 119500 }] },
        { id: 'amboseli', name: 'Amboseli Kilimanjaro Views', cat: 'Safari', img: 'images/amboseli-elephants.webp',
          options: [{ label: '2 Days / 1 Night', kes: 28500 }, { label: '3 Days / 2 Nights', kes: 41000 }] },
        { id: 'samburu', name: 'Samburu Northern Frontier', cat: 'Safari', img: 'images/migration-savanna.webp',
          options: [{ label: '3 Days / 2 Nights', kes: 52000 }, { label: '4 Days / 3 Nights', kes: 68500 }] },
        { id: 'diani', name: 'Diani Beach Escape', cat: 'Coast & Islands', img: 'images/diani-beach.webp',
          options: [{ label: '3 Days / 2 Nights', kes: 32500 }, { label: '5 Days / 4 Nights', kes: 56800 }] },
        { id: 'zanzibar', name: 'Zanzibar Island Extension', cat: 'Coast & Islands', img: 'images/bush-coast.webp',
          options: [{ label: '4 Days / 3 Nights', kes: 89000 }, { label: '5 Days / 4 Nights', kes: 112000 }] },
        { id: 'naivasha', name: 'Naivasha Weekend Getaway', cat: 'Weekend Escape', img: 'images/sky-safari.webp',
          options: [{ label: '2 Days / 1 Night', kes: 14800 }, { label: '3 Days / 2 Nights', kes: 21500 }] },
        { id: 'tsavo-weekend', name: 'Tsavo East Red Elephants Weekend', cat: 'Weekend Escape', img: 'images/safari-vehicle.webp',
          options: [{ label: '2 Days / 1 Night', kes: 18900 }, { label: '3 Days / 2 Nights', kes: 27500 }] },
        { id: 'custom', name: 'Custom / Not sure yet', cat: 'Tailor-Made', img: null,
          options: [{ label: 'Custom itinerary — priced on request', custom: true }] },
    ];

    const grid = document.getElementById('tripGrid');
    const optionSelect = document.getElementById('bkOption');
    const summary = document.getElementById('bookingSummary');
    const msg = document.getElementById('bookingMsg');
    const startEl = document.getElementById('bkStart');
    const endEl = document.getElementById('bkEnd');
    const flexibleEl = document.getElementById('bkFlexible');
    const adultsEl = document.getElementById('bkAdults');
    const childrenEl = document.getElementById('bkChildren');
    let selectedTrip = null;

    const usdOf = (opt) => opt.usd != null ? opt.usd : (opt.kes != null ? Math.round(opt.kes / KES_RATE) : null);
    const optPrice = (opt) => {
        if (opt.custom) return 'Quote on request';
        const usd = usdOf(opt);
        if (window.getRoarCurrency && window.getRoarCurrency() === 'kes') {
            const kes = opt.kes != null ? opt.kes : Math.round(usd * KES_RATE);
            return `KSh ${kes.toLocaleString('en-KE')} p.p.s`;
        }
        return `$${usd.toLocaleString('en-US')} p.p.s`;
    };
    const guests = () => Math.min(Math.max((Number(adultsEl.value) || 0) + (Number(childrenEl.value) || 0), 1), 30);

    function renderTrips() {
        grid.innerHTML = TRIPS.map(t => `
            <button type="button" class="bk-trip ${selectedTrip?.id === t.id ? 'selected' : ''}" data-trip="${t.id}">
                ${t.img ? `<span class="bk-trip-img" style="background-image:url('${t.img}')"></span>` : `<span class="bk-trip-img bk-trip-custom"><i class="fa-solid fa-compass"></i></span>`}
                <span class="bk-trip-body">
                    <span class="bk-trip-cat">${t.cat}</span>
                    <strong>${t.name}</strong>
                    <span class="bk-trip-price">${optPrice(t.options[0])}${t.options.length > 1 ? ' <em>+ options</em>' : ''}</span>
                </span>
            </button>`).join('');
        grid.querySelectorAll('.bk-trip').forEach(btn => btn.addEventListener('click', () => selectTrip(btn.dataset.trip)));
    }

    function selectTrip(id) {
        selectedTrip = TRIPS.find(t => t.id === id) || null;
        optionSelect.innerHTML = selectedTrip
            ? selectedTrip.options.map((o, i) => `<option value="${i}">${o.label}</option>`).join('')
            : '<option value="">Select a trip first</option>';
        renderTrips();
        updateSummary();
    }

    function updateSummary() {
        if (!selectedTrip) {
            summary.innerHTML = '<i class="fa-solid fa-route"></i> Select a trip to see your estimate.';
            return;
        }
        const opt = selectedTrip.options[Number(optionSelect.value)] || selectedTrip.options[0];
        const usd = usdOf(opt);
        const fmt = window.formatRoarPrice || (u => `$${u.toLocaleString()}`);
        if (usd == null) {
            summary.innerHTML = `<strong>${selectedTrip.name}</strong><span>${opt.label} — our team will quote this route for you.</span>`;
        } else {
            summary.innerHTML = `<strong>${selectedTrip.name}</strong><span>${opt.label} · ${fmt(usd)} × ${guests()} guest${guests() > 1 ? 's' : ''} ≈ <b>${fmt(usd * guests())}</b> total</span>`;
        }
    }

    // Dates
    const todayIso = new Date().toISOString().slice(0, 10);
    [startEl, endEl].forEach(d => { d.min = todayIso; });
    flexibleEl.addEventListener('change', () => {
        [startEl, endEl].forEach(d => { d.disabled = flexibleEl.checked; if (flexibleEl.checked) d.value = ''; });
    });
    const syncDates = () => {
        if (startEl.value && endEl.value && endEl.value < startEl.value) {
            const tmp = startEl.value; startEl.value = endEl.value; endEl.value = tmp;
        }
    };
    startEl.addEventListener('change', () => { endEl.min = startEl.value || todayIso; syncDates(); });
    endEl.addEventListener('change', syncDates);

    function readDates() {
        if (flexibleEl.checked) return 'Dates flexible';
        const fmt = v => new Date(`${v}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        if (startEl.value && endEl.value) return `${fmt(startEl.value)} → ${fmt(endEl.value)}`;
        if (startEl.value) return `From ${fmt(startEl.value)}`;
        if (endEl.value) return `Until ${fmt(endEl.value)}`;
        return '';
    }

    // Prefill from signed-in account + draft restore
    if (account?.isAuthenticated()) {
        document.getElementById('bkName').value = `${account.user.firstName} ${account.user.lastName}`;
        document.getElementById('bkEmail').value = account.user.email;
    }
    try {
        const draft = JSON.parse(sessionStorage.getItem('roar_booking_draft') || 'null');
        if (draft) {
            ['bkName','bkEmail','bkPhone','bkCountry','bkNotes'].forEach(id => { if (draft[id]) document.getElementById(id).value = draft[id]; });
            if (draft.trip) selectTrip(draft.trip);
            if (draft.option) optionSelect.value = draft.option;
            if (draft.start) startEl.value = draft.start;
            if (draft.end) endEl.value = draft.end;
            if (draft.adults) adultsEl.value = draft.adults;
            if (draft.children != null) childrenEl.value = draft.children;
        }
    } catch { /* ignore */ }

    function saveDraft() {
        try {
            sessionStorage.setItem('roar_booking_draft', JSON.stringify({
                trip: selectedTrip?.id, option: optionSelect.value,
                start: startEl.value, end: endEl.value,
                adults: adultsEl.value, children: childrenEl.value,
                bkName: document.getElementById('bkName').value,
                bkEmail: document.getElementById('bkEmail').value,
                bkPhone: document.getElementById('bkPhone').value,
                bkCountry: document.getElementById('bkCountry').value,
                bkNotes: document.getElementById('bkNotes').value,
            }));
        } catch { /* storage unavailable */ }
    }

    optionSelect.addEventListener('change', updateSummary);
    [adultsEl, childrenEl].forEach(el => el.addEventListener('input', updateSummary));
    window.addEventListener('roar:currencychange', () => { renderTrips(); updateSummary(); });

    // Preselect via ?trip= param (used by deal cards)
    const wanted = new URLSearchParams(window.location.search).get('trip');
    if (wanted && TRIPS.some(t => t.id === wanted)) selectTrip(wanted);
    else renderTrips();

    document.getElementById('bookingForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        msg.textContent = '';
        msg.className = '';
        if (!selectedTrip) { msg.textContent = 'Please choose a trip first.'; msg.className = 'err'; grid.scrollIntoView({ behavior: 'smooth' }); return; }
        const form = event.target;
        if (!form.reportValidity()) return;
        saveDraft();
        if (!account?.requireAccount(`${window.location.origin}${window.location.pathname}?trip=${selectedTrip.id}`)) return;

        const opt = selectedTrip.options[Number(optionSelect.value)] || selectedTrip.options[0];
        const usd = usdOf(opt);
        const adults = Number(adultsEl.value) || 1;
        const children = Number(childrenEl.value) || 0;
        const noteLines = [
            `Trip option: ${opt.label}`,
            `Guests: ${adults} adult${adults === 1 ? '' : 's'}${children ? ` + ${children} child${children === 1 ? '' : 'ren'}` : ''}`,
        ];
        const country = document.getElementById('bkCountry').value.trim();
        if (country) noteLines.push(`Country of residence: ${country}`);
        const requests = document.getElementById('bkNotes').value.trim();
        if (requests) noteLines.push(`Special requests: ${requests}`);

        const brief = {
            clientName: document.getElementById('bkName').value.trim(),
            clientPhone: document.getElementById('bkPhone').value.trim(),
            targetDates: readDates(),
            totalGuests: guests(),
            tierPreference: `${selectedTrip.name} — ${opt.label}`,
            primaryObjective: `Booking request (${selectedTrip.cat})`,
            notes: noteLines.join('\n'),
            termsAccepted: document.getElementById('bkTerms').checked,
            marketingConsent: document.getElementById('bkMarketing').checked,
            estimatedValue: usd != null ? usd * guests() : null,
        };

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Sending your booking request…';
        try {
            const res = await fetch(`${window.ROAR_CONFIG.apiBase}/leads`, {
                method: 'POST',
                headers: account.headers(),
                body: JSON.stringify(brief),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Unable to submit your booking request.');
            sessionStorage.removeItem('roar_booking_draft');
            form.reset();
            selectedTrip = null;
            renderTrips();
            updateSummary();
            msg.textContent = 'Booking request received — our safari team will reply within 24 hours with your confirmed quote.';
            msg.className = 'ok';
        } catch (error) {
            msg.textContent = error.message;
            msg.className = 'err';
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Request This Booking <i class="fa-solid fa-arrow-right"></i>';
        }
    });
});
