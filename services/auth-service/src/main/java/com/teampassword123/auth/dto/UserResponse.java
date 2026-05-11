package com.teampassword123.auth.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String displayName,
        OffsetDateTime createdAt
) {
}
