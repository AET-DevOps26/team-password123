package com.teampassword123.nutrition.dto.auth;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AuthResponse(
        String tokenType,
        String accessToken,
        OffsetDateTime expiresAt,
        UUID userId,
        String email,
        String displayName
) {
}
