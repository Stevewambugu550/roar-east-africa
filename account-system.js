class RoarAccount {
    constructor() {
        this.supabase = window.ROAR_SUPABASE;
        this.user = null;
        this.profile = null;
        this.session = null;
    }

    async init() {
        if (!this.supabase) return;
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) await this.setSession(session);
        this.supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session) await this.setSession(session);
            else { this.user = null; this.profile = null; this.session = null; }
        });
    }

    async setSession(session) {
        this.session = session;
        this.user = session.user;
        await this.loadProfile(session.user);
    }

    async loadProfile(authUser) {
        const { data, error } = await this.supabase.from('roar_customers').select('*').eq('id', authUser.id).single();
        if (error) { console.error('Profile load error:', error.message); this.profile = null; return; }
        this.profile = data;
    }

    isAuthenticated() { return !!this.user && !!this.profile; }

    async signUp({ email, password, firstName, lastName }) {
        if (!this.supabase) throw new Error('Supabase client not available.');
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: { first_name: firstName, last_name: lastName },
                emailRedirectTo: `${window.location.origin}/account.html`,
            },
        });
        if (error) throw error;
        return data;
    }

    async signIn(email, password) {
        if (!this.supabase) throw new Error('Supabase client not available.');
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await this.setSession(data.session);
        return data;
    }

    async signOut() {
        if (!this.supabase) return;
        await this.supabase.auth.signOut();
        this.user = null; this.profile = null; this.session = null;
        window.location.href = 'index.html';
    }

    requireAccount(returnTo = window.location.href) {
        if (this.isAuthenticated()) return true;
        window.location.href = `account.html?return=${encodeURIComponent(returnTo)}`;
        return false;
    }
}

window.roarAccount = new RoarAccount();
window.roarAccount.init();
