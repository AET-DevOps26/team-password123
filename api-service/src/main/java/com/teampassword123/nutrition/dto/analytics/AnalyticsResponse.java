package com.teampassword123.nutrition.dto.analytics;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AnalyticsResponse(
        LocalDate from,
        LocalDate to,
        int mealCount,
        BigDecimal calories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams,
        BigDecimal calorieGoalDelta,
        BigDecimal proteinGoalDelta,
        BigDecimal carbsGoalDelta,
        BigDecimal fatGoalDelta,
        BigDecimal fiberGoalDelta
) {
}
