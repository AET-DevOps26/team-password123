CREATE TABLE nutrition_goals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    daily_calories NUMERIC(10, 2) NOT NULL,
    protein_grams NUMERIC(10, 2) NOT NULL,
    carbs_grams NUMERIC(10, 2) NOT NULL,
    fat_grams NUMERIC(10, 2) NOT NULL,
    fiber_grams NUMERIC(10, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
