package com.teampassword123.meals.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record MealItemResponse(
        UUID id,
        String name,
        BigDecimal quantity,
        String unit,
        BigDecimal calories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams
) {
}
