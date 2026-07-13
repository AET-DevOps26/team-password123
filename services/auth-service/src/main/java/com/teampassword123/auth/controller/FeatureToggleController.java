package com.teampassword123.auth.controller;

import com.teampassword123.auth.service.FeatureToggleService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Runtime feature flags — same pattern as the W07 Canteen exercise.
 *
 * <p>Flip a flag with {@code PUT /api/features/{name}?enabled=true} (Bruno/Postman/curl). The web
 * app reads flags on startup and shows or hides UI without a new deploy.
 */
@RestController
@RequestMapping("/api/features")
public class FeatureToggleController {

    private final FeatureToggleService featureToggles;

    public FeatureToggleController(FeatureToggleService featureToggles) {
        this.featureToggles = featureToggles;
    }

    @GetMapping
    public Map<String, Boolean> listFeatureToggles() {
        return featureToggles.snapshot();
    }

    @GetMapping("/{featureName}")
    public ResponseEntity<Boolean> getFeatureToggleState(@PathVariable String featureName) {
        return ResponseEntity.ok(featureToggles.isEnabled(featureName));
    }

    @PutMapping("/{featureName}")
    public ResponseEntity<Boolean> setFeatureToggleState(
            @PathVariable String featureName, @RequestParam boolean enabled) {
        return ResponseEntity.ok(featureToggles.setEnabled(featureName, enabled));
    }
}
