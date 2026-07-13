package com.teampassword123.analytics.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MealSummary(
        OffsetDateTime loggedAt,
        BigDecimal calories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams,
        List<MealItemSummary> items) {

    // Convenience constructor for callers/tests that only need meal-level totals.
    // Jackson always binds the canonical (all-component) constructor, so this does
    // not affect deserialization of the meals-service response (which includes items).
    public MealSummary(
            OffsetDateTime loggedAt,
            BigDecimal calories,
            BigDecimal proteinGrams,
            BigDecimal carbsGrams,
            BigDecimal fatGrams,
            BigDecimal fiberGrams) {
        this(loggedAt, calories, proteinGrams, carbsGrams, fatGrams, fiberGrams, List.of());
    }
}
