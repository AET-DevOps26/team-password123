package com.teampassword123.analytics.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MealSummary(
        OffsetDateTime loggedAt,
        BigDecimal calories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams
) {
}
