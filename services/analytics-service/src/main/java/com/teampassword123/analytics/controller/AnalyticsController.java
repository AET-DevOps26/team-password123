package com.teampassword123.analytics.controller;

import com.teampassword123.analytics.dto.AnalyticsResponse;
import com.teampassword123.analytics.dto.InsightResponse;
import com.teampassword123.analytics.dto.StreakResponse;
import com.teampassword123.analytics.security.AuthenticatedUser;
import com.teampassword123.analytics.security.JwtAuthenticationFilter;
import com.teampassword123.analytics.service.AnalyticsService;
import com.teampassword123.analytics.service.InsightService;
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
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
    return analyticsService.daily(user.id(), bearerToken(request), date);
  }

  @GetMapping("/weekly")
  public AnalyticsResponse weekly(
      @AuthenticationPrincipal AuthenticatedUser user,
      HttpServletRequest request,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
    return analyticsService.weekly(user.id(), bearerToken(request), weekStart);
  }

  @GetMapping("/streak")
  public StreakResponse streak(
      @AuthenticationPrincipal AuthenticatedUser user, HttpServletRequest request) {
    return analyticsService.computeStreak(user.id(), bearerToken(request));
  }

  @GetMapping("/insight")
  @Operation(summary = "RAG health insight generated from the user's recently logged meals")
  public InsightResponse insight(
      @AuthenticationPrincipal AuthenticatedUser user,
      HttpServletRequest request,
      @RequestParam(defaultValue = "week") String window) {
    return insightService.getInsight(user.id(), bearerToken(request), window);
  }

  private String bearerToken(HttpServletRequest request) {
    return (String) request.getAttribute(JwtAuthenticationFilter.BEARER_TOKEN_ATTRIBUTE);
  }
}
