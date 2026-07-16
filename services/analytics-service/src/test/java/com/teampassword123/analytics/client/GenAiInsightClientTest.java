package com.teampassword123.analytics.client;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import com.teampassword123.analytics.dto.FactRef;
import com.teampassword123.analytics.dto.FoodTotal;
import com.teampassword123.analytics.dto.GenAiInsightRequest;
import com.teampassword123.analytics.dto.GenAiInsightResponse;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The insight feature is best-effort by contract: generate() must return null on every failure mode
 * so InsightService can degrade to "unavailable" instead of turning a genai outage into a 5xx on
 * /analytics/insight. These tests pin that contract over a real HTTP connection.
 */
class GenAiInsightClientTest {

    private HttpServer server;
    private GenAiInsightClient client;

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        client = new GenAiInsightClient("http://localhost:" + server.getAddress().getPort());
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private static GenAiInsightRequest sampleRequest() {
        return new GenAiInsightRequest(
                "week",
                List.of(new FoodTotal("chicken breast", 300.0)),
                Map.of("calories", 1200.0),
                2);
    }

    private void respond(int status, String contentType, String body) {
        server.createContext(
                "/",
                exchange -> {
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", contentType);
                    exchange.sendResponseHeaders(status, bytes.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(bytes);
                    }
                });
    }

    @Test
    void postsSnakeCaseProfileToInsightEndpointAndParsesResponse() {
        AtomicReference<String> path = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();
        server.createContext(
                "/",
                exchange -> {
                    path.set(exchange.getRequestURI().getPath());
                    requestBody.set(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    byte[] body =
                            """
                            {"insight":"Add legumes for fiber.",
                             "facts_used":[{"id":"fiber-001","text":"Legumes are high in fiber."}],
                             "generated_by":"logos:gpt-oss-120b","result":"success"}
                            """
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, body.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(body);
                    }
                });

        GenAiInsightResponse response = client.generate(sampleRequest());

        assertThat(path.get()).isEqualTo("/api/insight");
        // The genai-service (Python) reads snake_case keys; camelCase would silently
        // zero the profile it prompts with.
        assertThat(requestBody.get()).contains("\"nutrient_totals\"").contains("\"days_logged\"");
        assertThat(response).isNotNull();
        assertThat(response.insight()).isEqualTo("Add legumes for fiber.");
        assertThat(response.factsUsed())
                .containsExactly(new FactRef("fiber-001", "Legumes are high in fiber."));
        assertThat(response.generatedBy()).isEqualTo("logos:gpt-oss-120b");
        assertThat(response.result()).isEqualTo("success");
    }

    @Test
    void returnsNullInsteadOfThrowingWhenUpstreamReturns5xx() {
        respond(500, "application/json", "{\"detail\":\"boom\"}");

        assertThat(client.generate(sampleRequest())).isNull();
    }

    @Test
    void returnsNullWhenUpstreamRespondsWithGarbage() {
        respond(200, "application/json", "not json at all");

        assertThat(client.generate(sampleRequest())).isNull();
    }

    @Test
    void returnsNullWhenUpstreamIsUnreachable() throws Exception {
        int deadPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            deadPort = socket.getLocalPort();
        }
        GenAiInsightClient deadClient = new GenAiInsightClient("http://localhost:" + deadPort);

        assertThat(deadClient.generate(sampleRequest())).isNull();
    }
}
