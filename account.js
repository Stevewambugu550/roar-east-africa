document.addEventListener('DOMContentLoaded', async () => {
    await window.roarAccount.init();
    const message = document.getElementById('accountMessage');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const verifiedPanel = document.getElementById('verifiedPanel');
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const params = new URLSearchParams(location.search);

    function showMessage(text, type = '') { message.textContent = text; message.className = `message ${type}`; }
    function showTab(name) {
        loginForm.hidden = name !== 'login';
        registerForm.hidden = name !== 'register';
        verifiedPanel.hidden = true;
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
        showMessage('');
    }
    tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
    document.getElementById('showLogin')?.addEventListener('click', () => showTab('login'));

    // Handle email-confirmation redirect from Supabase
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
    if (hashParams.has('access_token') || hashParams.has('type')) {
        loginForm.hidden = true; registerForm.hidden = true; tabs.forEach(tab => tab.classList.remove('active'));
        try {
            await window.roarAccount.supabase.auth.getSessionFromUrl({ storeSession: true });
            await window.roarAccount.init();
            if (window.roarAccount.isAuthenticated()) {
                const destination = params.get('return');
                window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
                return;
            }
            verifiedPanel.hidden = false;
            showMessage('Email confirmed. Sign in to continue.', 'success');
        } catch (error) {
            showTab('login');
            showMessage(error.message, 'error');
        }
    }

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault(); showMessage('Creating your account…');
        try {
            const data = await window.roarAccount.signUp({
                email: document.getElementById('regEmail').value.trim(),
                password: document.getElementById('regPassword').value,
                firstName: document.getElementById('regFirst').value.trim(),
                lastName: document.getElementById('regLast').value.trim(),
            });
            registerForm.reset();
            // If Supabase has email confirmation disabled, signUp returns a session immediately.
            if (data?.session) {
                await window.roarAccount.setSession(data.session);
                const destination = params.get('return');
                window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
                return;
            }
            showMessage('Account created. Check your email for the confirmation link before signing in.', 'success');
        } catch (error) { showMessage(error.message, 'error'); }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); showMessage('Signing in…');
        try {
            await window.roarAccount.signIn(
                document.getElementById('loginEmail').value.trim(),
                document.getElementById('loginPassword').value
            );
            const destination = params.get('return');
            window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
        } catch (error) { showMessage(error.message, 'error'); }
    });
});
