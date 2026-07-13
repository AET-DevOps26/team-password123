package com.teampassword123.auth.service;

import com.teampassword123.auth.domain.AppUser;
import com.teampassword123.auth.dto.AuthResponse;
import com.teampassword123.auth.dto.LoginRequest;
import com.teampassword123.auth.dto.RegisterRequest;
import com.teampassword123.auth.exception.BadRequestException;
import com.teampassword123.auth.repository.AppUserRepository;
import com.teampassword123.auth.security.JwtService;
import com.teampassword123.auth.security.UserPrincipal;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final MeterRegistry metrics;

    public AuthService(
            AppUserRepository users,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            MeterRegistry metrics) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.metrics = metrics;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            metrics.counter("calorieasy.auth.registrations", "result", "duplicate").increment();
            log.warn("Registration rejected: duplicate email");
            // Deliberately indistinguishable from other registration failures so the
            // endpoint can't be used to probe which emails have an account.
            throw new BadRequestException("Registration failed. Check your details and try again.");
        }

        AppUser user = new AppUser();
        user.setEmail(email);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setCreatedAt(OffsetDateTime.now());
        AppUser saved = users.save(user);

        metrics.counter("calorieasy.auth.registrations", "result", "success").increment();
        log.info("Registered new user id={}", saved.getId());
        return tokenResponse(saved);
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (AuthenticationException e) {
            metrics.counter("calorieasy.auth.logins", "result", "failure").increment();
            log.warn("Login failed: {}", e.getMessage());
            throw e;
        }
        AppUser user =
                users.findByEmailIgnoreCase(email)
                        .orElseThrow(() -> new BadRequestException("Invalid email or password"));
        metrics.counter("calorieasy.auth.logins", "result", "success").increment();
        log.info("Login ok user id={}", user.getId());
        return tokenResponse(user);
    }

    private AuthResponse tokenResponse(AppUser user) {
        UserPrincipal principal = new UserPrincipal(user);
        return new AuthResponse(
                "Bearer",
                jwtService.generateToken(principal),
                jwtService.expiresAt(),
                user.getId(),
                user.getEmail(),
                user.getDisplayName());
    }
}
