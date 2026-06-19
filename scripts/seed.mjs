#!/usr/bin/env node
// Seed demo data into a running backend via the real REST APIs.
//
// Replaces the former frontend MOCK_MODE data: one demo user with a filled
// profile, daily goals, and ~10 days of meal history. Run after the services
// are up; then log in at http://localhost:3000 with the seed credentials and
// the whole app works against the real backend (everything except AI scan).
//
// Usage:
//   node scripts/seed.mjs                 # seed last 10 days for dev@local
//   SEED_DAYS=14 node scripts/seed.mjs    # override window
//   node scripts/seed.mjs --force         # re-create meals even if some exist
//
// Endpoints used (all already implemented):
//   POST /api/auth/register | /api/auth/login   (:8081)
//   PUT  /api/users/me                          (:8081)
//   PUT  /api/goals                             (:8083)
//   GET  /api/meals?from=&to=                   (:8082)
//   POST /api/meals/manual                      (:8082)

const cfg = {
  authUrl:      process.env.SEED_AUTH_URL      ?? 'http://localhost:8081',
  mealsUrl:     process.env.SEED_MEALS_URL     ?? 'http://localhost:8082',
  analyticsUrl: process.env.SEED_ANALYTICS_URL ?? 'http://localhost:8083',
  email:        process.env.SEED_EMAIL         ?? 'dev@local',
  password:     process.env.SEED_PASSWORD      ?? 'password123',
  displayName:  process.env.SEED_NAME          ?? 'Dev User',
  days:         Number(process.env.SEED_DAYS   ?? '10'),
  force:        process.argv.includes('--force'),
};

// Demo user physical profile → mirrors what onboarding would produce.
const PROFILE = {
  displayName:   cfg.displayName,
  heightCm:      178,
  weightKg:      74.5,
  age:           29,
  sex:           'male',       // wire format expected by auth-service
  activityLevel: 'moderate',
  goal:          'maintain',
};

const GOALS = {
  dailyCalories: 2200,
  proteinGrams:  140,
  carbsGrams:    240,
  fatGrams:      70,
  fiberGrams:    30,
};

// ─── Meal pools (ported verbatim from calorie-app src/entities/meal/model/mock.ts) ───
// PoolEntry: { time, name, calories, protein, carbs, fat }. Fiber is estimated
// from carbs since the original mock had no fiber data.

const BREAKFAST_POOL = [
  { time: '07:45', name: 'Oatmeal with banana & honey',        calories: 380, protein: 12, carbs: 68, fat: 8  },
  { time: '08:00', name: 'Scrambled eggs & whole-grain toast', calories: 420, protein: 28, carbs: 34, fat: 16 },
  { time: '08:15', name: 'Greek yogurt & berry bowl',          calories: 320, protein: 22, carbs: 38, fat: 9  },
  { time: '08:30', name: 'Avocado toast with poached egg',     calories: 450, protein: 18, carbs: 40, fat: 22 },
  { time: '07:30', name: 'Smoothie bowl (acai, granola)',      calories: 490, protein: 14, carbs: 72, fat: 15 },
  { time: '08:00', name: 'Cottage cheese & pineapple',         calories: 280, protein: 26, carbs: 28, fat: 5  },
  { time: '08:45', name: 'Whole-wheat pancakes with berries',  calories: 520, protein: 16, carbs: 80, fat: 14 },
  { time: '07:50', name: 'Muesli with almond milk',            calories: 350, protein: 11, carbs: 58, fat: 9  },
  { time: '08:10', name: 'Veggie omelette (3 eggs)',           calories: 390, protein: 30, carbs: 8,  fat: 26 },
  { time: '08:20', name: 'Protein shake & banana',             calories: 340, protein: 32, carbs: 40, fat: 5  },
];

