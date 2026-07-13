package com.teampassword123.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpMethod;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-IP rate limit on the unauthenticated auth endpoints (POST /api/auth/login and /register) to
 * blunt online credential brute-force and account enumeration, which were otherwise unlimited.
 * Fixed window, counted per client IP.
 *
 * <p>ponytail: in-memory and per-pod — enough to stop a single-source scripted flood, but a
 * distributed attacker or a multi-replica (HPA) deploy needs a shared store (Redis / bucket4j).
 * Client IP comes from X-Forwarded-For (behind Traefik), which a determined attacker can spoof to
 * dodge the per-IP key; the proper fix is a trusted-proxy forwarded-header config. Swap the map +
 * IP source for those if strict limiting is required.
 */
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private final int maxAttempts;
    private final long windowMillis;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public LoginRateLimitFilter(int maxAttempts, long windowMillis) {
        this.maxAttempts = maxAttempts;
        this.windowMillis = windowMillis;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!HttpMethod.POST.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !("/api/auth/login".equals(path) || "/api/auth/register".equals(path));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (isOverLimit(clientIp(request))) {
            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests, please retry later.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isOverLimit(String key) {
        long now = System.currentTimeMillis();
        // Crude memory bound: if the table grows unreasonably (e.g. an IP-spraying
        // attack), drop it wholesale. Safe — it only resets counters momentarily.
        if (windows.size() > 10_000) {
            windows.clear();
        }
        Window window =
                windows.compute(
                        key,
                        (k, existing) ->
                                (existing == null || now - existing.start >= windowMillis)
                                        ? new Window(now)
                                        : existing);
        return window.count.incrementAndGet() > maxAttempts;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class Window {
        final long start;
        final AtomicInteger count = new AtomicInteger();

        Window(long start) {
            this.start = start;
        }
    }
}
