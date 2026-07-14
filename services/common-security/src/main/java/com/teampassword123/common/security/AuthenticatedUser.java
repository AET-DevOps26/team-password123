package com.teampassword123.common.security;

import java.util.UUID;

public record AuthenticatedUser(UUID id, String email) {}
