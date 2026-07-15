package com.teampassword123.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtVerifierTest {

    private static final KeyPair KEY_PAIR = generateKeyPair();
    private static final KeyPair OTHER_KEY_PAIR = generateKeyPair();

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String token(KeyPair signingPair, UUID userId, String email) {
        return Jwts.builder()
                .subject(email)
                .claim("userId", userId.toString())
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(signingPair.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }

    @Test
    void verifiesTokenSignedWithMatchingPrivateKeyAndExtractsUserIdAndSubject() {
        UUID userId = UUID.randomUUID();
        JwtVerifier verifier = new JwtVerifier((RSAPublicKey) KEY_PAIR.getPublic());

        AuthenticatedUser user = verifier.verify(token(KEY_PAIR, userId, "user@example.com"));

        assertThat(user.id()).isEqualTo(userId);
        assertThat(user.email()).isEqualTo("user@example.com");
    }

    @Test
    void verifierAcceptsKeyParsedFromHeaderlessBase64Spki() {
        // The exact wire format the services receive via APP_JWT_PUBLIC_KEY.
        String publicKeyBase64 =
                Base64.getEncoder().encodeToString(KEY_PAIR.getPublic().getEncoded());
        UUID userId = UUID.randomUUID();

        JwtVerifier verifier = new JwtVerifier(PemKeys.parsePublicKey(publicKeyBase64));

        assertThat(verifier.verify(token(KEY_PAIR, userId, "a@b.com")).id()).isEqualTo(userId);
    }

    @Test
    void rejectsTokenSignedWithDifferentPrivateKey() {
        JwtVerifier verifier = new JwtVerifier((RSAPublicKey) KEY_PAIR.getPublic());

        String forged = token(OTHER_KEY_PAIR, UUID.randomUUID(), "attacker@evil.com");

        assertThatThrownBy(() -> verifier.verify(forged)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsMalformedToken() {
        JwtVerifier verifier = new JwtVerifier((RSAPublicKey) KEY_PAIR.getPublic());

        assertThatThrownBy(() -> verifier.verify("not-a-jwt")).isInstanceOf(JwtException.class);
    }
}
