package com.teampassword123.meals.dto;

import java.math.BigDecimal;

public record FoodEstimateResponse(
        String foodName,
        BigDecimal caloriesPer100g,
        BigDecimal proteinPer100g,
        BigDecimal carbsPer100g,
        BigDecimal fatPer100g,
        BigDecimal typicalPortionGrams,
        String typicalPortionLabel,
        String source,
        BigDecimal confidence) {}
