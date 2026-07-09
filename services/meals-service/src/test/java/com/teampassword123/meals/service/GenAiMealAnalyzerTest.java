package com.teampassword123.meals.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.teampassword123.meals.service.GenAiMealAnalyzer.GenAiNutrition;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class GenAiMealAnalyzerTest {

  @Test
  void mapsGenAiResponseOntoMealAnalysis() {
    GenAiNutrition nutrition =
        new GenAiNutrition(
            List.of("pizza"),
            new BigDecimal("399.0"),
            new BigDecimal("16.5"),
            new BigDecimal("49.5"),
            new BigDecimal("15.0"),
            new BigDecimal("3.75"),
            new BigDecimal("0.95"),
            "Gemini",
            new BigDecimal("120"));

    MealAnalysis analysis = GenAiMealAnalyzer.toMealAnalysis(nutrition);

    assertThat(analysis.dishName()).isEqualTo("Pizza");
    assertThat(analysis.calories()).isEqualByComparingTo("399.0");
    assertThat(analysis.protein()).isEqualByComparingTo("16.5");
    assertThat(analysis.carbs()).isEqualByComparingTo("49.5");
    assertThat(analysis.fat()).isEqualByComparingTo("15.0");
    assertThat(analysis.confidence()).isEqualTo(0.95);
    assertThat(analysis.visionModel()).isEqualTo("Gemini");
  }

  @Test
  void joinsMultipleFoodsIntoDishName() {
    GenAiNutrition nutrition =
        new GenAiNutrition(
            List.of("chicken", "broccoli"),
            new BigDecimal("464.0"),
            new BigDecimal("82.0"),
            new BigDecimal("10.0"),
            new BigDecimal("10.0"),
            new BigDecimal("2.6"),
            new BigDecimal("0.9"),
            "Nemotron",
            new BigDecimal("230"));

    MealAnalysis analysis = GenAiMealAnalyzer.toMealAnalysis(nutrition);

    assertThat(analysis.dishName()).isEqualTo("Chicken and Broccoli");
  }

  @Test
  void fallsBackToPlaceholdersWhenFieldsMissing() {
    GenAiNutrition nutrition =
        new GenAiNutrition(List.of(), null, null, null, null, null, null, null, null);

    MealAnalysis analysis = GenAiMealAnalyzer.toMealAnalysis(nutrition);

    assertThat(analysis.dishName()).isEqualTo("Photo meal");
    assertThat(analysis.calories()).isEqualByComparingTo("0");
    assertThat(analysis.confidence()).isEqualTo(0.0);
  }
}
