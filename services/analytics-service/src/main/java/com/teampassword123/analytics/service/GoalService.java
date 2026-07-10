package com.teampassword123.analytics.service;

import com.teampassword123.analytics.domain.NutritionGoal;
import com.teampassword123.analytics.dto.GoalRequest;
import com.teampassword123.analytics.dto.GoalResponse;
import com.teampassword123.analytics.repository.NutritionGoalRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoalService {

  private final NutritionGoalRepository goals;
  private final MeterRegistry metrics;

  public GoalService(NutritionGoalRepository goals, MeterRegistry metrics) {
    this.goals = goals;
    this.metrics = metrics;
  }

  @Transactional(readOnly = true)
  public Optional<GoalResponse> get(UUID userId) {
    return goals.findByUserId(userId).map(this::toResponse);
  }

  @Transactional
  public GoalResponse upsert(UUID userId, GoalRequest request) {
    NutritionGoal goal = goals.findByUserId(userId).orElseGet(NutritionGoal::new);
    goal.setUserId(userId);
    goal.setDailyCalories(request.dailyCalories());
    goal.setProteinGrams(request.proteinGrams());
    goal.setCarbsGrams(request.carbsGrams());
    goal.setFatGrams(request.fatGrams());
    goal.setFiberGrams(request.fiberGrams());
    goal.setUpdatedAt(OffsetDateTime.now());
    GoalResponse saved = toResponse(goals.save(goal));
    metrics.counter("calorieasy.analytics.goals.saved").increment();
    return saved;
  }

  GoalResponse toResponse(NutritionGoal goal) {
    return new GoalResponse(
        goal.getId(),
        goal.getDailyCalories(),
        goal.getProteinGrams(),
        goal.getCarbsGrams(),
        goal.getFatGrams(),
        goal.getFiberGrams(),
        goal.getUpdatedAt());
  }
}
