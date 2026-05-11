package com.teampassword123.meals.dto;

import com.teampassword123.meals.domain.MealType;
import com.teampassword123.meals.domain.SourceType;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record MealResponse(
        UUID id,
        MealType mealType,
        OffsetDateTime loggedAt,
        SourceType sourceType,
        BigDecimal calories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams,
        String notes,
        List<MealItemResponse> items
) {
}
