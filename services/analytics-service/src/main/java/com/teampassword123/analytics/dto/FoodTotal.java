package com.teampassword123.analytics.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record FoodTotal(String name, @JsonProperty("total_grams") double totalGrams) {}
