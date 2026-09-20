const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const router = express.Router();
const hasPgConfig = !!(process.env.DATABASE_URL || process.env.PGHOST);

function createJsonPool() {
    const dbPath = path.join(__dirname, 'roar-local-db.json');
    function load() {
        try { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
        catch { return { customers: [], leads: [], claims: [], quiz: [] }; }
    }
    function save(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }
    const now = () => new Date().toISOString();
    const uuid = () => crypto.randomUUID();

    function query(sql, params = []) {
        const s = sql.toLowerCase().trim();
        const data = load();
        if (!data.customers) data.customers = [];
        if (!data.leads) data.leads = [];
        if (!data.claims) data.claims = [];
        if (!data.quiz) { data.quiz = []; save(data); }

        if (s.startsWith('create table') || s.startsWith('create index') || s.startsWith('alter table')) {
            return Promise.resolve({ rows: [] });
        }
        if (s.includes('pg_advisory_xact_lock') || s === 'begin' || s === 'commit' || s === 'rollback') {
            return Promise.resolve({ rows: [] });
        }

        // helpers
        function parseReturning(sqlUpper) {
            const m = sql.match(/returning\s+(.+)$/i);
            if (!m) return null;
            return m[1].split(',').map(c => c.trim().split(/\s+/).pop());
        }
        const returning = parseReturning(sql);
        const pick = (obj) => {
            if (!returning) return obj;
            const out = {};
            for (const col of returning) {
                if (col === '*') return obj;
                const camel = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
                if (col in obj) out[col] = obj[col];
            }
            return out;
        };

        if (s.startsWith('insert into public.roar_customers')) {
            if (data.customers.some(c => c.email === params[0])) {
                const err = new Error('duplicate key value violates unique constraint "roar_customers_email_key"');
                err.code = '23505';
                throw err;
            }
            const customer = {
                id: uuid(),
                email: params[0],
                password_hash: params[1],
                first_name: params[2],
                last_name: params[3],
                role: 'customer',
                email_verified: params[4],
                verification_token_hash: params[5],
                verification_expires_at: params[6],
                created_at: now(),
                updated_at: now(),
            };
            data.customers.push(customer);
            save(data);
            return Promise.resolve({ rows: [pick(customer)] });
        }
        if (s.startsWith('select count(*)')) {
            if (s.includes('roar_launch_claims')) return Promise.resolve({ rows: [{ n: data.claims.length }] });
        }
        if (s.startsWith('select') && s.includes('from public.roar_customers')) {
            let rows = data.customers;
            if (s.includes('where email=$1')) rows = rows.filter(c => c.email === params[0]);
            if (s.includes('where id=$1')) rows = rows.filter(c => c.id === params[0]);
            if (s.includes('where verification_token_hash=$1')) rows = rows.filter(c => c.verification_token_hash === params[0] && c.verification_expires_at && new Date(c.verification_expires_at) > new Date());
            if (s.includes('limit 1')) rows = rows.slice(0, 1);
            return Promise.resolve({ rows: rows.map(pick) });
        }
        if (s.startsWith('update public.roar_customers')) {
            const customer = data.customers.find(c => {
                if (s.includes('where id=$')) return c.id === params.find((_, i) => s.includes(`where id=$${i + 1}`));
                if (s.includes('where verification_token_hash=$')) return c.verification_token_hash === params[0];
                return false;
            });
            if (!customer) return Promise.resolve({ rows: [] });
            const getParam = (name) => {
                const m = sql.match(new RegExp(`${name}\\s*=\\s*\\$([0-9]+)`, 'i'));
                return m ? params[Number(m[1]) - 1] : undefined;
            };
            const fields = ['email','password_hash','first_name','last_name','role','email_verified','verification_token_hash','verification_expires_at'];
            for (const f of fields) {
                const v = getParam(f);
                if (v !== undefined) customer[f] = v;
            }
            customer.updated_at = now();
            save(data);
            return Promise.resolve({ rows: [pick(customer)] });
        }
        if (s.startsWith('delete from public.roar_customers')) {
            const before = data.customers.length;
            data.customers = data.customers.filter(c => c.id !== params[0]);
            save(data);
            return Promise.resolve({ rows: [] });
        }
        if (s.startsWith('insert into public.roar_leads')) {
            const lead = {
                id: uuid(),
                customer_id: params[0],
                client_name: params[1],
                client_email: params[2],
                target_dates: params[3],
                total_guests: params[4],
                tier_preference: params[5],
                primary_objective: params[6],
                notes: params[7],
                terms_accepted: true,
                marketing_consent: params[8],
                estimated_value: params[9],
                source: 'website',
                status: 'new',
                launch_offer_claimed: false,
                launch_offer_percent: null,
                created_at: now(),
                updated_at: now(),
            };
            data.leads.push(lead);
            save(data);
            return Promise.resolve({ rows: [pick(lead)] });
        }
        if (s.startsWith('select') && s.includes('from public.roar_leads')) {
            let rows = [...data.leads];
            if (s.includes('order by created_at desc')) rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            if (s.includes('limit 500')) rows = rows.slice(0, 500);
            return Promise.resolve({ rows: rows.map(pick) });
        }
        if (s.startsWith('update public.roar_leads')) {
            const lead = data.leads.find(l => l.id === params[params.length - 1]);
            if (!lead) return Promise.resolve({ rows: [] });
            const getParam = (name) => {
                const m = sql.match(new RegExp(`${name}\\s*=\\s*\\$([0-9]+)`, 'i'));
                return m ? params[Number(m[1]) - 1] : undefined;
            };
            if (s.includes('set status=')) lead.status = getParam('status');
            if (s.includes('launch_offer_claimed=true')) { lead.launch_offer_claimed = true; lead.launch_offer_percent = 10; }
            lead.updated_at = now();
            save(data);
            return Promise.resolve({ rows: [pick(lead)] });
        }
        if (s.startsWith('insert into public.roar_launch_claims')) {
            const [lead_id, customer_id] = params;
            if (!data.claims.some(c => c.lead_id === lead_id)) {
                data.claims.push({ id: data.claims.length + 1, lead_id, customer_id, discount_percent: 10, claimed_at: now() });
                save(data);
            }
            return Promise.resolve({ rows: [] });
        }
        if (s.startsWith('insert into public.roar_quiz_results')) {
            const result = {
                id: uuid(),
                traveler_persona: params[0],
                selected_transit: params[1],
                selected_lodging: params[2],
                selected_finale: params[3],
                selected_travelers: params[4],
                selected_season: params[5],
                matched_offer: params[6],
                source_ip: params[7],
                created_at: now(),
            };
            data.quiz.push(result);
            save(data);
            return Promise.resolve({ rows: [pick(result)] });
        }
        if (s.startsWith('select') && s.includes('from public.roar_quiz_results')) {
            let rows = [...data.quiz];
            if (s.includes('order by created_at desc')) rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            if (s.includes('limit 500')) rows = rows.slice(0, 500);
            return Promise.resolve({ rows: rows.map(pick) });
        }
        return Promise.resolve({ rows: [] });
    }

    function connect() {
        return Promise.resolve({ query, release: () => {} });
    }

    return { query, connect };
}

let pool = hasPgConfig ? new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    ssl: process.env.PGSSLMODE === 'require' || process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
}) : createJsonPool();

