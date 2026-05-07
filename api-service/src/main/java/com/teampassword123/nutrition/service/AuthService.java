package com.teampassword123.nutrition.service;

import com.teampassword123.nutrition.domain.AppUser;
import com.teampassword123.nutrition.dto.auth.AuthResponse;
import com.teampassword123.nutrition.dto.auth.LoginRequest;
import com.teampassword123.nutrition.dto.auth.RegisterRequest;
import com.teampassword123.nutrition.exception.BadRequestException;
import com.teampassword123.nutrition.repository.AppUserRepository;
import com.teampassword123.nutrition.security.JwtService;
import com.teampassword123.nutrition.security.UserPrincipal;
import java.time.OffsetDateTime;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(
            AppUserRepository users,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService
    ) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email is already registered");
        }

        AppUser user = new AppUser();
        user.setEmail(email);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setCreatedAt(OffsetDateTime.now());
        AppUser saved = users.save(user);

        return tokenResponse(saved);
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                email,
                request.password()
        ));
        AppUser user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));
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
                user.getDisplayName()
        );
    }
}
