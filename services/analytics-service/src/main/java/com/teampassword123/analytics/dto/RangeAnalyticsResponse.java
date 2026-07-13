package com.teampassword123.analytics.dto;

import java.time.LocalDate;
import java.util.List;

/** Per-day nutrition totals for a date range; days without meals are omitted. */
public record RangeAnalyticsResponse(LocalDate from, LocalDate to, List<DayTotals> days) {}
