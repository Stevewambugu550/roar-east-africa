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

    const verificationToken = params.get('verify');
    if (verificationToken) {
        loginForm.hidden = true; registerForm.hidden = true; tabs.forEach(tab => tab.classList.remove('active'));
        try {
            const response = await fetch(`${api}/auth/verify`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:verificationToken}) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            verifiedPanel.hidden = false; showMessage(data.message, 'success');
        } catch (error) { showTab('login'); showMessage(error.message, 'error'); }
    }

    registerForm.addEventListener('submit', async event => {
        event.preventDefault(); showMessage('Creating your account…');
        try {
            const response = await fetch(`${api}/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
                firstName:document.getElementById('regFirst').value.trim(), lastName:document.getElementById('regLast').value.trim(),
                email:document.getElementById('regEmail').value.trim(), password:document.getElementById('regPassword').value,
            }) });
            const data = await response.json(); if (!response.ok) throw new Error(data.message);
            registerForm.reset();
            if (data.token && data.user) {
                window.roarAccount.save(data.token, data.user);
                const destination = params.get('return');
                window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
                return;
            }
            if (data.verificationUrl) {
                showMessage('Account created. Open the verification link below.', 'success');
                const link = document.createElement('a'); link.href = data.verificationUrl; link.textContent = 'Verify my email'; link.style.display='block'; link.style.marginTop='8px'; message.appendChild(link);
            } else showMessage(data.message, 'success');
        } catch (error) { showMessage(error.message, 'error'); }
    });

    loginForm.addEventListener('submit', async event => {
        event.preventDefault(); showMessage('Signing in…');
        try {
            const response = await fetch(`${api}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:document.getElementById('loginEmail').value.trim(),password:document.getElementById('loginPassword').value}) });
            const data = await response.json(); if (!response.ok) throw new Error(data.message);
            window.roarAccount.save(data.token, data.user);
            const destination = params.get('return');
            window.location.href = destination && destination.startsWith(location.origin) ? destination : 'index.html';
        } catch (error) { showMessage(error.message, 'error'); }
    });
});
