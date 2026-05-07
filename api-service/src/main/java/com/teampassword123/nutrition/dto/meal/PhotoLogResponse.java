package com.teampassword123.nutrition.dto.meal;

import com.teampassword123.nutrition.domain.PhotoStatus;
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
