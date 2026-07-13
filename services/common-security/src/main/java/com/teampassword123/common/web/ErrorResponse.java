package com.teampassword123.common.web;

import java.time.OffsetDateTime;
import java.util.List;

public record ErrorResponse(
        OffsetDateTime timestamp, int status, String error, String message, List<String> details) {}
