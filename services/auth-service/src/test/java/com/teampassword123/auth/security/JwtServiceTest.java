package com.teampassword123.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.teampassword123.auth.domain.AppUser;
import io.jsonwebtoken.JwtException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    // 64-char ASCII secrets => 512 bits, comfortably above the 256-bit HMAC-SHA minimum.
    private static final String SECRET =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String OTHER_SECRET =
            "ZZZZ56789abcdef0123456789abcdef0123456789abcdef0123456789abcdefZZ";

    private UserPrincipal principal(UUID id, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setPasswordHash("hash");
        return new UserPrincipal(user);
    }

    @Test
    void generatedTokenRoundTripsToSubjectAndIsParseableByServiceWithSameSecret() {
        JwtService service = new JwtService(SECRET, Duration.ofHours(1));
        UUID id = UUID.randomUUID();
        UserPrincipal principal = principal(id, "user@example.com");

        String token = service.generateToken(principal);

        assertThat(token).isNotBlank();
        // A signed JWT has three dot-separated parts.
        assertThat(token.split("\\.")).hasSize(3);
        assertThat(service.subject(token)).isEqualTo("user@example.com");
    }

    @Test
    void tokenSignedWithOneSecretIsRejectedByServiceWithDifferentSecret() {
        JwtService issuer = new JwtService(SECRET, Duration.ofHours(1));
        JwtService verifier = new JwtService(OTHER_SECRET, Duration.ofHours(1));

        String token = issuer.generateToken(principal(UUID.randomUUID(), "a@b.com"));

        assertThatThrownBy(() -> verifier.subject(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void expiredTokenIsRejectedOnParsing() {
        // Negative expiration => the token's exp is already in the past at creation.
        JwtService service = new JwtService(SECRET, Duration.ofSeconds(-60));
        String token = service.generateToken(principal(UUID.randomUUID(), "expired@b.com"));

        assertThatThrownBy(() -> service.subject(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void malformedTokenIsRejected() {
        JwtService service = new JwtService(SECRET, Duration.ofHours(1));

        assertThatThrownBy(() -> service.subject("not-a-real-jwt"))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void expiresAtIsRoughlyNowPlusConfiguredExpirationInUtc() {
        Duration expiration = Duration.ofHours(2);
        JwtService service = new JwtService(SECRET, expiration);

        OffsetDateTime before = OffsetDateTime.now(ZoneOffset.UTC).plus(expiration);
        OffsetDateTime result = service.expiresAt();
        OffsetDateTime after = OffsetDateTime.now(ZoneOffset.UTC).plus(expiration);

        assertThat(result.getOffset()).isEqualTo(ZoneOffset.UTC);
        // Allow a generous window so the assertion never flakes on slow machines.
        assertThat(result).isBetween(before.minusMinutes(1), after.plusMinutes(1));
    }
}