if (hasPgConfig) pool.on('error', (err) => console.error('[roar] PostgreSQL pool error:', err.message));

const secret = process.env.ROAR_JWT_SECRET || process.env.JWT_SECRET || (!hasPgConfig ? 'dev-roar-secret-do-not-use-in-production' : undefined);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const statuses = new Set(['new', 'reviewing', 'contacted', 'proposal_sent', 'won', 'lost']);

function rateLimit(windowMs, max) {
    const attempts = new Map();
    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        const entry = attempts.get(key);
        if (!entry || entry.resetAt <= now) {
            attempts.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        entry.count += 1;
        if (entry.count > max) return res.status(429).json({ message: 'Too many requests. Please try again later.' });
        next();
    };
}

const registerLimit = rateLimit(60 * 60 * 1000, 10);
const loginLimit = rateLimit(15 * 60 * 1000, 20);
const leadLimit = rateLimit(60 * 60 * 1000, 10);

async function init() {
    if (!hasPgConfig) {
        console.log('[roar] no PostgreSQL config — using local JSON storage for development');
        return;
    }
    try {
        await pool.query('select 1');
    } catch (error) {
        console.warn('[roar] PostgreSQL connection failed — falling back to local JSON storage:', error.message);
        pool = createJsonPool();
        return;
    }
    await pool.query(`
        create table if not exists public.roar_customers (
            id uuid primary key default gen_random_uuid(),
            email text not null unique,
            password_hash text not null,
            first_name text not null,
            last_name text not null,
            role text not null default 'customer' check (role in ('customer','admin')),
            email_verified boolean not null default false,
            verification_token_hash text,
            verification_expires_at timestamptz,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );
        create table if not exists public.roar_leads (
            id uuid primary key default gen_random_uuid(),
            client_name text not null check (char_length(client_name) between 1 and 150),
            client_email text not null check (char_length(client_email) between 3 and 254),
            target_dates text check (char_length(target_dates) <= 200),
            total_guests integer not null default 1 check (total_guests between 1 and 30),
            tier_preference text check (char_length(tier_preference) <= 150),
            primary_objective text check (char_length(primary_objective) <= 200),
            notes text check (char_length(notes) <= 3000),
            terms_accepted boolean not null default false,
            marketing_consent boolean not null default false,
            status text not null default 'new' check (status in ('new','reviewing','contacted','proposal_sent','won','lost')),
            estimated_value numeric(12,2),
            source text not null default 'website',
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );
        alter table public.roar_leads add column if not exists customer_id uuid references public.roar_customers(id) on delete set null;
        alter table public.roar_leads add column if not exists launch_offer_claimed boolean not null default false;
        alter table public.roar_leads add column if not exists launch_offer_percent integer;
        create table if not exists public.roar_launch_claims (
            id bigserial primary key,
            lead_id uuid not null unique references public.roar_leads(id) on delete cascade,
            customer_id uuid not null references public.roar_customers(id) on delete cascade,
            discount_percent integer not null default 10 check (discount_percent = 10),
            claimed_at timestamptz not null default now()
        );
        create index if not exists roar_leads_customer_idx on public.roar_leads(customer_id);
        create table if not exists public.roar_quiz_results (
            id uuid primary key default gen_random_uuid(),
            traveler_persona text check (char_length(traveler_persona) <= 80),
            selected_transit text check (char_length(selected_transit) <= 80),
            selected_lodging text check (char_length(selected_lodging) <= 80),
            selected_finale text check (char_length(selected_finale) <= 80),
            selected_travelers text check (char_length(selected_travelers) <= 80),
            selected_season text check (char_length(selected_season) <= 80),
            matched_offer text check (char_length(matched_offer) <= 80),
            source_ip inet,
            created_at timestamptz not null default now()
        );
    `);
}

