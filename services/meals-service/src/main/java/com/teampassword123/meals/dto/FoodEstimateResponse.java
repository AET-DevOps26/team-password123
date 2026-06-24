package com.teampassword123.meals.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

public record FoodEstimateResponse(
        @JsonProperty("food_name")                String foodName,
        @JsonProperty("calories_per_100g")         BigDecimal caloriesPer100g,
        @JsonProperty("protein_grams_per_100g")    BigDecimal proteinPer100g,
        @JsonProperty("carbs_grams_per_100g")      BigDecimal carbsPer100g,
        @JsonProperty("fat_grams_per_100g")        BigDecimal fatPer100g,
        @JsonProperty("typical_portion_grams")     BigDecimal typicalPortionGrams,
        @JsonProperty("typical_portion_label")     String typicalPortionLabel,
        String source,
        BigDecimal confidence
) {}
