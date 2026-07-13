package com.teampassword123.meals.service;

import com.teampassword123.meals.config.StorageProperties;
import com.teampassword123.meals.domain.MealItem;
import com.teampassword123.meals.domain.MealLog;
import com.teampassword123.meals.domain.MealType;
import com.teampassword123.meals.domain.PhotoLog;
import com.teampassword123.meals.domain.PhotoStatus;
import com.teampassword123.meals.domain.SourceType;
import com.teampassword123.meals.dto.AnalyzedMeal;
import com.teampassword123.meals.dto.ManualMealRequest;
import com.teampassword123.meals.dto.MealAnalysisResponse;
import com.teampassword123.meals.dto.MealResponse;
import com.teampassword123.meals.dto.NutritionSummary;
import com.teampassword123.meals.dto.PhotoLogResponse;
import com.teampassword123.meals.exception.BadRequestException;
import com.teampassword123.meals.exception.NotFoundException;
import com.teampassword123.meals.repository.MealLogRepository;
import com.teampassword123.meals.repository.PhotoLogRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MealService {

    private static final Logger log = LoggerFactory.getLogger(MealService.class);

    // Caps the full-body list endpoint so a single request cannot pull the whole
    // table; 400 days still fits the widest UI window (the year view). The
    // lightweight logged-dates endpoint is intentionally not capped — the streak
    // computation scans ~5 years of dates.
    private static final int MAX_LIST_RANGE_DAYS = 400;

    private final MealLogRepository meals;
    private final PhotoLogRepository photos;
    private final MealAnalyzer analyzer;
    private final Path uploadDir;
    private final MeterRegistry metrics;

    public MealService(
            MealLogRepository meals,
            PhotoLogRepository photos,
            MealAnalyzer analyzer,
            StorageProperties storageProperties,
            MeterRegistry metrics) {
        this.meals = meals;
        this.photos = photos;
        this.analyzer = analyzer;
        this.uploadDir = Path.of(storageProperties.getUploadDir()).toAbsolutePath().normalize();
        this.metrics = metrics;
    }

    @Transactional
    public MealResponse createManual(UUID userId, ManualMealRequest request) {
        MealLog meal = buildMeal(userId, request, SourceType.MANUAL);
        MealLog saved = meals.save(meal);
        recordLogged(saved, "manual");
        return MealMapper.toMealResponse(saved);
    }

    /** Bumps the meals-logged counter + calorie distribution and emits a business log line. */
    private void recordLogged(MealLog meal, String source) {
        metrics.counter("calorieasy.meals.logged", "source", source).increment();
        if (meal.getCalories() != null) {
            metrics.summary("calorieasy.meals.calories").record(meal.getCalories().doubleValue());
        }
        log.info(
                "Meal logged id={} user={} source={} kcal={} type={}",
                meal.getId(),
                meal.getUserId(),
                source,
                meal.getCalories(),
                meal.getMealType());
    }

    @Transactional(readOnly = true)
    public List<MealResponse> list(UUID userId, LocalDate from, LocalDate to, ZoneId zone) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_LIST_RANGE_DAYS) {
            throw new BadRequestException(
                    "Date range must not exceed " + MAX_LIST_RANGE_DAYS + " days");
        }
        List<MealLog> mealLogs =
                meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        userId, start(from, zone), end(to, zone));

        // Resolve every linked photo in one query, then map without per-meal lookups.
        Map<UUID, PhotoLog> photosByMeal =
                photos
                        .findByLinkedMealLogIdIn(mealLogs.stream().map(MealLog::getId).toList())
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        p -> p.getLinkedMealLog().getId(), p -> p, (a, b) -> a));

        return mealLogs.stream()
                .map(meal -> MealMapper.toMealResponse(meal, photosByMeal.get(meal.getId())))
                .toList();
    }

    // Distinct local calendar dates (in the caller's zone) that have at least one
    // meal. Serves analytics' streak computation without shipping full meal bodies.
    @Transactional(readOnly = true)
    public List<LocalDate> loggedDates(UUID userId, LocalDate from, LocalDate to, ZoneId zone) {
        if (from.isAfter(to)) {
            throw new BadRequestException("from must be on or before to");
        }
        return meals.findLoggedAtInRange(userId, start(from, zone), end(to, zone)).stream()
                .map(loggedAt -> loggedAt.atZoneSameInstant(zone).toLocalDate())
                .distinct()
                .sorted()
                .toList();
    }

    @Transactional(readOnly = true)
    public MealResponse get(UUID userId, UUID mealId) {
        MealLog meal = findOwnedMeal(userId, mealId);
        return MealMapper.toMealResponse(meal, photos.findByLinkedMealLogId(mealId).orElse(null));
    }

    @Transactional
    public MealResponse update(UUID userId, UUID mealId, ManualMealRequest request) {
        MealLog meal = findOwnedMeal(userId, mealId);
        applyMealRequest(meal, request);
        meals.save(meal);
        return MealMapper.toMealResponse(meal, photos.findByLinkedMealLogId(mealId).orElse(null));
    }

    @Transactional
    public void delete(UUID userId, UUID mealId) {
        MealLog meal = findOwnedMeal(userId, mealId);
        meals.delete(meal);
        metrics.counter("calorieasy.meals.deleted").increment();
        log.info("Meal deleted id={} user={}", mealId, userId);
    }

    @Transactional
    public PhotoLogResponse createPhoto(UUID userId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("Photo file is required");
        }

        StoredFile stored = storePhoto(file);

        PhotoLog photo = new PhotoLog();
        photo.setUserId(userId);
        photo.setOriginalFilename(stored.originalFilename());
        photo.setStoredFilename(stored.storedFilename());
        photo.setContentType(file.getContentType());
        photo.setStatus(PhotoStatus.AI_NOT_AVAILABLE);
        photo.setCreatedAt(OffsetDateTime.now());
        metrics.counter("calorieasy.meals.photo_uploads").increment();
        log.info("Photo uploaded user={} file={}", userId, stored.originalFilename());
        return MealMapper.toPhotoResponse(photos.save(photo));
    }

    @Transactional
    public MealAnalysisResponse analyzePhoto(
            UUID userId, MultipartFile image, String visionProvider, ZoneId zone) {
        if (image.isEmpty()) {
            throw new BadRequestException("Photo file is required");
        }

        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException exception) {
            throw new BadRequestException("Could not read uploaded photo");
        }

        StoredFile stored = storePhoto(image);
        MealAnalysis analysis;
        try {
            analysis = analyzer.analyze(bytes, stored.originalFilename(), visionProvider);
        } catch (RuntimeException e) {
            metrics.counter("calorieasy.meals.analyze", "result", "error").increment();
            log.error(
                    "Photo analysis failed user={} file={}: {}",
                    userId,
                    stored.originalFilename(),
                    e.toString());
            throw e;
        }
        metrics.counter("calorieasy.meals.analyze", "result", "success").increment();

        OffsetDateTime now = OffsetDateTime.now();
        MealLog meal = meals.save(buildAnalyzedMeal(userId, analysis, now, zone));
        recordLogged(meal, "photo_ai");

        PhotoLog photo = new PhotoLog();
        photo.setUserId(userId);
        photo.setOriginalFilename(stored.originalFilename());
        photo.setStoredFilename(stored.storedFilename());
        photo.setContentType(image.getContentType());
        photo.setStatus(PhotoStatus.ANALYZED);
        photo.setCreatedAt(now);
        photo.setAnalyzedAt(now);
        photo.setLinkedMealLog(meal);
        photos.save(photo);

        String imageUrl = MealMapper.photoRawUrl(photo.getId());
        AnalyzedMeal analyzedMeal =
                new AnalyzedMeal(
                        meal.getId(),
                        analysis.dishName(),
                        imageUrl,
                        new NutritionSummary(
                                analysis.calories(),
                                analysis.protein(),
                                analysis.carbs(),
                                analysis.fat()),
                        analysis.confidence(),
                        analysis.visionModel(),
                        analysis.portionGrams() == null
                                ? 0.0
                                : analysis.portionGrams().doubleValue(),
                        photo.getAnalyzedAt());
        return new MealAnalysisResponse(analyzedMeal, "Analysis complete");
    }

    @Transactional(readOnly = true)
    public StoredPhoto loadPhoto(UUID userId, UUID photoId) {
        PhotoLog photo =
                photos.findByIdAndUserId(photoId, userId)
                        .orElseThrow(() -> new NotFoundException("Photo log not found"));

        Path file = uploadDir.resolve(photo.getStoredFilename());
        Resource resource;
        try {
            resource = new UrlResource(file.toUri());
        } catch (MalformedURLException exception) {
            throw new NotFoundException("Photo file not found");
        }
        if (!resource.exists() || !resource.isReadable()) {
            throw new NotFoundException("Photo file not found");
        }
        return new StoredPhoto(resource, photo.getContentType());
    }

    @Transactional
    public MealResponse convertPhotoToManual(UUID userId, UUID photoId, ManualMealRequest request) {
        PhotoLog photo =
                photos.findByIdAndUserId(photoId, userId)
                        .orElseThrow(() -> new NotFoundException("Photo log not found"));
        if (photo.getLinkedMealLog() != null) {
            throw new BadRequestException("Photo log has already been converted");
        }

        MealLog meal = meals.save(buildMeal(userId, request, SourceType.PHOTO_MANUAL));
        recordLogged(meal, "photo_manual");
        photo.setLinkedMealLog(meal);
        photo.setStatus(PhotoStatus.MANUALLY_COMPLETED);
        photos.save(photo);
        return MealMapper.toMealResponse(meal, photo);
    }

    private StoredFile storePhoto(MultipartFile file) {
        String originalFilename =
                StringUtils.cleanPath(
                        file.getOriginalFilename() == null
                                ? "meal-photo"
                                : file.getOriginalFilename());
        String storedFilename =
                UUID.randomUUID() + "-" + originalFilename.replaceAll("[^A-Za-z0-9._-]", "_");

        try {
            Files.createDirectories(uploadDir);
            file.transferTo(uploadDir.resolve(storedFilename));
        } catch (IOException exception) {
            throw new BadRequestException("Could not store uploaded photo");
        }
        return new StoredFile(originalFilename, storedFilename);
    }

    private MealLog buildAnalyzedMeal(
            UUID userId, MealAnalysis analysis, OffsetDateTime loggedAt, ZoneId zone) {
        MealItem item = new MealItem();
        item.setName(analysis.dishName());
        item.setQuantity(
                analysis.portionGrams() == null ? BigDecimal.ONE : analysis.portionGrams());
        item.setUnit("g");
        item.setCalories(analysis.calories());
        item.setProteinGrams(analysis.protein());
        item.setCarbsGrams(analysis.carbs());
        item.setFatGrams(analysis.fat());
        item.setFiberGrams(BigDecimal.ZERO);

        MealLog meal = new MealLog();
        meal.setUserId(userId);
        meal.setSourceType(SourceType.PHOTO_AI);
        meal.setMealType(pickMealType(loggedAt, zone));
        meal.setLoggedAt(loggedAt);
        meal.setDishName(analysis.dishName());
        meal.setConfidence(BigDecimal.valueOf(analysis.confidence()));
        meal.setCalories(analysis.calories());
        meal.setProteinGrams(analysis.protein());
        meal.setCarbsGrams(analysis.carbs());
        meal.setFatGrams(analysis.fat());
        meal.setFiberGrams(BigDecimal.ZERO);
        meal.replaceItems(List.of(item));
        return meal;
    }

    private MealType pickMealType(OffsetDateTime loggedAt, ZoneId zone) {
        int hour = loggedAt.atZoneSameInstant(zone).getHour();
        if (hour < 11) {
            return MealType.BREAKFAST;
        }
        if (hour < 16) {
            return MealType.LUNCH;
        }
        if (hour < 21) {
            return MealType.DINNER;
        }
        return MealType.SNACK;
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
        List<MealItem> items = request.items().stream().map(MealMapper::toItem).toList();
        meal.replaceItems(items);
        meal.setCalories(sum(items, Nutrient.CALORIES));
        meal.setProteinGrams(sum(items, Nutrient.PROTEIN));
        meal.setCarbsGrams(sum(items, Nutrient.CARBS));
        meal.setFatGrams(sum(items, Nutrient.FAT));
        meal.setFiberGrams(sum(items, Nutrient.FIBER));
    }

    private BigDecimal sum(List<MealItem> items, Nutrient nutrient) {
        return items.stream().map(nutrient::value).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // Closed day range [start, end] bucketed in the caller's zone, expressed as
    // instants for the timestamp column: end() backs off one nanosecond from the
    // next local midnight so it pairs with the inclusive BETWEEN. Berlin 2026-05-01
    // spans 2026-04-30T22:00Z .. 2026-05-01T21:59:59.999999999Z.
    private OffsetDateTime start(LocalDate date, ZoneId zone) {
        return date.atStartOfDay(zone).toOffsetDateTime();
    }

    private OffsetDateTime end(LocalDate date, ZoneId zone) {
        return date.plusDays(1).atStartOfDay(zone).minusNanos(1).toOffsetDateTime();
    }

    private record StoredFile(String originalFilename, String storedFilename) {}

    public record StoredPhoto(Resource resource, String contentType) {}

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