function signCustomer(customer) {
    return jwt.sign({ id: customer.id, role: customer.role, app: 'roar' }, secret, { expiresIn: '7d' });
}

function requireCustomer(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Customer login required.' });
    try {
        const decoded = jwt.verify(token, secret);
        if (decoded.app !== 'roar') throw new Error('Wrong application token');
        req.roarUser = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Session invalid or expired.' });
    }
}

function requireRoarAdmin(req, res, next) {
    requireCustomer(req, res, async () => {
        try {
            const { rows } = await pool.query('select role from public.roar_customers where id=$1', [req.roarUser.id]);
            if (rows[0]?.role !== 'admin') {
                return res.status(403).json({ message: 'Roar administrator access required.' });
            }
            next();
        } catch {
            res.status(500).json({ message: 'Unable to verify administrator access.' });
        }
    });
}

router.post('/auth/register', registerLimit, async (req, res) => {
    try {
        const email = clean(req.body.email, 254).toLowerCase();
        const password = String(req.body.password || '');
        const firstName = clean(req.body.firstName, 80);
        const lastName = clean(req.body.lastName, 80);
        if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !firstName || !lastName) {
            return res.status(400).json({ message: 'Name, valid email, and a password of at least 10 characters are required.' });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const { rows: insertRows } = await pool.query(`
            insert into public.roar_customers
                (email, password_hash, first_name, last_name, email_verified)
            values ($1,$2,$3,$4,true)
            returning id, email, first_name, last_name, role, email_verified
        `, [email, passwordHash, firstName, lastName]);
        const customer = insertRows[0];
        res.status(201).json({
            message: 'Account created and signed in.',
            token: signCustomer(customer),
            user: { id: customer.id, email: customer.email, firstName: customer.first_name, lastName: customer.last_name, role: customer.role },
        });
    } catch (error) {
        if (error.code === '23505') {
            try {
                const { rows: existingRows } = await pool.query(
                    'select id, email, first_name, last_name, role, password_hash from public.roar_customers where email=$1 limit 1',
                    [clean(req.body.email || '', 254).toLowerCase()]
                );
                const existing = existingRows[0];
                if (existing && await bcrypt.compare(String(req.body.password || ''), existing.password_hash)) {
                    const signedIn = { id: existing.id, email: existing.email, first_name: existing.first_name, last_name: existing.last_name, role: existing.role };
                    return res.json({
                        message: 'Signed in successfully.',
                        token: signCustomer(signedIn),
                        user: { id: signedIn.id, email: signedIn.email, firstName: signedIn.first_name, lastName: signedIn.last_name, role: signedIn.role },
                    });
                }
            } catch (inner) { console.error('Roar duplicate-account handling error:', inner.message); }
            return res.status(409).json({ message: 'An account with that email already exists. Please sign in instead.' });
        }
        console.error('Roar registration error:', error.message);
        res.status(500).json({ message: 'Unable to create account.' });
    }
});

