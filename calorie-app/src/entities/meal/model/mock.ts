import type { MealEntry } from './types';

type MealSlot = MealEntry['slot'];

export const MOCK_MEALS: MealEntry[] = [
  { id: 'm1', slot: 'Breakfast', time: '08:15', name: 'Greek yogurt & berry bowl',    calories: 320, protein: 22, carbs: 38, fat: 9,  tone: '#e8d9c4' },
  { id: 'm2', slot: 'Lunch',     time: '13:05', name: 'Quinoa & avocado salad',        calories: 550, protein: 19, carbs: 61, fat: 24, tone: '#cfe0c9' },
  { id: 'm3', slot: 'Snack',     time: '16:40', name: 'Apple & a handful of almonds', calories: 210, protein: 6,  carbs: 27, fat: 11, tone: '#e4d2cf' },
  { id: 'm4', slot: 'Snack',     time: '11:00', name: 'Flat white',                    calories: 120, protein: 7,  carbs: 10, fat: 6,  tone: '#dcd6cc' },
];

// ─── seeded RNG (same xorshift32 as InsightsPage) ───────────────────────────

function seeded(seed: number) {
  let n = (seed + 1) >>> 0;
  return () => {
    n = (n + 0x6d2b79f5) >>> 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Meal pools per slot ─────────────────────────────────────────────────────

type PoolEntry = Omit<MealEntry, 'id' | 'slot'>;

const BREAKFAST_POOL: PoolEntry[] = [
  { time: '07:45', name: 'Oatmeal with banana & honey',        calories: 380, protein: 12, carbs: 68, fat: 8,  tone: '#e8d9c4' },
  { time: '08:00', name: 'Scrambled eggs & whole-grain toast', calories: 420, protein: 28, carbs: 34, fat: 16, tone: '#e8d9c4' },
  { time: '08:15', name: 'Greek yogurt & berry bowl',          calories: 320, protein: 22, carbs: 38, fat: 9,  tone: '#e8d9c4' },
  { time: '08:30', name: 'Avocado toast with poached egg',     calories: 450, protein: 18, carbs: 40, fat: 22, tone: '#e8d9c4' },
  { time: '07:30', name: 'Smoothie bowl (acai, granola)',      calories: 490, protein: 14, carbs: 72, fat: 15, tone: '#e8d9c4' },
  { time: '08:00', name: 'Cottage cheese & pineapple',         calories: 280, protein: 26, carbs: 28, fat: 5,  tone: '#e8d9c4' },
  { time: '08:45', name: 'Whole-wheat pancakes with berries',  calories: 520, protein: 16, carbs: 80, fat: 14, tone: '#e8d9c4' },
  { time: '07:50', name: 'Muesli with almond milk',            calories: 350, protein: 11, carbs: 58, fat: 9,  tone: '#e8d9c4' },
  { time: '08:10', name: 'Veggie omelette (3 eggs)',           calories: 390, protein: 30, carbs: 8,  fat: 26, tone: '#e8d9c4' },
  { time: '08:20', name: 'Protein shake & banana',             calories: 340, protein: 32, carbs: 40, fat: 5,  tone: '#e8d9c4' },
];

const LUNCH_POOL: PoolEntry[] = [
  { time: '12:30', name: 'Quinoa & avocado salad',             calories: 550, protein: 19, carbs: 61, fat: 24, tone: '#cfe0c9' },
  { time: '13:00', name: 'Grilled chicken wrap',               calories: 620, protein: 42, carbs: 55, fat: 18, tone: '#cfe0c9' },
  { time: '12:45', name: 'Lentil soup & rye bread',            calories: 480, protein: 24, carbs: 68, fat: 9,  tone: '#cfe0c9' },
  { time: '13:15', name: 'Salmon & brown rice bowl',           calories: 680, protein: 48, carbs: 62, fat: 22, tone: '#cfe0c9' },
  { time: '12:00', name: 'Caesar salad with chicken',          calories: 530, protein: 38, carbs: 24, fat: 28, tone: '#cfe0c9' },
  { time: '13:30', name: 'Turkey & hummus sandwich',           calories: 560, protein: 34, carbs: 58, fat: 16, tone: '#cfe0c9' },
  { time: '12:15', name: 'Poke bowl (tuna, edamame)',          calories: 610, protein: 40, carbs: 66, fat: 18, tone: '#cfe0c9' },
  { time: '13:00', name: 'Vegetable stir-fry & tofu',          calories: 440, protein: 22, carbs: 52, fat: 14, tone: '#cfe0c9' },
  { time: '12:50', name: 'Pasta primavera',                    calories: 590, protein: 20, carbs: 90, fat: 12, tone: '#cfe0c9' },
  { time: '13:10', name: 'Minestrone soup & focaccia',         calories: 510, protein: 18, carbs: 74, fat: 11, tone: '#cfe0c9' },
];

const DINNER_POOL: PoolEntry[] = [
  { time: '19:00', name: 'Baked salmon & asparagus',           calories: 540, protein: 46, carbs: 22, fat: 26, tone: '#d0d8e8' },
  { time: '19:30', name: 'Chicken tikka masala & rice',        calories: 720, protein: 44, carbs: 76, fat: 24, tone: '#d0d8e8' },
  { time: '18:45', name: 'Beef stir-fry with noodles',         calories: 680, protein: 38, carbs: 74, fat: 20, tone: '#d0d8e8' },
  { time: '19:15', name: 'Grilled sea bass & roasted veg',     calories: 490, protein: 42, carbs: 28, fat: 18, tone: '#d0d8e8' },
  { time: '20:00', name: 'Spaghetti bolognese',                calories: 750, protein: 36, carbs: 88, fat: 22, tone: '#d0d8e8' },
  { time: '19:00', name: 'Turkey meatballs & zucchini',        calories: 520, protein: 44, carbs: 26, fat: 22, tone: '#d0d8e8' },
  { time: '19:30', name: 'Vegetable curry & basmati rice',     calories: 610, protein: 18, carbs: 90, fat: 18, tone: '#d0d8e8' },
  { time: '18:30', name: 'Grilled pork tenderloin & potatoes', calories: 640, protein: 48, carbs: 50, fat: 20, tone: '#d0d8e8' },
  { time: '19:45', name: 'Mushroom risotto',                   calories: 580, protein: 16, carbs: 82, fat: 16, tone: '#d0d8e8' },
  { time: '19:00', name: 'Tuna & chickpea salad',              calories: 470, protein: 44, carbs: 38, fat: 14, tone: '#d0d8e8' },
];

const SNACK_POOL: PoolEntry[] = [
  { time: '10:30', name: 'Flat white',                         calories: 120, protein: 7,  carbs: 10, fat: 6,  tone: '#dcd6cc' },
  { time: '16:00', name: 'Apple & a handful of almonds',       calories: 210, protein: 6,  carbs: 27, fat: 11, tone: '#e4d2cf' },
  { time: '15:30', name: 'Rice cakes & peanut butter',         calories: 240, protein: 8,  carbs: 30, fat: 10, tone: '#dcd6cc' },
  { time: '10:00', name: 'Banana & protein bar',               calories: 280, protein: 18, carbs: 40, fat: 6,  tone: '#e4d2cf' },
  { time: '16:30', name: 'Carrot sticks & hummus',             calories: 160, protein: 5,  carbs: 20, fat: 7,  tone: '#dcd6cc' },
  { time: '11:00', name: 'Mixed nuts (30 g)',                  calories: 185, protein: 5,  carbs: 6,  fat: 16, tone: '#e4d2cf' },
  { time: '15:00', name: 'Dark chocolate (2 squares)',         calories: 110, protein: 2,  carbs: 12, fat: 6,  tone: '#dcd6cc' },
  { time: '16:45', name: 'String cheese & grapes',             calories: 190, protein: 10, carbs: 22, fat: 7,  tone: '#e4d2cf' },
];

const SLOT_POOLS: Record<MealSlot, PoolEntry[]> = {
  Breakfast: BREAKFAST_POOL,
  Lunch:     LUNCH_POOL,
  Dinner:    DINNER_POOL,
  Snack:     SNACK_POOL,
};

const MOCK_ANCHOR = new Date(2026, 4, 28); // Thu 28 May 2026

/**
 * Returns a deterministic set of mock meal entries for a given day offset
 * (relative to MOCK_ANCHOR). Uses the same seeded RNG as InsightsPage so
 * diary totals are consistent with chart values.
 */
export function getMockMealsForOffset(offset: number): MealEntry[] {
  const d = new Date(MOCK_ANCHOR);
  d.setDate(d.getDate() + offset);
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const r = seeded(seed);

  const entries: MealEntry[] = [];
  const slots: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

  for (const slot of slots) {
    // ~85 % chance each slot is logged; Snack slightly less
    const threshold = slot === 'Snack' ? 0.35 : 0.15;
    if (r() < threshold) continue;

    const pool = SLOT_POOLS[slot];
    const idx  = Math.floor(r() * pool.length);
    entries.push({ id: `mock${offset}-${slot}`, slot, ...pool[idx] });
  }

  return entries;
}
