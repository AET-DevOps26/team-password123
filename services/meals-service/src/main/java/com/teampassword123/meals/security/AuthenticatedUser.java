package com.teampassword123.meals.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, String email) {
}
