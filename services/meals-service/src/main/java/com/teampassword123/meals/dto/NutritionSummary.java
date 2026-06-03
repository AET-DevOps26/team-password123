package com.teampassword123.meals.dto;

import java.math.BigDecimal;

public record NutritionSummary(
        BigDecimal calories,
        BigDecimal protein,
        BigDecimal carbs,
        BigDecimal fat
) {
}
