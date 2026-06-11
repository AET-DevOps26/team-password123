package com.teampassword123.auth.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

// JSON wire format matches the web client's lowercase tokens; JPA stores the constant name.
public enum Sex {
    FEMALE("female"),
    MALE("male"),
    OTHER("other");

    private final String wire;

    Sex(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static Sex fromValue(String value) {
        for (Sex sex : values()) {
            if (sex.wire.equalsIgnoreCase(value) || sex.name().equalsIgnoreCase(value)) {
                return sex;
            }
        }
        throw new IllegalArgumentException("Unknown sex: " + value);
    }
}
