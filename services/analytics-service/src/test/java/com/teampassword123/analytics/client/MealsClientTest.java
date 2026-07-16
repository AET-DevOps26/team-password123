package com.teampassword123.analytics.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import com.teampassword123.analytics.dto.MealItemSummary;
import com.teampassword123.analytics.dto.MealSummary;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

/**
 * Exercises the real HTTP path against a local server: the bearer-forwarding contract, the wire
 * format both services must agree on, and — most importantly — which exception type each upstream
 * failure surfaces as, because ApiExceptionHandler maps those types to 502/504.
 */
class MealsClientTest {

    private static final String TOKEN = "bearer-token";

    private HttpServer server;
    private MealsClient client;

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        client = new MealsClient("http://localhost:" + server.getAddress().getPort());
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private void respond(int status, String json) {
        server.createContext(
                "/",
                exchange -> {
                    byte[] body = json.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(status, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });
    }

    @Test
    void listForUserForwardsBearerTokenAndRangeAndParsesMealSummaries() {
        AtomicReference<String> path = new AtomicReference<>();
        AtomicReference<String> query = new AtomicReference<>();
        AtomicReference<String> authHeader = new AtomicReference<>();
        server.createContext(
                "/",
                exchange -> {
                    path.set(exchange.getRequestURI().getPath());
                    query.set(exchange.getRequestURI().getQuery());
                    authHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    byte[] body =
                            """
                            [{"loggedAt":"2026-05-29T12:00:00Z","calories":500.5,
                              "proteinGrams":30,"carbsGrams":60,"fatGrams":20,"fiberGrams":5,
                              "items":[{"name":"rice","quantity":150}],
                              "someFutureField":"ignored"}]
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });

        List<MealSummary> result =
                client.listForUser(
                        TOKEN,
                        LocalDate.of(2026, 5, 29),
                        LocalDate.of(2026, 5, 30),
                        ZoneOffset.UTC);

        assertThat(path.get()).isEqualTo("/api/meals");
        assertThat(query.get())
                .contains("from=2026-05-29")
                .contains("to=2026-05-30")
                .contains("tz=Z");
        assertThat(authHeader.get()).isEqualTo("Bearer " + TOKEN);

        assertThat(result).hasSize(1);
        MealSummary meal = result.get(0);
        assertThat(meal.loggedAt().toInstant())
                .isEqualTo(OffsetDateTime.of(2026, 5, 29, 12, 0, 0, 0, ZoneOffset.UTC).toInstant());
        assertThat(meal.calories()).isEqualByComparingTo("500.5");
        assertThat(meal.proteinGrams()).isEqualByComparingTo("30");
        assertThat(meal.items())
                .containsExactly(new MealItemSummary("rice", new java.math.BigDecimal("150")));
    }

    @Test
    void loggedDatesParsesIsoDateArray() {
        AtomicReference<String> path = new AtomicReference<>();
        server.createContext(
                "/",
                exchange -> {
                    path.set(exchange.getRequestURI().getPath());
                    byte[] body =
                            "[\"2026-05-01\",\"2026-05-02\"]".getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });

        List<LocalDate> result =
                client.loggedDates(
                        TOKEN, LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 31), ZoneOffset.UTC);

        assertThat(path.get()).isEqualTo("/api/meals/logged-dates");
        assertThat(result).containsExactly(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 2));
    }

    @Test
    void upstream5xxSurfacesAsHttpServerErrorForThe502Mapping() {
        respond(500, "{\"message\":\"boom\"}");

        assertThatThrownBy(
                        () ->
                                client.listForUser(
                                        TOKEN,
                                        LocalDate.of(2026, 5, 29),
                                        LocalDate.of(2026, 5, 29),
                                        ZoneOffset.UTC))
                .isInstanceOf(HttpServerErrorException.class);
    }

    @Test
    void unreachableUpstreamSurfacesAsResourceAccessForThe504Mapping() throws Exception {
        // Bind and immediately release a port so nothing is listening on it.
        int deadPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            deadPort = socket.getLocalPort();
        }
        MealsClient deadClient = new MealsClient("http://localhost:" + deadPort);

        assertThatThrownBy(
                        () ->
                                deadClient.loggedDates(
                                        TOKEN,
                                        LocalDate.of(2026, 5, 1),
                                        LocalDate.of(2026, 5, 31),
                                        ZoneOffset.UTC))
                .isInstanceOf(ResourceAccessException.class);
    }
}
