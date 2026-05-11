package com.teampassword123.analytics.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, String email) {
}
