package com.teampassword123.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.auth.domain.AppUser;
import com.teampassword123.auth.dto.AuthResponse;
import com.teampassword123.auth.dto.LoginRequest;
import com.teampassword123.auth.dto.RegisterRequest;
import com.teampassword123.auth.repository.AppUserRepository;
import com.teampassword123.auth.security.JwtService;
import com.teampassword123.auth.security.UserPrincipal;
import com.teampassword123.common.web.BadRequestException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private AppUserRepository users;

    @Mock private org.springframework.security.crypto.password.PasswordEncoder encoder;

    @Mock private AuthenticationManager authenticationManager;

    @Mock private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService =
                new AuthService(
                        users,
                        encoder,
                        authenticationManager,
                        jwtService,
                        new io.micrometer.core.instrument.simple.SimpleMeterRegistry());
    }

    private AppUser persistedUser(UUID id, String email, String displayName) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setDisplayName(displayName);
        user.setPasswordHash("ENC");
        user.setCreatedAt(OffsetDateTime.now());
        return user;
    }

    @Test
    void registerNormalizesEmailEncodesPasswordSavesUserAndReturnsToken() {
        RegisterRequest request =
                new RegisterRequest("  Test@Example.COM ", "password1", "  Alice  ");

        when(users.existsByEmailIgnoreCase("test@example.com")).thenReturn(false);
        when(encoder.encode("password1")).thenReturn("ENC");

        UUID id = UUID.randomUUID();
        when(users.save(any(AppUser.class)))
                .thenAnswer(
                        invocation -> {
                            AppUser arg = invocation.getArgument(0);
                            arg.setId(id);
                            return arg;
                        });
        when(jwtService.generateToken(any(UserPrincipal.class))).thenReturn("jwt-token");
        OffsetDateTime expiry = OffsetDateTime.now().plusHours(1);
        when(jwtService.expiresAt()).thenReturn(expiry);

        AuthResponse response = authService.register(request);

        ArgumentCaptor<AppUser> saved = ArgumentCaptor.forClass(AppUser.class);
        verify(users).save(saved.capture());
        AppUser savedUser = saved.getValue();
        assertThat(savedUser.getEmail()).isEqualTo("test@example.com");
        assertThat(savedUser.getDisplayName()).isEqualTo("Alice");
        assertThat(savedUser.getPasswordHash()).isEqualTo("ENC");
        assertThat(savedUser.getCreatedAt()).isNotNull();

        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.accessToken()).isEqualTo("jwt-token");
        assertThat(response.expiresAt()).isEqualTo(expiry);
        assertThat(response.userId()).isEqualTo(id);
        assertThat(response.email()).isEqualTo("test@example.com");
        assertThat(response.displayName()).isEqualTo("Alice");
    }

    @Test
    void registerThrowsBadRequestWhenEmailAlreadyRegisteredAndDoesNotSave() {
        RegisterRequest request = new RegisterRequest("DUP@Example.com", "password1", "Bob");

        when(users.existsByEmailIgnoreCase("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Registration failed. Check your details and try again.");

        verify(users, never()).save(any());
        verify(encoder, never()).encode(any());
    }

    @Test
    void loginAuthenticatesNormalizedEmailAndReturnsTokenForFoundUser() {
        LoginRequest request = new LoginRequest("  USER@Example.com ", "secret123");

        Authentication auth =
                new UsernamePasswordAuthenticationToken("user@example.com", "secret123");
        when(authenticationManager.authenticate(any())).thenReturn(auth);

        UUID id = UUID.randomUUID();
        AppUser user = persistedUser(id, "user@example.com", "Carol");
        when(users.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(any(UserPrincipal.class))).thenReturn("login-token");
        OffsetDateTime expiry = OffsetDateTime.now().plusHours(2);
        when(jwtService.expiresAt()).thenReturn(expiry);

        AuthResponse response = authService.login(request);

        ArgumentCaptor<UsernamePasswordAuthenticationToken> tokenCaptor =
                ArgumentCaptor.forClass(UsernamePasswordAuthenticationToken.class);
        verify(authenticationManager).authenticate(tokenCaptor.capture());
        assertThat(tokenCaptor.getValue().getPrincipal()).isEqualTo("user@example.com");
        assertThat(tokenCaptor.getValue().getCredentials()).isEqualTo("secret123");

        assertThat(response.accessToken()).isEqualTo("login-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.userId()).isEqualTo(id);
        assertThat(response.email()).isEqualTo("user@example.com");
        assertThat(response.displayName()).isEqualTo("Carol");
        assertThat(response.expiresAt()).isEqualTo(expiry);
    }

    @Test
    void loginPropagatesAuthenticationFailureAndNeverGeneratesToken() {
        LoginRequest request = new LoginRequest("user@example.com", "wrong");

        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("bad"));

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);

        verify(users, never()).findByEmailIgnoreCase(any());
        verify(jwtService, never()).generateToken(any());
    }

    @Test
    void loginThrowsBadRequestWhenAuthenticatedUserNotFoundInRepository() {
        LoginRequest request = new LoginRequest("ghost@example.com", "secret123");

        when(authenticationManager.authenticate(any()))
                .thenReturn(
                        new UsernamePasswordAuthenticationToken("ghost@example.com", "secret123"));
        when(users.findByEmailIgnoreCase("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Invalid email or password");

        verify(jwtService, never()).generateToken(any());
    }
}
