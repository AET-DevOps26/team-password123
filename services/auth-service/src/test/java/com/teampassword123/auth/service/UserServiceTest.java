package com.teampassword123.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.teampassword123.auth.domain.AppUser;
import com.teampassword123.auth.dto.UserResponse;
import com.teampassword123.auth.exception.NotFoundException;
import com.teampassword123.auth.repository.AppUserRepository;
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
}
