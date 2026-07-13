package com.teampassword123.meals.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.teampassword123.meals.dto.FoodEstimateRequest;
import com.teampassword123.meals.dto.FoodEstimateResponse;
import com.teampassword123.meals.service.GenAiFoodEstimator;
import com.teampassword123.meals.service.MealService;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class MealControllerTest {

    private final MealService mealService = mock(MealService.class);

    @Test
    void estimateReturns503WhenEstimatorNotConfigured() {
        MealController controller = new MealController(mealService, Optional.empty());

        assertThatThrownBy(() -> controller.estimate(new FoodEstimateRequest("toast")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void estimateDelegatesToEstimatorWhenConfigured() {
        GenAiFoodEstimator estimator = mock(GenAiFoodEstimator.class);
        FoodEstimateResponse expected =
                new FoodEstimateResponse(
                        "toast",
                        new BigDecimal("265"),
                        new BigDecimal("9"),
                        new BigDecimal("49"),
                        new BigDecimal("3.2"),
                        new BigDecimal("30"),
                        "1 slice",
                        "curated",
                        new BigDecimal("0.9"));
        when(estimator.estimate("toast")).thenReturn(expected);

        MealController controller = new MealController(mealService, Optional.of(estimator));

        assertThat(controller.estimate(new FoodEstimateRequest("toast"))).isEqualTo(expected);
    }
}
