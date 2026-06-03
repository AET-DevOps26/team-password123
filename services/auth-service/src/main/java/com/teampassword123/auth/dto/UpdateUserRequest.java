package com.teampassword123.auth.dto;

import com.teampassword123.auth.domain.ActivityLevel;
import com.teampassword123.auth.domain.Goal;
import com.teampassword123.auth.domain.Sex;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record UpdateUserRequest(
        @NotBlank @Size(max = 120) String displayName,
        @Min(50) @Max(300) Integer heightCm,
        @Positive BigDecimal weightKg,
        @Min(1) @Max(150) Integer age,
        Sex sex,
        ActivityLevel activityLevel,
        Goal goal
) {
}
