package com.teampassword123.meals.service;

import com.teampassword123.meals.config.StorageProperties;
import com.teampassword123.meals.domain.MealItem;
import com.teampassword123.meals.domain.MealLog;
import com.teampassword123.meals.domain.PhotoLog;
import com.teampassword123.meals.domain.PhotoStatus;
import com.teampassword123.meals.domain.SourceType;
import com.teampassword123.meals.dto.ManualMealRequest;
import com.teampassword123.meals.dto.MealResponse;
import com.teampassword123.meals.dto.PhotoLogResponse;
import com.teampassword123.meals.exception.BadRequestException;
import com.teampassword123.meals.exception.NotFoundException;
import com.teampassword123.meals.repository.MealLogRepository;
import com.teampassword123.meals.repository.PhotoLogRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MealService {

    private final MealLogRepository meals;
    private final PhotoLogRepository photos;
    private final Path uploadDir;

    public MealService(
            MealLogRepository meals,
            PhotoLogRepository photos,
            StorageProperties storageProperties
    ) {
        this.meals = meals;
        this.photos = photos;
        this.uploadDir = Path.of(storageProperties.getUploadDir()).toAbsolutePath().normalize();
    }

    @Transactional
    public MealResponse createManual(UUID userId, ManualMealRequest request) {
        MealLog meal = buildMeal(userId, request, SourceType.MANUAL);
        return MealMapper.toMealResponse(meals.save(meal));
    }

    @Transactional(readOnly = true)
    public List<MealResponse> list(UUID userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        return meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(userId, start(from), end(to))
                .stream()
                .map(MealMapper::toMealResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MealResponse get(UUID userId, UUID mealId) {
        return MealMapper.toMealResponse(findOwnedMeal(userId, mealId));
    }

    @Transactional
    public MealResponse update(UUID userId, UUID mealId, ManualMealRequest request) {
        MealLog meal = findOwnedMeal(userId, mealId);
        applyMealRequest(meal, request);
        return MealMapper.toMealResponse(meals.save(meal));
    }

    @Transactional
    public void delete(UUID userId, UUID mealId) {
        MealLog meal = findOwnedMeal(userId, mealId);
        meals.delete(meal);
    }

    @Transactional
    public PhotoLogResponse createPhoto(UUID userId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("Photo file is required");
        }

        String originalFilename = StringUtils.cleanPath(
                file.getOriginalFilename() == null ? "meal-photo" : file.getOriginalFilename()
        );
        String storedFilename = UUID.randomUUID() + "-" + originalFilename.replaceAll("[^A-Za-z0-9._-]", "_");

        try {
            Files.createDirectories(uploadDir);
            file.transferTo(uploadDir.resolve(storedFilename));
        } catch (IOException exception) {
            throw new BadRequestException("Could not store uploaded photo");
        }

        PhotoLog photo = new PhotoLog();
        photo.setUserId(userId);
        photo.setOriginalFilename(originalFilename);
        photo.setStoredFilename(storedFilename);
        photo.setContentType(file.getContentType());
        photo.setStatus(PhotoStatus.AI_NOT_AVAILABLE);
        photo.setCreatedAt(OffsetDateTime.now());
        return MealMapper.toPhotoResponse(photos.save(photo));
    }

    @Transactional
    public MealResponse convertPhotoToManual(UUID userId, UUID photoId, ManualMealRequest request) {
        PhotoLog photo = photos.findByIdAndUserId(photoId, userId)
                .orElseThrow(() -> new NotFoundException("Photo log not found"));
        if (photo.getLinkedMealLog() != null) {
            throw new BadRequestException("Photo log has already been converted");
        }

        MealLog meal = meals.save(buildMeal(userId, request, SourceType.PHOTO_MANUAL));
        photo.setLinkedMealLog(meal);
        photo.setStatus(PhotoStatus.MANUALLY_COMPLETED);
        photos.save(photo);
        return MealMapper.toMealResponse(meal);
    }

    private MealLog findOwnedMeal(UUID userId, UUID mealId) {
        return meals.findByIdAndUserId(mealId, userId)
                .orElseThrow(() -> new NotFoundException("Meal log not found"));
    }

    private MealLog buildMeal(UUID userId, ManualMealRequest request, SourceType sourceType) {
        MealLog meal = new MealLog();
        meal.setUserId(userId);
        meal.setSourceType(sourceType);
        applyMealRequest(meal, request);
        return meal;
    }

    private void applyMealRequest(MealLog meal, ManualMealRequest request) {
        meal.setMealType(request.mealType());
        meal.setLoggedAt(request.loggedAt() == null ? OffsetDateTime.now() : request.loggedAt());
        meal.setNotes(request.notes());
        List<MealItem> items = request.items().stream()
                .map(MealMapper::toItem)
                .toList();
        meal.replaceItems(items);
        meal.setCalories(sum(items, Nutrient.CALORIES));
        meal.setProteinGrams(sum(items, Nutrient.PROTEIN));
        meal.setCarbsGrams(sum(items, Nutrient.CARBS));
        meal.setFatGrams(sum(items, Nutrient.FAT));
        meal.setFiberGrams(sum(items, Nutrient.FIBER));
    }

    private BigDecimal sum(List<MealItem> items, Nutrient nutrient) {
        return items.stream()
                .map(nutrient::value)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private OffsetDateTime start(LocalDate date) {
        return date.atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    private OffsetDateTime end(LocalDate date) {
        return date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).minusNanos(1);
    }

    private enum Nutrient {
        CALORIES {
            BigDecimal value(MealItem item) {
                return item.getCalories();
            }
        },
        PROTEIN {
            BigDecimal value(MealItem item) {
                return item.getProteinGrams();
            }
        },
        CARBS {
            BigDecimal value(MealItem item) {
                return item.getCarbsGrams();
            }
        },
        FAT {
            BigDecimal value(MealItem item) {
                return item.getFatGrams();
            }
        },
        FIBER {
            BigDecimal value(MealItem item) {
                return item.getFiberGrams();
            }
        };

        abstract BigDecimal value(MealItem item);
    }
}
