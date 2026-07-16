package com.teampassword123.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.teampassword123.auth.domain.ActivityLevel;
import com.teampassword123.auth.domain.Goal;
import com.teampassword123.auth.domain.Sex;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Pins the PUT /users/me validation bounds — these are the only guard between the client and
 * nonsense profile data (negative age, 4-metre humans) reaching TDEE calculations.
 */
class UpdateUserRequestValidationTest {

    private static final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    private static Set<ConstraintViolation<UpdateUserRequest>> validate(UpdateUserRequest request) {
        return validator.validate(request);
    }

    private static UpdateUserRequest request(
            String displayName, Integer heightCm, BigDecimal weightKg, Integer age) {
        return new UpdateUserRequest(
                displayName, heightCm, weightKg, age, Sex.OTHER, ActivityLevel.LIGHT, Goal.GAIN);
    }

    @Test
    void fullyPopulatedRequestWithinBoundsIsValid() {
        assertThat(validate(request("Alice", 170, new BigDecimal("65.2"), 44))).isEmpty();
    }

    @Test
    void displayNameOnlyRequestIsValidSoPartialProfilesCanBeSaved() {
        UpdateUserRequest onboardingOnly =
                new UpdateUserRequest("Alice", null, null, null, null, null, null);

        assertThat(validate(onboardingOnly)).isEmpty();
    }

    @Test
    void blankDisplayNameIsRejected() {
        assertThat(validate(request("   ", 170, null, null)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("displayName");
    }

    @Test
    void displayNameLongerThan120CharsIsRejected() {
        assertThat(validate(request("x".repeat(121), null, null, null)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("displayName");
        assertThat(validate(request("x".repeat(120), null, null, null))).isEmpty();
    }

    @Test
    void negativeAndZeroAgeAreRejected() {
        assertThat(validate(request("Alice", null, null, -30)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("age");
        assertThat(validate(request("Alice", null, null, 0)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("age");
    }

    @Test
    void ageBoundsAreOneToOneHundredFifty() {
        assertThat(validate(request("Alice", null, null, 1))).isEmpty();
        assertThat(validate(request("Alice", null, null, 150))).isEmpty();
        assertThat(validate(request("Alice", null, null, 151)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("age");
    }

    @Test
    void heightBoundsAreFiftyToThreeHundredCm() {
        assertThat(validate(request("Alice", 50, null, null))).isEmpty();
        assertThat(validate(request("Alice", 300, null, null))).isEmpty();
        assertThat(validate(request("Alice", 49, null, null)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("heightCm");
        assertThat(validate(request("Alice", 301, null, null)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("heightCm");
    }

    @Test
    void zeroOrNegativeWeightIsRejected() {
        assertThat(validate(request("Alice", null, BigDecimal.ZERO, null)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("weightKg");
        assertThat(validate(request("Alice", null, new BigDecimal("-5"), null)))
                .extracting(v -> v.getPropertyPath().toString())
                .containsExactly("weightKg");
        assertThat(validate(request("Alice", null, new BigDecimal("0.1"), null))).isEmpty();
    }
}
