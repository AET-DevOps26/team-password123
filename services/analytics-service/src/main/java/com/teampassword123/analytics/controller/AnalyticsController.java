package com.teampassword123.analytics.controller;

import com.teampassword123.analytics.dto.AnalyticsResponse;
import com.teampassword123.analytics.dto.InsightResponse;
import com.teampassword123.analytics.dto.RangeAnalyticsResponse;
import com.teampassword123.analytics.dto.StreakResponse;
import com.teampassword123.analytics.service.AnalyticsService;
import com.teampassword123.analytics.service.InsightService;
import com.teampassword123.analytics.support.TimeZones;
import com.teampassword123.common.security.AuthenticatedUser;
import com.teampassword123.common.security.JwtAuthenticationFilter;
import io.swagger.v3.oas.annotations.Operation;
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
    private final InsightService insightService;

    public AnalyticsController(AnalyticsService analyticsService, InsightService insightService) {
        this.analyticsService = analyticsService;
        this.insightService = insightService;
    }

    @GetMapping("/daily")
    public AnalyticsResponse daily(
            @AuthenticationPrincipal AuthenticatedUser user,
            HttpServletRequest request,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String tz) {
        return analyticsService.daily(user.id(), bearerToken(request), date, TimeZones.resolve(tz));
    }

    @GetMapping("/weekly")
    public AnalyticsResponse weekly(
            @AuthenticationPrincipal AuthenticatedUser user,
            HttpServletRequest request,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @RequestParam(required = false) String tz) {
        return analyticsService.weekly(
                user.id(), bearerToken(request), weekStart, TimeZones.resolve(tz));
    }

    // No principal parameter: authentication is enforced by the filter chain, and
    // user scoping happens in meals-service via the forwarded bearer token.
    @GetMapping("/range")
    @Operation(summary = "Per-day nutrition totals for a date range (days without meals omitted)")
    public RangeAnalyticsResponse range(
            HttpServletRequest request,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String tz) {
        return analyticsService.range(bearerToken(request), from, to, TimeZones.resolve(tz));
    }

    @GetMapping("/streak")
    public StreakResponse streak(
            @AuthenticationPrincipal AuthenticatedUser user,
            HttpServletRequest request,
            @RequestParam(required = false) String tz) {
        return analyticsService.computeStreak(
                user.id(), bearerToken(request), TimeZones.resolve(tz));
    }

    @GetMapping("/insight")
    @Operation(summary = "RAG health insight generated from the user's recently logged meals")
    public InsightResponse insight(
            @AuthenticationPrincipal AuthenticatedUser user,
            HttpServletRequest request,
            @RequestParam(defaultValue = "week") String window,
            @RequestParam(required = false) String tz) {
        return insightService.getInsight(
                user.id(), bearerToken(request), window, TimeZones.resolve(tz));
    }

    private String bearerToken(HttpServletRequest request) {
        return (String) request.getAttribute(JwtAuthenticationFilter.BEARER_TOKEN_ATTRIBUTE);
    }
}
