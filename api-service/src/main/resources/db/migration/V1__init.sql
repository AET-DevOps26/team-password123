CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE nutrition_goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
    daily_calories NUMERIC(10, 2) NOT NULL,
    protein_grams NUMERIC(10, 2) NOT NULL,
    carbs_grams NUMERIC(10, 2) NOT NULL,
    fat_grams NUMERIC(10, 2) NOT NULL,
    fiber_grams NUMERIC(10, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE meal_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    meal_type VARCHAR(40) NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source_type VARCHAR(40) NOT NULL,
    calories NUMERIC(10, 2) NOT NULL,
    protein_grams NUMERIC(10, 2) NOT NULL,
    carbs_grams NUMERIC(10, 2) NOT NULL,
    fat_grams NUMERIC(10, 2) NOT NULL,
    fiber_grams NUMERIC(10, 2) NOT NULL,
    notes VARCHAR(500)
);

CREATE INDEX idx_meal_logs_user_logged_at ON meal_logs(user_id, logged_at);

CREATE TABLE meal_items (
    id UUID PRIMARY KEY,
    meal_log_id UUID NOT NULL REFERENCES meal_logs(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(40) NOT NULL,
    calories NUMERIC(10, 2) NOT NULL,
    protein_grams NUMERIC(10, 2) NOT NULL,
    carbs_grams NUMERIC(10, 2) NOT NULL,
    fat_grams NUMERIC(10, 2) NOT NULL,
    fiber_grams NUMERIC(10, 2) NOT NULL
);

CREATE TABLE photo_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    linked_meal_log_id UUID REFERENCES meal_logs(id) ON DELETE SET NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    status VARCHAR(40) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
