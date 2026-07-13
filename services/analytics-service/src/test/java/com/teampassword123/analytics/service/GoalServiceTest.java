package com.teampassword123.analytics.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.analytics.domain.NutritionGoal;
import com.teampassword123.analytics.dto.GoalRequest;
import com.teampassword123.analytics.dto.GoalResponse;
import com.teampassword123.analytics.repository.NutritionGoalRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GoalServiceTest {

    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock private NutritionGoalRepository goals;

    private GoalService service;

    @BeforeEach
    void setUp() {
        service = new GoalService(goals, new SimpleMeterRegistry());
    }

    private static GoalRequest request(
            double cal, double protein, double carbs, double fat, double fiber) {
        return new GoalRequest(
                BigDecimal.valueOf(cal),
                BigDecimal.valueOf(protein),
                BigDecimal.valueOf(carbs),
                BigDecimal.valueOf(fat),
                BigDecimal.valueOf(fiber));
    }

    @Test
    void getReturnsEmptyWhenNoGoalStored() {
        when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

        Optional<GoalResponse> result = service.get(USER_ID);

        assertThat(result).isEmpty();
    }

    @Test
    void getMapsStoredGoalToResponse() {
        UUID goalId = UUID.randomUUID();
        OffsetDateTime updatedAt = OffsetDateTime.parse("2026-05-29T10:15:30+00:00");
        NutritionGoal stored = new NutritionGoal();
        stored.setUserId(USER_ID);
        stored.setDailyCalories(BigDecimal.valueOf(2000));
        stored.setProteinGrams(BigDecimal.valueOf(150));
        stored.setCarbsGrams(BigDecimal.valueOf(200));
        stored.setFatGrams(BigDecimal.valueOf(70));
        stored.setFiberGrams(BigDecimal.valueOf(30));
        stored.setUpdatedAt(updatedAt);
        setId(stored, goalId);
        when(goals.findByUserId(USER_ID)).thenReturn(Optional.of(stored));

        GoalResponse response = service.get(USER_ID).orElseThrow();

        assertThat(response.id()).isEqualTo(goalId);
        assertThat(response.dailyCalories()).isEqualByComparingTo("2000");
        assertThat(response.proteinGrams()).isEqualByComparingTo("150");
        assertThat(response.carbsGrams()).isEqualByComparingTo("200");
        assertThat(response.fatGrams()).isEqualByComparingTo("70");
        assertThat(response.fiberGrams()).isEqualByComparingTo("30");
        assertThat(response.updatedAt()).isEqualTo(updatedAt);
    }

    @Test
    void upsertInsertsNewGoalWhenNoneExists() {
        when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());
        when(goals.save(any(NutritionGoal.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        GoalRequest request = request(2200, 160, 210, 75, 32);
        GoalResponse response = service.upsert(USER_ID, request);

        ArgumentCaptor<NutritionGoal> captor = ArgumentCaptor.forClass(NutritionGoal.class);
        verify(goals).save(captor.capture());
        NutritionGoal saved = captor.getValue();

        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getDailyCalories()).isEqualByComparingTo("2200");
        assertThat(saved.getProteinGrams()).isEqualByComparingTo("160");
        assertThat(saved.getCarbsGrams()).isEqualByComparingTo("210");
        assertThat(saved.getFatGrams()).isEqualByComparingTo("75");
        assertThat(saved.getFiberGrams()).isEqualByComparingTo("32");
        assertThat(saved.getUpdatedAt()).isNotNull();

        assertThat(response.dailyCalories()).isEqualByComparingTo("2200");
        assertThat(response.proteinGrams()).isEqualByComparingTo("160");
        assertThat(response.fiberGrams()).isEqualByComparingTo("32");
    }

    @Test
    void upsertUpdatesExistingGoalInPlace() {
        UUID goalId = UUID.randomUUID();
        OffsetDateTime oldUpdatedAt = OffsetDateTime.parse("2020-01-01T00:00:00+00:00");
        NutritionGoal existing = new NutritionGoal();
        existing.setUserId(USER_ID);
        existing.setDailyCalories(BigDecimal.valueOf(1000));
        existing.setProteinGrams(BigDecimal.valueOf(50));
        existing.setCarbsGrams(BigDecimal.valueOf(100));
        existing.setFatGrams(BigDecimal.valueOf(30));
        existing.setFiberGrams(BigDecimal.valueOf(10));
        existing.setUpdatedAt(oldUpdatedAt);
        setId(existing, goalId);

        when(goals.findByUserId(USER_ID)).thenReturn(Optional.of(existing));
        when(goals.save(any(NutritionGoal.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        GoalRequest request = request(2500, 180, 240, 80, 35);
        GoalResponse response = service.upsert(USER_ID, request);

        ArgumentCaptor<NutritionGoal> captor = ArgumentCaptor.forClass(NutritionGoal.class);
        verify(goals).save(captor.capture());
        NutritionGoal saved = captor.getValue();

        // same managed entity is reused (id preserved), fields overwritten
        assertThat(saved).isSameAs(existing);
        assertThat(saved.getId()).isEqualTo(goalId);
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getDailyCalories()).isEqualByComparingTo("2500");
        assertThat(saved.getProteinGrams()).isEqualByComparingTo("180");
        assertThat(saved.getCarbsGrams()).isEqualByComparingTo("240");
        assertThat(saved.getFatGrams()).isEqualByComparingTo("80");
        assertThat(saved.getFiberGrams()).isEqualByComparingTo("35");
        assertThat(saved.getUpdatedAt()).isAfter(oldUpdatedAt);

        assertThat(response.id()).isEqualTo(goalId);
        assertThat(response.dailyCalories()).isEqualByComparingTo("2500");
    }

    @Test
    void getNeverWritesToRepository() {
        when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());

        service.get(USER_ID);

        verify(goals).findByUserId(USER_ID);
        verify(goals, never()).save(any());
    }

    @Test
    void upsertRefreshesUpdatedAtToRecentTime() {
        OffsetDateTime before = OffsetDateTime.now().minusSeconds(1);
        when(goals.findByUserId(USER_ID)).thenReturn(Optional.empty());
        when(goals.save(any(NutritionGoal.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        GoalResponse response = service.upsert(USER_ID, request(2000, 150, 200, 70, 30));
        OffsetDateTime after = OffsetDateTime.now().plusSeconds(1);

        assertThat(response.updatedAt()).isAfter(before);
        assertThat(response.updatedAt()).isBefore(after);
    }

    private static void setId(NutritionGoal goal, UUID id) {
        org.springframework.test.util.ReflectionTestUtils.setField(goal, "id", id);
    }
}
