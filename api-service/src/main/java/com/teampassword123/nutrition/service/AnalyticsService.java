package com.teampassword123.nutrition.service;

import com.teampassword123.nutrition.domain.MealLog;
import com.teampassword123.nutrition.domain.NutritionGoal;
import com.teampassword123.nutrition.dto.analytics.AnalyticsResponse;
import com.teampassword123.nutrition.exception.BadRequestException;
import com.teampassword123.nutrition.repository.MealLogRepository;
import com.teampassword123.nutrition.repository.NutritionGoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private final MealLogRepository meals;
    private final NutritionGoalRepository goals;

    public AnalyticsService(MealLogRepository meals, NutritionGoalRepository goals) {
        this.meals = meals;
        this.goals = goals;
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse daily(UUID userId, LocalDate date) {
        return summarize(userId, date, date, BigDecimal.ONE);
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse weekly(UUID userId, LocalDate weekStart) {
        return summarize(userId, weekStart, weekStart.plusDays(6), BigDecimal.valueOf(7));
    }

    private AnalyticsResponse summarize(UUID userId, LocalDate from, LocalDate to, BigDecimal goalMultiplier) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        List<MealLog> logs = meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(userId, start(from), end(to));
        Totals totals = Totals.from(logs);
        NutritionGoal goal = goals.findByUserId(userId).orElse(null);

        return new AnalyticsResponse(
                from,
                to,
                logs.size(),
                totals.calories,
                totals.protein,
                totals.carbs,
                totals.fat,
                totals.fiber,
                delta(totals.calories, goal == null ? BigDecimal.ZERO : goal.getDailyCalories().multiply(goalMultiplier)),
                delta(totals.protein, goal == null ? BigDecimal.ZERO : goal.getProteinGrams().multiply(goalMultiplier)),
                delta(totals.carbs, goal == null ? BigDecimal.ZERO : goal.getCarbsGrams().multiply(goalMultiplier)),
                delta(totals.fat, goal == null ? BigDecimal.ZERO : goal.getFatGrams().multiply(goalMultiplier)),
                delta(totals.fiber, goal == null ? BigDecimal.ZERO : goal.getFiberGrams().multiply(goalMultiplier))
        );
    }

    private BigDecimal delta(BigDecimal actual, BigDecimal target) {
        return actual.subtract(target);
    }

    private OffsetDateTime start(LocalDate date) {
        return date.atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    private OffsetDateTime end(LocalDate date) {
        return date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).minusNanos(1);
    }

    private record Totals(
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber
    ) {

        static Totals from(List<MealLog> logs) {
            return new Totals(
                    logs.stream().map(MealLog::getCalories).reduce(BigDecimal.ZERO, BigDecimal::add),
                    logs.stream().map(MealLog::getProteinGrams).reduce(BigDecimal.ZERO, BigDecimal::add),
                    logs.stream().map(MealLog::getCarbsGrams).reduce(BigDecimal.ZERO, BigDecimal::add),
                    logs.stream().map(MealLog::getFatGrams).reduce(BigDecimal.ZERO, BigDecimal::add),
                    logs.stream().map(MealLog::getFiberGrams).reduce(BigDecimal.ZERO, BigDecimal::add)
            );
        }
    }
}
