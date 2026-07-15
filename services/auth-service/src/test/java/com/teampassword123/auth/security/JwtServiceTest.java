package com.teampassword123.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.teampassword123.auth.domain.AppUser;
import io.jsonwebtoken.JwtException;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    // RS256 keypairs generated per test run; the service consumes the private key exactly as it
    // arrives via APP_JWT_PRIVATE_KEY — a headerless single-line base64 PKCS#8 body.
    private static final String PRIVATE_KEY = generatePrivateKeyBase64();
    private static final String OTHER_PRIVATE_KEY = generatePrivateKeyBase64();

    private static String generatePrivateKeyBase64() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return Base64.getEncoder()
                    .encodeToString(generator.generateKeyPair().getPrivate().getEncoded());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private UserPrincipal principal(UUID id, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setPasswordHash("hash");
        return new UserPrincipal(user);
    }

    @Test
    void generatedTokenRoundTripsToSubjectAndIsParseableByServiceWithSameKey() {
        JwtService service = new JwtService(PRIVATE_KEY, Duration.ofHours(1));
        UUID id = UUID.randomUUID();
        UserPrincipal principal = principal(id, "user@example.com");

        String token = service.generateToken(principal);

        assertThat(token).isNotBlank();
        // A signed JWT has three dot-separated parts.
        assertThat(token.split("\\.")).hasSize(3);
        assertThat(service.subject(token)).isEqualTo("user@example.com");
    }

    @Test
    void tokenSignedWithOneKeyIsRejectedByServiceWithDifferentKey() {
        JwtService issuer = new JwtService(PRIVATE_KEY, Duration.ofHours(1));
        JwtService verifier = new JwtService(OTHER_PRIVATE_KEY, Duration.ofHours(1));

        String token = issuer.generateToken(principal(UUID.randomUUID(), "a@b.com"));

        assertThatThrownBy(() -> verifier.subject(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void expiredTokenIsRejectedOnParsing() {
        // Negative expiration => the token's exp is already in the past at creation.
        JwtService service = new JwtService(PRIVATE_KEY, Duration.ofSeconds(-60));
        String token = service.generateToken(principal(UUID.randomUUID(), "expired@b.com"));

        assertThatThrownBy(() -> service.subject(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void malformedTokenIsRejected() {
        JwtService service = new JwtService(PRIVATE_KEY, Duration.ofHours(1));

        assertThatThrownBy(() -> service.subject("not-a-real-jwt"))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void malformedPrivateKeyIsRejectedAtConstruction() {
        assertThatThrownBy(() -> new JwtService("not-a-key", Duration.ofHours(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void expiresAtIsRoughlyNowPlusConfiguredExpirationInUtc() {
        Duration expiration = Duration.ofHours(2);
        JwtService service = new JwtService(PRIVATE_KEY, expiration);

        OffsetDateTime before = OffsetDateTime.now(ZoneOffset.UTC).plus(expiration);
        OffsetDateTime result = service.expiresAt();
        OffsetDateTime after = OffsetDateTime.now(ZoneOffset.UTC).plus(expiration);

        assertThat(result.getOffset()).isEqualTo(ZoneOffset.UTC);
        // Allow a generous window so the assertion never flakes on slow machines.
        assertThat(result).isBetween(before.minusMinutes(1), after.plusMinutes(1));
    }
}