router.post('/auth/login', loginLimit, async (req, res) => {
    const email = clean(req.body.email, 254).toLowerCase();
    const { rows } = await pool.query('select * from public.roar_customers where email=$1 limit 1', [email]);
    const customer = rows[0];
    if (!customer || !await bcrypt.compare(String(req.body.password || ''), customer.password_hash)) {
        return res.status(401).json({ message: 'Invalid email or password.' });
    }
    res.json({ token: signCustomer(customer), user: { id: customer.id, email: customer.email, firstName: customer.first_name, lastName: customer.last_name, role: customer.role } });
});

router.get('/auth/me', requireCustomer, async (req, res) => {
    const { rows } = await pool.query('select id,email,first_name,last_name,role from public.roar_customers where id=$1', [req.roarUser.id]);
    if (!rows.length) return res.status(404).json({ message: 'Account not found.' });
    const u = rows[0];
    res.json({ id:u.id, email:u.email, firstName:u.first_name, lastName:u.last_name, role:u.role });
});

router.post('/leads', leadLimit, requireCustomer, async (req, res) => {
    const clientName = clean(req.body.clientName, 150);
    const totalGuests = Number(req.body.totalGuests);
    if (!clientName || !Number.isInteger(totalGuests) || totalGuests < 1 || totalGuests > 30 || req.body.termsAccepted !== true) {
        return res.status(400).json({ message: 'Complete the required inquiry fields.' });
    }
    const customerResult = await pool.query('select email from public.roar_customers where id=$1', [req.roarUser.id]);
    if (!customerResult.rows[0]) return res.status(404).json({ message: 'Account not found.' });
    const clientEmail = customerResult.rows[0].email;
    const { rows } = await pool.query(`
        insert into public.roar_leads
            (customer_id,client_name,client_email,target_dates,total_guests,tier_preference,primary_objective,notes,terms_accepted,marketing_consent,estimated_value,source)
        values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,'website') returning *
    `, [req.roarUser.id, clientName, clientEmail, clean(req.body.targetDates,200)||null, totalGuests,
        clean(req.body.tierPreference,150)||null, clean(req.body.primaryObjective,200)||null,
        clean(req.body.notes,3000)||null, req.body.marketingConsent===true,
        Number.isFinite(Number(req.body.estimatedValue)) ? Number(req.body.estimatedValue) : null]);
    res.status(201).json({ success:true, lead:rows[0] });
});

