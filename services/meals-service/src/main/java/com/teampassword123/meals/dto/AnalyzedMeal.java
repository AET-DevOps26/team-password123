package com.teampassword123.meals.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AnalyzedMeal(
        UUID id,
        String dishName,
        String imageUrl,
        NutritionSummary nutrition,
        double confidence,
        String visionModel,
        double portionGrams,
        OffsetDateTime analyzedAt) {}
