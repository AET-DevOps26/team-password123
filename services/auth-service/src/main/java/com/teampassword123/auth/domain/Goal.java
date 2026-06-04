package com.teampassword123.auth.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

// JSON wire format matches the web client's lowercase tokens; JPA stores the constant name.
public enum Goal {
    LOSE("lose"),
    MAINTAIN("maintain"),
    GAIN("gain");

    private final String wire;

    Goal(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static Goal fromValue(String value) {
        for (Goal goal : values()) {
            if (goal.wire.equalsIgnoreCase(value) || goal.name().equalsIgnoreCase(value)) {
                return goal;
            }
        }
        throw new IllegalArgumentException("Unknown goal: " + value);
    }
}
