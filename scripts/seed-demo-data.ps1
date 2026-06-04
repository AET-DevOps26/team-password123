param(
    [string]$SeedUserEmail = 'melisa@gmail.com',
    [string]$Email = 'demo.local@calorieasy.test',
    [string]$Password = 'SeedDemo123!',
    [string]$DisplayName = 'Seed Demo',
    [int]$DaysBack = 14
)

$ErrorActionPreference = 'Stop'

function Escape-SqlLiteral([string]$value) {
    return $value.Replace("'", "''")
}

function To-IsoDate([datetime]$date) {
    return $date.ToString('yyyy-MM-dd')
}

$today = (Get-Date).Date
$from  = $today.AddDays(-$DaysBack)
$repoRoot = Split-Path -Parent $PSScriptRoot
$demoUserId = '7b5b0bc9-1b91-4e5c-b0d8-7aa96c1fe001'

Set-Location $repoRoot

$emailEscaped = Escape-SqlLiteral $Email
$passwordEscaped = Escape-SqlLiteral $Password
$displayNameEscaped = Escape-SqlLiteral $DisplayName
$seedUserEmailEscaped = Escape-SqlLiteral $SeedUserEmail

$seedUserId = docker compose exec -T postgres psql -U nutrition -d nutrition -t -A -v ON_ERROR_STOP=1 -c "select id from auth.app_users where email = '$seedUserEmailEscaped' limit 1;"
$seedUserId = $seedUserId.Trim()
if ([string]::IsNullOrWhiteSpace($seedUserId)) {
    $seedUserId = $demoUserId
}

Write-Host "Seeding demo data for $Email from $(To-IsoDate $from) to $(To-IsoDate $today)"
Write-Host "Targeting meals/goals at existing user $SeedUserEmail ($seedUserId)"

$mealTemplates = @(
    @{ mealType = 'BREAKFAST'; hour = 8;  options = @(
        @{ name = 'Greek yogurt bowl';        calories = 320; protein = 22; carbs = 35; fat = 9;  fiber = 4 },
        @{ name = 'Oatmeal with banana';      calories = 410; protein = 15; carbs = 61; fat = 11; fiber = 7 },
        @{ name = 'Egg toast and berries';    calories = 360; protein = 19; carbs = 32; fat = 14; fiber = 5 }
    )},
    @{ mealType = 'LUNCH'; hour = 13; options = @(
        @{ name = 'Chicken rice bowl';        calories = 640; protein = 42; carbs = 58; fat = 20; fiber = 8 },
        @{ name = 'Turkey sandwich and soup'; calories = 520; protein = 33; carbs = 49; fat = 17; fiber = 6 },
        @{ name = 'Salad and grain bowl';     calories = 560; protein = 27; carbs = 54; fat = 22; fiber = 9 }
    )},
    @{ mealType = 'DINNER'; hour = 19; options = @(
        @{ name = 'Salmon with potatoes';     calories = 710; protein = 39; carbs = 47; fat = 34; fiber = 6 },
        @{ name = 'Chicken pasta';            calories = 690; protein = 36; carbs = 72; fat = 24; fiber = 5 },
        @{ name = 'Beef stir fry';            calories = 760; protein = 40; carbs = 51; fat = 36; fiber = 7 }
    )}
)

