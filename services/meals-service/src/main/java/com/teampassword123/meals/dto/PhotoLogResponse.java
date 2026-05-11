package com.teampassword123.meals.dto;

import com.teampassword123.meals.domain.PhotoStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PhotoLogResponse(
        UUID id,
        String originalFilename,
        String contentType,
        PhotoStatus status,
        UUID linkedMealLogId,
        OffsetDateTime createdAt
) {
}
