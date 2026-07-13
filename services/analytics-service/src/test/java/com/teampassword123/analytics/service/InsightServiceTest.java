package com.teampassword123.analytics.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.analytics.client.GenAiInsightClient;
import com.teampassword123.analytics.client.MealsClient;
import com.teampassword123.analytics.dto.FactRef;
import com.teampassword123.analytics.dto.FoodTotal;
import com.teampassword123.analytics.dto.GenAiInsightRequest;
import com.teampassword123.analytics.dto.GenAiInsightResponse;
import com.teampassword123.analytics.dto.InsightResponse;
import com.teampassword123.analytics.dto.MealItemSummary;
import com.teampassword123.analytics.dto.MealSummary;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InsightServiceTest {

  private static final String TOKEN = "bearer-token";
  private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

  @Mock private MealsClient mealsClient;

  @Mock private GenAiInsightClient genAiInsightClient;

  private InsightService service;

  @BeforeEach
  void setUp() {
    service = new InsightService(mealsClient, genAiInsightClient, new SimpleMeterRegistry());
  }

  private static MealItemSummary item(String name, double grams) {
    return new MealItemSummary(name, BigDecimal.valueOf(grams));
  }

  private static MealSummary meal(
      OffsetDateTime loggedAt,
      double cal,
      double protein,
      double carbs,
      double fat,
      double fiber,
      MealItemSummary... items) {
    return new MealSummary(
        loggedAt,
        BigDecimal.valueOf(cal),
        BigDecimal.valueOf(protein),
        BigDecimal.valueOf(carbs),
        BigDecimal.valueOf(fat),
        BigDecimal.valueOf(fiber),
        List.of(items));
  }

  private static OffsetDateTime at(int year, int month, int day, int hour) {
    return OffsetDateTime.of(year, month, day, hour, 0, 0, 0, ZoneOffset.UTC);
  }

  @Test
  void buildsEatingProfileFromWindowMeals() {
    List<MealSummary> meals =
        List.of(
            meal(
                at(2026, 6, 25, 12),
                500,
                30,
                60,
                20,
                5,
                item("chicken breast", 200),
                item("white rice", 150)),
            meal(
                at(2026, 6, 25, 19),
                300,
                10,
                40,
                10,
                3,
                item("white rice", 100),
                item("broccoli", 80)),
            meal(at(2026, 6, 26, 12), 400, 25, 30, 15, 6, item("chicken breast", 100)));
    when(mealsClient.listForUser(
            eq(TOKEN), any(LocalDate.class), any(LocalDate.class), any(ZoneId.class)))
        .thenReturn(meals);
    when(genAiInsightClient.generate(any())).thenReturn(null);

    service.getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC);

    ArgumentCaptor<GenAiInsightRequest> captor = ArgumentCaptor.forClass(GenAiInsightRequest.class);
    verify(genAiInsightClient).generate(captor.capture());
    GenAiInsightRequest request = captor.getValue();

    assertThat(request.window()).isEqualTo("week");
    assertThat(request.daysLogged()).isEqualTo(2);
    // dominant-first, quantities summed per distinct food name
    assertThat(request.foods())
        .containsExactly(
            new FoodTotal("chicken breast", 300.0),
            new FoodTotal("white rice", 250.0),
            new FoodTotal("broccoli", 80.0));
    assertThat(request.nutrientTotals())
        .containsEntry("calories", 1200.0)
        .containsEntry("protein", 65.0)
        .containsEntry("carbs", 130.0)
        .containsEntry("fat", 45.0)
        .containsEntry("fiber", 14.0);
  }

  @Test
  void requestsLastSevenDaysInclusiveOfToday() {
    when(mealsClient.listForUser(
            eq(TOKEN), any(LocalDate.class), any(LocalDate.class), any(ZoneId.class)))
        .thenReturn(List.of());
    when(genAiInsightClient.generate(any())).thenReturn(null);

    service.getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC);

    ArgumentCaptor<LocalDate> from = ArgumentCaptor.forClass(LocalDate.class);
    ArgumentCaptor<LocalDate> to = ArgumentCaptor.forClass(LocalDate.class);
    verify(mealsClient).listForUser(eq(TOKEN), from.capture(), to.capture(), any(ZoneId.class));

    assertThat(to.getValue()).isEqualTo(LocalDate.now(ZoneOffset.UTC));
    assertThat(ChronoUnit.DAYS.between(from.getValue(), to.getValue())).isEqualTo(6);
  }

  @Test
  void defaultsToWeekWhenWindowIsNull() {
    when(mealsClient.listForUser(
            eq(TOKEN), any(LocalDate.class), any(LocalDate.class), any(ZoneId.class)))
        .thenReturn(List.of());
    when(genAiInsightClient.generate(any())).thenReturn(null);

    service.getInsight(USER_ID, TOKEN, null, ZoneOffset.UTC);

    ArgumentCaptor<GenAiInsightRequest> captor = ArgumentCaptor.forClass(GenAiInsightRequest.class);
    verify(genAiInsightClient).generate(captor.capture());
    assertThat(captor.getValue().window()).isEqualTo("week");
  }

  @Test
  void mapsGenAiResponseOnHappyPath() {
    when(mealsClient.listForUser(
            eq(TOKEN), any(LocalDate.class), any(LocalDate.class), any(ZoneId.class)))
        .thenReturn(
            List.of(meal(at(2026, 6, 26, 12), 400, 25, 30, 15, 6, item("chicken breast", 100))));
    GenAiInsightResponse genai =
        new GenAiInsightResponse(
            "Solid protein this week, but fiber looks low — add legumes.",
            List.of(new FactRef("fiber-legumes-001", "Legumes are high in soluble fiber.")),
            "logos:gpt-oss-120b",
            "success");
    when(genAiInsightClient.generate(any())).thenReturn(genai);

    InsightResponse response = service.getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC);

    assertThat(response.insight())
        .isEqualTo("Solid protein this week, but fiber looks low — add legumes.");
    assertThat(response.factsUsed())
        .containsExactly(new FactRef("fiber-legumes-001", "Legumes are high in soluble fiber."));
    assertThat(response.generatedBy()).isEqualTo("logos:gpt-oss-120b");
    assertThat(response.result()).isEqualTo("success");
  }

  @Test
  void failsSoftWhenGenAiClientThrows() {
    when(mealsClient.listForUser(
            eq(TOKEN), any(LocalDate.class), any(LocalDate.class), any(ZoneId.class)))
        .thenReturn(List.of());
    when(genAiInsightClient.generate(any())).thenThrow(new RuntimeException("boom"));

    InsightResponse response = service.getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC);

    assertThat(response.result()).isEqualTo("unavailable");
    assertThat(response.insight()).isNull();
    assertThat(response.generatedBy()).isNull();
    assertThat(response.factsUsed()).isEmpty();
  }

  @Test
  void failsSoftWhenGenAiClientReturnsNull() {
    when(mealsClient.listForUser(
            eq(TOKEN), any(LocalDate.class), any(LocalDate.class), any(ZoneId.class)))
        .thenReturn(List.of());
    when(genAiInsightClient.generate(any())).thenReturn(null);

    InsightResponse response = service.getInsight(USER_ID, TOKEN, "week", ZoneOffset.UTC);

    assertThat(response.result()).isEqualTo("unavailable");
    assertThat(response.insight()).isNull();
    assertThat(response.factsUsed()).isEmpty();
  }
}
