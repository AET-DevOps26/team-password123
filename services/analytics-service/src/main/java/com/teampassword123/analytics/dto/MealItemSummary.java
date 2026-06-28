package com.teampassword123.analytics.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MealItemSummary(String name, BigDecimal quantity) {}
