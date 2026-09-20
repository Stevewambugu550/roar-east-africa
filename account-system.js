function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function safeStorageRemove(key) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

class RoarAccount {
    constructor() {
        this.token = safeStorageGet('roar_customer_token');
        try { this.user = JSON.parse(safeStorageGet('roar_customer_user')); } catch { this.user = null; }
        try {
            const encoded = (this.token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
            if (!payload.exp || payload.exp * 1000 <= Date.now() || payload.app !== 'roar') this.clear();
        } catch { this.clear(); }
    }
    clear() {
        this.token = null; this.user = null;
        safeStorageRemove('roar_customer_token');
        safeStorageRemove('roar_customer_user');
    }
    headers() { return { 'Content-Type':'application/json', Authorization:`Bearer ${this.token}` }; }
    isAuthenticated() { return !!this.token && !!this.user; }
    save(token, user) {
        this.token = token; this.user = user;
        safeStorageSet('roar_customer_token', token);
        safeStorageSet('roar_customer_user', JSON.stringify(user));
    }
    logout() {
        this.clear();
        window.location.href = 'index.html';
    }
    requireAccount(returnTo = window.location.href) {
        if (this.isAuthenticated()) return true;
        window.location.href = `account.html?return=${encodeURIComponent(returnTo)}`;
        return false;
    }
}
window.roarAccount = new RoarAccount();
