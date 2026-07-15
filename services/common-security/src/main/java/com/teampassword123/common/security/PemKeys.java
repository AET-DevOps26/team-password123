package com.teampassword123.common.security;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Parses RSA keys from PEM text or a headerless base64 body. Any {@code -----BEGIN/END ...-----}
 * lines and all whitespace are stripped before base64-decoding to DER, so single-line values (as
 * used in .env files, GitHub secrets and {@code helm --set}) and full multi-line PEM files both
 * work. Private keys must be PKCS#8, public keys X.509/SPKI — the formats produced by {@code
 * scripts/gen-jwt-keys.mjs} and {@code openssl genpkey}.
 */
public final class PemKeys {

    private PemKeys() {}

    /** Parses a PKCS#8 RSA private key from PEM or headerless base64. */
    public static RSAPrivateKey parsePrivateKey(String pem) {
        try {
            return (RSAPrivateKey)
                    rsaKeyFactory().generatePrivate(new PKCS8EncodedKeySpec(decode(pem)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Invalid RSA private key: expected a PKCS#8 PEM or its base64 body"
                            + " (generate a keypair with: node scripts/gen-jwt-keys.mjs)",
                    e);
        }
    }

    /** Parses an X.509/SPKI RSA public key from PEM or headerless base64. */
    public static RSAPublicKey parsePublicKey(String pem) {
        try {
            return (RSAPublicKey)
                    rsaKeyFactory().generatePublic(new X509EncodedKeySpec(decode(pem)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Invalid RSA public key: expected an X.509/SPKI PEM or its base64 body"
                            + " (generate a keypair with: node scripts/gen-jwt-keys.mjs)",
                    e);
        }
    }

    private static KeyFactory rsaKeyFactory() throws GeneralSecurityException {
        return KeyFactory.getInstance("RSA");
    }

    private static byte[] decode(String pem) {
        if (pem == null) {
            throw new IllegalArgumentException("key value is null");
        }
        String base64 = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        return Base64.getDecoder().decode(base64);
    }
}
