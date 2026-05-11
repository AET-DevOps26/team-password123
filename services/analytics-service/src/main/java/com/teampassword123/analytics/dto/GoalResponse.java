package com.teampassword123.analytics.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record GoalResponse(
        UUID id,
        BigDecimal dailyCalories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams,
        OffsetDateTime updatedAt
) {
}
