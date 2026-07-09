package com.teampassword123.meals.service;

import java.math.BigDecimal;

public record MealAnalysis(
    String dishName,
    BigDecimal calories,
    BigDecimal protein,
    BigDecimal carbs,
    BigDecimal fat,
    double confidence,
    String visionModel,
    BigDecimal portionGrams) {}
