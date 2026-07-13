package com.teampassword123.auth.service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/** In-memory feature flags, toggled at runtime without redeploying (W07 pattern). */
@Service
public class FeatureToggleService {

    private final ConcurrentHashMap<String, Boolean> toggles = new ConcurrentHashMap<>();

    public boolean isEnabled(String featureName) {
        return toggles.getOrDefault(featureName, false);
    }

    public boolean setEnabled(String featureName, boolean enabled) {
        toggles.put(featureName, enabled);
        return enabled;
    }

    /** Snapshot of all known toggle states (for debugging / admin tools). */
    public Map<String, Boolean> snapshot() {
        return Map.copyOf(toggles);
    }
}
