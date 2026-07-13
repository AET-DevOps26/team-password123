package com.teampassword123.meals.exception;

import com.teampassword123.common.web.BaseApiExceptionHandler;
import com.teampassword123.common.web.ErrorResponse;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class ApiExceptionHandler extends BaseApiExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> handleUploadSize() {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "Uploaded file is too large", List.of());
    }
}
