package com.teampassword123.nutrition.exception;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<ErrorResponse> handleNotFound(NotFoundException exception) {
        return error(HttpStatus.NOT_FOUND, exception.getMessage(), List.of());
    }

    @ExceptionHandler({BadRequestException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErrorResponse> handleBadRequest(Exception exception) {
        return error(HttpStatus.BAD_REQUEST, exception.getMessage(), List.of());
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ErrorResponse> handleBadCredentials() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid email or password", List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<String> details = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .toList();
        return error(HttpStatus.BAD_REQUEST, "Validation failed", details);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> handleUploadSize() {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "Uploaded file is too large", List.of());
    }

    private ResponseEntity<ErrorResponse> error(HttpStatus status, String message, List<String> details) {
        return ResponseEntity.status(status).body(new ErrorResponse(
                OffsetDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                details
        ));
    }
}
