document.addEventListener('DOMContentLoaded', async () => {
    const api = window.ROAR_CONFIG.apiBase;
    const message = document.getElementById('accountMessage');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const verifiedPanel = document.getElementById('verifiedPanel');
    const tabs = [...document.querySelectorAll('[data-tab]')];
    const params = new URLSearchParams(location.search);

    function showMessage(text, type = '') { message.textContent = text; message.className = `message ${type}`; }
    function showTab(name) {
        loginForm.hidden = name !== 'login'; registerForm.hidden = name !== 'register'; verifiedPanel.hidden = true;
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name)); showMessage('');
    }
    tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
    document.getElementById('showLogin').addEventListener('click', () => showTab('login'));

    async function postAuth(path, body, button) {
        button.disabled = true;
        try {
            const response = await fetch(`${api}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `Error ${response.status}`);
            return data;
        } catch (error) {
            console.error(`${path} failed:`, error);
            throw error;
        } finally {
            button.disabled = false;
        }
    }

    registerForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = registerForm.querySelector('button[type="submit"]');
        showMessage('Creating your account…');
        try {
            const data = await postAuth('/auth/register', {
                firstName: document.getElementById('regFirst').value.trim(),
                lastName: document.getElementById('regLast').value.trim(),
                email: document.getElementById('regEmail').value.trim(),
                password: document.getElementById('regPassword').value,
            }, button);
            window.roarAccount.save(data.token, data.user);
            showMessage('Account created. Redirecting…', 'success');
            const destination = params.get('return');
            setTimeout(() => {
                window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
            }, 500);
        } catch (error) {
            showMessage(error.message || 'Unable to reach the server. Please check your connection and try again.', 'error');
        }
    });

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = loginForm.querySelector('button[type="submit"]');
        showMessage('Signing in…');
        try {
            const data = await postAuth('/auth/login', {
                email: document.getElementById('loginEmail').value.trim(),
                password: document.getElementById('loginPassword').value,
            }, button);
            window.roarAccount.save(data.token, data.user);
            showMessage('Signed in. Redirecting…', 'success');
            const destination = params.get('return');
            setTimeout(() => {
                window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
            }, 500);
        } catch (error) {
            showMessage(error.message || 'Unable to reach the server. Please check your connection and try again.', 'error');
        }
    });
});
