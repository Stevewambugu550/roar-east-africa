document.addEventListener('DOMContentLoaded', () => {
    const config = window.ROAR_CONFIG;
    const loginPanel = document.getElementById('loginPanel');
    const dashboardPanel = document.getElementById('dashboardPanel');
    const loginError = document.getElementById('loginError');
    const dashboardError = document.getElementById('dashboardError');
    const rows = document.getElementById('leadRows');
    let token = sessionStorage.getItem('roar_admin_token');
    let leads = [];

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

    async function api(method = 'GET', body, leadId = '') {
        const response = await fetch(`${config.apiBase}/admin/leads${leadId ? '/' + encodeURIComponent(leadId) : ''}`, {
            method,
            headers: { authorization: `Bearer ${token}`, 'content-type':'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await response.json();
        if (response.status === 401) logout();
        if (!response.ok) throw new Error(data.message || 'Request failed.');
        return data;
    }

    async function loadLeads() {
        dashboardError.textContent = '';
        rows.innerHTML = '<tr><td colspan="7" class="empty">Loading briefs…</td></tr>';
        try {
            leads = (await api()).leads || [];
            render();
        } catch (error) {
            dashboardError.textContent = error.message;
            rows.innerHTML = '<tr><td colspan="7" class="empty">No lead data available.</td></tr>';
        }
    }

    function render() {
        const filter = document.getElementById('statusFilter').value;
        const query = document.getElementById('leadSearch').value.trim().toLowerCase();
        const visible = leads.filter(lead => {
            const matchesStatus = filter === 'all' || lead.status === filter;
            const haystack = `${lead.client_name} ${lead.client_email} ${lead.primary_objective} ${lead.tier_preference}`.toLowerCase();
            return matchesStatus && (!query || haystack.includes(query));
        });

        document.getElementById('metricLeads').textContent = leads.length;
        document.getElementById('metricGuests').textContent = leads.reduce((sum, lead) => sum + Number(lead.total_guests || 0), 0);
        document.getElementById('metricRevenue').textContent = formatMoney(leads.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0));
        document.getElementById('metricNew').textContent = leads.filter(lead => lead.status === 'new').length;

        if (!visible.length) {
            rows.innerHTML = '<tr><td colspan="7" class="empty">No briefs match this view.</td></tr>';
            return;
        }
        rows.innerHTML = visible.map(lead => `<tr>
            <td>${escapeHtml(new Date(lead.created_at).toLocaleDateString())}<small>${escapeHtml(new Date(lead.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</small></td>
            <td><strong>${escapeHtml(lead.client_name)}</strong><small>${escapeHtml(lead.client_email)}</small></td>
            <td>${escapeHtml(lead.primary_objective || 'Custom journey')}<small>${escapeHtml(lead.target_dates || 'Dates flexible')}</small></td>
            <td>${escapeHtml(lead.total_guests)}</td><td>${escapeHtml(lead.tier_preference || '—')}</td><td>${escapeHtml(formatMoney(lead.estimated_value))}</td>
            <td><select data-lead-id="${escapeHtml(lead.id)}">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${lead.status===value?'selected':''}>${label}</option>`).join('')}</select></td>
        </tr>`).join('');

        rows.querySelectorAll('select[data-lead-id]').forEach(select => select.addEventListener('change', async () => {
            select.disabled = true;
            try {
                const { lead } = await api('PATCH', { status: select.value }, select.dataset.leadId);
                const index = leads.findIndex(item => item.id === lead.id);
                if (index >= 0) leads[index] = lead;
                render();
            } catch (error) { dashboardError.textContent = error.message; select.disabled = false; }
        }));
    }

    function showDashboard() {
        loginPanel.hidden = true;
        dashboardPanel.hidden = false;
        document.getElementById('adminIdentity').textContent = sessionStorage.getItem('roar_admin_email') || 'Authorized admin';
        loadLeads();
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
    document.getElementById('refreshLeads').addEventListener('click', loadLeads);
    document.getElementById('statusFilter').addEventListener('change', render);
    document.getElementById('leadSearch').addEventListener('input', render);

    if (token) showDashboard();
});
