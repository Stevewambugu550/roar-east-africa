document.addEventListener('DOMContentLoaded', () => {
    const menuButton = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const account = window.roarAccount;
    const accountAction = document.getElementById('accountAction');
    if (account?.isAuthenticated()) {
        accountAction.innerHTML = `<span>Hi, ${account.user.firstName}</span><button type="button">Sign Out</button>`;
        accountAction.querySelector('button').addEventListener('click', () => account.logout());
        const name = document.getElementById('clientName');
        const email = document.getElementById('clientEmail');
        if (name) name.value = `${account.user.firstName} ${account.user.lastName}`;
        if (email) email.value = account.user.email;
    }
    fetch(`${window.ROAR_CONFIG.apiBase}/promotion`).then(response => response.json()).then(promo => {
        const banner = document.getElementById('launchBanner');
        if (promo.remaining > 0) banner.querySelector('span').textContent = `10% off eligible safari services — ${promo.remaining} of 5 founding-client places remain.`;
        else banner.hidden = true;
    }).catch(() => {});

    menuButton?.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.innerHTML = `<i class="fa-solid fa-${open ? 'xmark' : 'bars'}"></i>`;
    });

    navLinks?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuButton?.setAttribute('aria-expanded', 'false');
        if (menuButton) menuButton.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }));

    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.closest('.accordion-item');
            const opening = !item.classList.contains('active');
            document.querySelectorAll('.accordion-item').forEach(other => {
                other.classList.remove('active');
                other.querySelector('.accordion-header')?.setAttribute('aria-expanded', 'false');
            });
            if (opening) item.classList.add('active');
            header.setAttribute('aria-expanded', String(opening));
        });
    });

    document.querySelectorAll('[data-safari]').forEach(link => {
        link.addEventListener('click', () => {
            const goal = document.getElementById('safariGoal');
            if (!goal) return;
            const selected = link.dataset.safari;
            const custom = [...goal.options].find(option => option.text.includes('Bespoke'));
            if (custom) custom.text = selected;
            goal.value = custom?.value || goal.value;
        });
    });

    const plannerIntro = document.querySelector('.planner-intro');
    if (plannerIntro) {
        const month = new Date().getMonth();
        const phases = [
            { months: [0, 1, 2], title: 'Calving Season Planning', text: 'January–March often centers on calving and predator activity in the southern Serengeti. Ask us about a Kenya–Tanzania combination.' },
            { months: [3, 4, 5], title: 'Green Season Planning', text: 'April–June generally brings lush landscapes, dramatic skies, strong birding, and attractive seasonal value. Rainfall and access vary by area.' },
            { months: [6, 7, 8, 9], title: 'Migration Season Planning', text: 'July–October is a high-demand Maasai Mara period. Early planning improves camp choice, but crossings and wildlife movements can never be guaranteed.' },
            { months: [10, 11], title: 'Short-Rains Season Planning', text: 'November–December can bring refreshed landscapes, fewer vehicles, and excellent photography conditions across many regions.' },
        ];
        const phase = phases.find(item => item.months.includes(month));
        const advice = document.createElement('div');
        advice.className = 'season-advisor';
        advice.innerHTML = `<h5><i class="fa-solid fa-cloud-sun"></i> ${phase.title}</h5><p>${phase.text}</p><small>Calendar guidance—not live weather or wildlife tracking.</small>`;
        plannerIntro.appendChild(advice);
    }

    const calcPackage = document.getElementById('calcPackage');
    const calcGuests  = document.getElementById('calcGuests');
    const calcSeason  = document.getElementById('calcSeason');
    const calcAddon   = document.getElementById('calcAddon');
    const calcOffer   = document.getElementById('calcOffer');
    const calcCustomTier = document.getElementById('calcCustomTier');
    const customOptions = document.getElementById('customOptions');
    const customTierRow = document.getElementById('customTierRow');
    const perPersonDisplay = document.getElementById('perPersonPrice');
    const totalGroupDisplay = document.getElementById('totalGroupPrice');
    let currentEstimate = null;

    function getTotalGuests() {
        return Math.min(Math.max(Number(calcGuests?.value) || 2, 1), 100);
    }

    const customNightlyRates = {
        ultra:   { mara: 750, amboseli: 680, samburu: 640, tsavo: 590, diani: 520 },
        premium: { mara: 520, amboseli: 470, samburu: 450, tsavo: 410, diani: 360 },
        classic: { mara: 340, amboseli: 310, samburu: 300, tsavo: 270, diani: 240 },
    };
    const customRegionNames = { mara: 'Maasai Mara', amboseli: 'Amboseli', samburu: 'Samburu', tsavo: 'Tsavo West', diani: 'Diani Beach' };

    function readCustomNights() {
        return {
            mara: Number(document.getElementById('nightsMara')?.value) || 0,
            amboseli: Number(document.getElementById('nightsAmboseli')?.value) || 0,
            samburu: Number(document.getElementById('nightsSamburu')?.value) || 0,
            tsavo: Number(document.getElementById('nightsTsavo')?.value) || 0,
            diani: Number(document.getElementById('nightsDiani')?.value) || 0,
        };
    }

    function toggleCustomFields() {
        const isCustom = calcPackage.value === 'custom';
        if (customOptions) customOptions.hidden = !isCustom;
        if (customTierRow) customTierRow.hidden = !isCustom;
    }

    function calculateSafariRates() {
        if (!calcPackage || !calcGuests || !calcSeason || !calcAddon) return;
        const totalGuests = getTotalGuests();
        const seasonalMultiplier = Number(calcSeason.value);
        const experienceAddon = Number(calcAddon.value);
        const singleSupplement = totalGuests === 1 ? 650 : 0;
        const offerPercent = calcOffer ? Number(calcOffer.selectedOptions[0]?.dataset.discount || 0) : 0;

        let basePrice, packageName, customRoute = [];
        if (calcPackage.value === 'custom') {
            const tier = calcCustomTier ? calcCustomTier.value : 'premium';
            const rates = customNightlyRates[tier] || customNightlyRates.premium;
            const nights = readCustomNights();
            let customBase = 0;
            Object.keys(nights).forEach((region) => {
                if (nights[region] > 0) {
                    customBase += nights[region] * rates[region];
                    customRoute.push(`${customRegionNames[region]} (${nights[region]} nights)`);
                }
            });
            basePrice = customBase;
            packageName = `Custom Safari — ${customRoute.join(', ') || 'no destinations selected'}`;
        } else {
            basePrice = Number(calcPackage.value);
            packageName = calcPackage.selectedOptions[0]?.dataset.name || 'Selected safari';
        }

        const rawPerPerson = Math.round(basePrice * seasonalMultiplier + experienceAddon + singleSupplement);
        const rawGroupTotal = rawPerPerson * totalGuests;
        const discountAmount = Math.round(rawGroupTotal * (offerPercent / 100));
        const groupTotal = rawGroupTotal - discountAmount;
        const perPerson = totalGuests > 0 ? Math.round(groupTotal / totalGuests) : rawPerPerson;
        const fmt = window.formatRoarPrice || (usd => `$${usd.toLocaleString()}`);
        perPersonDisplay.textContent = fmt(perPerson);
        totalGroupDisplay.textContent = fmt(groupTotal);
        currentEstimate = {
            packageName,
            guests: totalGuests,
            season: calcSeason.selectedOptions[0]?.dataset.name || '',
            addon: calcAddon.selectedOptions[0]?.dataset.name || '',
            offer: calcOffer ? calcOffer.selectedOptions[0]?.dataset.name : 'Standard estimate',
            perPerson,
            groupTotal,
            discountAmount,
        };
    }

    [calcPackage, calcGuests, calcSeason, calcAddon, calcOffer, calcCustomTier].filter(Boolean).forEach(field => {
        const eventType = field.tagName === 'INPUT' ? 'input' : 'change';
        field.addEventListener(eventType, () => { toggleCustomFields(); calculateSafariRates(); });
    });
    document.querySelectorAll('#customOptions input[type="number"]').forEach(input => {
        input.addEventListener('input', calculateSafariRates);
    });
    toggleCustomFields();
    calculateSafariRates();
    window.addEventListener('roar:currencychange', calculateSafariRates);

    document.getElementById('useEstimateBtn')?.addEventListener('click', () => {
        if (!currentEstimate) return;
        const notes = document.getElementById('clientNotes');
        const guests = document.getElementById('guestCount');
        if (guests) guests.value = currentEstimate.guests;
        if (notes) {
            const fmt = window.formatRoarPrice || (usd => `$${usd.toLocaleString()}`);
            let estimate = `Planning estimate: ${currentEstimate.packageName}; ${currentEstimate.season}; ${currentEstimate.addon}; ${currentEstimate.offer}; ${fmt(currentEstimate.perPerson)} per person / ${fmt(currentEstimate.groupTotal)} group total.`;
            if (currentEstimate.discountAmount) estimate += ` (Includes ${fmt(currentEstimate.discountAmount)} estimated discount).`;
            notes.value = notes.value ? `${notes.value}\n${estimate}` : estimate;
        }
    });

    const migrationWindow = sessionStorage.getItem('roar_migration_window');
    if (migrationWindow) {
        const goal = document.getElementById('safariGoal');
        const notes = document.getElementById('clientNotes');
        if (goal) goal.value = 'Great Migration River Crossings';
        if (notes) notes.value = `Preferred migration window: ${migrationWindow}`;
        sessionStorage.removeItem('roar_migration_window');
    }

    const luxuryTierSelect = document.getElementById('luxuryTier');
    const luxuryTierOtherWrap = document.getElementById('luxuryTierOtherWrap');
    const luxuryTierOther = document.getElementById('luxuryTierOther');
    const safariGoalSelect = document.getElementById('safariGoal');
    const safariGoalOtherWrap = document.getElementById('safariGoalOtherWrap');
    const safariGoalOther = document.getElementById('safariGoalOther');

    function toggleOtherField(select, wrap) {
        if (!select || !wrap) return;
        const isOther = select.value.includes('Other');
        wrap.hidden = !isOther;
        if (!isOther && wrap.querySelector('input')) wrap.querySelector('input').value = '';
    }

    [luxuryTierSelect, safariGoalSelect].forEach(select => {
        if (!select) return;
        select.addEventListener('change', () => {
            toggleOtherField(luxuryTierSelect, luxuryTierOtherWrap);
            toggleOtherField(safariGoalSelect, safariGoalOtherWrap);
        });
    });
    toggleOtherField(luxuryTierSelect, luxuryTierOtherWrap);
    toggleOtherField(safariGoalSelect, safariGoalOtherWrap);

    // Travel date pickers
    const travelStart = document.getElementById('travelStart');
    const travelEnd = document.getElementById('travelEnd');
    const datesFlexible = document.getElementById('datesFlexible');
    const todayIso = new Date().toISOString().slice(0, 10);
    [travelStart, travelEnd].forEach((d) => { if (d) d.min = todayIso; });
    datesFlexible?.addEventListener('change', () => {
        [travelStart, travelEnd].forEach((d) => {
            if (!d) return;
            d.disabled = datesFlexible.checked;
            if (datesFlexible.checked) d.value = '';
        });
    });
    const syncDateRange = () => {
        if (travelStart?.value && travelEnd?.value && travelEnd.value < travelStart.value) {
            const tmp = travelStart.value;
            travelStart.value = travelEnd.value;
            travelEnd.value = tmp;
        }
    };
    travelStart?.addEventListener('change', () => {
        if (travelEnd) travelEnd.min = travelStart.value || todayIso;
        syncDateRange();
    });
    travelEnd?.addEventListener('change', syncDateRange);

    function readTargetDates() {
        if (datesFlexible?.checked) return 'Dates flexible';
        const fmt = (v) => new Date(`${v}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const s = travelStart?.value;
        const e = travelEnd?.value;
        if (s && e) return `${fmt(s)} → ${fmt(e)}`;
        if (s) return `From ${fmt(s)}`;
        if (e) return `Until ${fmt(e)}`;
        return '';
    }

    const leadForm = document.getElementById('safariLeadForm');
    leadForm?.addEventListener('submit', async event => {
        event.preventDefault();
        if (!leadForm.reportValidity()) return;
        if (!account?.requireAccount(`${window.location.origin}${window.location.pathname}#planner`)) return;

        const name = document.getElementById('clientName').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const brief = {
            brand: 'Roar East Africa',
            clientName: name,
            clientEmail: email,
            targetDates: readTargetDates(),
            totalGuests: Number(document.getElementById('guestCount').value),
            tierPreference: document.getElementById('luxuryTier').value.includes('Other') && luxuryTierOther?.value.trim()
                ? `${document.getElementById('luxuryTier').value}: ${luxuryTierOther.value.trim()}`
                : document.getElementById('luxuryTier').value,
            primaryObjective: document.getElementById('safariGoal').value.includes('Other') && safariGoalOther?.value.trim()
                ? `${document.getElementById('safariGoal').value}: ${safariGoalOther.value.trim()}`
                : document.getElementById('safariGoal').value,
            notes: document.getElementById('clientNotes').value.trim(),
            termsAccepted: document.getElementById('termsConsent').checked,
            marketingConsent: document.getElementById('marketingConsent').checked,
            estimatedValue: currentEstimate?.groupTotal || null,
            website: document.getElementById('website').value,
            submissionTime: new Date().toISOString(),
        };

        const submitButton = leadForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Sending your brief…';
        try {
            const response = await fetch(`${window.ROAR_CONFIG.apiBase}/leads`, {
                method: 'POST',
                headers: account.headers(),
                body: JSON.stringify(brief),
            });
            const data = await response.json();
            if (response.status === 401) {
                account.logout();
                return;
            }
            if (!response.ok) throw new Error(data.message || 'Unable to submit your inquiry.');
        } catch (error) {
            let errorBox = document.getElementById('leadSubmitError');
            if (!errorBox) {
                errorBox = document.createElement('p');
                errorBox.id = 'leadSubmitError';
                errorBox.style.cssText = 'color:#ffb4ab;font-size:11px;line-height:1.6;margin-top:12px';
                leadForm.appendChild(errorBox);
            }
            errorBox.textContent = `${error.message} Please try again or contact us on WhatsApp.`;
            submitButton.disabled = false;
            submitButton.innerHTML = 'Submit My Safari Brief <i class="fa-solid fa-arrow-right"></i>';
            return;
        }

        const formBox = document.querySelector('.planner-form-box');
        formBox.style.opacity = '0';
        setTimeout(() => {
            formBox.innerHTML = `
                <div style="text-align:center;padding:45px 15px">
                    <div style="width:68px;height:68px;background:#d4af37;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px">
                        <i class="fa-solid fa-envelope-open-text" style="font-size:28px;color:#151d16"></i>
                    </div>
                    <h3 style="font:400 34px 'Cormorant Garamond',serif;color:#d4af37;margin-bottom:14px">Your Safari Brief Has Roared In</h3>
                    <p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,.7)">Asante sana, <strong></strong>. Your ideas are ready for our private journey planning desk.</p>
                    <p style="font-size:12px;color:rgba(255,255,255,.48);margin-top:12px">A safari specialist will contact you at <span></span> within 24 hours.</p>
                    <p id="leadDeliveryStatus" style="font-size:10px;color:rgba(255,255,255,.4);margin-top:10px"></p>
                </div>`;
            formBox.querySelector('strong').textContent = name;
            formBox.querySelector('span').textContent = email;
            formBox.querySelector('#leadDeliveryStatus').textContent = 'Your brief was securely added to our planning desk.';
            formBox.style.opacity = '1';
        }, 280);
    });

    // Safari persona quiz
    const quizData = [
        { q: 'How do you prefer to travel between parks?', a: [{ t: 'Short scenic flights and more time on the ground', v: 'fly' }, { t: 'Private 4×4 road journeys through the landscapes', v: 'road' }] },
        { q: 'Which accommodation mood suits you?', a: [{ t: 'Glass-fronted suites with private plunge pools', v: 'lodge' }, { t: 'Intimate canvas tents with campfire evenings', v: 'camp' }] },
        { q: 'What is your ideal safari finale?', a: [{ t: 'A few barefoot days on a quiet Indian Ocean beach', v: 'beach' }, { t: 'More wildlife, culture, and conservation time inland', v: 'bush' }] },
        { q: 'Who are you traveling with?', a: [
            { t: 'Solo adventurer', v: 'solo' },
            { t: 'Couple or celebration', v: 'couple' },
            { t: 'Family with children', v: 'family' },
            { t: 'Group of friends / colleagues', v: 'group' },
        ] },
        { q: 'When are you hoping to travel?', a: [
            { t: 'July–October Great Migration peak', v: 'peak' },
            { t: 'January–March calving / shoulder season', v: 'shoulder' },
            { t: 'April–June green season', v: 'green' },
            { t: 'November–December short rains', v: 'shortrains' },
        ] },
    ];
    let currentQ = 0;
    const scores = { fly: 0, road: 0, lodge: 0, camp: 0, beach: 0, bush: 0, solo: 0, couple: 0, family: 0, group: 0, peak: 0, shoulder: 0, green: 0, shortrains: 0 };
    let selectedAnswers = [];

    document.getElementById('startQuizBtn')?.addEventListener('click', () => {
        document.getElementById('quiz-intro').style.display = 'none';
        document.getElementById('quiz-window').style.display = 'block';
        currentQ = 0;
        selectedAnswers = [];
        for (const k of Object.keys(scores)) scores[k] = 0;
        renderQuestion();
    });

    function renderQuestion() {
        document.getElementById('quiz-question').textContent = quizData[currentQ].q;
        const optionsBox = document.getElementById('quiz-options');
        optionsBox.innerHTML = '';
        quizData[currentQ].a.forEach((opt) => {
            const btn = document.createElement('button');
            btn.textContent = opt.t;
            btn.style.cssText = 'padding:15px;background:#fdfbf7;border:1px solid #dcd7ca;text-align:left;cursor:pointer;font-weight:500;font-size:14px;color:#151d16;border-radius:2px;transition:background .15s,border-color .15s';
            btn.addEventListener('mouseenter', () => { btn.style.background = '#f8f4ec'; btn.style.borderColor = '#d4af37'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = '#fdfbf7'; btn.style.borderColor = '#dcd7ca'; });
            btn.addEventListener('click', () => {
                scores[opt.v]++;
                selectedAnswers.push(opt.t);
                currentQ++;
                if (currentQ < quizData.length) renderQuestion();
                else showQuizResult();
            });
            optionsBox.appendChild(btn);
        });
    }

    async function recordQuizResult(title, transit, lodging, finale, travelers, season, offer) {
        try {
            await fetch(`${window.ROAR_CONFIG.apiBase}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    traveler_persona: title.replace(/–/g, '-'),
                    selected_transit: transit.replace(/–/g, '-'),
                    selected_lodging: lodging.replace(/–/g, '-'),
                    selected_finale: finale.replace(/–/g, '-'),
                    selected_travelers: travelers.replace(/–/g, '-'),
                    selected_season: season.replace(/–/g, '-'),
                    matched_offer: offer.replace(/–/g, '-'),
                }),
            });
        } catch (err) {
            console.error('Quiz tracking failed:', err);
        }
    }

    function pickMatchedOffer() {
        const companion = Object.entries({ couple: scores.couple, family: scores.family, group: scores.group, solo: scores.solo })
            .sort((a, b) => b[1] - a[1])[0][0];
        const season = Object.entries({ peak: scores.peak, shoulder: scores.shoulder, green: scores.green, shortrains: scores.shortrains })
            .sort((a, b) => b[1] - a[1])[0][0];
        const offers = {
            couple: { label: "Honeymoon & Celebration", desc: "One partner receives 50% off the safari rate (25% off the couple's total), plus a private bush dinner when available.", cta: "Claim the Celebration Offer", target: "#special-offers" },
            family: { label: "Family Safari", desc: "Children under 12 sharing with parents receive 50% off. Family tents, flexible drives, and airport meet-and-greet included.", cta: "Claim the Family Offer", target: "#special-offers" },
            group: { label: "Group of 6+", desc: "Private group departures save 10% off the total itinerary. Your own vehicle, your own pace.", cta: "Claim the Group Offer", target: "#special-offers" },
            solo: { label: "Solo-Friendly Planning", desc: "No single-supplement stress on selected dates. We pair you with the right guide and camp setup.", cta: "Plan a Solo Safari", target: "#planner" },
        };
        let offer = offers[companion];
        if (season === 'green') {
            offer = { label: "Green Season Escape", desc: "April–June travel saves up to 15% on lodge rates, with fewer vehicles and lush landscapes. Includes a complimentary cultural visit.", cta: "Claim the Green Season Offer", target: "#special-offers" };
        }
        return { personaCompanion: companion, personaSeason: season, ...offer };
    }

    function showQuizResult() {
        const windowBox = document.getElementById('quiz-window');
        const preferFly = scores.fly >= scores.road;
        const preferLodge = scores.lodge >= scores.camp;
        const preferBeach = scores.beach >= scores.bush;
        let title, text, cta, target;
        if (preferFly && preferBeach) {
            title = 'Sky Safari & Indian Ocean Escape';
            text = 'You value time, aerial perspective, and a rewarding beach finale — our 10-day Bush & Surf journey is built around you.';
            cta = 'Inspect the Grand Savanna & Diani Waters';
            target = '#itineraries';
        } else if (preferFly || preferLodge) {
            title = 'Sky Safari Connoisseur';
            text = 'You gravitate toward premium camps, fly-in logistics, and concentrated wildlife access — our 7-day Sky Safari & Mara Migration fits perfectly.';
            cta = 'Inspect the Sky Safari & Mara Package';
            target = '#itineraries';
        } else if (preferBeach) {
            title = 'Classic Explorer with a Beach Finale';
            text = 'You want authentic road safari rhythm followed by ocean downtime — the Grand Savanna & Diani Waters route is your match.';
            cta = 'Inspect the Grand Savanna Circuit';
            target = '#itineraries';
        } else {
            title = 'Classic Explorer';
            text = 'You favor raw, immersive wildlife time, culture, and open-vehicle photography — the Sky Safari can be customised with longer road sectors for you.';
            cta = 'Start Planning Your Classic Safari';
            target = '#planner';
        }
        const offer = pickMatchedOffer();
        const calcOffer = document.getElementById('calcOffer');
        if (calcOffer) {
            const map = { 'Honeymoon & Celebration': 'honeymoon25', 'Family Safari': 'launch10', 'Group of 6+': 'group10', 'Green Season Escape': 'none', 'Solo-Friendly Planning': 'none' };
            if (map[offer.label]) {
                calcOffer.value = map[offer.label];
                if (typeof calculateSafariRates === 'function') calculateSafariRates();
            }
        }
        recordQuizResult(title, selectedAnswers[0], selectedAnswers[1], selectedAnswers[2], selectedAnswers[3], selectedAnswers[4], offer.label);
        windowBox.innerHTML = `<div style="text-align:center;padding:10px 0">
            <h3 style="font-family:Cormorant Garamond,serif;font-size:28px;color:#151d16;margin-bottom:12px">You profile as a: ${title}</h3>
            <p style="color:#6b6861;font-size:15px;line-height:1.6;margin:0 0 20px">${text}</p>
            <div style="background:#f8f4ec;border:1px solid #e8e0d3;border-radius:4px;padding:22px;margin:0 0 25px;text-align:left">
                <h4 style="font-family:var(--font-serif),serif;color:#a36a3e;font-size:20px;margin-bottom:8px">Recommended offer: ${offer.label}</h4>
                <p style="color:#6b6861;font-size:13.5px;line-height:1.6;margin:0 0 15px">${offer.desc}</p>
                <a href="${offer.target}" class="btn-nav" style="text-decoration:none">${offer.cta}</a>
            </div>
            <a href="${target}" class="btn-nav" style="text-decoration:none;background:transparent;border:1px solid #151d16;color:#151d16">${cta}</a>
        </div>`;
    }

    // Premium bundle selection — fills planner notes and pre-sets estimate
    document.querySelectorAll('[data-bundle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const bundleName = btn.dataset.bundle;
            const notes = document.getElementById('clientNotes');
            if (notes) {
                notes.value = `[SELECTED BUNDLE]: I would like to lock in and apply the premium "${bundleName}" inclusions to this custom safari brief.\n\nAdditional trip preferences: `;
                notes.style.borderColor = '#d4af37';
                notes.style.backgroundColor = 'rgba(212,175,55,0.05)';
                setTimeout(() => { notes.style.backgroundColor = ''; notes.style.borderColor = ''; }, 1500);
            }
            const calcOffer = document.getElementById('calcOffer');
            const calcPackage = document.getElementById('calcPackage');
            if (bundleName.includes('Romance')) {
                if (calcPackage) calcPackage.value = '2950';
                if (calcOffer) calcOffer.value = 'honeymoon25';
            } else if (bundleName.includes('Family')) {
                if (calcPackage) calcPackage.value = '2950';
                if (calcOffer) calcOffer.value = 'group10';
            } else if (bundleName.includes('Surf')) {
                if (calcPackage) calcPackage.value = '4200';
                if (calcOffer) calcOffer.value = 'none';
            }
            if (typeof calculateSafariRates === 'function') calculateSafariRates();
        });
    });

    // Seasonal wildlife radar
    const radarData = {
        mara: {
            title: 'Maasai Mara National Reserve',
            desc: 'Peak predator viewing and the Great Migration river crossings from July to October. Big cats remain excellent year-round across the conservancies.',
            cats: 'Excellent',
            herds: 'Mega herds Jul–Oct',
            species: ['Black-maned lion coalitions', 'Cheetah along riverine corridors', 'Wildebeest & zebra crossings'],
        },
        amboseli: {
            title: 'Amboseli Plains',
            desc: 'Elephant herds concentrate around central swamps beneath Kilimanjaro. Strong photography conditions, especially at dawn and dusk.',
            cats: 'Moderate',
            herds: 'Dense elephant groups',
            species: ['Matriarch elephant herds', 'Spotted hyena clans', 'Burchell\'s zebra & wildebeest'],
        },
        samburu: {
            title: 'Samburu Arid Corridor',
            desc: 'Dry-country special species gather along the Ewaso Nyiro River. Leopard sightings are reliable in riverine trees.',
            cats: 'Good',
            herds: 'Streamed riverine groups',
            species: ['Reticulated giraffe', 'Grevy\'s zebra', 'Leopard in canopy shade'],
        },
    };

    function renderRadar(regionKey) {
        const data = radarData[regionKey];
        if (!data) return;
        document.querySelectorAll('.radar-btn').forEach((btn) => btn.classList.toggle('active-radar', btn.dataset.radar === regionKey));
        document.getElementById('radar-title').textContent = data.title;
        document.getElementById('radar-desc').textContent = data.desc;
        document.getElementById('stat-cats').textContent = data.cats;
        document.getElementById('stat-herds').textContent = data.herds;
        const speciesBox = document.getElementById('radar-species');
        speciesBox.innerHTML = data.species.map((sp) => `<li><i class="fa-solid fa-paw" style="color:#d4af37;margin-right:10px"></i> ${sp}</li>`).join('');
    }

    document.querySelectorAll('.radar-btn').forEach((btn) => {
        btn.addEventListener('click', () => renderRadar(btn.dataset.radar));
    });

    // Dynamic multi-destination circuit builder
    let selectedCircuitDestinations = [];
    const costPerDestinationBlock = 1200;

    function updateCircuitBuilder() {
        const summary = document.getElementById('circuitSummaryTotal');
        const total = selectedCircuitDestinations.length * costPerDestinationBlock;
        const fmt = window.formatRoarPrice || (usd => `$${usd.toLocaleString()}`);
        if (summary) summary.textContent = total > 0 ? fmt(total) : fmt(0);

        const notes = document.getElementById('clientNotes');
        if (notes && selectedCircuitDestinations.length > 0) {
            notes.value = `[CUSTOM CIRCUIT SELECTED]: Preferred chained route: ${selectedCircuitDestinations.join(' → ')}.\n\nAdditional trip preferences: `;
        }
    }

    document.querySelectorAll('[data-circuit]').forEach((chip) => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const name = chip.dataset.circuit;
            if (chip.classList.contains('selected')) {
                if (!selectedCircuitDestinations.includes(name)) selectedCircuitDestinations.push(name);
            } else {
                selectedCircuitDestinations = selectedCircuitDestinations.filter((item) => item !== name);
            }
            updateCircuitBuilder();
        });
    });
    window.addEventListener('roar:currencychange', updateCircuitBuilder);

    // Deals listing category filter
    document.querySelectorAll('.deals-filter button').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.deals-filter button').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('.deal-card').forEach((card) => {
                card.style.display = (filter === 'all' || card.dataset.cat === filter) ? '' : 'none';
            });
        });
    });

    // Footer newsletter subscription
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        const newsletterMsg = document.getElementById('newsletterMsg');
        newsletterForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            newsletterMsg.textContent = '';
            const email = document.getElementById('newsletterEmail').value.trim();
            try {
                const res = await fetch(`${window.ROAR_CONFIG.apiBase}/subscribe`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Unable to subscribe.');
                newsletterForm.reset();
                newsletterMsg.textContent = data.message || 'Subscribed — welcome aboard.';
                newsletterMsg.className = 'ok';
            } catch (error) {
                newsletterMsg.textContent = error.message;
                newsletterMsg.className = 'err';
            }
        });
    }
});
