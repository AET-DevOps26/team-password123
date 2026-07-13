package com.teampassword123.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FeatureToggleServiceTest {

    private FeatureToggleService service;

    @BeforeEach
    void setUp() {
        service = new FeatureToggleService();
    }

    @Test
    void unknownFeatureDefaultsToDisabled() {
        assertThat(service.isEnabled("scan-vision-model-picker")).isFalse();
    }

    @Test
    void canEnableAndReadFeature() {
        service.setEnabled("scan-vision-model-picker", true);
        assertThat(service.isEnabled("scan-vision-model-picker")).isTrue();
    }

    @Test
    void snapshotReturnsCopy() {
        service.setEnabled("a", true);
        assertThat(service.snapshot()).containsEntry("a", true);
    }
}
