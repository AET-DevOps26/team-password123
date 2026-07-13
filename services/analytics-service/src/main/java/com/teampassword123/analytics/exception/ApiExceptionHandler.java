package com.teampassword123.analytics.exception;

import java.time.OffsetDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler({BadRequestException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> handleBadRequest(Exception exception) {
        return error(HttpStatus.BAD_REQUEST, exception.getMessage(), List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<String> details =
                exception.getBindingResult().getFieldErrors().stream()
                        .map(error -> error.getField() + ": " + error.getDefaultMessage())
                        .toList();
        return error(HttpStatus.BAD_REQUEST, "Validation failed", details);
    }

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

    private ResponseEntity<ErrorResponse> error(
            HttpStatus status, String message, List<String> details) {
        return ResponseEntity.status(status)
                .body(
                        new ErrorResponse(
                                OffsetDateTime.now(),
                                status.value(),
                                status.getReasonPhrase(),
                                message,
                                details));
    }
}
