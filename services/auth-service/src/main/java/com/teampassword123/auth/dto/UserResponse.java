package com.teampassword123.auth.dto;

import com.teampassword123.auth.domain.ActivityLevel;
import com.teampassword123.auth.domain.Goal;
import com.teampassword123.auth.domain.Sex;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String displayName,
        OffsetDateTime createdAt,
        Integer heightCm,
        BigDecimal weightKg,
        Integer age,
        Sex sex,
        ActivityLevel activityLevel,
        Goal goal
) {
}
