package com.teampassword123.analytics.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.analytics.client.MealsClient;
import com.teampassword123.analytics.domain.NutritionGoal;
import com.teampassword123.analytics.dto.AnalyticsResponse;
import com.teampassword123.analytics.dto.MealSummary;
import com.teampassword123.analytics.repository.NutritionGoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

  private static final String TOKEN = "bearer-token";
  private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

  @Mock private MealsClient mealsClient;

  @Mock private NutritionGoalRepository goals;

  @InjectMocks private AnalyticsService service;

  private static MealSummary meal(
      double cal, double protein, double carbs, double fat, double fiber) {
    return new MealSummary(
        OffsetDateTime.of(2026, 5, 29, 12, 0, 0, 0, ZoneOffset.UTC),
        BigDecimal.valueOf(cal),
        BigDecimal.valueOf(protein),
        BigDecimal.valueOf(carbs),
        BigDecimal.valueOf(fat),
        BigDecimal.valueOf(fiber));
  }

  private static NutritionGoal goal(
      double cal, double protein, double carbs, double fat, double fiber) {
    NutritionGoal g = new NutritionGoal();
    g.setUserId(USER_ID);
    g.setDailyCalories(BigDecimal.valueOf(cal));
    g.setProteinGrams(BigDecimal.valueOf(protein));
    g.setCarbsGrams(BigDecimal.valueOf(carbs));
    g.setFatGrams(BigDecimal.valueOf(fat));
    g.setFiberGrams(BigDecimal.valueOf(fiber));
    return g;
  }

  @Test
  void dailySumsMealTotals() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(meal(500, 30, 60, 20, 5), meal(300, 10, 40, 10, 3)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    AnalyticsResponse response = service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    assertThat(response.from()).isEqualTo(date);
    assertThat(response.to()).isEqualTo(date);
    assertThat(response.mealCount()).isEqualTo(2);
    assertThat(response.calories()).isEqualByComparingTo("800");
    assertThat(response.proteinGrams()).isEqualByComparingTo("40");
    assertThat(response.carbsGrams()).isEqualByComparingTo("100");
    assertThat(response.fatGrams()).isEqualByComparingTo("30");
    assertThat(response.fiberGrams()).isEqualByComparingTo("8");
  }

  @Test
  void dailyDeltaIsActualMinusGoalWithMultiplierOne() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(meal(800, 40, 100, 30, 8)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.of(goal(2000, 150, 200, 70, 30)));

    AnalyticsResponse response = service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    // delta = actual - goal (goal multiplier = 1 for daily)
    assertThat(response.calorieGoalDelta()).isEqualByComparingTo("-1200");
    assertThat(response.proteinGoalDelta()).isEqualByComparingTo("-110");
    assertThat(response.carbsGoalDelta()).isEqualByComparingTo("-100");
    assertThat(response.fatGoalDelta()).isEqualByComparingTo("-40");
    assertThat(response.fiberGoalDelta()).isEqualByComparingTo("-22");
  }

  @Test
  void dailyPositiveDeltaWhenOverGoal() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(meal(2500, 200, 250, 90, 40)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.of(goal(2000, 150, 200, 70, 30)));

    AnalyticsResponse response = service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    assertThat(response.calorieGoalDelta()).isEqualByComparingTo("500");
    assertThat(response.proteinGoalDelta()).isEqualByComparingTo("50");
    assertThat(response.carbsGoalDelta()).isEqualByComparingTo("50");
    assertThat(response.fatGoalDelta()).isEqualByComparingTo("20");
    assertThat(response.fiberGoalDelta()).isEqualByComparingTo("10");
  }

  @Test
  void emptyGoalTreatsTargetAsZeroSoDeltaEqualsActual() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(meal(800, 40, 100, 30, 8)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    AnalyticsResponse response = service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    // no goal -> target is 0 -> delta equals actual totals
    assertThat(response.calorieGoalDelta()).isEqualByComparingTo("800");
    assertThat(response.proteinGoalDelta()).isEqualByComparingTo("40");
    assertThat(response.carbsGoalDelta()).isEqualByComparingTo("100");
    assertThat(response.fatGoalDelta()).isEqualByComparingTo("30");
    assertThat(response.fiberGoalDelta()).isEqualByComparingTo("8");
  }

  @Test
  void emptyMealsProduceZeroTotals() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of());
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    AnalyticsResponse response = service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    assertThat(response.mealCount()).isZero();
    assertThat(response.calories()).isEqualByComparingTo("0");
    assertThat(response.proteinGrams()).isEqualByComparingTo("0");
    assertThat(response.carbsGrams()).isEqualByComparingTo("0");
    assertThat(response.fatGrams()).isEqualByComparingTo("0");
    assertThat(response.fiberGrams()).isEqualByComparingTo("0");
  }

  @Test
  void weeklyQueriesSevenDayRangeAndSumsMeals() {
    LocalDate weekStart = LocalDate.of(2026, 5, 25);
    LocalDate weekEnd = weekStart.plusDays(6);
    when(mealsClient.listForUser(eq(TOKEN), eq(weekStart), eq(weekEnd), eq(ZoneOffset.UTC)))
        .thenReturn(
            List.of(
                meal(700, 50, 80, 25, 6), meal(300, 20, 30, 10, 4), meal(1000, 60, 120, 35, 10)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    AnalyticsResponse response = service.weekly(USER_ID, TOKEN, weekStart, ZoneOffset.UTC);

    assertThat(response.from()).isEqualTo(weekStart);
    assertThat(response.to()).isEqualTo(weekEnd);
    assertThat(response.mealCount()).isEqualTo(3);
    assertThat(response.calories()).isEqualByComparingTo("2000");
    assertThat(response.proteinGrams()).isEqualByComparingTo("130");
    assertThat(response.carbsGrams()).isEqualByComparingTo("230");
    assertThat(response.fatGrams()).isEqualByComparingTo("70");
    assertThat(response.fiberGrams()).isEqualByComparingTo("20");
  }

  @Test
  void weeklyMultipliesGoalBySevenForDelta() {
    LocalDate weekStart = LocalDate.of(2026, 5, 25);
    LocalDate weekEnd = weekStart.plusDays(6);
    when(mealsClient.listForUser(eq(TOKEN), eq(weekStart), eq(weekEnd), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(meal(14000, 1050, 1400, 490, 210)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.of(goal(2000, 150, 200, 70, 30)));

    AnalyticsResponse response = service.weekly(USER_ID, TOKEN, weekStart, ZoneOffset.UTC);

    // weekly goal target = daily goal * 7; actual exactly matches -> delta 0
    assertThat(response.calorieGoalDelta()).isEqualByComparingTo("0");
    assertThat(response.proteinGoalDelta()).isEqualByComparingTo("0");
    assertThat(response.carbsGoalDelta()).isEqualByComparingTo("0");
    assertThat(response.fatGoalDelta()).isEqualByComparingTo("0");
    assertThat(response.fiberGoalDelta()).isEqualByComparingTo("0");
  }

  @Test
  void weeklyDeltaUsesSevenTimesGoalWhenUnderTarget() {
    LocalDate weekStart = LocalDate.of(2026, 5, 25);
    LocalDate weekEnd = weekStart.plusDays(6);
    when(mealsClient.listForUser(eq(TOKEN), eq(weekStart), eq(weekEnd), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(meal(7000, 0, 0, 0, 0)));
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.of(goal(2000, 150, 200, 70, 30)));

    AnalyticsResponse response = service.weekly(USER_ID, TOKEN, weekStart, ZoneOffset.UTC);

    // calorie target = 2000 * 7 = 14000; actual 7000 -> -7000
    assertThat(response.calorieGoalDelta()).isEqualByComparingTo("-7000");
    // protein target = 150 * 7 = 1050; actual 0 -> -1050
    assertThat(response.proteinGoalDelta()).isEqualByComparingTo("-1050");
    assertThat(response.carbsGoalDelta()).isEqualByComparingTo("-1400");
    assertThat(response.fatGoalDelta()).isEqualByComparingTo("-490");
    assertThat(response.fiberGoalDelta()).isEqualByComparingTo("-210");
  }

  @Test
  void weeklyDoesNotThrowSinceEndIsAlwaysAfterStart() {
    LocalDate weekStart = LocalDate.of(2026, 5, 25);
    when(mealsClient.listForUser(any(), any(), any(), any())).thenReturn(List.of());
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    AnalyticsResponse response = service.weekly(USER_ID, TOKEN, weekStart, ZoneOffset.UTC);

    assertThat(response.to()).isEqualTo(weekStart.plusDays(6));
  }

  @Test
  void singleDayRangeNeverTripsTheFromAfterToGuard() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of());
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    AnalyticsResponse response = service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    assertThat(response.from()).isEqualTo(response.to());
  }

  @Test
  void streakCountsConsecutiveUtcDaysEndingToday() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    when(mealsClient.loggedDates(
            eq(TOKEN), eq(today.minusDays(1830)), eq(today), eq(ZoneOffset.UTC)))
        .thenReturn(List.of(today, today.minusDays(1), today.minusDays(2)));

    assertThat(service.computeStreak(USER_ID, TOKEN, ZoneOffset.UTC).streak()).isEqualTo(3);
  }

  @Test
  void streakGraceRuleKeepsStreakWhenTodayNotLoggedYet() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    when(mealsClient.loggedDates(any(), any(), any(), any()))
        .thenReturn(List.of(today.minusDays(1), today.minusDays(2)));

    assertThat(service.computeStreak(USER_ID, TOKEN, ZoneOffset.UTC).streak()).isEqualTo(2);
  }

  @Test
  void streakIsZeroWhenLastLoggedDayIsBeforeYesterday() {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    when(mealsClient.loggedDates(any(), any(), any(), any()))
        .thenReturn(List.of(today.minusDays(2), today.minusDays(3)));

    assertThat(service.computeStreak(USER_ID, TOKEN, ZoneOffset.UTC).streak()).isZero();
  }

  @Test
  void streakIsZeroWhenNothingLogged() {
    when(mealsClient.loggedDates(any(), any(), any(), any())).thenReturn(List.of());

    assertThat(service.computeStreak(USER_ID, TOKEN, ZoneOffset.UTC).streak()).isZero();
  }

  @Test
  void dailyConsultsBothMealsClientAndGoalsAndNeverSaves() {
    LocalDate date = LocalDate.of(2026, 5, 29);
    when(mealsClient.listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC)))
        .thenReturn(List.of());
    when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

    service.daily(USER_ID, TOKEN, date, ZoneOffset.UTC);

    verify(mealsClient).listForUser(eq(TOKEN), eq(date), eq(date), eq(ZoneOffset.UTC));
    verify(goals).findByUserId(USER_ID);
    verify(goals, never()).save(any());
  }
}