$sqlLines = @()
$sqlLines += "BEGIN;"
$sqlLines += "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
$sqlLines += "INSERT INTO auth.app_users (id, email, password_hash, display_name, created_at, height_cm, weight_kg, age, sex, activity_level, goal)"
$sqlLines += "VALUES ('${demoUserId}', '$emailEscaped', crypt('$passwordEscaped', gen_salt('bf')), '$displayNameEscaped', NOW(), 178, 74.5, 29, 'male', 'moderate', 'maintain')"
$sqlLines += "ON CONFLICT (email) DO UPDATE SET"
$sqlLines += "  password_hash = EXCLUDED.password_hash,"
$sqlLines += "  display_name = EXCLUDED.display_name,"
$sqlLines += "  created_at = EXCLUDED.created_at,"
$sqlLines += "  height_cm = EXCLUDED.height_cm,"
$sqlLines += "  weight_kg = EXCLUDED.weight_kg,"
$sqlLines += "  age = EXCLUDED.age,"
$sqlLines += "  sex = EXCLUDED.sex,"
$sqlLines += "  activity_level = EXCLUDED.activity_level,"
$sqlLines += "  goal = EXCLUDED.goal;"
$sqlLines += "DELETE FROM meals.meal_items WHERE meal_log_id IN (SELECT id FROM meals.meal_logs WHERE user_id = '$seedUserId');"
$sqlLines += "DELETE FROM meals.photo_logs WHERE user_id = '$seedUserId';"
$sqlLines += "DELETE FROM meals.meal_logs WHERE user_id = '$seedUserId';"
$sqlLines += "DELETE FROM analytics.nutrition_goals WHERE user_id = '$seedUserId';"
$sqlLines += "INSERT INTO analytics.nutrition_goals (id, user_id, daily_calories, protein_grams, carbs_grams, fat_grams, fiber_grams, updated_at)"
$sqlLines += "VALUES (gen_random_uuid(), '$seedUserId', 1775, 133, 178, 59, 30, NOW())"
$sqlLines += "ON CONFLICT (user_id) DO UPDATE SET"
$sqlLines += "  daily_calories = EXCLUDED.daily_calories,"
$sqlLines += "  protein_grams = EXCLUDED.protein_grams,"
$sqlLines += "  carbs_grams = EXCLUDED.carbs_grams,"
$sqlLines += "  fat_grams = EXCLUDED.fat_grams,"
$sqlLines += "  fiber_grams = EXCLUDED.fiber_grams,"
$sqlLines += "  updated_at = EXCLUDED.updated_at;"

$mealCount = 0
for ($dayOffset = $DaysBack; $dayOffset -ge 0; $dayOffset--) {
    $day = $today.AddDays(-$dayOffset)
    for ($templateIndex = 0; $templateIndex -lt $mealTemplates.Count; $templateIndex++) {
        $template = $mealTemplates[$templateIndex]
        $choice = Get-Random -SetSeed ($dayOffset * 10 + $templateIndex + 1) -InputObject $template.options
        $loggedAt = $day.AddHours($template.hour).ToString('o')
        $mealId = [guid]::NewGuid().ToString()

        $sqlLines += "INSERT INTO meals.meal_logs (id, user_id, meal_type, logged_at, source_type, calories, protein_grams, carbs_grams, fat_grams, fiber_grams, notes) VALUES ('$mealId', '$seedUserId', '$($template.mealType)', '$loggedAt', 'MANUAL', $($choice.calories), $($choice.protein), $($choice.carbs), $($choice.fat), $($choice.fiber), '$(Escape-SqlLiteral $choice.name)');"
        $sqlLines += "INSERT INTO meals.meal_items (id, meal_log_id, name, quantity, unit, calories, protein_grams, carbs_grams, fat_grams, fiber_grams) VALUES (gen_random_uuid(), '$mealId', '$(Escape-SqlLiteral $choice.name)', 1, 'serving', $($choice.calories), $($choice.protein), $($choice.carbs), $($choice.fat), $($choice.fiber));"
        $mealCount++
    }
}
$sqlLines += "COMMIT;"

$sql = [string]::Join("`n", $sqlLines)

$sql | docker compose exec -T postgres psql -U nutrition -d nutrition -v ON_ERROR_STOP=1 | Out-Null

Write-Host "Seeded $mealCount meals for $Email"
Write-Host "Seeded demo user id: $demoUserId"
Write-Host "Open the app at http://localhost:3000 and refresh the page if it is already open."