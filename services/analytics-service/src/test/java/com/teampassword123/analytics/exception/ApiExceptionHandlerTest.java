package com.teampassword123.analytics.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.teampassword123.common.web.ErrorResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

/**
 * Every /analytics endpoint depends on meals-service over HTTP. Pins how those upstream failures
 * translate for the client: timeouts/refused connections are a 504, HTTP-level failures a 502, and
 * neither response echoes the internal service URL the RestClient message embeds.
 */
class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void unreachableMealsServiceMapsTo504GatewayTimeout() {
        ResponseEntity<ErrorResponse> response =
                handler.handleUpstreamTimeout(
                        new ResourceAccessException(
                                "I/O error on GET request for"
                                        + " \"http://meals-service:8082/api/meals\": timeout"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT);
        assertThat(response.getBody().message())
                .isEqualTo("Upstream meals service did not respond");
    }

    @Test
    void failingMealsServiceCallMapsTo502BadGateway() {
        ResponseEntity<ErrorResponse> response =
                handler.handleUpstream(new RestClientException("500 Internal Server Error"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(response.getBody().message()).isEqualTo("Upstream meals service unavailable");
    }

    @Test
    void upstreamErrorResponsesNeverEchoTheInternalServiceUrl() {
        // RestClient exception messages embed the mesh-internal host and port;
        // echoing them would leak the topology to any authenticated caller.
        String leakyMessage =
                "500 on GET request for \"http://meals-service:8082/api/meals?from=2026-01-01\"";

        ErrorResponse viaRestClient =
                handler.handleUpstream(new RestClientException(leakyMessage)).getBody();
        ErrorResponse viaTimeout =
                handler.handleUpstreamTimeout(new ResourceAccessException(leakyMessage)).getBody();

        assertThat(viaRestClient.message()).doesNotContain("meals-service:8082");
        assertThat(viaRestClient.details()).isEmpty();
        assertThat(viaTimeout.message()).doesNotContain("meals-service:8082");
        assertThat(viaTimeout.details()).isEmpty();
    }
}
