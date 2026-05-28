import './App.css';

// ── Design tokens / mock data ───────────────────────────────────────────────

const GOAL = { calories: 2000, protein: 120, carbs: 220, fat: 65 };
const TODAY = { dateLabel: 'Today, Thu 28 May', consumed: 1340, protein: 78, carbs: 145, fat: 42 };
const STATS = { weekAvg: 2050, goalAdherence: 0.86, streak: 12 };

const MEALS = [
  { id: 'm1', slot: 'Breakfast', time: '08:15', name: 'Greek yogurt & berry bowl',       calories: 320, protein: 22, carbs: 38,  fat: 9,  tone: '#e8d9c4' },
  { id: 'm2', slot: 'Lunch',     time: '13:05', name: 'Quinoa & avocado salad',            calories: 550, protein: 19, carbs: 61,  fat: 24, tone: '#cfe0c9' },
  { id: 'm3', slot: 'Snack',     time: '16:40', name: 'Apple & a handful of almonds',     calories: 210, protein: 6,  carbs: 27,  fat: 11, tone: '#e4d2cf' },
  { id: 'm4', slot: 'Snack',     time: '11:00', name: 'Flat white',                        calories: 120, protein: 7,  carbs: 10,  fat: 6,  tone: '#dcd6cc' },
];

// ── Icons ───────────────────────────────────────────────────────────────────

interface IconProps { size?: number; }

function IconSvg({ size = 22, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IconHome   = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </IconSvg>
);
const IconCamera = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.8a1 1 0 0 1 .9-.5h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.4" />
  </IconSvg>
);
const IconBook   = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6M9 11h6" />
  </IconSvg>
);
const IconChart  = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M4 20V4M4 20h16M8 16v-5M12.5 16V8M17 16v-8" />
  </IconSvg>
);
const IconUser   = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
  </IconSvg>
);
const IconFlame  = ({ size }: IconProps) => (
  <IconSvg size={size}>
    <path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 0-1.5-.5-2.5C16 9 18 12 18 14.5A6 6 0 0 1 6 14.5C6 10 10 8 12 3z" />
  </IconSvg>
);
const IconBolt   = ({ size }: IconProps) => (
  <IconSvg size={size}><path d="M13 3 5 13h6l-1 8 8-10h-6z" /></IconSvg>
);
const IconTarget = ({ size }: IconProps) => (
  <IconSvg size={size}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></IconSvg>
);
const IconTrend  = ({ size }: IconProps) => (
  <IconSvg size={size}><path d="M4 15l5-5 3.5 3.5L20 6M20 6h-4M20 6v4" /></IconSvg>
);
const IconChevR  = ({ size }: IconProps) => (
  <IconSvg size={size}><path d="M9 6l6 6-6 6" /></IconSvg>
);

// ── Calorie Ring ─────────────────────────────────────────────────────────────

function CalorieRing({ value, goal, size = 188, thickness = 16 }: {
  value: number; goal: number; size?: number; thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(value / goal, 1);
  const remaining = Math.max(goal - value, 0);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--green)" strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div className="ring-center">
        <div className="ring-num">{remaining.toLocaleString()}</div>
        <div className="ring-label">kcal left</div>
        <div className="ring-sub">{value.toLocaleString()} of {goal.toLocaleString()}</div>
      </div>
    </div>
  );
}

// ── Macro Bar ────────────────────────────────────────────────────────────────

function MacroBar({ label, value, goal, color }: {
  label: string; value: number; goal: number; color: string;
}) {
  const pct = Math.min(value / goal, 1) * 100;
  return (
    <div className="macro">
      <div className="macro-head">
        <span className="macro-label">{label}</span>
        <span className="macro-val"><b>{value}</b> / {goal} g</span>
      </div>
      <div className="macro-track">
        <div className="macro-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="statpill">
      <span className="statpill-ic">{icon}</span>
      <div>
        <div className="statpill-v">{value}</div>
        <div className="statpill-l">{label}</div>
      </div>
    </div>
  );
}

// ── Meal Row ─────────────────────────────────────────────────────────────────

