document.addEventListener('DOMContentLoaded', async () => {
    await window.roarAccount.init();
    const loginPanel = document.getElementById('loginPanel');
    const dashboardPanel = document.getElementById('dashboardPanel');
    const loginError = document.getElementById('loginError');
    const dashboardError = document.getElementById('dashboardError');
    const rows = document.getElementById('leadRows');
    let leads = [];

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
    const formatMoney = value => value == null ? '—' : new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(value);
    const statusLabels = { new:'New', reviewing:'Reviewing', contacted:'Contacted', proposal_sent:'Proposal sent', won:'Won', lost:'Lost' };

    async function signIn(email, password) {
        await window.roarAccount.signIn(email, password);
        if (!window.roarAccount.isAuthenticated()) throw new Error('Sign-in failed.');
        if (window.roarAccount.profile?.role !== 'admin') throw new Error('This account is not authorized for the control desk.');
    }

    async function loadLeads() {
        dashboardError.textContent = '';
        rows.innerHTML = '<tr><td colspan="7" class="empty">Loading briefs…</td></tr>';
        try {
            const { data, error } = await window.roarAccount.supabase
                .from('roar_leads')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            leads = data || [];
            render();
        } catch (error) {
            dashboardError.textContent = error.message;
            rows.innerHTML = '<tr><td colspan="7" class="empty">No lead data available.</td></tr>';
        }
    }

    async function loadQuiz() {
        const quizRows = document.getElementById('quizRows');
        try {
            const { data, error } = await window.roarAccount.supabase
                .from('roar_quiz_results')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            if (error) throw error;
            const results = data || [];
            document.getElementById('metricQuiz').textContent = `${results.length} completion${results.length === 1 ? '' : 's'}`;
            if (!results.length) {
                quizRows.innerHTML = '<tr><td colspan="8" class="empty">No quiz completions yet.</td></tr>';
                return;
            }
            quizRows.innerHTML = results.slice(0, 100).map(r => `<tr>
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
                const { error } = await window.roarAccount.supabase
                    .from('roar_leads')
                    .update({ status: select.value, updated_at: new Date().toISOString() })
                    .eq('id', select.dataset.leadId)
                    .select()
                    .single();
                if (error) throw error;
                const index = leads.findIndex(item => item.id === select.dataset.leadId);
                if (index >= 0) leads[index].status = select.value;
                render();
            } catch (error) { dashboardError.textContent = error.message; select.disabled = false; }
        }));
    }

    function showDashboard() {
        loginPanel.hidden = true;
        dashboardPanel.hidden = false;
        document.getElementById('adminIdentity').textContent = window.roarAccount.user?.email || 'Authorized admin';
        loadLeads();
        loadQuiz();
    }

    function logout() {
        window.roarAccount.signOut();
    }

    document.getElementById('adminLogin').addEventListener('submit', async (event) => {
        event.preventDefault();
        loginError.textContent = '';
        try {
            await signIn(document.getElementById('adminEmail').value.trim(), document.getElementById('adminPassword').value);
            showDashboard();
        } catch (error) { loginError.textContent = error.message; }
    });
    document.getElementById('adminLogout').addEventListener('click', logout);
    document.getElementById('refreshLeads').addEventListener('click', () => { loadLeads(); loadQuiz(); });
    document.getElementById('statusFilter').addEventListener('change', render);
    document.getElementById('leadSearch').addEventListener('input', render);

    if (window.roarAccount.isAuthenticated() && window.roarAccount.profile?.role === 'admin') showDashboard();
});
