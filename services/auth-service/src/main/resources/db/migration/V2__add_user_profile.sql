ALTER TABLE app_users
    ADD COLUMN height_cm INTEGER,
    ADD COLUMN weight_kg NUMERIC(6, 2),
    ADD COLUMN age INTEGER,
    ADD COLUMN sex VARCHAR(20),
    ADD COLUMN activity_level VARCHAR(30),
    ADD COLUMN goal VARCHAR(30);
