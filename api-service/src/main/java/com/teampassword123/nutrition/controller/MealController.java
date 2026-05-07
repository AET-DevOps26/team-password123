package com.teampassword123.nutrition.controller;

import com.teampassword123.nutrition.dto.meal.ManualMealRequest;
import com.teampassword123.nutrition.dto.meal.MealResponse;
import com.teampassword123.nutrition.dto.meal.PhotoLogResponse;
import com.teampassword123.nutrition.security.UserPrincipal;
import com.teampassword123.nutrition.service.MealService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealService mealService;

    public MealController(MealService mealService) {
        this.mealService = mealService;
    }

    @PostMapping("/manual")
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse createManual(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ManualMealRequest request
    ) {
        return mealService.createManual(principal.id(), request);
    }

    @GetMapping
    public List<MealResponse> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return mealService.list(principal.id(), from, to);
    }

    @GetMapping("/{id}")
    public MealResponse get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id
    ) {
        return mealService.get(principal.id(), id);
    }

    @PutMapping("/{id}")
    public MealResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ManualMealRequest request
    ) {
        return mealService.update(principal.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id
    ) {
        mealService.delete(principal.id(), id);
    }

    @PostMapping("/photo")
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoLogResponse createPhoto(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestPart("file") MultipartFile file
    ) {
        return mealService.createPhoto(principal.id(), file);
    }

    @PostMapping("/photo/{id}/convert-manual")
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse convertPhotoToManual(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ManualMealRequest request
    ) {
        return mealService.convertPhotoToManual(principal.id(), id, request);
    }
}
