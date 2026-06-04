package com.teampassword123.auth.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

// JSON wire format matches the web client's tokens (note camelCase "veryActive"); JPA stores the constant name.
public enum ActivityLevel {
    SEDENTARY("sedentary"),
    LIGHT("light"),
    MODERATE("moderate"),
    ACTIVE("active"),
    VERY_ACTIVE("veryActive");

    private final String wire;

    ActivityLevel(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static ActivityLevel fromValue(String value) {
        for (ActivityLevel level : values()) {
            if (level.wire.equalsIgnoreCase(value) || level.name().equalsIgnoreCase(value)) {
                return level;
            }
        }
        throw new IllegalArgumentException("Unknown activity level: " + value);
    }
}
