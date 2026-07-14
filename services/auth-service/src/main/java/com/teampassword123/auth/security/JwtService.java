package com.teampassword123.auth.security;

import com.teampassword123.common.security.PemKeys;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Issues RS256 JWTs signed with the RSA private key ({@code APP_JWT_PRIVATE_KEY}). Resource
 * services verify with the public key only, so auth-service is the single place able to mint
 * tokens. The public key used for this service's own token parsing is derived from the private key,
 * so auth needs no separate public-key configuration.
 */
@Service
public class JwtService {

    private final RSAPrivateKey privateKey;
    private final RSAPublicKey publicKey;
    private final Duration expiration;

    public JwtService(
            @Value("${app.jwt.private-key}") String privateKeyPem,
            @Value("${app.jwt.expiration}") Duration expiration) {
        this.privateKey = PemKeys.parsePrivateKey(privateKeyPem);
        this.publicKey = derivePublicKey(this.privateKey);
        this.expiration = expiration;
    }

    public String generateToken(UserPrincipal principal) {
        Instant now = Instant.now();
        Instant expires = now.plus(expiration);
        return Jwts.builder()
                .subject(principal.getUsername())
                .claim("userId", principal.id().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expires))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }

    public String subject(String token) {
        return claims(token).getSubject();
    }

    public OffsetDateTime expiresAt() {
        return OffsetDateTime.ofInstant(Instant.now().plus(expiration), ZoneOffset.UTC);
    }

    private Claims claims(String token) {
        return Jwts.parser().verifyWith(publicKey).build().parseSignedClaims(token).getPayload();
    }

    private static RSAPublicKey derivePublicKey(RSAPrivateKey privateKey) {
        if (!(privateKey instanceof RSAPrivateCrtKey crtKey)) {
            throw new IllegalArgumentException(
                    "APP_JWT_PRIVATE_KEY must be a standard (CRT-form) PKCS#8 RSA key so the"
                            + " public key can be derived from it");
        }
        try {
            return (RSAPublicKey)
                    KeyFactory.getInstance("RSA")
                            .generatePublic(
                                    new RSAPublicKeySpec(
                                            crtKey.getModulus(), crtKey.getPublicExponent()));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to derive the RSA public key", e);
        }
    }
}
