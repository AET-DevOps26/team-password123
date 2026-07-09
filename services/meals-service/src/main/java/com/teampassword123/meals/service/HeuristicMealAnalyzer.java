package com.teampassword123.meals.service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * PLACEHOLDER stand-in for the real GenAI meal recognition service (tracked on a separate branch).
 * This performs NO image recognition: it deterministically maps the image bytes to a fixed catalog
 * entry via a stable hash, so the same image always yields the same dish, macros, and confidence.
 * Swap this @Component for a real MealAnalyzer implementation when the GenAI service lands.
 */
@Component
public class HeuristicMealAnalyzer implements MealAnalyzer {

  private static final List<Dish> CATALOG =
      List.of(
          new Dish("Grilled chicken bowl", 520, 42, 48, 16),
          new Dish("Margherita pizza", 760, 28, 90, 30),
          new Dish("Caesar salad", 360, 12, 18, 27),
          new Dish("Beef burger and fries", 940, 38, 78, 52),
          new Dish("Salmon with vegetables", 480, 35, 22, 26),
          new Dish("Veggie stir fry", 410, 14, 60, 13));

  private static final double MIN_CONFIDENCE = 0.60;
  private static final double MAX_CONFIDENCE = 0.95;

  @Override
  public MealAnalysis analyze(byte[] image, String filename) {
    int positive = Arrays.hashCode(image) & Integer.MAX_VALUE;
    Dish dish = CATALOG.get(positive % CATALOG.size());
    return new MealAnalysis(
        dish.name(),
        dish.calories(),
        dish.protein(),
        dish.carbs(),
        dish.fat(),
        deriveConfidence(positive),
        null,
        BigDecimal.valueOf(300));
  }

  private double deriveConfidence(int positive) {
    // Map the hash into [MIN, MAX] using 1000 discrete steps for stable, repeatable output.
    double fraction = (positive % 1000) / 999.0;
    return MIN_CONFIDENCE + fraction * (MAX_CONFIDENCE - MIN_CONFIDENCE);
  }

  private record Dish(
      String name, BigDecimal calories, BigDecimal protein, BigDecimal carbs, BigDecimal fat) {
    Dish(String name, int calories, int protein, int carbs, int fat) {
      this(
          name,
          BigDecimal.valueOf(calories),
          BigDecimal.valueOf(protein),
          BigDecimal.valueOf(carbs),
          BigDecimal.valueOf(fat));
    }
  }
}
