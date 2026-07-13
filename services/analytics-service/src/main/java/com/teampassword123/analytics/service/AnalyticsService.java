package com.teampassword123.analytics.service;

import com.teampassword123.analytics.client.MealsClient;
import com.teampassword123.analytics.domain.NutritionGoal;
import com.teampassword123.analytics.dto.AnalyticsResponse;
import com.teampassword123.analytics.dto.DayTotals;
import com.teampassword123.analytics.dto.MealSummary;
import com.teampassword123.analytics.dto.RangeAnalyticsResponse;
import com.teampassword123.analytics.dto.StreakResponse;
import com.teampassword123.analytics.exception.BadRequestException;
import com.teampassword123.analytics.repository.NutritionGoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {

    // Matches the meals-service list cap; the widest UI window (year view) fits.
    private static final int MAX_RANGE_DAYS = 400;

    private final MealsClient mealsClient;
    private final NutritionGoalRepository goals;

    public AnalyticsService(MealsClient mealsClient, NutritionGoalRepository goals) {
        this.mealsClient = mealsClient;
        this.goals = goals;
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse daily(UUID userId, String bearerToken, LocalDate date, ZoneId zone) {
        return summarize(userId, bearerToken, date, date, BigDecimal.ONE, zone);
    }

    @Transactional(readOnly = true)
    public AnalyticsResponse weekly(
            UUID userId, String bearerToken, LocalDate weekStart, ZoneId zone) {
        return summarize(
                userId, bearerToken, weekStart, weekStart.plusDays(6), BigDecimal.valueOf(7), zone);
    }

    // Per-day totals for the Insights charts: one call per visible range instead
    // of the client pulling raw meal bodies and aggregating them itself.
    public RangeAnalyticsResponse range(
            String bearerToken, LocalDate from, LocalDate to, ZoneId zone) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS) {
            throw new BadRequestException("Date range must not exceed " + MAX_RANGE_DAYS + " days");
        }
        List<MealSummary> meals = mealsClient.listForUser(bearerToken, from, to, zone);
        Map<LocalDate, List<MealSummary>> byDay =
                meals.stream()
                        .collect(
                                Collectors.groupingBy(
                                        m -> m.loggedAt().atZoneSameInstant(zone).toLocalDate()));
        List<DayTotals> days =
                byDay.entrySet().stream()
                        .map(e -> dayTotals(e.getKey(), e.getValue()))
                        .sorted(Comparator.comparing(DayTotals::date))
                        .toList();
        return new RangeAnalyticsResponse(from, to, days);
    }

    private DayTotals dayTotals(LocalDate date, List<MealSummary> meals) {
        Totals totals = Totals.from(meals);
        return new DayTotals(
                date,
                meals.size(),
                totals.calories,
                totals.protein,
                totals.carbs,
                totals.fat,
                totals.fiber);
    }

    @Transactional(readOnly = true)
    public StreakResponse computeStreak(UUID userId, String bearerToken, ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        // ~5 year window caps extreme streaks; logged-dates returns only distinct
        // days, so the window no longer means transferring years of meal bodies.
        Set<LocalDate> loggedDays =
                new HashSet<>(
                        mealsClient.loggedDates(bearerToken, today.minusDays(1830), today, zone));

        // Grace rule: don't reset an active streak just because today's meal isn't logged yet.
        LocalDate cursor = loggedDays.contains(today) ? today : today.minusDays(1);

        int streak = 0;
        while (loggedDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return new StreakResponse(streak);
    }

    private AnalyticsResponse summarize(
            UUID userId,
            String bearerToken,
            LocalDate from,
            LocalDate to,
            BigDecimal goalMultiplier,
            ZoneId zone) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        List<MealSummary> meals = mealsClient.listForUser(bearerToken, from, to, zone);
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
                delta(totals.fiber, goalAmount(goal, goalMultiplier, GoalField.FIBER)));
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
            BigDecimal fiber) {

        static Totals from(List<MealSummary> meals) {
            return new Totals(
                    meals.stream()
                            .map(MealSummary::calories)
                            .reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream()
                            .map(MealSummary::proteinGrams)
                            .reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream()
                            .map(MealSummary::carbsGrams)
                            .reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream()
                            .map(MealSummary::fatGrams)
                            .reduce(BigDecimal.ZERO, BigDecimal::add),
                    meals.stream()
                            .map(MealSummary::fiberGrams)
                            .reduce(BigDecimal.ZERO, BigDecimal::add));
        }
    }
}
