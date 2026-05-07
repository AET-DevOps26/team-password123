package com.teampassword123.nutrition.dto.meal;

import com.teampassword123.nutrition.domain.MealType;
import com.teampassword123.nutrition.domain.SourceType;
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