router.get('/admin/leads', requireRoarAdmin, async (req, res) => {
    const { rows } = await pool.query('select * from public.roar_leads order by created_at desc limit 500');
    res.json({ leads:rows });
});

router.patch('/admin/leads/:id', requireRoarAdmin, async (req, res) => {
    const status = clean(req.body.status, 30);
    if (!statuses.has(status)) return res.status(400).json({ message: 'Invalid lead status.' });
    const client = await pool.connect();
    try {
        await client.query('begin');
        const { rows } = await client.query('update public.roar_leads set status=$1,updated_at=now() where id=$2 returning *', [status, req.params.id]);
        if (!rows.length) { await client.query('rollback'); return res.status(404).json({ message:'Lead not found.' }); }
        let lead = rows[0];
        if (status === 'won' && lead.customer_id && !lead.launch_offer_claimed) {
            await client.query("select pg_advisory_xact_lock(hashtext('roar-first-five-offer'))");
            const count = Number((await client.query('select count(*)::int n from public.roar_launch_claims')).rows[0].n);
            if (count < 5) {
                await client.query('insert into public.roar_launch_claims (lead_id,customer_id) values ($1,$2) on conflict do nothing', [lead.id, lead.customer_id]);
                lead = (await client.query('update public.roar_leads set launch_offer_claimed=true,launch_offer_percent=10 where id=$1 returning *', [lead.id])).rows[0];
            }
        }
        await client.query('commit');
        res.json({ lead });
    } catch (error) {
        await client.query('rollback');
        console.error('Roar lead update error:', error.message);
        res.status(500).json({ message:'Unable to update lead.' });
    } finally { client.release(); }
});

const quizLimit = rateLimit(60 * 60 * 1000, 20);

router.post('/quiz', quizLimit, async (req, res) => {
    try {
        const persona = clean(req.body.traveler_persona, 80);
        const transit = clean(req.body.selected_transit, 80);
        const lodging = clean(req.body.selected_lodging, 80);
        const finale = clean(req.body.selected_finale, 80);
        const travelers = clean(req.body.selected_travelers, 80);
        const season = clean(req.body.selected_season, 80);
        const offer = clean(req.body.matched_offer, 80);
        if (!persona) return res.status(400).json({ message: 'Persona result is required.' });
        const { rows } = await pool.query(`
            insert into public.roar_quiz_results (traveler_persona, selected_transit, selected_lodging, selected_finale, selected_travelers, selected_season, matched_offer, source_ip)
            values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, created_at
        `, [persona, transit || null, lodging || null, finale || null, travelers || null, season || null, offer || null, req.ip || null]);
        res.status(201).json({ success: true, recorded: rows[0] });
    } catch (error) {
        console.error('Roar quiz tracking error:', error.message);
        res.status(500).json({ message: 'Unable to record quiz result.' });
    }
});

router.get('/admin/quiz', requireRoarAdmin, async (_req, res) => {
    const { rows } = await pool.query('select * from public.roar_quiz_results order by created_at desc limit 500');
    res.json({ results: rows });
});

router.get('/promotion', async (_req, res) => {
    const claimed = Number((await pool.query('select count(*)::int n from public.roar_launch_claims')).rows[0].n);
    res.json({ total:5, claimed, remaining:Math.max(0,5-claimed), discountPercent:10 });
});

module.exports = { router, init };
