package com.teampassword123.meals.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.teampassword123.meals.domain.MealType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Pins the manual-entry contract: MealService sums item macros unchecked, so these annotations are
 * the only thing keeping negative calories out of the diary and the analytics aggregates.
 */
class ManualMealRequestValidationTest {

    private static final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static Set<ConstraintViolation<ManualMealRequest>> validate(ManualMealRequest request) {
        return validator.validate(request);
    }

    private static MealItemRequest item(String name, String calories) {
        return new MealItemRequest(
                name,
                new BigDecimal("100"),
                "g",
                new BigDecimal(calories),
                new BigDecimal("10"),
                new BigDecimal("20"),
                new BigDecimal("5"),
                new BigDecimal("2"));
    }

    private static ManualMealRequest requestWith(List<MealItemRequest> items) {
        return new ManualMealRequest(
                MealType.LUNCH,
                OffsetDateTime.of(2026, 5, 1, 12, 0, 0, 0, ZoneOffset.UTC),
                "notes",
                items);
    }

    @Test
    void validRequestHasNoViolations() {
        assertThat(validate(requestWith(List.of(item("Rice", "300"))))).isEmpty();
    }

    @Test
    void negativeItemMacrosAreRejectedThroughTheNestedCascade() {
        Set<ConstraintViolation<ManualMealRequest>> violations =
                validate(requestWith(List.of(item("Antimatter", "-100"))));

        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("items[0].calories");
    }

    @Test
    void zeroCaloriesAreAllowedForWaterAndBlackCoffee() {
        assertThat(validate(requestWith(List.of(item("Water", "0"))))).isEmpty();
    }

    @Test
    void zeroQuantityIsRejectedBecauseTheMinimumIsExclusive() {
        MealItemRequest zeroQuantity =
                new MealItemRequest(
                        "Nothing",
                        BigDecimal.ZERO,
                        "g",
                        new BigDecimal("100"),
                        new BigDecimal("10"),
                        new BigDecimal("20"),
                        new BigDecimal("5"),
                        new BigDecimal("2"));

        assertThat(validate(requestWith(List.of(zeroQuantity))))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("items[0].quantity");
    }

    @Test
    void emptyItemsListIsRejected() {
        assertThat(validate(requestWith(List.of())))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("items");
    }

    @Test
    void nullMealTypeIsRejected() {
        ManualMealRequest request =
                new ManualMealRequest(null, null, null, List.of(item("Rice", "300")));

        assertThat(validate(request))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("mealType");
    }

    @Test
    void nullLoggedAtAndNullNotesAreAllowed() {
        ManualMealRequest request =
                new ManualMealRequest(MealType.SNACK, null, null, List.of(item("Rice", "300")));

        assertThat(validate(request)).isEmpty();
    }

    @Test
    void oversizedNameAndNotesAreRejected() {
        ManualMealRequest request =
                new ManualMealRequest(
                        MealType.LUNCH,
                        null,
                        "n".repeat(501),
                        List.of(item("x".repeat(161), "300")));

        assertThat(validate(request))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactlyInAnyOrder("notes", "items[0].name");
    }
}
