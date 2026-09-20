require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = 'info@roareastafrica.com';
const tempPassword = 'RoarAdmin' + crypto.randomBytes(4).toString('hex') + '!';

if (!url || !serviceKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;

    let userId;
    const existing = list.users.find((u) => u.email === email);

    if (existing) {
        const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
            password: tempPassword,
            email_confirm: true,
        });
        if (error) throw error;
        userId = data.user.id;
        console.log(`Updated existing admin user ${email}`);
    } else {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { first_name: 'Roar', last_name: 'Admin' },
        });
        if (error) throw error;
        userId = data.user.id;
        console.log(`Created admin user ${email}`);
    }

    const { error: upsertErr } = await supabase.from('roar_customers').upsert(
        { id: userId, email, first_name: 'Roar', last_name: 'Admin', role: 'admin' },
        { onConflict: 'id' }
    );
    if (upsertErr) throw upsertErr;

    console.log('Set role to admin in roar_customers');
    console.log(`Temporary password: ${tempPassword}`);
    console.log('Sign in at https://roar-east-africa.netlify.app/admin.html');
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
