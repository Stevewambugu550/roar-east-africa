/**
 * Seeds sample guest reviews into the roar_reviews table.
 * These are clearly flagged is_demo=true so they can be identified and
 * removed once genuine guest feedback exists.
 *
 * Usage:  node seed-reviews.js
 * Requires PG* env vars (loaded from ./.env or ../TutorNest/backend/.env).
 */
const path = require('path');
require('dotenv').config();
if (!process.env.PGHOST && !process.env.DATABASE_URL) {
    require('dotenv').config({ path: path.join(__dirname, '..', 'TutorNest', 'backend', '.env') });
}
const { Pool } = require('pg');

const sampleReviews = [
    { name: 'Sarah Mitchell', location: 'London, United Kingdom', trip: 'Sky Safari & Mara Migration', rating: 5, text: 'Stephen planned every detail around the migration crossings we hoped to see. The private conservancy stay meant we watched a leopard with zero other vehicles. Worth every dollar — and noticeably better value than the big-name operators we priced against.' },
    { name: 'James and Priya Okafor', location: 'Atlanta, USA', trip: 'Grand Savanna & Diani Waters', rating: 5, text: 'The bush-to-beach flow was seamless. Our kids still talk about the Samburu elephant herds, and ending on a Diani beachfront was the perfect reset before flying home. Milka answered every question within hours.' },
    { name: 'Claudia Berger', location: 'Munich, Germany', trip: "Kenya's Iconic Conservancies", rating: 5, text: 'I compared four safari companies before choosing Roar. The conservancy routing — Lewa then a private Mara conservancy — gave us rhino tracking and big cats without the crowds. Transparent pricing, no surprise costs.' },
    { name: 'Daniel Otieno', location: 'Nairobi, Kenya', trip: 'Custom multi-destination safari', rating: 4, text: 'As a resident I wanted something beyond the standard packages. The circuit builder let me combine Tsavo and Amboseli exactly as I wanted, and the team adjusted the quote twice until it fit my budget.' },
    { name: 'Emma Whitfield', location: 'Sydney, Australia', trip: 'Sky Safari & Mara Migration', rating: 5, text: 'Solo female traveler — I felt looked after from the first WhatsApp message to the airport drop-off. The guide they assigned knew bird photography spots I would never have found. Crossing at the Mara River on day four was unforgettable.' },
    { name: 'Henrik Larsen', location: 'Copenhagen, Denmark', trip: 'Grand Savanna & Diani Waters', rating: 5, text: 'Excellent communication before the trip and a clear written quote. The Tsavo wilderness camp exceeded expectations. Only reason for 4 stars elsewhere: wished we had added one more night at the coast. Book longer than you think you need.' },
    { name: 'Aisha Rahman', location: 'Dubai, UAE', trip: 'Custom multi-destination safari', rating: 5, text: 'Our honeymoon was built entirely around us — private dinners, a balloon flight over the Mara, and a quiet beach finale. The team flagged realistic wildlife expectations instead of overselling. That honesty is rare.' },
    { name: 'Michael Torres', location: 'Austin, USA', trip: "Kenya's Iconic Conservancies", rating: 4, text: 'Strong value for a private safari. Vehicle was a proper Land Cruiser with a window seat each. A couple of lodge check-ins ran slower than expected, but the operations team smoothed everything out quickly.' },
    { name: 'Yuki Tanaka', location: 'Osaka, Japan', trip: 'Sky Safari & Mara Migration', rating: 5, text: 'The migration timing advice was spot-on. We watched three crossings in two days. Roar is a newer company but the planning felt more personal and more careful than the large operators we contacted.' },
    { name: 'Fatima Al-Hassan', location: 'Nairobi, Kenya', trip: 'Custom multi-destination safari', rating: 5, text: 'Booked a family trip for eight people across three generations. They balanced driving distances so my parents were never exhausted, and found a conservancy with a proper kids program. Already planning our next one.' },
];

async function main() {
    const pool = new Pool({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        connectionString: process.env.DATABASE_URL || undefined,
        ssl: process.env.PGSSLMODE === 'require' || process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    });

    await pool.query(`
        create table if not exists public.roar_reviews (
            id uuid primary key default gen_random_uuid(),
            reviewer_name text not null,
            reviewer_location text,
            trip_name text,
            rating integer not null check (rating between 1 and 5),
            review_text text not null,
            status text not null default 'pending' check (status in ('pending','approved','rejected')),
            is_demo boolean not null default false,
            created_at timestamptz not null default now()
        )
    `);

    const { rows: existing } = await pool.query('select reviewer_name from public.roar_reviews where is_demo = true');
    const existingNames = new Set(existing.map(r => r.reviewer_name));

    let inserted = 0;
    for (const r of sampleReviews) {
        if (existingNames.has(r.name)) continue;
        await pool.query(
            `insert into public.roar_reviews (reviewer_name, reviewer_location, trip_name, rating, review_text, status, is_demo)
             values ($1,$2,$3,$4,$5,'approved',true)`,
            [r.name, r.location, r.trip, r.rating, r.text]
        );
        inserted += 1;
    }
    const { rows: count } = await pool.query("select count(*)::int n from public.roar_reviews where status='approved'");
    console.log(`Seeded ${inserted} new reviews. Total approved reviews: ${count[0].n}`);
    await pool.end();
}

main().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
