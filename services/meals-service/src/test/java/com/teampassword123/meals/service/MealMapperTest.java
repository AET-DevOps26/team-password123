package com.teampassword123.meals.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.teampassword123.meals.domain.MealItem;
import com.teampassword123.meals.domain.MealLog;
import com.teampassword123.meals.domain.MealType;
import com.teampassword123.meals.domain.PhotoLog;
import com.teampassword123.meals.domain.PhotoStatus;
import com.teampassword123.meals.domain.SourceType;
import com.teampassword123.meals.dto.MealItemRequest;
import com.teampassword123.meals.dto.MealItemResponse;
import com.teampassword123.meals.dto.MealResponse;
import com.teampassword123.meals.dto.PhotoLogResponse;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class MealMapperTest {

    private static MealItemRequest itemRequest(
            String name,
            String unit,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber) {
        return new MealItemRequest(
                name, new BigDecimal("1.0"), unit, calories, protein, carbs, fat, fiber);
    }

    @Test
    void toItem_trimsNameAndUnit_andCopiesNutrients() {
        MealItemRequest request =
                itemRequest(
                        "  Chicken  ",
                        "  g  ",
                        new BigDecimal("250"),
                        new BigDecimal("30"),
                        new BigDecimal("5"),
                        new BigDecimal("12"),
                        new BigDecimal("2"));

        MealItem item = MealMapper.toItem(request);

        assertThat(item.getName()).isEqualTo("Chicken");
        assertThat(item.getUnit()).isEqualTo("g");
        assertThat(item.getQuantity()).isEqualByComparingTo("1.0");
        assertThat(item.getCalories()).isEqualByComparingTo("250");
        assertThat(item.getProteinGrams()).isEqualByComparingTo("30");
        assertThat(item.getCarbsGrams()).isEqualByComparingTo("5");
        assertThat(item.getFatGrams()).isEqualByComparingTo("12");
        assertThat(item.getFiberGrams()).isEqualByComparingTo("2");
    }

    @Test
    void toItemResponse_copiesAllFields() {
        MealItem item = new MealItem();
        ReflectionTestUtils.setField(item, "id", java.util.UUID.randomUUID());
        item.setName("Rice");
        item.setQuantity(new BigDecimal("150"));
        item.setUnit("g");
        item.setCalories(new BigDecimal("200"));
        item.setProteinGrams(new BigDecimal("4"));
        item.setCarbsGrams(new BigDecimal("44"));
        item.setFatGrams(new BigDecimal("1"));
        item.setFiberGrams(new BigDecimal("3"));

        MealItemResponse response = MealMapper.toItemResponse(item);

        assertThat(response.id()).isEqualTo(item.getId());
        assertThat(response.name()).isEqualTo("Rice");
        assertThat(response.quantity()).isEqualByComparingTo("150");
        assertThat(response.unit()).isEqualTo("g");
        assertThat(response.calories()).isEqualByComparingTo("200");
        assertThat(response.proteinGrams()).isEqualByComparingTo("4");
        assertThat(response.carbsGrams()).isEqualByComparingTo("44");
        assertThat(response.fatGrams()).isEqualByComparingTo("1");
        assertThat(response.fiberGrams()).isEqualByComparingTo("3");
    }

    @Test
    void toMealResponse_mapsScalarFieldsAndItems() {
        OffsetDateTime loggedAt = OffsetDateTime.of(2026, 5, 1, 12, 0, 0, 0, ZoneOffset.UTC);

        MealLog meal = new MealLog();
        ReflectionTestUtils.setField(meal, "id", java.util.UUID.randomUUID());
        meal.setMealType(MealType.LUNCH);
        meal.setLoggedAt(loggedAt);
        meal.setSourceType(SourceType.MANUAL);
        meal.setCalories(new BigDecimal("450"));
        meal.setProteinGrams(new BigDecimal("34"));
        meal.setCarbsGrams(new BigDecimal("49"));
        meal.setFatGrams(new BigDecimal("13"));
        meal.setFiberGrams(new BigDecimal("5"));
        meal.setNotes("post-workout");

        MealItem item =
                MealMapper.toItem(
                        itemRequest(
                                "Eggs",
                                "pcs",
                                new BigDecimal("90"),
                                new BigDecimal("7"),
                                new BigDecimal("1"),
                                new BigDecimal("6"),
                                new BigDecimal("0")));
        meal.addItem(item);

        MealResponse response = MealMapper.toMealResponse(meal);

        assertThat(response.id()).isEqualTo(meal.getId());
        assertThat(response.mealType()).isEqualTo(MealType.LUNCH);
        assertThat(response.loggedAt()).isEqualTo(loggedAt);
        assertThat(response.sourceType()).isEqualTo(SourceType.MANUAL);
        assertThat(response.calories()).isEqualByComparingTo("450");
        assertThat(response.proteinGrams()).isEqualByComparingTo("34");
        assertThat(response.carbsGrams()).isEqualByComparingTo("49");
        assertThat(response.fatGrams()).isEqualByComparingTo("13");
        assertThat(response.fiberGrams()).isEqualByComparingTo("5");
        assertThat(response.notes()).isEqualTo("post-workout");
        assertThat(response.photoUrl()).isNull();
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).name()).isEqualTo("Eggs");
        assertThat(response.items().get(0).unit()).isEqualTo("pcs");
    }

    @Test
    void toMealResponse_withLinkedPhoto_buildsPhotoRawUrl() {
        java.util.UUID photoId = java.util.UUID.randomUUID();
        PhotoLog photo = new PhotoLog();
        ReflectionTestUtils.setField(photo, "id", photoId);

        MealLog meal = new MealLog();
        meal.setMealType(MealType.DINNER);
        meal.setLoggedAt(OffsetDateTime.now(ZoneOffset.UTC));
        meal.setSourceType(SourceType.PHOTO_MANUAL);
        meal.setCalories(BigDecimal.ZERO);
        meal.setProteinGrams(BigDecimal.ZERO);
        meal.setCarbsGrams(BigDecimal.ZERO);
        meal.setFatGrams(BigDecimal.ZERO);
        meal.setFiberGrams(BigDecimal.ZERO);

        MealResponse response = MealMapper.toMealResponse(meal, photo);

        assertThat(response.photoUrl()).isEqualTo("/api/meals/photo/" + photoId + "/raw");
    }

    @Test
    void toMealResponse_withNoItems_returnsEmptyItemList() {
        MealLog meal = new MealLog();
        meal.setMealType(MealType.SNACK);
        meal.setLoggedAt(OffsetDateTime.now(ZoneOffset.UTC));
        meal.setSourceType(SourceType.MANUAL);
        meal.setCalories(BigDecimal.ZERO);
        meal.setProteinGrams(BigDecimal.ZERO);
        meal.setCarbsGrams(BigDecimal.ZERO);
        meal.setFatGrams(BigDecimal.ZERO);
        meal.setFiberGrams(BigDecimal.ZERO);

        MealResponse response = MealMapper.toMealResponse(meal);

        assertThat(response.items()).isEmpty();
        assertThat(response.notes()).isNull();
    }

    @Test
    void toPhotoResponse_withoutLinkedMeal_hasNullLinkedMealLogId() {
        OffsetDateTime createdAt = OffsetDateTime.of(2026, 5, 2, 8, 30, 0, 0, ZoneOffset.UTC);

        PhotoLog photo = new PhotoLog();
        ReflectionTestUtils.setField(photo, "id", java.util.UUID.randomUUID());
        photo.setOriginalFilename("lunch.jpg");
        photo.setContentType("image/jpeg");
        photo.setStatus(PhotoStatus.AI_NOT_AVAILABLE);
        photo.setCreatedAt(createdAt);

        PhotoLogResponse response = MealMapper.toPhotoResponse(photo);

        assertThat(response.id()).isEqualTo(photo.getId());
        assertThat(response.originalFilename()).isEqualTo("lunch.jpg");
        assertThat(response.contentType()).isEqualTo("image/jpeg");
        assertThat(response.status()).isEqualTo(PhotoStatus.AI_NOT_AVAILABLE);
        assertThat(response.linkedMealLogId()).isNull();
        assertThat(response.createdAt()).isEqualTo(createdAt);
    }

    @Test
    void toPhotoResponse_withLinkedMeal_exposesMealId() {
        MealLog meal = new MealLog();
        java.util.UUID mealId = java.util.UUID.randomUUID();
        ReflectionTestUtils.setField(meal, "id", mealId);

        PhotoLog photo = new PhotoLog();
        photo.setOriginalFilename("dinner.png");
        photo.setContentType("image/png");
        photo.setStatus(PhotoStatus.MANUALLY_COMPLETED);
        photo.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        photo.setLinkedMealLog(meal);

        PhotoLogResponse response = MealMapper.toPhotoResponse(photo);

        assertThat(response.status()).isEqualTo(PhotoStatus.MANUALLY_COMPLETED);
        assertThat(response.linkedMealLogId()).isEqualTo(mealId);
    }
}
