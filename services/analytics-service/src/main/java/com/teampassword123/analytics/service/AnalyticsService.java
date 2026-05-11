package com.teampassword123.analytics.service;

import com.teampassword123.analytics.client.MealsClient;
import com.teampassword123.analytics.domain.NutritionGoal;
import com.teampassword123.analytics.dto.AnalyticsResponse;
import com.teampassword123.analytics.dto.MealSummary;
import com.teampassword123.analytics.exception.BadRequestException;
import com.teampassword123.analytics.repository.NutritionGoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    private final MealsClient mealsClient;
    private final NutritionGoalRepository goals;

    public AnalyticsService(MealsClient mealsClient, NutritionGoalRepository goals) {
        this.mealsClient = mealsClient;
        this.goals = goals;
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse daily(UUID userId, String bearerToken, LocalDate date) {
        return summarize(userId, bearerToken, date, date, BigDecimal.ONE);
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse weekly(UUID userId, String bearerToken, LocalDate weekStart) {
        return summarize(userId, bearerToken, weekStart, weekStart.plusDays(6), BigDecimal.valueOf(7));
    }

    private AnalyticsResponse summarize(
            UUID userId,
            String bearerToken,
            LocalDate from,
            LocalDate to,
            BigDecimal goalMultiplier
    ) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        List<MealSummary> meals = mealsClient.listForUser(bearerToken, from, to);
        Totals totals = Totals.from(meals);
        NutritionGoal goal = goals.findByUserId(userId).orElse(null);

        return new AnalyticsResponse(
                from,
                to,
                meals.size(),
                totals.calories,
                totals.protein,
                totals.carbs,
                totals.fat,
                totals.fiber,
                delta(totals.calories, goalAmount(goal, goalMultiplier, GoalField.CALORIES)),
                delta(totals.protein, goalAmount(goal, goalMultiplier, GoalField.PROTEIN)),
                delta(totals.carbs, goalAmount(goal, goalMultiplier, GoalField.CARBS)),
                delta(totals.fat, goalAmount(goal, goalMultiplier, GoalField.FAT)),
                delta(totals.fiber, goalAmount(goal, goalMultiplier, GoalField.FIBER))
        );
    }

    private BigDecimal goalAmount(NutritionGoal goal, BigDecimal multiplier, GoalField field) {
        if (goal == null) {
            return BigDecimal.ZERO;
        }
        return field.value(goal).multiply(multiplier);
    }

    private BigDecimal delta(BigDecimal actual, BigDecimal target) {
        return actual.subtract(target);
    }

    private enum GoalField {
        CALORIES {
            BigDecimal value(NutritionGoal goal) {
                return goal.getDailyCalories();
            }
        },
        PROTEIN {
            BigDecimal value(NutritionGoal goal) {
                return goal.getProteinGrams();
            }
        },
        CARBS {
            BigDecimal value(NutritionGoal goal) {
                return goal.getCarbsGrams();
            }
        },
        FAT {
            BigDecimal value(NutritionGoal goal) {
                return goal.getFatGrams();
            }
        },
        FIBER {
            BigDecimal value(NutritionGoal goal) {
                return goal.getFiberGrams();
            }
        };

        abstract BigDecimal value(NutritionGoal goal);
    }

    private record Totals(
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber
    ) {

        static Totals from(List<MealSummary> meals) {
            return new Totals(
                    meals.stream().map(MealSummary::calories).reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream().map(MealSummary::proteinGrams).reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream().map(MealSummary::carbsGrams).reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream().map(MealSummary::fatGrams).reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream().map(MealSummary::fiberGrams).reduce(BigDecimal.ZERO, BigDecimal::add)
            );
        }
    }
}
