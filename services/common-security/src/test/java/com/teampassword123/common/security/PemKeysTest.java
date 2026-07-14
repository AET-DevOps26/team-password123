package com.teampassword123.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class PemKeysTest {

    private static final KeyPair KEY_PAIR = generateKeyPair();

    private static KeyPairGenerator rsaGenerator() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static KeyPair generateKeyPair() {
        return rsaGenerator().generateKeyPair();
    }

    /** Wraps a headerless base64 body into classic multi-line PEM. */
    private static String asPem(byte[] der, String label) {
        String body = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(der);
        return "-----BEGIN " + label + "-----\n" + body + "\n-----END " + label + "-----\n";
    }

    @Test
    void parsesHeaderlessSingleLineBase64() {
        String privateBody = Base64.getEncoder().encodeToString(KEY_PAIR.getPrivate().getEncoded());
        String publicBody = Base64.getEncoder().encodeToString(KEY_PAIR.getPublic().getEncoded());

        assertThat(PemKeys.parsePrivateKey(privateBody).getEncoded())
                .isEqualTo(KEY_PAIR.getPrivate().getEncoded());
        assertThat(PemKeys.parsePublicKey(publicBody).getEncoded())
                .isEqualTo(KEY_PAIR.getPublic().getEncoded());
    }

    @Test
    void parsesFullPemWithHeadersAndLineBreaks() {
        String privatePem = asPem(KEY_PAIR.getPrivate().getEncoded(), "PRIVATE KEY");
        String publicPem = asPem(KEY_PAIR.getPublic().getEncoded(), "PUBLIC KEY");

        assertThat(PemKeys.parsePrivateKey(privatePem).getEncoded())
                .isEqualTo(KEY_PAIR.getPrivate().getEncoded());
        assertThat(PemKeys.parsePublicKey(publicPem).getEncoded())
                .isEqualTo(KEY_PAIR.getPublic().getEncoded());
    }

    @Test
    void parsesBase64BodyContainingStrayWhitespace() {
        // e.g. a value pasted into an .env file with an accidental trailing newline.
        String body =
                "  " + Base64.getEncoder().encodeToString(KEY_PAIR.getPublic().getEncoded()) + "\n";

        assertThat(PemKeys.parsePublicKey(body).getEncoded())
                .isEqualTo(KEY_PAIR.getPublic().getEncoded());
    }

    @Test
    void rejectsGarbageAndEmptyValues() {
        assertThatThrownBy(() -> PemKeys.parsePrivateKey("!!not base64!!"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PemKeys.parsePrivateKey(""))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PemKeys.parsePublicKey(""))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PemKeys.parsePublicKey(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsKeyOfWrongType() {
        // A public key fed to the private-key parser (and vice versa) must fail loudly.
        String publicBody = Base64.getEncoder().encodeToString(KEY_PAIR.getPublic().getEncoded());
        String privateBody = Base64.getEncoder().encodeToString(KEY_PAIR.getPrivate().getEncoded());

        assertThatThrownBy(() -> PemKeys.parsePrivateKey(publicBody))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PemKeys.parsePublicKey(privateBody))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
