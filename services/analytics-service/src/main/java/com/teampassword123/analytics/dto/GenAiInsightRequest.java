package com.teampassword123.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public record GenAiInsightRequest(
        String window,
        List<FoodTotal> foods,
        @JsonProperty("nutrient_totals") Map<String, Double> nutrientTotals,
        @JsonProperty("days_logged") int daysLogged) {}
