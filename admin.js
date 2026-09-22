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
    let customers = [];
    let reviews = [];

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

    async function loadCustomers() {
        const customerRows = document.getElementById('customerRows');
        try {
            const data = await adminApi('/admin/customers');
            customers = data.customers || [];
            const active = customers.filter(c => (c.account_status || 'active') === 'active').length;
            document.getElementById('metricCustomers').textContent = `${active}/${customers.length} active`;
            if (!customers.length) {
                customerRows.innerHTML = '<tr><td colspan="6" class="empty">No customer accounts yet.</td></tr>';
                return;
            }
            customerRows.innerHTML = customers.slice(0, 200).map(c => {
                const suspended = (c.account_status || 'active') === 'suspended';
                return `<tr>
                <td>${escapeHtml(new Date(c.created_at).toLocaleDateString())}</td>
                <td><strong>${escapeHtml(`${c.first_name} ${c.last_name}`)}</strong></td>
                <td>${escapeHtml(c.email)}</td>
                <td>
                    <select class="status-select role-select" data-customer-id="${escapeHtml(c.id)}">
                        <option value="customer" ${c.role === 'customer' ? 'selected' : ''}>Customer</option>
                        <option value="admin" ${c.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td><span class="status-badge ${suspended ? 'status-lost' : 'status-won'}">${suspended ? 'Suspended' : 'Active'}</span></td>
                <td class="action-cell">
                    <button class="view-btn suspend-btn" data-customer-id="${escapeHtml(c.id)}" data-status="${suspended ? 'active' : 'suspended'}" type="button"><i class="fa-solid ${suspended ? 'fa-unlock' : 'fa-ban'}"></i> ${suspended ? 'Restore' : 'Suspend'}</button>
                    <button class="danger-btn customer-delete-btn" data-customer-id="${escapeHtml(c.id)}" type="button"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </td>
            </tr>`; }).join('');

            customerRows.querySelectorAll('.role-select').forEach(select => select.addEventListener('change', async () => {
                select.disabled = true;
                try {
                    await adminApi(`/admin/customers/${encodeURIComponent(select.dataset.customerId)}`, 'PATCH', { role: select.value });
                    loadCustomers();
                } catch (error) { dashboardError.textContent = error.message; select.disabled = false; }
            }));
            customerRows.querySelectorAll('.suspend-btn').forEach(btn => btn.addEventListener('click', async () => {
                const c = customers.find(x => x.id === btn.dataset.customerId);
                const verb = btn.dataset.status === 'suspended' ? 'suspend login access for' : 'restore login access for';
                if (!confirm(`Are you sure you want to ${verb} ${c ? `${c.first_name} ${c.last_name}` : 'this account'}?`)) return;
                try {
                    await adminApi(`/admin/customers/${encodeURIComponent(btn.dataset.customerId)}`, 'PATCH', { account_status: btn.dataset.status });
                    loadCustomers();
                } catch (error) { dashboardError.textContent = error.message; }
            }));
            customerRows.querySelectorAll('.customer-delete-btn').forEach(btn => btn.addEventListener('click', async () => {
                const c = customers.find(x => x.id === btn.dataset.customerId);
                if (!confirm(`Permanently delete the account for ${c ? `${c.first_name} ${c.last_name} (${c.email})` : 'this customer'}? This cannot be undone.`)) return;
                try {
                    await adminApi(`/admin/customers/${encodeURIComponent(btn.dataset.customerId)}`, 'DELETE');
                    loadCustomers();
                } catch (error) { dashboardError.textContent = error.message; }
            }));
        } catch (error) {
            customerRows.innerHTML = '<tr><td colspan="6" class="empty">Customer data unavailable.</td></tr>';
        }
    }

    async function loadReviews() {
        const reviewRows = document.getElementById('reviewRows');
        try {
            const data = await adminApi('/admin/reviews');
            reviews = data.reviews || [];
            const pending = reviews.filter(r => r.status === 'pending').length;
            document.getElementById('metricReviews').textContent = `${reviews.length} review${reviews.length === 1 ? '' : 's'}${pending ? ` · ${pending} pending` : ''}`;
            if (!reviews.length) {
                reviewRows.innerHTML = '<tr><td colspan="7" class="empty">No reviews yet.</td></tr>';
                return;
            }
            reviewRows.innerHTML = reviews.slice(0, 200).map(r => `<tr>
                <td>${escapeHtml(new Date(r.created_at).toLocaleDateString())}</td>
                <td><strong>${escapeHtml(r.reviewer_name)}</strong><span class="sub">${escapeHtml(r.reviewer_location || '')}${r.is_demo ? ' · demo' : ''}</span></td>
                <td><span class="stars" style="color:#d4af37;letter-spacing:2px">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></td>
                <td>${escapeHtml(r.trip_name || '—')}</td>
                <td class="review-cell">${escapeHtml(r.review_text)}</td>
                <td><span class="status-badge status-${r.status === 'approved' ? 'won' : r.status === 'rejected' ? 'lost' : 'new'}">${escapeHtml(r.status)}</span></td>
                <td class="action-cell">
                    <select class="status-select review-status-select" data-review-id="${escapeHtml(r.id)}">
                        <option value="pending" ${r.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${r.status === 'approved' ? 'selected' : ''}>Approve</option>
                        <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>Reject</option>
                    </select>
                    <button class="danger-btn review-delete-btn" data-review-id="${escapeHtml(r.id)}" type="button"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </td>
            </tr>`).join('');

            reviewRows.querySelectorAll('.review-status-select').forEach(select => select.addEventListener('change', async () => {
                select.disabled = true;
                try {
                    await adminApi(`/admin/reviews/${encodeURIComponent(select.dataset.reviewId)}`, 'PATCH', { status: select.value });
                    loadReviews();
                } catch (error) { dashboardError.textContent = error.message; select.disabled = false; }
            }));
            reviewRows.querySelectorAll('.review-delete-btn').forEach(btn => btn.addEventListener('click', async () => {
                if (!confirm('Permanently delete this review?')) return;
                try {
                    await adminApi(`/admin/reviews/${encodeURIComponent(btn.dataset.reviewId)}`, 'DELETE');
                    loadReviews();
                } catch (error) { dashboardError.textContent = error.message; }
            }));
        } catch (error) {
            reviewRows.innerHTML = '<tr><td colspan="7" class="empty">Review data unavailable.</td></tr>';
        }
    }

    async function loadSubscribers() {
        const subRows = document.getElementById('subscriberRows');
        try {
            const data = await adminApi('/admin/subscribers');
            const subs = data.subscribers || [];
            document.getElementById('metricSubscribers').textContent = `${subs.length} subscriber${subs.length === 1 ? '' : 's'}`;
            if (!subs.length) {
                subRows.innerHTML = '<tr><td colspan="2" class="empty">No newsletter subscribers yet.</td></tr>';
                return;
            }
            subRows.innerHTML = subs.slice(0, 200).map(s => `<tr>
                <td>${escapeHtml(new Date(s.created_at).toLocaleDateString())}</td>
                <td>${escapeHtml(s.email)}</td>
            </tr>`).join('');
        } catch (error) {
            subRows.innerHTML = '<tr><td colspan="2" class="empty">Subscriber data unavailable.</td></tr>';
        }
    }

    function updateStatusBars() {
        const counts = { new:0, reviewing:0, contacted:0, proposal_sent:0, won:0, lost:0 };
        leads.forEach(l => { counts[l.status || 'new']++; });
        const max = Math.max(...Object.values(counts), 1);
        const bars = document.querySelectorAll('#statusBars .status-bar');
        const keys = ['new','reviewing','contacted','proposal_sent','won','lost'];
        bars.forEach((bar, index) => {
            const count = counts[keys[index]] || 0;
            bar.querySelector('strong').textContent = count;
            bar.querySelector('i').style.width = `${(count / max) * 100}%`;
        });
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
        updateStatusBars();
    }

    function renderLeads() {
        const filter = document.getElementById('statusFilter').value;
        const query = document.getElementById('leadSearch').value.trim().toLowerCase();
        const visible = leads.filter(lead => {
            const matchesStatus = filter === 'all' || lead.status === filter;
            const haystack = `${lead.client_name} ${lead.client_email} ${lead.primary_objective} ${lead.tier_preference}`.toLowerCase();
            return matchesStatus && (!query || haystack.includes(query));
        });

        document.querySelector('#dashboardPanel .empty-state')?.remove();
        if (!leads.length) {
            document.querySelector('.admin-container').insertAdjacentHTML('beforeend', `
                <div class="empty-state">
                    <h3>No safari briefs yet</h3>
                    <p>Your dashboard is connected and ready. Share the website link to start receiving inquiries. When guests submit their safari briefs, they will appear here.</p>
                </div>
            `);
        }

        if (!visible.length) {
            rows.innerHTML = '<tr><td colspan="8" class="empty">No briefs match this view.</td></tr>';
            return;
        }

        rows.innerHTML = visible.map(lead => `<tr data-lead-id="${escapeHtml(lead.id)}">
            <td>${escapeHtml(new Date(lead.created_at).toLocaleDateString())}<span class="sub">${escapeHtml(new Date(lead.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</span></td>
            <td><strong>${escapeHtml(lead.client_name)}</strong><span class="sub">${escapeHtml(lead.client_email)}</span></td>
            <td>${escapeHtml(lead.primary_objective || 'Custom journey')}<span class="sub">${escapeHtml(lead.target_dates || 'Dates flexible')}</span></td>
            <td>${escapeHtml(lead.total_guests)}</td>
            <td>${escapeHtml(lead.tier_preference || '—')}</td>
            <td>${formatMoney(lead.estimated_value)}</td>
            <td>${statusBadge(lead.status)}</td>
            <td class="action-cell">
                <select class="status-select" data-lead-id="${escapeHtml(lead.id)}">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${lead.status===value?'selected':''}>${label}</option>`).join('')}</select>
                <button class="view-btn" data-lead-id="${escapeHtml(lead.id)}" type="button"><i class="fa-solid fa-eye"></i> View</button>
                <button class="view-btn edit-btn" data-lead-id="${escapeHtml(lead.id)}" type="button"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="danger-btn" data-lead-id="${escapeHtml(lead.id)}" type="button"><i class="fa-solid fa-trash-can"></i> Delete</button>
            </td>
        </tr>`).join('');

        rows.querySelectorAll('select.status-select').forEach(select => select.addEventListener('change', async () => {
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
        rows.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.leadId)));
        rows.querySelectorAll('.danger-btn').forEach(btn => btn.addEventListener('click', () => deleteLead(btn.dataset.leadId)));
    }

    function openEditModal(id) {
        const lead = leads.find(l => l.id === id);
        if (!lead) return;
        document.getElementById('editLeadId').value = lead.id;
        document.getElementById('editClientName').value = lead.client_name || '';
        document.getElementById('editClientEmail').value = lead.client_email || '';
        document.getElementById('editTargetDates').value = lead.target_dates || '';
        document.getElementById('editTotalGuests').value = lead.total_guests || '';
        document.getElementById('editTierPreference').value = lead.tier_preference || '';
        document.getElementById('editPrimaryObjective').value = lead.primary_objective || '';
        document.getElementById('editEstimatedValue').value = lead.estimated_value || '';
        document.getElementById('editStatus').value = lead.status || 'new';
        document.getElementById('editNotes').value = lead.notes || '';
        document.getElementById('editModal').hidden = false;
    }

    async function deleteLead(id) {
        const lead = leads.find(l => l.id === id);
        if (!lead) return;
        if (!confirm(`Delete the brief from ${lead.client_name}? This cannot be undone.`)) return;
        try {
            await adminApi(`/admin/leads/${encodeURIComponent(id)}`, 'DELETE');
            leads = leads.filter(l => l.id !== id);
            renderLeads();
            updateMetrics();
        } catch (error) { dashboardError.textContent = error.message; }
    }

    async function submitEdit(event) {
        event.preventDefault();
        const id = document.getElementById('editLeadId').value;
        const payload = {
            client_name: document.getElementById('editClientName').value.trim(),
            client_email: document.getElementById('editClientEmail').value.trim(),
            target_dates: document.getElementById('editTargetDates').value.trim(),
            total_guests: Number(document.getElementById('editTotalGuests').value),
            tier_preference: document.getElementById('editTierPreference').value.trim(),
            primary_objective: document.getElementById('editPrimaryObjective').value.trim(),
            estimated_value: document.getElementById('editEstimatedValue').value ? Number(document.getElementById('editEstimatedValue').value) : null,
            status: document.getElementById('editStatus').value,
            notes: document.getElementById('editNotes').value.trim(),
        };
        try {
            const { lead } = await adminApi(`/admin/leads/${encodeURIComponent(id)}`, 'PUT', payload);
            const index = leads.findIndex(l => l.id === lead.id);
            if (index >= 0) leads[index] = lead;
            renderLeads();
            updateMetrics();
            document.getElementById('editModal').hidden = true;
        } catch (error) { dashboardError.textContent = error.message; }
    }

    function openModal(id) {
        const lead = leads.find(l => l.id === id);
        const nameEl = document.getElementById('modalClientName');
        const content = document.getElementById('modalContent');
        if (!lead) {
            nameEl.textContent = 'Lead not found';
            content.innerHTML = '<div class="modal-field full"><p>This lead could not be loaded. Try refreshing the dashboard.</p></div>';
            document.getElementById('leadModal').hidden = false;
            return;
        }
        nameEl.textContent = lead.client_name;
        content.innerHTML = `
            <div class="modal-field"><label>Email</label><p>${escapeHtml(lead.client_email)}</p></div>
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

    async function showDashboard() {
        loginPanel.hidden = true;
        dashboardPanel.hidden = false;
        document.getElementById('adminIdentity').textContent = sessionStorage.getItem('roar_admin_email') || 'Authorized admin';
        await loadLeads();
        loadQuiz();
        loadOffers();
        loadCustomers();
        loadReviews();
        loadSubscribers();
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
    document.getElementById('refreshData').addEventListener('click', () => { loadLeads().then(loadOffers); loadQuiz(); loadCustomers(); loadReviews(); loadSubscribers(); });
    document.getElementById('statusFilter').addEventListener('change', renderLeads);
    document.getElementById('leadSearch').addEventListener('input', renderLeads);
    document.getElementById('exportLeads').addEventListener('click', exportCSV);
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.getElementById('editModal').querySelector('.modal-close').addEventListener('click', () => document.getElementById('editModal').hidden = true);
    document.getElementById('editModal').querySelector('.modal-backdrop').addEventListener('click', () => document.getElementById('editModal').hidden = true);
    document.getElementById('editCancel').addEventListener('click', () => document.getElementById('editModal').hidden = true);
    document.getElementById('editLeadForm').addEventListener('submit', submitEdit);

    if (token) showDashboard();
});