function MealRow({ meal }: { meal: typeof MEALS[number] }) {
  return (
    <div className="mealrow">
      <div className="meal-thumb" style={{ width: 52, height: 52, background: meal.tone }}>
        <span className="meal-thumb-cap">photo</span>
      </div>
      <div className="mealrow-body">
        <div className="mealrow-top">
          <span className="mealrow-slot">{meal.slot}</span>
          <span className="mealrow-time">{meal.time}</span>
        </div>
        <div className="mealrow-name">{meal.name}</div>
        <div className="mealrow-macros">
          <span><i style={{ background: 'var(--protein)' }} />{meal.protein}p</span>
          <span><i style={{ background: 'var(--carbs)' }} />{meal.carbs}c</span>
          <span><i style={{ background: 'var(--fat)' }} />{meal.fat}f</span>
        </div>
      </div>
      <div className="mealrow-cal"><b>{meal.calories}</b><span>kcal</span></div>
    </div>
  );
}

// ── Home Screen ──────────────────────────────────────────────────────────────

function HomeScreen() {
  return (
    <div className="screen home">
      <header className="screen-head">
        <div>
          <div className="eyebrow">{TODAY.dateLabel}</div>
          <h1 className="h1">Good afternoon, there</h1>
        </div>
        <button className="scan-cta desktop-only">
          <IconCamera size={19} /> Scan a meal
        </button>
      </header>

      <div className="home-grid">
        <section className="card summary-card">
          <CalorieRing value={TODAY.consumed} goal={GOAL.calories} />
          <div className="summary-macros">
            <MacroBar label="Protein" value={TODAY.protein} goal={GOAL.protein} color="var(--protein)" />
            <MacroBar label="Carbs"   value={TODAY.carbs}   goal={GOAL.carbs}   color="var(--carbs)" />
            <MacroBar label="Fat"     value={TODAY.fat}     goal={GOAL.fat}     color="var(--fat)" />
          </div>
        </section>

        <section className="card insight-card">
          <div className="insight-ic"><IconBolt size={20} /></div>
          <div className="insight-body">
            <div className="insight-title">Log your dinner in one snap</div>
            <div className="insight-text">
              Point your camera at the plate — calorieasy reads the ingredients and
              estimates calories &amp; macros for you.
            </div>
          </div>
          <span className="insight-go"><IconChevR size={18} /></span>
        </section>

        <div className="quick-stats">
          <StatPill icon={<IconFlame size={18} />}  label="day streak" value={STATS.streak} />
          <StatPill icon={<IconTarget size={18} />} label="goal hit"   value={`${Math.round(STATS.goalAdherence * 100)}%`} />
          <StatPill icon={<IconTrend size={18} />}  label="7-day avg"  value={STATS.weekAvg.toLocaleString()} />
        </div>
      </div>

      <section className="meals-section">
        <div className="section-head">
          <h2 className="h2">Today's meals</h2>
          <span className="muted">{MEALS.length} logged</span>
        </div>
        <div className="meals-list">
          {MEALS.map((m) => <MealRow key={m.id} meal={m} />)}
        </div>
      </section>
    </div>
  );
}

// ── App Shell ────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'home',      label: 'Today',   Icon: IconHome,  active: true  },
  { id: 'diary',     label: 'Diary',   Icon: IconBook,  active: false },
  { id: 'analytics', label: 'Insights',Icon: IconChart, active: false },
  { id: 'profile',   label: 'Profile', Icon: IconUser,  active: false },
];

export default function App() {
  return (
    <div className="app-shell">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><IconFlame size={18} /></span>
          <span className="brand-name">calorie<b>easy</b></span>
        </div>

        {NAV.map(({ id, label, Icon, active }) => (
          <button
            key={id}
            className={`nav-item${active ? ' active' : ' disabled'}`}
            disabled={!active}
          >
            <Icon size={21} /> {label}
          </button>
        ))}

        <button className="sidebar-scan">
          <IconCamera size={19} /> Scan a meal
        </button>

        <div className="sidebar-foot">
          <span className="avatar">MC</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Mia Carter</div>
            <div className="muted">Free plan</div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="app-main">
        <div className="content">
          <HomeScreen />
        </div>
      </main>

      {/* ── Tabbar (mobile) ── */}
      <nav className="tabbar">
        <button className="tab active"><IconHome size={23} />Today</button>
        <button className="tab disabled" disabled><IconBook size={23} />Diary</button>
        <div className="tab-fab">
          <button className="tab-fab-btn"><IconCamera size={26} /></button>
        </div>
        <button className="tab disabled" disabled><IconChart size={23} />Insights</button>
        <button className="tab disabled" disabled><IconUser size={23} />Profile</button>
      </nav>
    </div>
  );
}
