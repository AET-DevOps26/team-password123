package com.teampassword123.analytics.service;

import com.teampassword123.analytics.client.GenAiInsightClient;
import com.teampassword123.analytics.client.MealsClient;
import com.teampassword123.analytics.dto.FactRef;
import com.teampassword123.analytics.dto.FoodTotal;
import com.teampassword123.analytics.dto.GenAiInsightRequest;
import com.teampassword123.analytics.dto.GenAiInsightResponse;
import com.teampassword123.analytics.dto.InsightResponse;
import com.teampassword123.analytics.dto.MealItemSummary;
import com.teampassword123.analytics.dto.MealSummary;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class InsightService {

  private static final Logger log = LoggerFactory.getLogger(InsightService.class);

  // "week" is the only supported window today: the last 7 days (inclusive).
  private static final String DEFAULT_WINDOW = "week";
  private static final int WINDOW_DAYS = 7;
  private static final String RESULT_UNAVAILABLE = "unavailable";

  private final MealsClient mealsClient;
  private final GenAiInsightClient genAiInsightClient;

  public InsightService(MealsClient mealsClient, GenAiInsightClient genAiInsightClient) {
    this.mealsClient = mealsClient;
    this.genAiInsightClient = genAiInsightClient;
  }

  public InsightResponse getInsight(UUID userId, String bearerToken, String window) {
    String normalizedWindow =
        (window == null || window.isBlank()) ? DEFAULT_WINDOW : window.toLowerCase(Locale.ROOT);

    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    LocalDate from = today.minusDays(WINDOW_DAYS - 1L);
    List<MealSummary> meals = mealsClient.listForUser(bearerToken, from, today);

    GenAiInsightRequest request = buildRequest(normalizedWindow, meals);

    try {
      GenAiInsightResponse response = genAiInsightClient.generate(request);
      if (response == null || response.insight() == null) {
        log.warn("Insight unavailable for user {}: genai returned no insight", userId);
        return unavailable();
      }
      List<FactRef> facts = response.factsUsed() == null ? List.of() : response.factsUsed();
      return new InsightResponse(
          response.insight(), facts, response.generatedBy(), response.result());
    } catch (RuntimeException e) {
      log.warn("Insight generation failed for user {}: {}", userId, e.getMessage());
      return unavailable();
    }
  }

  private GenAiInsightRequest buildRequest(String window, List<MealSummary> meals) {
    return new GenAiInsightRequest(
        window, aggregateFoods(meals), nutrientTotals(meals), daysLogged(meals));
  }

  // Distinct foods keyed by name, with summed quantities. The meals service exposes a
  // free-text `unit` per item (not guaranteed grams), so we sum the raw `quantity` as the
  // best available "grams" signal and surface it as total_grams. Sorted dominant-first.
  private List<FoodTotal> aggregateFoods(List<MealSummary> meals) {
    Map<String, Double> gramsByFood = new LinkedHashMap<>();
    for (MealSummary meal : meals) {
      if (meal.items() == null) {
        continue;
      }
      for (MealItemSummary item : meal.items()) {
        if (item.name() == null || item.name().isBlank()) {
          continue;
        }
        double grams = item.quantity() == null ? 0.0 : item.quantity().doubleValue();
        gramsByFood.merge(item.name().trim(), grams, Double::sum);
      }
    }
    return gramsByFood.entrySet().stream()
        .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
        .map(e -> new FoodTotal(e.getKey(), e.getValue()))
        .toList();
  }

  private Map<String, Double> nutrientTotals(List<MealSummary> meals) {
    Map<String, Double> totals = new LinkedHashMap<>();
    totals.put("calories", sum(meals, MealSummary::calories));
    totals.put("protein", sum(meals, MealSummary::proteinGrams));
    totals.put("carbs", sum(meals, MealSummary::carbsGrams));
    totals.put("fat", sum(meals, MealSummary::fatGrams));
    totals.put("fiber", sum(meals, MealSummary::fiberGrams));
    return totals;
  }

  private int daysLogged(List<MealSummary> meals) {
    return (int)
        meals.stream()
            .map(meal -> meal.loggedAt().atZoneSameInstant(ZoneOffset.UTC).toLocalDate())
            .distinct()
            .count();
  }

  private double sum(List<MealSummary> meals, Function<MealSummary, BigDecimal> field) {
    return meals.stream()
        .map(field)
        .filter(value -> value != null)
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .doubleValue();
  }

  private InsightResponse unavailable() {
    return new InsightResponse(null, List.of(), null, RESULT_UNAVAILABLE);
  }
}
