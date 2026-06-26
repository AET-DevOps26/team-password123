package com.teampassword123.meals.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FoodEstimateRequest(@NotBlank @Size(max = 120) String foodName) {}
