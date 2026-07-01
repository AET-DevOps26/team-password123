# Manual Test Plan — Calorieasy Web App

End-to-end manual QA checklist for the React web client (`calorie-app/`) running against the real backend (no frontend mocks). Use this before merging feature branches or cutting a release.

**Scope:** Web client only (auth, onboarding, home, diary, insights, profile, scan/manual meal logging, meal detail/edit/delete).  
**Out of scope:** iOS app, Helm/k8s deploy, GenAI service unit tests (except via the scan flow).

---

## 1. Prerequisites

### 1.1 Environment (pick one)

#### Option A — Without AI (recommended for most QA)

Fastest setup; scan falls back to manual entry. Matches the README “Run locally without AI” flow.

```bash
cp .env.example .env
docker compose up --build postgres auth-service meals-service analytics-service web
node scripts/seed.mjs
```

Open **http://localhost:3000**

#### Option B — Full stack with GenAI

Requires Ollama with `llava` or OpenAI credentials in `.env`. See [README](../README.md#full-stack-with-genai).

After any compose change, hard-refresh the browser tab if the app was already open.

### 1.2 Test accounts

| Account | Email | Password | Purpose |
|---------|-------|----------|---------|
| Seeded demo | `dev@local.com` | `password123` | Pre-populated diary (~10 days), goals, streak |
| Fresh user | `qa-fresh-{date}@local.com` | `password12345` | Register + onboarding path (create per run) |

### 1.3 Browser & tools

- [ ] Chrome or Firefox (latest)
- [ ] DevTools → **Network** tab (filter `Fetch/XHR`)
- [ ] DevTools → **Application** → Local Storage (`token`, `userProfile`)
- [ ] Optional: responsive mode (375px mobile width)
- [ ] Optional: screen reader (NVDA/VoiceOver) for accessibility spot checks

### 1.4 How to record results

Each test case has:

- **Priority:** P0 (blocker), P1 (important), P2 (nice to verify)
- **Steps** → **Expected (UI)** → **Expected (API)** → **Edge cases**

Mark: ✅ Pass · ❌ Fail · ⏭ Skip (note reason) · 🐛 Fail + log defect ID

---

## 2. Smoke test (15 min)

Run this first. If any P0 fails, stop and fix before deep testing.

| ID | Area | Steps | Expected |
|----|------|-------|----------|
| SM-01 | Auth | Login as `dev@local.com` | Home loads, no onboarding |
| SM-02 | Home | Check greeting + name | Time-of-day salutation + profile name (not stale session name) |
| SM-03 | Home | Calorie ring shows data | Consumed kcal > 0 from seed |
| SM-04 | Diary | Navigate to Diary | Meals grouped by slot |
| SM-05 | Manual | Add one snack via Manual | Toast, entry appears, total updates |
| SM-06 | Detail | Click a meal row | Meal detail modal opens |
| SM-07 | Edit | Change name, Save | List updates; reload persists |
| SM-08 | Delete | Delete a meal, confirm | Entry gone; totals drop |
| SM-09 | Insights | Open Insights | Charts/bars render |
| SM-10 | Profile | Open Profile, tweak goal, Save | “Saved ✓” |
| SM-11 | Scan | Open scan modal, pick photo | Preview shown (AI off → manual form) |
| SM-12 | Sign out | Sign out from sidebar | Back to auth screen |

---

## 3. Authentication

### AUTH-01 · Login (P0)

**Precondition:** Logged out.

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Open app | Auth page with Sign in / Create account tabs | — |
| 2 | Enter valid credentials, submit | Home or onboarding | `POST /api/auth/login` → 200, body has `accessToken` |
| 3 | Check localStorage | `token` set | — |

**Edge cases**

- [ ] Wrong password → error message, stay on auth, no token
- [ ] Empty email/password → validation prevents submit or shows error
- [ ] “Sign in” tab vs “Sign in” button — screen reader announces distinct names (`Switch to sign in` on tab)

### AUTH-02 · Register (P0)

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Switch to Create account | Register form visible | — |
| 2 | Fill name, email, password (≥8 chars), submit | Onboarding flow | `POST /api/auth/register` → 201 |
| 3 | Complete onboarding | Home with chosen name | `PUT /api/users/me`, `PUT /api/goals` |

**Edge cases**

- [ ] Duplicate email → 409/400 with readable message
- [ ] Password &lt; 8 chars → blocked or error
- [ ] Register then reload before onboarding → onboarding resumes (not home)

### AUTH-03 · Session persistence (P1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login, close tab, reopen | Still logged in |
| 2 | Sign out, reopen | Auth page |
| 3 | Manually delete `token` in localStorage, refresh | Auth page, no crash |

### AUTH-04 · Cross-account isolation (P1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as user A, note home greeting name | Name = A |
| 2 | Sign out, login as user B (no shared browser profile confusion) | Greeting shows B immediately, not A |
| 3 | Diary | Only B’s meals |

---

## 4. Onboarding

### ONB-01 · Happy path (P0)

**Precondition:** Fresh registered user.

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Step 1: enter name, Next | Step 2 | — |
| 2 | Step 2: adjust Age/Height/Weight with ± | Values change; buttons have `Increase Age` / `Decrease Height` labels | — |
| 3 | Step 3: pick activity + goal, Finish | Home | `PUT /api/users/me`, goals saved |
| 4 | Reload | Home, onboarding skipped | `GET /api/users/me` has profile fields |

**Edge cases**

- [ ] Step 1: empty name → Next disabled
- [ ] Step 2: Age at min (10) → Decrease disabled; at max (99) → Increase disabled
- [ ] Back from step 2 → name preserved
- [ ] Greeting on home uses onboarding name with correct time-of-day prefix

### ONB-02 · Seeded user skip (P1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as `dev@local.com` | Straight to Home, no onboarding |

---

## 5. Home page

### HOME-01 · Layout & data (P0)

**Precondition:** Logged in as seeded user.

| Element | Expected |
|---------|----------|
| Date eyebrow | “Today, {weekday} {day} {month}” |
| Greeting | `Good morning` (&lt;12) / `Good afternoon` (12–17) / `Good evening` (≥18) + first name |
| Calorie ring | Consumed vs goal |
| Macro bars | Protein, carbs, fat with progress |
| Stat pills | Day streak, goal hit, 7-day avg |
| Today’s meals | List of `MealRow` entries |

**Edge cases**

- [ ] No meals today (fresh user or after deleting all) → ring at 0, “0 logged”
- [ ] API failure → page still renders; stats may fall back to local store sums

### HOME-02 · Scan entry points (P1)

| Entry point | Action | Expected |
|-------------|--------|----------|
| Header button | Click “Scan a meal” | Scan modal (accessible name: “Scan a meal for today”) |
| Insight card | Click “Log your dinner…” card | Same modal |
| Sidebar | Click “Scan a meal” | Same modal (name: “Scan a meal”) |
| Tab bar FAB | Click camera FAB | Same modal (`aria-label`: “Scan a meal”) |

**Edge case:** No two actionable controls share the same accessible name on the same screen.

### HOME-03 · Meal row → detail (P0)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click any meal in Today’s meals | Meal detail modal |
| 2 | Photo | Shows image or “No photo” |
| 3 | Close (X, Esc, overlay click) | Modal closes, list unchanged |

---

## 6. Food diary

### DRY-01 · Day navigation (P0)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Diary | Today’s date in header |
| 2 | Previous day | Yesterday’s meals load |
| 3 | Next day from past | Forward works until today |
| 4 | Next day on today | Disabled (cannot go to future) |
| 5 | Week strip pills | Jump to day; future days disabled |

**API:** `GET /api/meals?from=YYYY-MM-DD&to=YYYY-MM-DD` on each day change.

### DRY-02 · Slot groups (P1)

| Slot | Empty state | With meals |
|------|-------------|------------|
| Breakfast | “Add breakfast” CTA | Rows + “Add more” |
| Lunch | same | same |
| Dinner | same | same |
| Snack | same | same |

**Edge case:** Empty-slot CTA opens Manual modal with correct default slot.

### DRY-03 · Day totals (P0)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Note total kcal + macro chips | Sum of visible meals |
| 2 | Add meal via Manual | Total increases immediately after save |
| 3 | Delete meal via detail modal | Total decreases |

### DRY-04 · Manual entry (P0)

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Click Manual | Modal “Add ingredients” | — |
| 2 | Search “Banana”, add suggestion | Ingredient in list, total kcal updates | — |
| 3 | Optional: add photo | Thumbnail preview | — |
| 4 | Select slot, Save | Toast “Logged N kcal”, modal closes | `POST /api/meals/manual` or photo flow |
| 5 | Reload page | Entry still present | `GET /api/meals` |

**Edge cases**

- [ ] Save with zero ingredients → disabled
- [ ] Remove ingredient → total recalculates
- [ ] Photo &gt; 10 MB → rejected silently (no preview)
- [ ] Non-image file → rejected
- [ ] Log on **past day** (offset -1): entry appears on that day, not today
- [ ] Remove photo before save → saves without photo

### DRY-05 · Meal detail from diary (P0)

Same as HOME-03 but on Diary page; verify slot group updates after edit/delete.

---

## 7. Scan meal flow

### SCN-01 · Modal idle state (P1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open scan modal | Drop zone visible |
| 2 | Click drop zone, pick JPG/PNG | Preview replaces drop zone |
| 3 | “Choose a different photo” / Retake | Clears preview |

**Edge cases**

- [ ] Drag-and-drop image onto zone → preview
- [ ] Non-image file → ignored
- [ ] File &gt; 10 MB → ignored

### SCN-02 · Without AI (compose default) (P0)

**Precondition:** GenAI not wired (`APP_GENAI_BASE_URL` unset) or analyze fails.

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Select photo, Analyze | Scanning then manual form OR direct manual fallback | `POST /api/meals/analyze` may fail → fallback |
| 2 | Fill dish name + kcal + macros | Fields editable | — |
| 3 | Pick slot, Log | Toast, entry in diary | `POST /api/meals/manual` or `convert-manual` |
| 4 | Hard reload | Entry persists | `GET /api/meals` |

**Known regression to watch:** Scan manual fallback should upload photo via `POST /api/meals/photo` before `convert-manual` so photo survives reload. If photo disappears after reload, log defect.

### SCN-03 · With AI available (P1)

**Precondition:** Ollama running + GenAI linked (see README / branch `photo-logging-a11y-cleanup` compose).

| Step | Action | Expected |
|------|--------|----------|
| 1 | Analyze valid meal photo | Result stage with dish name, confidence, macros |
| 2 | Add to diary | Entry with AI-derived name and kcal |
| 3 | Reload | Entry + photo persist |

**Edge cases**

- [ ] Blurry/unrecognizable photo → manual fallback
- [ ] GenAI service down → graceful manual fallback, no white screen
- [ ] Cancel mid-scan (close modal) → no diary entry

### SCN-04 · Scan progress & error (P2)

- [ ] Scanning stage shows progress animation
- [ ] Error stage shows message + “Try again” resets modal

---

## 8. Meal detail — view, edit, delete

### DET-01 · View (P0)

| Field | Expected |
|-------|----------|
| Photo | Full-width preview or placeholder |
| Time | Matches list row |
| Name | Editable text field pre-filled |
| Meal slot | Dropdown: Breakfast/Lunch/Dinner/Snack |
| Calories | Number input |
| Protein/Carbs/Fat | Number inputs (grams) |

**Edge case:** Meal without backend UUID (local-only `scan-*` id) shows “not synced to server”; save/delete still updates local list only.

### DET-02 · Edit & save (P0)

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Change name + kcal + one macro | Fields accept input | — |
| 2 | Change slot Lunch → Snack | Dropdown updates | — |
| 3 | Save changes | Modal closes; row updated in list | `PUT /api/meals/{id}` → 200 |
| 4 | Reload | All edits persisted | `GET /api/meals/{id}` |
| 5 | Home ring / diary totals | Reflect new kcal | `GET /api/analytics/daily` |

**Edge cases**

- [ ] Empty name → Save disabled
- [ ] Zero calories → Save disabled
- [ ] Save while offline → error message in modal, no crash
- [ ] Edit seeded meal from Home vs Diary — both views stay in sync after refresh

### DET-03 · Delete (P0)

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Click Delete | Inline confirm: “Delete {name}?…” | — |
| 2 | Cancel | Stay in modal, meal remains | — |
| 3 | Confirm Delete | Modal closes, row gone | `DELETE /api/meals/{id}` → 204 |
| 4 | Reload | Meal still gone | — |
| 5 | Insights / streak | May change if last meal of day | optional check |

**Edge cases**

- [ ] Delete last meal of the day → empty slot CTA returns
- [ ] Double-click Delete confirm → only one request (no error toast loop)

---

## 9. Insights

### INS-01 · Week view (P1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Insights | Week range selected by default |
| 2 | Bar chart | Days with seed data show bars |
| 3 | Today bar | Highlighted differently |
| 4 | Click a day bar | Navigates to Diary for that day |
| 5 | “Back to Insights” on Diary | Returns with state preserved |

### INS-02 · Range switching (P2)

- [ ] Month view loads without error
- [ ] Year view loads without error
- [ ] Drill-down / back navigation consistent

### INS-03 · Empty data (P2)

**Precondition:** Fresh user, no meals.

- [ ] Insights renders empty/zero states without crash

---

## 10. Profile & goals

### PRF-01 · Display (P1)

| Field | Expected |
|-------|----------|
| Name | Editable, matches greeting source |
| Email | Read-only from account |

### PRF-02 · Goal steppers (P0)

| Step | Action | Expected UI | Expected API |
|------|--------|-------------|--------------|
| 1 | Adjust calories ±50 | Value changes | — |
| 2 | Adjust protein/carbs/fat | Values change | — |
| 3 | Save goals | “Saved ✓” | `PUT /api/goals` → 200 |
| 4 | Go to Home | Ring goal matches new target | — |

**Edge cases**

- [ ] Stepper at 0 → decrease does not go negative
- [ ] Toggle daily reminder switch → UI toggles (persistence if implemented)

### PRF-03 · Sign out (P0)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Sign out from Profile or Sidebar | Auth screen |
| 2 | Browser back | Does not expose authenticated pages without token |

---

## 11. Navigation & shell

### NAV-01 · Sidebar (P1)

| Item | Expected |
|------|----------|
| Home / Diary / Insights / Profile | Switches page, highlights active |
| Scan a meal | Opens scan modal from any page |
| Sign out | Clears session |

### NAV-02 · Tab bar — mobile (P1)

**Precondition:** Viewport ≤ ~768px or narrow window.

- [ ] Bottom tabs visible, sidebar hidden
- [ ] FAB opens scan modal
- [ ] Active tab indicator correct

### NAV-03 · Toast notifications (P2)

- [ ] After logging meal, toast appears and auto-dismisses
- [ ] Dismiss manually if supported

---

## 12. Accessibility

### A11Y-01 · Keyboard (P1)

- [ ] Tab through auth form → focus visible
- [ ] Modal: Esc closes; focus trapped reasonably
- [ ] Meal row: activatable via keyboard (Enter/Space on button)
- [ ] Onboarding steppers: reachable, labeled Increase/Decrease

### A11Y-02 · Screen reader labels (P1)

| Control | Expected accessible name |
|---------|-------------------------|
| Auth Sign in tab | “Switch to sign in” |
| Auth Create account tab | “Switch to create account” |
| Home scan button | “Scan a meal for today” |
| Diary scan button | “Scan a meal for this day” |
| Sidebar scan | “Scan a meal” |
| Tab bar FAB | “Scan a meal” |
| Meal row | “View {name}, {kcal} calories” |
| Onboarding Age + | “Increase Age” |
| Delete confirm | “Delete meal” |

### A11Y-03 · Images (P2)

- [ ] Meal photos have `alt` text (meal name)
- [ ] Decorative icons marked appropriately

---

## 13. Resilience & security

### RES-01 · Network failure (P1)

| Scenario | Steps | Expected |
|----------|-------|----------|
| API down at login | Stop meals-service | Login may work; diary shows empty/error, no infinite spinner |
| Offline save | DevTools offline during Save | Error message, data not silently lost |
| Expired token | Invalidate token in storage | Next API call → redirect to auth or error |

### RES-02 · Data integrity (P1)

- [ ] No duplicate meals after double-submit on Save (rapid double-click)
- [ ] Reload never shows another user’s data after account switch

---

## 14. Full end-to-end script (~45 min)

Execute as one continuous user session. Check off each step.

### Phase A — New user journey

1. [ ] Register `qa-fresh-{date}@local.com` / `password12345`
2. [ ] Onboarding: name “QA Tester”, adjust height/weight, finish
3. [ ] Home: verify greeting “Good …, QA”
4. [ ] Diary → Manual → add **Breakfast** (oats + banana, no photo)
5. [ ] Diary → Manual → add **Lunch** with photo
6. [ ] Scan → pick photo → manual fallback → log **Dinner**
7. [ ] Home: verify 3 meals, ring updated

### Phase B — Edit & delete

8. [ ] Home: open lunch → rename → change kcal → Save → verify list
9. [ ] Diary: open dinner → move to **Snack** → Save
10. [ ] Delete breakfast from detail modal → confirm
11. [ ] Reload browser → only lunch + snack remain; totals correct

### Phase C — Analytics & profile

12. [ ] Insights: week view shows activity for today
13. [ ] Click today’s bar → Diary → Back to Insights
14. [ ] Profile: raise calorie goal +100, Save
15. [ ] Home: ring goal label reflects new target

### Phase D — Seeded account regression

16. [ ] Sign out → login `dev@local.com` / `password123`
17. [ ] Home: streak & 7-day avg populated
18. [ ] Diary: navigate to a past seeded day → meals load
19. [ ] Edit one seeded meal → reload → persisted
20. [ ] Delete one seeded meal → reload → gone

### Phase E — Accessibility spot check

21. [ ] Tab through scan modal open/close
22. [ ] Verify distinct scan button names (DevTools Accessibility tree)

### Phase F — Clean exit

23. [ ] Sign out → land on auth
24. [ ] Confirm `token` removed from localStorage

---

## 15. API quick reference (for Network tab)

| Action | Method | Path |
|--------|--------|------|
| Login | POST | `/api/auth/login` |
| Register | POST | `/api/auth/register` |
| Profile | GET/PUT | `/api/users/me` |
| List meals | GET | `/api/meals?from=&to=` |
| Get meal | GET | `/api/meals/{id}` |
| Update meal | PUT | `/api/meals/{id}` |
| Delete meal | DELETE | `/api/meals/{id}` |
| Manual log | POST | `/api/meals/manual` |
| Upload photo | POST | `/api/meals/photo` |
| Photo + manual | POST | `/api/meals/photo/{id}/convert-manual` |
| Analyze | POST | `/api/meals/analyze` |
| Meal photo | GET | `/api/meals/photo/{id}/raw` |
| Daily analytics | GET | `/api/analytics/daily?date=` |
| Weekly analytics | GET | `/api/analytics/weekly?weekStart=` |
| Streak | GET | `/api/analytics/streak` |
| Goals | GET/PUT | `/api/goals` |

Full schemas: [`API Reference.md`](API%20Reference.md)

---

## 16. Known issues & regression watchlist

Track these during every full pass:

| ID | Area | Symptom | Status |
|----|------|---------|--------|
| REG-01 | Scan fallback | Photo lost after reload when AI unavailable | Verify on branch |
| REG-02 | Greeting | Hardcoded “Good afternoon” | Fixed on `photo-logging-a11y-cleanup` |
| REG-03 | Name source | Session name vs profile name mismatch | Fixed |
| REG-04 | Scan a11y | Duplicate “Scan a meal” names | Fixed |
| REG-05 | Meal detail | Missing view/edit page | Fixed on `melisa/meal-detail-and-delete` |
| REG-06 | Delete meal | No UI for delete | Fixed on `melisa/meal-detail-and-delete` |

---

## 17. Defect log template

Copy for each failure:

```
Defect ID:     BUG-###
Date:          YYYY-MM-DD
Tester:        
Build/Branch:  
Priority:      P0 / P1 / P2
Test case ID:  e.g. DET-03
Environment:   Docker compose (AI on/off)

Steps to reproduce:
1.
2.

Expected:
Actual:
Screenshots/Network:
```

---

## 18. Sign-off

| Field | Value |
|-------|-------|
| Branch / commit | |
| Tester | |
| Date | |
| Environment | AI off / AI on |
| Smoke (Section 2) | ☐ All P0 pass |
| Full E2E (Section 14) | ☐ Complete |
| Open P0 defects | |
| Release recommendation | ☐ Ship · ☐ Block |
