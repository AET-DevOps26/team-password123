package com.teampassword123.analytics.controller;

import com.teampassword123.analytics.dto.AnalyticsResponse;
import com.teampassword123.analytics.security.AuthenticatedUser;
import com.teampassword123.analytics.security.JwtAuthenticationFilter;
import com.teampassword123.analytics.service.AnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/daily")
    public AnalyticsResponse daily(
            @AuthenticationPrincipal AuthenticatedUser user,
            HttpServletRequest request,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return analyticsService.daily(user.id(), bearerToken(request), date);
    }

    @GetMapping("/weekly")
    public AnalyticsResponse weekly(
            @AuthenticationPrincipal AuthenticatedUser user,
            HttpServletRequest request,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return analyticsService.weekly(user.id(), bearerToken(request), weekStart);
    }

    private String bearerToken(HttpServletRequest request) {
        return (String) request.getAttribute(JwtAuthenticationFilter.BEARER_TOKEN_ATTRIBUTE);
    }
}
