package com.teampassword123.nutrition.dto.goal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record GoalRequest(
        @NotNull @DecimalMin("0.0") BigDecimal dailyCalories,
        @NotNull @DecimalMin("0.0") BigDecimal proteinGrams,
        @NotNull @DecimalMin("0.0") BigDecimal carbsGrams,
        @NotNull @DecimalMin("0.0") BigDecimal fatGrams,
        @NotNull @DecimalMin("0.0") BigDecimal fiberGrams
) {
}
