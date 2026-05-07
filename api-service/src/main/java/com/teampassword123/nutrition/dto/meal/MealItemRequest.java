package com.teampassword123.nutrition.dto.meal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record MealItemRequest(
        @NotBlank @Size(max = 160) String name,
        @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal quantity,
        @NotBlank @Size(max = 40) String unit,
        @NotNull @DecimalMin("0.0") BigDecimal calories,
        @NotNull @DecimalMin("0.0") BigDecimal proteinGrams,
        @NotNull @DecimalMin("0.0") BigDecimal carbsGrams,
        @NotNull @DecimalMin("0.0") BigDecimal fatGrams,
        @NotNull @DecimalMin("0.0") BigDecimal fiberGrams
) {
}
