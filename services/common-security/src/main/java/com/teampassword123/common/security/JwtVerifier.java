package com.teampassword123.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.security.interfaces.RSAPublicKey;
import java.util.UUID;

/**
 * Verifies RS256 JWTs issued by auth-service using the RSA public key only — resource services hold
 * no signing material and therefore cannot mint tokens.
 */
public class JwtVerifier {

    private final RSAPublicKey publicKey;

    public JwtVerifier(RSAPublicKey publicKey) {
        this.publicKey = publicKey;
    }

    public AuthenticatedUser verify(String token) {
        Claims claims =
                Jwts.parser().verifyWith(publicKey).build().parseSignedClaims(token).getPayload();
        UUID userId = UUID.fromString(claims.get("userId", String.class));
        return new AuthenticatedUser(userId, claims.getSubject());
    }
}
