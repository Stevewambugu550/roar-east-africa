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
    const perPersonDisplay = document.getElementById('perPersonPrice');
    const totalGroupDisplay = document.getElementById('totalGroupPrice');
    let currentEstimate = null;

    function calculateSafariRates() {
        if (!calcPackage || !calcGuests || !calcSeason || !calcAddon) return;
        const basePrice = Number(calcPackage.value);
        const totalGuests = Number(calcGuests.value);
        const seasonalMultiplier = Number(calcSeason.value);
        const experienceAddon = Number(calcAddon.value);
        const singleSupplement = totalGuests === 1 ? 650 : 0;
        const offerPercent = calcOffer ? Number(calcOffer.selectedOptions[0]?.dataset.discount || 0) : 0;
        const rawPerPerson = Math.round(basePrice * seasonalMultiplier + experienceAddon + singleSupplement);
        const rawGroupTotal = rawPerPerson * totalGuests;
        const discountAmount = Math.round(rawGroupTotal * (offerPercent / 100));
        const groupTotal = rawGroupTotal - discountAmount;
        const perPerson = totalGuests > 0 ? Math.round(groupTotal / totalGuests) : rawPerPerson;
        const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        perPersonDisplay.textContent = currency.format(perPerson);
        totalGroupDisplay.textContent = currency.format(groupTotal);
        currentEstimate = {
            packageName: calcPackage.selectedOptions[0].dataset.name,
            guests: totalGuests,
            season: calcSeason.selectedOptions[0].dataset.name,
            addon: calcAddon.selectedOptions[0].dataset.name,
            offer: calcOffer ? calcOffer.selectedOptions[0].dataset.name : 'Standard estimate',
            perPerson,
            groupTotal,
            discountAmount,
        };
    }

    [calcPackage, calcGuests, calcSeason, calcAddon, calcOffer].filter(Boolean).forEach(field => {
        field.addEventListener('change', calculateSafariRates);
    });
    calculateSafariRates();

    document.getElementById('useEstimateBtn')?.addEventListener('click', () => {
        if (!currentEstimate) return;
        const notes = document.getElementById('clientNotes');
        const guests = document.getElementById('guestCount');
        if (guests) guests.value = currentEstimate.guests;
        if (notes) {
            let estimate = `Planning estimate: ${currentEstimate.packageName}; ${currentEstimate.season}; ${currentEstimate.addon}; ${currentEstimate.offer}; $${currentEstimate.perPerson.toLocaleString()} per person / $${currentEstimate.groupTotal.toLocaleString()} group total.`;
            if (currentEstimate.discountAmount) estimate += ` (Includes $${currentEstimate.discountAmount.toLocaleString()} estimated discount).`;
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
            targetDates: document.getElementById('travelDates').value.trim(),
            totalGuests: Number(document.getElementById('guestCount').value),
            tierPreference: document.getElementById('luxuryTier').value,
            primaryObjective: document.getElementById('safariGoal').value,
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
    ];
    let currentQ = 0;
    const scores = { fly: 0, road: 0, lodge: 0, camp: 0, beach: 0, bush: 0 };

    document.getElementById('startQuizBtn')?.addEventListener('click', () => {
        document.getElementById('quiz-intro').style.display = 'none';
        document.getElementById('quiz-window').style.display = 'block';
        currentQ = 0;
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
                currentQ++;
                if (currentQ < quizData.length) renderQuestion();
                else showQuizResult();
            });
            optionsBox.appendChild(btn);
        });
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
        windowBox.innerHTML = `<div style="text-align:center;padding:10px 0">
            <h3 style="font-family:Cormorant Garamond,serif;font-size:28px;color:#151d16;margin-bottom:12px">You profile as a: ${title}</h3>
            <p style="color:#6b6861;font-size:15px;line-height:1.6;margin:0 0 25px">${text}</p>
            <a href="${target}" class="btn-nav" style="text-decoration:none">${cta}</a>
        </div>`;
    }
});