const LUNCH_POOL = [
  { time: '12:30', name: 'Quinoa & avocado salad',             calories: 550, protein: 19, carbs: 61, fat: 24 },
  { time: '13:00', name: 'Grilled chicken wrap',               calories: 620, protein: 42, carbs: 55, fat: 18 },
  { time: '12:45', name: 'Lentil soup & rye bread',            calories: 480, protein: 24, carbs: 68, fat: 9  },
  { time: '13:15', name: 'Salmon & brown rice bowl',           calories: 680, protein: 48, carbs: 62, fat: 22 },
  { time: '12:00', name: 'Caesar salad with chicken',          calories: 530, protein: 38, carbs: 24, fat: 28 },
  { time: '13:30', name: 'Turkey & hummus sandwich',           calories: 560, protein: 34, carbs: 58, fat: 16 },
  { time: '12:15', name: 'Poke bowl (tuna, edamame)',          calories: 610, protein: 40, carbs: 66, fat: 18 },
  { time: '13:00', name: 'Vegetable stir-fry & tofu',          calories: 440, protein: 22, carbs: 52, fat: 14 },
  { time: '12:50', name: 'Pasta primavera',                    calories: 590, protein: 20, carbs: 90, fat: 12 },
  { time: '13:10', name: 'Minestrone soup & focaccia',         calories: 510, protein: 18, carbs: 74, fat: 11 },
];

const DINNER_POOL = [
  { time: '19:00', name: 'Baked salmon & asparagus',           calories: 540, protein: 46, carbs: 22, fat: 26 },
  { time: '19:30', name: 'Chicken tikka masala & rice',        calories: 720, protein: 44, carbs: 76, fat: 24 },
  { time: '18:45', name: 'Beef stir-fry with noodles',         calories: 680, protein: 38, carbs: 74, fat: 20 },
  { time: '19:15', name: 'Grilled sea bass & roasted veg',     calories: 490, protein: 42, carbs: 28, fat: 18 },
  { time: '20:00', name: 'Spaghetti bolognese',                calories: 750, protein: 36, carbs: 88, fat: 22 },
  { time: '19:00', name: 'Turkey meatballs & zucchini',        calories: 520, protein: 44, carbs: 26, fat: 22 },
  { time: '19:30', name: 'Vegetable curry & basmati rice',     calories: 610, protein: 18, carbs: 90, fat: 18 },
  { time: '18:30', name: 'Grilled pork tenderloin & potatoes', calories: 640, protein: 48, carbs: 50, fat: 20 },
  { time: '19:45', name: 'Mushroom risotto',                   calories: 580, protein: 16, carbs: 82, fat: 16 },
  { time: '19:00', name: 'Tuna & chickpea salad',              calories: 470, protein: 44, carbs: 38, fat: 14 },
];

const SNACK_POOL = [
  { time: '10:30', name: 'Flat white',                         calories: 120, protein: 7,  carbs: 10, fat: 6  },
  { time: '16:00', name: 'Apple & a handful of almonds',       calories: 210, protein: 6,  carbs: 27, fat: 11 },
  { time: '15:30', name: 'Rice cakes & peanut butter',         calories: 240, protein: 8,  carbs: 30, fat: 10 },
  { time: '10:00', name: 'Banana & protein bar',               calories: 280, protein: 18, carbs: 40, fat: 6  },
  { time: '16:30', name: 'Carrot sticks & hummus',             calories: 160, protein: 5,  carbs: 20, fat: 7  },
  { time: '11:00', name: 'Mixed nuts (30 g)',                  calories: 185, protein: 5,  carbs: 6,  fat: 16 },
  { time: '15:00', name: 'Dark chocolate (2 squares)',         calories: 110, protein: 2,  carbs: 12, fat: 6  },
  { time: '16:45', name: 'String cheese & grapes',             calories: 190, protein: 10, carbs: 22, fat: 7  },
];

