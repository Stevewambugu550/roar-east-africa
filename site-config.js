window.ROAR_CONFIG = Object.freeze({
    apiBase: '/api/roar',
    supabaseUrl: 'https://gyecvqpovpngjaikqzkz.supabase.co',
    supabaseKey: 'sb_publishable_bbd0T0-QGgL7FjM8z67-7Q_ezSBkKcR',
});

if (typeof supabase !== 'undefined' && window.ROAR_CONFIG.supabaseUrl && window.ROAR_CONFIG.supabaseKey) {
    window.ROAR_SUPABASE = supabase.createClient(window.ROAR_CONFIG.supabaseUrl, window.ROAR_CONFIG.supabaseKey, {
        auth: {
            persistSession: true,
            storageKey: 'roar_supabase_auth',
            autoRefreshToken: true,
        },
    });
}
