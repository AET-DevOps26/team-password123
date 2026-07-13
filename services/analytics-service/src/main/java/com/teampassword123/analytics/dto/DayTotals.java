package com.teampassword123.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DayTotals(
        LocalDate date,
        int mealCount,
        BigDecimal calories,
        BigDecimal proteinGrams,
        BigDecimal carbsGrams,
        BigDecimal fatGrams,
        BigDecimal fiberGrams) {}
