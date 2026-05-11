package com.teampassword123.meals.service;

import com.teampassword123.meals.domain.MealItem;
import com.teampassword123.meals.domain.MealLog;
import com.teampassword123.meals.domain.PhotoLog;
import com.teampassword123.meals.dto.MealItemRequest;
import com.teampassword123.meals.dto.MealItemResponse;
import com.teampassword123.meals.dto.MealResponse;
import com.teampassword123.meals.dto.PhotoLogResponse;
import java.util.List;

final class MealMapper {

    private MealMapper() {
    }

    static MealItem toItem(MealItemRequest request) {
        MealItem item = new MealItem();
        item.setName(request.name().trim());
        item.setQuantity(request.quantity());
        item.setUnit(request.unit().trim());
        item.setCalories(request.calories());
        item.setProteinGrams(request.proteinGrams());
        item.setCarbsGrams(request.carbsGrams());
        item.setFatGrams(request.fatGrams());
        item.setFiberGrams(request.fiberGrams());
        return item;
    }

    static MealResponse toMealResponse(MealLog meal) {
        List<MealItemResponse> items = meal.getItems().stream()
                .map(MealMapper::toItemResponse)
                .toList();
        return new MealResponse(
                meal.getId(),
                meal.getMealType(),
                meal.getLoggedAt(),
                meal.getSourceType(),
                meal.getCalories(),
                meal.getProteinGrams(),
                meal.getCarbsGrams(),
                meal.getFatGrams(),
                meal.getFiberGrams(),
                meal.getNotes(),
                items
        );
    }

    static MealItemResponse toItemResponse(MealItem item) {
        return new MealItemResponse(
                item.getId(),
                item.getName(),
                item.getQuantity(),
                item.getUnit(),
                item.getCalories(),
                item.getProteinGrams(),
                item.getCarbsGrams(),
                item.getFatGrams(),
                item.getFiberGrams()
        );
    }

    static PhotoLogResponse toPhotoResponse(PhotoLog photo) {
        return new PhotoLogResponse(
                photo.getId(),
                photo.getOriginalFilename(),
                photo.getContentType(),
                photo.getStatus(),
                photo.getLinkedMealLog() == null ? null : photo.getLinkedMealLog().getId(),
                photo.getCreatedAt()
        );
    }
}
