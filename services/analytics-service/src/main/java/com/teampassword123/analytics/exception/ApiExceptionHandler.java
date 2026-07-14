package com.teampassword123.analytics.exception;

import com.teampassword123.common.web.BaseApiExceptionHandler;
import com.teampassword123.common.web.ErrorResponse;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

@RestControllerAdvice
public class ApiExceptionHandler extends BaseApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    // ResourceAccessException covers connect/read timeouts and refused connections —
    // the upstream never produced a response, so 504 fits better than the generic 502.
    @ExceptionHandler(ResourceAccessException.class)
    ResponseEntity<ErrorResponse> handleUpstreamTimeout(ResourceAccessException exception) {
        log.warn("Upstream meals service unreachable or timed out", exception);
        return error(
                HttpStatus.GATEWAY_TIMEOUT, "Upstream meals service did not respond", List.of());
    }

    @ExceptionHandler(RestClientException.class)
    ResponseEntity<ErrorResponse> handleUpstream(RestClientException exception) {
        // Log the raw cause server-side, but don't echo it: RestClient messages
        // embed the internal service URL/host/port and leak the mesh topology.
        log.warn("Upstream meals service call failed", exception);
        return error(HttpStatus.BAD_GATEWAY, "Upstream meals service unavailable", List.of());
    }
}
