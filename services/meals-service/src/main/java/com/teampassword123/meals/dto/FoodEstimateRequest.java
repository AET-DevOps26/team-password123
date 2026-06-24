package com.teampassword123.meals.dto;

import jakarta.validation.constraints.NotBlank;

public record FoodEstimateRequest(@NotBlank String foodName) {}
