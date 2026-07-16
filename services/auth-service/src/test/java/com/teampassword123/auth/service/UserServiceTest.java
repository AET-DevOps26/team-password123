package com.teampassword123.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.auth.domain.ActivityLevel;
import com.teampassword123.auth.domain.AppUser;
import com.teampassword123.auth.domain.Goal;
import com.teampassword123.auth.domain.Sex;
import com.teampassword123.auth.dto.UpdateUserRequest;
import com.teampassword123.auth.dto.UserResponse;
import com.teampassword123.auth.repository.AppUserRepository;
import com.teampassword123.common.web.NotFoundException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private AppUserRepository users;

    @InjectMocks private UserService userService;

    @Test
    void getMapsFoundUserToUserResponse() {
        UUID id = UUID.randomUUID();
        OffsetDateTime createdAt = OffsetDateTime.now();
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail("found@example.com");
        user.setDisplayName("Found User");
        user.setPasswordHash("hash");
        user.setCreatedAt(createdAt);

        when(users.findById(id)).thenReturn(Optional.of(user));

        UserResponse response = userService.get(id);

        assertThat(response.id()).isEqualTo(id);
        assertThat(response.email()).isEqualTo("found@example.com");
        assertThat(response.displayName()).isEqualTo("Found User");
        assertThat(response.createdAt()).isEqualTo(createdAt);
    }

    @Test
    void getThrowsNotFoundWhenUserMissing() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.get(id))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");
    }

    private AppUser storedUser(UUID id) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail("stored@example.com");
        user.setDisplayName("Old Name");
        user.setPasswordHash("hash");
        user.setCreatedAt(OffsetDateTime.parse("2026-01-01T00:00:00+00:00"));
        user.setHeightCm(180);
        user.setWeightKg(new BigDecimal("80.5"));
        user.setAge(30);
        user.setSex(Sex.MALE);
        user.setActivityLevel(ActivityLevel.MODERATE);
        user.setGoal(Goal.MAINTAIN);
        return user;
    }

    @Test
    void updateReplacesProfileFieldsAndMapsResponse() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.of(storedUser(id)));
        when(users.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateUserRequest request =
                new UpdateUserRequest(
                        "New Name",
                        170,
                        new BigDecimal("65.2"),
                        44,
                        Sex.FEMALE,
                        ActivityLevel.VERY_ACTIVE,
                        Goal.LOSE);

        UserResponse response = userService.update(id, request);

        assertThat(response.displayName()).isEqualTo("New Name");
        assertThat(response.heightCm()).isEqualTo(170);
        assertThat(response.weightKg()).isEqualByComparingTo("65.2");
        assertThat(response.age()).isEqualTo(44);
        assertThat(response.sex()).isEqualTo(Sex.FEMALE);
        assertThat(response.activityLevel()).isEqualTo(ActivityLevel.VERY_ACTIVE);
        assertThat(response.goal()).isEqualTo(Goal.LOSE);
    }

    @Test
    void updateAppliesFullPutSemanticsClearingOmittedOptionalFields() {
        UUID id = UUID.randomUUID();
        AppUser stored = storedUser(id);
        when(users.findById(id)).thenReturn(Optional.of(stored));
        when(users.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Only displayName is provided: a full PUT replace must null the rest.
        UpdateUserRequest request =
                new UpdateUserRequest("Just A Name", null, null, null, null, null, null);

        UserResponse response = userService.update(id, request);

        assertThat(stored.getHeightCm()).isNull();
        assertThat(stored.getWeightKg()).isNull();
        assertThat(stored.getAge()).isNull();
        assertThat(stored.getSex()).isNull();
        assertThat(stored.getActivityLevel()).isNull();
        assertThat(stored.getGoal()).isNull();
        assertThat(response.heightCm()).isNull();
        assertThat(response.age()).isNull();
    }

    @Test
    void updateNeverTouchesEmailPasswordOrCreatedAt() {
        UUID id = UUID.randomUUID();
        AppUser stored = storedUser(id);
        OffsetDateTime createdAt = stored.getCreatedAt();
        when(users.findById(id)).thenReturn(Optional.of(stored));
        when(users.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        userService.update(
                id, new UpdateUserRequest("New Name", null, null, null, null, null, null));

        // Credentials and identity are outside the profile-update surface.
        assertThat(stored.getEmail()).isEqualTo("stored@example.com");
        assertThat(stored.getPasswordHash()).isEqualTo("hash");
        assertThat(stored.getCreatedAt()).isEqualTo(createdAt);
        assertThat(stored.getId()).isEqualTo(id);
    }

    @Test
    void updateThrowsNotFoundWhenUserMissingAndNeverSaves() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.empty());

        UpdateUserRequest request =
                new UpdateUserRequest("Ghost", null, null, null, null, null, null);

        assertThatThrownBy(() -> userService.update(id, request))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User not found");

        verify(users, never()).save(any());
    }
}