const SLOTS = [
  { type: 'BREAKFAST', pool: BREAKFAST_POOL, skip: 0.15 },
  { type: 'LUNCH',     pool: LUNCH_POOL,     skip: 0.15 },
  { type: 'DINNER',    pool: DINNER_POOL,    skip: 0.15 },
  { type: 'SNACK',     pool: SNACK_POOL,     skip: 0.35 },
];

// Seeded RNG (xorshift32) — identical to the frontend mock, so the seeded
// history matches what MOCK_MODE used to render for the same calendar date.
function seeded(seed) {
  let n = (seed + 1) >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const estimateFiber = (carbs) => Math.max(1, Math.round(carbs * 0.12));

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function api(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (err) {
    throw new Error(`Cannot reach ${url} — are the services running? (${err.message})`);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Build an ISO timestamp for `day` at the pool entry's HH:MM (local time).
function loggedAtFor(day, time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function mealsForDay(day) {
  const seed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
  const r = seeded(seed);
  const meals = [];
  for (const slot of SLOTS) {
    if (r() < slot.skip) continue;
    const item = slot.pool[Math.floor(r() * slot.pool.length)];
    meals.push({
      mealType: slot.type,
      loggedAt: loggedAtFor(day, item.time),
      notes: '',
      items: [{
        name:         item.name,
        quantity:     1,
        unit:         'serving',
        calories:     item.calories,
        proteinGrams: item.protein,
        carbsGrams:   item.carbs,
        fatGrams:     item.fat,
        fiberGrams:   estimateFiber(item.carbs),
      }],
    });
  }
  return meals;
}

// ─── Seed flow ───────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${cfg.email} — last ${cfg.days} days`);

  // 1. Register (or log in if the user already exists).
  let auth = await api('POST', `${cfg.authUrl}/api/auth/register`, {
    body: { email: cfg.email, password: cfg.password, displayName: cfg.displayName },
  });
  if (!auth.ok) {
    auth = await api('POST', `${cfg.authUrl}/api/auth/login`, {
      body: { email: cfg.email, password: cfg.password },
    });
    if (!auth.ok) {
      throw new Error(`Auth failed (${auth.status}): ${JSON.stringify(auth.data)}`);
    }
    console.log('• user exists → logged in');
  } else {
    console.log('• registered new user');
  }
  const token = auth.data.accessToken;

  // 2. Profile (idempotent upsert).
  const prof = await api('PUT', `${cfg.authUrl}/api/users/me`, { token, body: PROFILE });
  if (!prof.ok) throw new Error(`PUT /users/me failed (${prof.status}): ${JSON.stringify(prof.data)}`);
  console.log('• profile updated');

  // 3. Goals (idempotent upsert).
  const goals = await api('PUT', `${cfg.analyticsUrl}/api/goals`, { token, body: GOALS });
  if (!goals.ok) throw new Error(`PUT /goals failed (${goals.status}): ${JSON.stringify(goals.data)}`);
  console.log('• goals set');

  // 4. Meals. Skip if the window already has data (unless --force).
  const today = new Date();
  const from = new Date(today); from.setDate(from.getDate() - (cfg.days - 1));
  const existing = await api('GET',
    `${cfg.mealsUrl}/api/meals?from=${isoDate(from)}&to=${isoDate(today)}`, { token });
  if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0 && !cfg.force) {
    console.log(`• ${existing.data.length} meals already in range — skipping (use --force to add anyway)`);
    console.log('\nDone. Open http://localhost:3000 and log in with', cfg.email, '/', cfg.password);
    return;
  }

  let count = 0;
  for (let offset = cfg.days - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    for (const meal of mealsForDay(day)) {
      const res = await api('POST', `${cfg.mealsUrl}/api/meals/manual`, { token, body: meal });
      if (!res.ok) throw new Error(`POST /meals/manual failed (${res.status}): ${JSON.stringify(res.data)}`);
      count++;
    }
  }
  console.log(`• seeded ${count} meals`);
  console.log('\nDone. Open http://localhost:3000 and log in with', cfg.email, '/', cfg.password);
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
