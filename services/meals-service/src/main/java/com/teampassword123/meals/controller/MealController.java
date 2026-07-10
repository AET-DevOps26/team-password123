package com.teampassword123.meals.controller;

import com.teampassword123.meals.dto.FoodEstimateRequest;
import com.teampassword123.meals.dto.FoodEstimateResponse;
import com.teampassword123.meals.dto.ManualMealRequest;
import com.teampassword123.meals.dto.MealAnalysisResponse;
import com.teampassword123.meals.dto.MealResponse;
import com.teampassword123.meals.dto.PhotoLogResponse;
import com.teampassword123.meals.security.AuthenticatedUser;
import com.teampassword123.meals.service.GenAiFoodEstimator;
import com.teampassword123.meals.service.MealService;
import com.teampassword123.meals.service.MealService.StoredPhoto;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealService mealService;
    private final Optional<GenAiFoodEstimator> foodEstimator;

    public MealController(MealService mealService, Optional<GenAiFoodEstimator> foodEstimator) {
        this.mealService = mealService;
        this.foodEstimator = foodEstimator;
    }

    @PostMapping("/manual")
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse createManual(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody ManualMealRequest request
    ) {
        return mealService.createManual(user.id(), request);
    }

    @GetMapping
    public List<MealResponse> list(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return mealService.list(user.id(), from, to);
    }

    @GetMapping("/{id}")
    public MealResponse get(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id
    ) {
        return mealService.get(user.id(), id);
    }

    @PutMapping("/{id}")
    public MealResponse update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody ManualMealRequest request
    ) {
        return mealService.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id
    ) {
        mealService.delete(user.id(), id);
    }

    @PostMapping("/photo")
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoLogResponse createPhoto(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestPart("file") MultipartFile file
    ) {
        return mealService.createPhoto(user.id(), file);
    }

    @PostMapping("/photo/{id}/convert-manual")
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse convertPhotoToManual(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id,
            @Valid @RequestBody ManualMealRequest request
    ) {
        return mealService.convertPhotoToManual(user.id(), id, request);
    }

    @PostMapping("/estimate")
    public FoodEstimateResponse estimate(
            @Valid @RequestBody FoodEstimateRequest request
    ) {
        return foodEstimator
                .map(e -> e.estimate(request.foodName()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "AI estimation is not available — genai-service URL not configured."));
    }

    @PostMapping("/analyze")
    @ResponseStatus(HttpStatus.CREATED)
    public MealAnalysisResponse analyze(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestPart("image") MultipartFile image,
            @RequestParam(defaultValue = "auto") String visionProvider
    ) {
        return mealService.analyzePhoto(user.id(), image, visionProvider);
    }

    @GetMapping("/photo/{id}/raw")
    public ResponseEntity<Resource> photoRaw(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID id
    ) {
        StoredPhoto photo = mealService.loadPhoto(user.id(), id);
        MediaType contentType = photo.contentType() == null
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(photo.contentType());
        return ResponseEntity.ok()
                .contentType(contentType)
                .body(photo.resource());
    }
}
