document.addEventListener('DOMContentLoaded', () => {
    const config = window.ROAR_CONFIG;
    const loginPanel = document.getElementById('loginPanel');
    const dashboardPanel = document.getElementById('dashboardPanel');
    const loginError = document.getElementById('loginError');
    const dashboardError = document.getElementById('dashboardError');
    const rows = document.getElementById('leadRows');
    let token = sessionStorage.getItem('roar_admin_token');
    let leads = [];
    let quizResults = [];

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
    const formatMoney = value => value == null ? '—' : new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(value);
    const statusLabels = { new:'New', reviewing:'Reviewing', contacted:'Contacted', proposal_sent:'Proposal sent', won:'Won', lost:'Lost' };

    async function signIn(email, password) {
        const response = await fetch(`${config.apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'content-type':'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Sign-in failed.');
        if (data.user?.role !== 'admin') throw new Error('This account is not authorized for the control desk.');
        token = data.token;
        sessionStorage.setItem('roar_admin_token', token);
        sessionStorage.setItem('roar_admin_email', data.user.email || email);
    }

    async function adminApi(path, method = 'GET', body) {
        const response = await fetch(`${config.apiBase}${path}`, {
            method,
            headers: { authorization: `Bearer ${token}`, 'content-type':'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await response.json();
        if (response.status === 401) logout();
        if (!response.ok) throw new Error(data.message || 'Request failed.');
        return data;
    }

    function statusBadge(status) {
        const key = (status || 'new').toLowerCase().replace(/\s+/g, '_');
        const label = statusLabels[key] || 'New';
        return `<span class="status-badge status-${key.replace(/_/g, '-')}">${label}</span>`;
    }

    async function loadLeads() {
        dashboardError.textContent = '';
        rows.innerHTML = '<tr><td colspan="8" class="empty">Loading briefs…</td></tr>';
        try {
            leads = (await adminApi('/admin/leads')).leads || [];
            renderLeads();
            updateMetrics();
        } catch (error) {
            dashboardError.textContent = error.message;
            rows.innerHTML = '<tr><td colspan="8" class="empty">No lead data available.</td></tr>';
        }
    }

    async function loadQuiz() {
        const quizRows = document.getElementById('quizRows');
        try {
            const data = await adminApi('/admin/quiz');
            quizResults = data.results || [];
            document.getElementById('metricQuiz').textContent = `${quizResults.length} completion${quizResults.length === 1 ? '' : 's'}`;
            if (!quizResults.length) {
                quizRows.innerHTML = '<tr><td colspan="8" class="empty">No quiz completions yet.</td></tr>';
                return;
            }
            quizRows.innerHTML = quizResults.slice(0, 200).map(r => `<tr>
                <td>${escapeHtml(new Date(r.created_at).toLocaleDateString())}</td>
                <td><strong>${escapeHtml(r.traveler_persona)}</strong></td>
                <td>${escapeHtml(r.selected_transit || '—')}</td>
                <td>${escapeHtml(r.selected_lodging || '—')}</td>
                <td>${escapeHtml(r.selected_finale || '—')}</td>
                <td>${escapeHtml(r.selected_travelers || '—')}</td>
                <td>${escapeHtml(r.selected_season || '—')}</td>
                <td>${escapeHtml(r.matched_offer || '—')}</td>
            </tr>`).join('');
        } catch (error) {
            quizRows.innerHTML = '<tr><td colspan="8" class="empty">Quiz data unavailable.</td></tr>';
        }
    }

    async function loadOffers() {
        try {
            const data = await adminApi('/promotion');
            document.getElementById('offerTotal').textContent = data.total ?? 5;
            document.getElementById('offerClaimed').textContent = data.claimed ?? 0;
            document.getElementById('offerRemaining').textContent = data.remaining ?? 5;
            const claims = leads.filter(l => l.launch_offer_claimed);
            const claimRows = document.getElementById('claimRows');
            if (!claims.length) {
                claimRows.innerHTML = '<tr><td colspan="4" class="empty">No offers claimed yet.</td></tr>';
                return;
            }
            claimRows.innerHTML = claims.map(l => `<tr>
                <td>${escapeHtml(new Date(l.created_at).toLocaleDateString())}</td>
                <td>${escapeHtml(l.client_name)}</td>
                <td>${escapeHtml(l.client_email)}</td>
                <td>${formatMoney(l.estimated_value)}</td>
            </tr>`).join('');
        } catch (error) {
            document.getElementById('claimRows').innerHTML = '<tr><td colspan="4" class="empty">Offer data unavailable.</td></tr>';
        }
    }

    function updateMetrics() {
        document.getElementById('metricLeads').textContent = leads.length;
        document.getElementById('metricGuests').textContent = leads.reduce((sum, lead) => sum + Number(lead.total_guests || 0), 0);
        document.getElementById('metricRevenue').textContent = formatMoney(leads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0));
        document.getElementById('metricNew').textContent = leads.filter(lead => lead.status === 'new').length;
    }

    function renderLeads() {
        const filter = document.getElementById('statusFilter').value;
        const query = document.getElementById('leadSearch').value.trim().toLowerCase();
        const visible = leads.filter(lead => {
            const matchesStatus = filter === 'all' || lead.status === filter;
            const haystack = `${lead.client_name} ${lead.client_email} ${lead.primary_objective} ${lead.tier_preference}`.toLowerCase();
            return matchesStatus && (!query || haystack.includes(query));
        });

        if (!visible.length) {
            rows.innerHTML = '<tr><td colspan="8" class="empty">No briefs match this view.</td></tr>';
            return;
        }
        rows.innerHTML = visible.map(lead => `<tr data-lead-id="${escapeHtml(lead.id)}">
            <td>${escapeHtml(new Date(lead.created_at).toLocaleDateString())}<small>${escapeHtml(new Date(lead.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</small></td>
            <td><strong>${escapeHtml(lead.client_name)}</strong><small>${escapeHtml(lead.client_email)}</small></td>
            <td>${escapeHtml(lead.primary_objective || 'Custom journey')}<small>${escapeHtml(lead.target_dates || 'Dates flexible')}</small></td>
            <td>${escapeHtml(lead.total_guests)}</td>
            <td>${escapeHtml(lead.tier_preference || '—')}</td>
            <td>${formatMoney(lead.estimated_value)}</td>
            <td><select data-lead-id="${escapeHtml(lead.id)}">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${lead.status===value?'selected':''}>${label}</option>`).join('')}</select></td>
            <td><button class="view-btn" data-lead-id="${escapeHtml(lead.id)}" type="button"><i class="fa-solid fa-eye"></i> View</button></td>
        </tr>`).join('');

        rows.querySelectorAll('select[data-lead-id]').forEach(select => select.addEventListener('change', async () => {
            select.disabled = true;
            try {
                const { lead } = await adminApi(`/admin/leads/${encodeURIComponent(select.dataset.leadId)}`, 'PATCH', { status: select.value });
                const index = leads.findIndex(item => item.id === lead.id);
                if (index >= 0) leads[index] = lead;
                renderLeads();
                updateMetrics();
            } catch (error) { dashboardError.textContent = error.message; select.disabled = false; }
        }));

        rows.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.leadId)));
    }

    function openModal(id) {
        const lead = leads.find(l => l.id === id);
        if (!lead) return;
        document.getElementById('modalClientName').textContent = lead.client_name;
        const content = document.getElementById('modalContent');
        content.innerHTML = `
            <div class="modal-field"><label>Email</label><p>${escapeHtml(lead.client_email)}</p></div>
            <div class="modal-field"><label>Phone / WhatsApp</label><p>${escapeHtml(lead.whatsapp || '—')}</p></div>
            <div class="modal-field"><label>Travel dates</label><p>${escapeHtml(lead.target_dates || '—')}</p></div>
            <div class="modal-field"><label>Guests</label><p>${escapeHtml(lead.total_guests)}</p></div>
            <div class="modal-field"><label>Travel style</label><p>${escapeHtml(lead.tier_preference || '—')}</p></div>
            <div class="modal-field"><label>Objective</label><p>${escapeHtml(lead.primary_objective || '—')}</p></div>
            <div class="modal-field"><label>Estimated value</label><p>${formatMoney(lead.estimated_value)}</p></div>
            <div class="modal-field"><label>Status</label><p>${statusBadge(lead.status)}</p></div>
            <div class="modal-field full"><label>Notes</label><p>${escapeHtml(lead.notes || 'No notes provided.')}</p></div>
            <div class="modal-field full"><label>Submission</label><p>${escapeHtml(new Date(lead.created_at).toLocaleString())}</p></div>
            <div class="modal-field full"><label>Marketing consent</label><p>${lead.marketing_consent ? 'Yes — opted in to updates' : 'No'}</p></div>
        `;
        document.getElementById('leadModal').hidden = false;
    }

    function closeModal() {
        document.getElementById('leadModal').hidden = true;
    }

    function exportCSV() {
        if (!leads.length) return alert('No leads to export.');
        const headers = ['Date','Name','Email','Guests','Dates','Objective','Tier','Estimate','Status','Notes'];
        const lines = leads.map(l => [
            new Date(l.created_at).toISOString(),
            l.client_name, l.client_email, l.total_guests,
            l.target_dates || '', l.primary_objective || '', l.tier_preference || '',
            l.estimated_value || '', l.status || '', (l.notes || '').replace(/"/g, '""')
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        const blob = new Blob([headers.join(',') + '\n' + lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roar-leads-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function showSection(id) {
        ['leadsSection','quizSection','offersSection'].forEach(s => {
            document.getElementById(s).hidden = s !== id;
        });
        document.querySelectorAll('.admin-nav a').forEach(a => a.classList.toggle('active', a.dataset.section === id.replace('Section','')));
        if (id === 'offersSection') loadOffers();
    }

    function showDashboard() {
        loginPanel.hidden = true;
        dashboardPanel.hidden = false;
        document.getElementById('adminIdentity').textContent = sessionStorage.getItem('roar_admin_email') || 'Authorized admin';
        loadLeads();
        loadQuiz();
        loadOffers();
    }

    function logout() {
        token = null;
        sessionStorage.removeItem('roar_admin_token');
        sessionStorage.removeItem('roar_admin_email');
        dashboardPanel.hidden = true;
        loginPanel.hidden = false;
    }

    document.getElementById('adminLogin').addEventListener('submit', async event => {
        event.preventDefault();
        loginError.textContent = '';
        try {
            await signIn(document.getElementById('adminEmail').value.trim(), document.getElementById('adminPassword').value);
            showDashboard();
        } catch (error) { loginError.textContent = error.message; }
    });

    document.getElementById('adminLogout').addEventListener('click', logout);
    document.getElementById('refreshData').addEventListener('click', () => { loadLeads(); loadQuiz(); loadOffers(); });
    document.getElementById('statusFilter').addEventListener('change', renderLeads);
    document.getElementById('leadSearch').addEventListener('input', renderLeads);
    document.getElementById('exportLeads').addEventListener('click', exportCSV);
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

    document.querySelectorAll('.admin-nav a').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            showSection(link.dataset.section + 'Section');
        });
    });

    if (token) showDashboard();
});
