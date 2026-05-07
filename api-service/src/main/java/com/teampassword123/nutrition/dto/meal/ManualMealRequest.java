package com.teampassword123.nutrition.dto.meal;

import com.teampassword123.nutrition.domain.MealType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public record ManualMealRequest(
        @NotNull MealType mealType,
        OffsetDateTime loggedAt,
        @Size(max = 500) String notes,
        @NotEmpty List<@Valid MealItemRequest> items
) {
}
