package com.teampassword123.meals.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.teampassword123.common.web.BadRequestException;
import com.teampassword123.common.web.NotFoundException;
import com.teampassword123.meals.config.StorageProperties;
import com.teampassword123.meals.domain.MealLog;
import com.teampassword123.meals.domain.MealType;
import com.teampassword123.meals.domain.PhotoLog;
import com.teampassword123.meals.domain.PhotoStatus;
import com.teampassword123.meals.domain.SourceType;
import com.teampassword123.meals.dto.ManualMealRequest;
import com.teampassword123.meals.dto.MealItemRequest;
import com.teampassword123.meals.dto.MealResponse;
import com.teampassword123.meals.dto.PhotoLogResponse;
import com.teampassword123.meals.repository.MealLogRepository;
import com.teampassword123.meals.repository.PhotoLogRepository;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class MealServiceTest {

    @Mock private MealLogRepository meals;

    @Mock private PhotoLogRepository photos;

    @Mock private MealAnalyzer analyzer;

    @TempDir Path uploadDir;

    private MealService service;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        StorageProperties storageProperties = new StorageProperties();
        storageProperties.setUploadDir(uploadDir.toString());
        service =
                new MealService(
                        meals,
                        photos,
                        analyzer,
                        storageProperties,
                        new io.micrometer.core.instrument.simple.SimpleMeterRegistry());
    }

    private static MealItemRequest item(
            String name,
            BigDecimal calories,
            BigDecimal protein,
            BigDecimal carbs,
            BigDecimal fat,
            BigDecimal fiber) {
        return new MealItemRequest(
                name, new BigDecimal("1.0"), "g", calories, protein, carbs, fat, fiber);
    }

    private static ManualMealRequest twoItemRequest() {
        return new ManualMealRequest(
                MealType.LUNCH,
                OffsetDateTime.of(2026, 5, 1, 12, 0, 0, 0, ZoneOffset.UTC),
                "tasty",
                List.of(
                        item(
                                "A",
                                new BigDecimal("100"),
                                new BigDecimal("10"),
                                new BigDecimal("20"),
                                new BigDecimal("5"),
                                new BigDecimal("1")),
                        item(
                                "B",
                                new BigDecimal("50"),
                                new BigDecimal("4"),
                                new BigDecimal("3"),
                                new BigDecimal("2"),
                                new BigDecimal("0.5"))));
    }

    @Test
    void createManual_sumsItemMacrosAndSetsManualSource() {
        when(meals.save(any(MealLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MealResponse response = service.createManual(userId, twoItemRequest());

        assertThat(response.sourceType()).isEqualTo(SourceType.MANUAL);
        assertThat(response.mealType()).isEqualTo(MealType.LUNCH);
        assertThat(response.notes()).isEqualTo("tasty");
        assertThat(response.calories()).isEqualByComparingTo("150");
        assertThat(response.proteinGrams()).isEqualByComparingTo("14");
        assertThat(response.carbsGrams()).isEqualByComparingTo("23");
        assertThat(response.fatGrams()).isEqualByComparingTo("7");
        assertThat(response.fiberGrams()).isEqualByComparingTo("1.5");
        assertThat(response.items()).hasSize(2);

        ArgumentCaptor<MealLog> captor = ArgumentCaptor.forClass(MealLog.class);
        verify(meals).save(captor.capture());
        MealLog saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getSourceType()).isEqualTo(SourceType.MANUAL);
        assertThat(saved.getItems()).hasSize(2);
        assertThat(saved.getItems().get(0).getMealLog()).isSameAs(saved);
    }

    @Test
    void createManual_withNullLoggedAt_defaultsToNow() {
        when(meals.save(any(MealLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
        OffsetDateTime before = OffsetDateTime.now();

        ManualMealRequest request =
                new ManualMealRequest(
                        MealType.BREAKFAST,
                        null,
                        null,
                        List.of(
                                item(
                                        "Oats",
                                        new BigDecimal("300"),
                                        new BigDecimal("10"),
                                        new BigDecimal("50"),
                                        new BigDecimal("6"),
                                        new BigDecimal("8"))));

        MealResponse response = service.createManual(userId, request);
        OffsetDateTime after = OffsetDateTime.now();

        assertThat(response.loggedAt()).isNotNull();
        assertThat(response.loggedAt()).isBetween(before, after);
        assertThat(response.calories()).isEqualByComparingTo("300");
    }

    @Test
    void list_whenFromAfterTo_throwsBadRequest() {
        LocalDate from = LocalDate.of(2026, 5, 10);
        LocalDate to = LocalDate.of(2026, 5, 1);

        assertThatThrownBy(() -> service.list(userId, from, to, ZoneOffset.UTC))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("from must be on or before to");

        verify(meals, never())
                .findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(any(), any(), any());
    }

    @Test
    void list_whenFromBeforeTo_mapsRepositoryResults() {
        MealLog meal = new MealLog();
        meal.setMealType(MealType.DINNER);
        meal.setLoggedAt(OffsetDateTime.of(2026, 5, 5, 19, 0, 0, 0, ZoneOffset.UTC));
        meal.setSourceType(SourceType.MANUAL);
        meal.setCalories(new BigDecimal("400"));
        meal.setProteinGrams(new BigDecimal("30"));
        meal.setCarbsGrams(new BigDecimal("40"));
        meal.setFatGrams(new BigDecimal("12"));
        meal.setFiberGrams(new BigDecimal("6"));

        when(meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of(meal));

        List<MealResponse> result =
                service.list(
                        userId,
                        LocalDate.of(2026, 5, 1),
                        LocalDate.of(2026, 5, 31),
                        ZoneOffset.UTC);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).mealType()).isEqualTo(MealType.DINNER);
        assertThat(result.get(0).calories()).isEqualByComparingTo("400");
    }

    @Test
    void list_bucketsQueryRangeInClientZone() {
        when(meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        service.list(
                userId,
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 1),
                ZoneId.of("Europe/Berlin"));

        ArgumentCaptor<OffsetDateTime> from = ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> to = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(meals)
                .findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        any(UUID.class), from.capture(), to.capture());

        // Berlin is UTC+2 in May: the local day starts at 22:00Z the previous day.
        assertThat(from.getValue().toInstant())
                .isEqualTo(OffsetDateTime.of(2026, 4, 30, 22, 0, 0, 0, ZoneOffset.UTC).toInstant());
        assertThat(to.getValue().toInstant())
                .isEqualTo(
                        OffsetDateTime.of(2026, 5, 1, 21, 59, 59, 999_999_999, ZoneOffset.UTC)
                                .toInstant());
    }

    @Test
    void list_whenRangeExceedsCap_throwsBadRequest() {
        LocalDate from = LocalDate.of(2025, 1, 1);
        LocalDate to = from.plusDays(400);

        assertThatThrownBy(() -> service.list(userId, from, to, ZoneOffset.UTC))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Date range must not exceed 400 days");

        verify(meals, never())
                .findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(any(), any(), any());
    }

    @Test
    void list_whenRangeIsExactlyCap_isAllowed() {
        when(meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        LocalDate from = LocalDate.of(2025, 1, 1);
        List<MealResponse> result = service.list(userId, from, from.plusDays(399), ZoneOffset.UTC);

        assertThat(result).isEmpty();
    }

    @Test
    void list_whenFromEqualsTo_isAllowed() {
        when(meals.findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        LocalDate sameDay = LocalDate.of(2026, 5, 5);
        List<MealResponse> result = service.list(userId, sameDay, sameDay, ZoneOffset.UTC);

        assertThat(result).isEmpty();
        verify(meals)
                .findByUserIdAndLoggedAtBetweenOrderByLoggedAtDesc(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class));
    }

    @Test
    void loggedDates_whenFromAfterTo_throwsBadRequest() {
        LocalDate from = LocalDate.of(2026, 5, 10);
        LocalDate to = LocalDate.of(2026, 5, 1);

        assertThatThrownBy(() -> service.loggedDates(userId, from, to, ZoneOffset.UTC))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("from must be on or before to");

        verify(meals, never()).findLoggedAtInRange(any(), any(), any());
    }

    @Test
    void loggedDates_deduplicatesAndBucketsByUtcDay() {
        when(meals.findLoggedAtInRange(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(
                        List.of(
                                OffsetDateTime.of(2026, 5, 2, 8, 0, 0, 0, ZoneOffset.UTC),
                                OffsetDateTime.of(2026, 5, 2, 21, 30, 0, 0, ZoneOffset.UTC),
                                // 2026-05-01T01:00+02:00 is 2026-04-30T23:00Z — must land on Apr
                                // 30.
                                OffsetDateTime.of(2026, 5, 1, 1, 0, 0, 0, ZoneOffset.ofHours(2))));

        List<LocalDate> result =
                service.loggedDates(
                        userId,
                        LocalDate.of(2026, 4, 1),
                        LocalDate.of(2026, 5, 31),
                        ZoneOffset.UTC);

        assertThat(result).containsExactly(LocalDate.of(2026, 4, 30), LocalDate.of(2026, 5, 2));
    }

    @Test
    void loggedDates_bucketsByClientZone() {
        when(meals.findLoggedAtInRange(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(
                        List.of(
                                // 22:30Z is already 00:30 next day in Berlin (UTC+2) — the local
                                // day.
                                OffsetDateTime.of(2026, 5, 1, 22, 30, 0, 0, ZoneOffset.UTC),
                                OffsetDateTime.of(2026, 5, 2, 9, 0, 0, 0, ZoneOffset.UTC)));

        List<LocalDate> result =
                service.loggedDates(
                        userId,
                        LocalDate.of(2026, 4, 1),
                        LocalDate.of(2026, 5, 31),
                        ZoneId.of("Europe/Berlin"));

        assertThat(result).containsExactly(LocalDate.of(2026, 5, 2));
    }

    @Test
    void loggedDates_bucketsQueryRangeInClientZone() {
        when(meals.findLoggedAtInRange(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        service.loggedDates(
                userId,
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 1),
                ZoneId.of("Europe/Berlin"));

        ArgumentCaptor<OffsetDateTime> from = ArgumentCaptor.forClass(OffsetDateTime.class);
        ArgumentCaptor<OffsetDateTime> to = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(meals).findLoggedAtInRange(any(UUID.class), from.capture(), to.capture());

        // Berlin is UTC+2 in May: the local day starts at 22:00Z the previous day.
        assertThat(from.getValue().toInstant())
                .isEqualTo(OffsetDateTime.of(2026, 4, 30, 22, 0, 0, 0, ZoneOffset.UTC).toInstant());
        assertThat(to.getValue().toInstant())
                .isEqualTo(
                        OffsetDateTime.of(2026, 5, 1, 21, 59, 59, 999_999_999, ZoneOffset.UTC)
                                .toInstant());
    }

    @Test
    void get_whenMealNotFound_throwsNotFound() {
        UUID mealId = UUID.randomUUID();
        when(meals.findByIdAndUserId(mealId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(userId, mealId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Meal log not found");
    }

    @Test
    void loggedDates_isNotCappedLikeList_soStreaksCanScanYears() {
        // The streak computation requests ~5 years of dates; adding the list cap
        // here would silently zero every streak. Pin the intentional asymmetry.
        when(meals.findLoggedAtInRange(
                        any(UUID.class), any(OffsetDateTime.class), any(OffsetDateTime.class)))
                .thenReturn(List.of());

        LocalDate to = LocalDate.of(2026, 5, 29);
        List<LocalDate> result =
                service.loggedDates(userId, to.minusDays(1830), to, ZoneOffset.UTC);

        assertThat(result).isEmpty();
        verify(meals).findLoggedAtInRange(any(UUID.class), any(), any());
    }

    @Test
    void update_whenMealBelongsToAnotherUser_throwsNotFoundAndNeverSaves() {
        // IDOR guard: the lookup must be scoped to the caller, so user B updating
        // user A's meal id sees a plain 404 — not a hit on the foreign row.
        UUID mealId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        when(meals.findByIdAndUserId(mealId, attackerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(attackerId, mealId, twoItemRequest()))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Meal log not found");

        verify(meals).findByIdAndUserId(mealId, attackerId);
        verify(meals, never()).save(any());
    }

    @Test
    void update_replacesItemsAndRecomputesTotals() {
        UUID mealId = UUID.randomUUID();
        MealLog existing = new MealLog();
        existing.setUserId(userId);
        existing.setSourceType(SourceType.MANUAL);
        existing.setMealType(MealType.DINNER);
        existing.setCalories(new BigDecimal("999"));
        existing.setProteinGrams(new BigDecimal("99"));
        existing.replaceItems(
                List.of(
                        MealMapper.toItem(
                                item(
                                        "Old",
                                        BigDecimal.ONE,
                                        BigDecimal.ONE,
                                        BigDecimal.ONE,
                                        BigDecimal.ONE,
                                        BigDecimal.ONE))));
        when(meals.findByIdAndUserId(mealId, userId)).thenReturn(Optional.of(existing));
        when(photos.findByLinkedMealLogId(mealId)).thenReturn(Optional.empty());

        MealResponse response = service.update(userId, mealId, twoItemRequest());

        // Totals are recomputed from the new items, not carried over.
        assertThat(response.calories()).isEqualByComparingTo("150");
        assertThat(response.proteinGrams()).isEqualByComparingTo("14");
        assertThat(response.carbsGrams()).isEqualByComparingTo("23");
        assertThat(response.fatGrams()).isEqualByComparingTo("7");
        assertThat(response.fiberGrams()).isEqualByComparingTo("1.5");
        assertThat(response.items()).hasSize(2);
        assertThat(response.mealType()).isEqualTo(MealType.LUNCH);
        // The original source is preserved: an edit does not turn a meal MANUAL.
        assertThat(response.sourceType()).isEqualTo(SourceType.MANUAL);

        verify(meals).save(existing);
        assertThat(existing.getItems()).hasSize(2);
    }

    @Test
    void loadPhoto_whenPhotoBelongsToAnotherUser_throwsNotFound() {
        UUID photoId = UUID.randomUUID();
        UUID attackerId = UUID.randomUUID();
        when(photos.findByIdAndUserId(photoId, attackerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadPhoto(attackerId, photoId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Photo log not found");
    }

    @Test
    void loadPhoto_whenStoredFileMissingOnDisk_throwsCleanNotFound() {
        // The DB row can outlive the file (volume wipe, pod reschedule): the raw
        // endpoint must degrade to a 404, not a 500 from an unreadable resource.
        UUID photoId = UUID.randomUUID();
        PhotoLog photo = new PhotoLog();
        photo.setStoredFilename("gone-forever.jpg");
        when(photos.findByIdAndUserId(photoId, userId)).thenReturn(Optional.of(photo));

        assertThatThrownBy(() -> service.loadPhoto(userId, photoId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Photo file not found");
    }

    @Test
    void loadPhoto_whenOwnedAndFileExists_returnsReadableResource() throws Exception {
        UUID photoId = UUID.randomUUID();
        PhotoLog photo = new PhotoLog();
        photo.setStoredFilename("stored-meal.jpg");
        photo.setContentType("image/jpeg");
        java.nio.file.Files.write(uploadDir.resolve("stored-meal.jpg"), jpegBytes());
        when(photos.findByIdAndUserId(photoId, userId)).thenReturn(Optional.of(photo));

        MealService.StoredPhoto stored = service.loadPhoto(userId, photoId);

        assertThat(stored.contentType()).isEqualTo("image/jpeg");
        assertThat(stored.resource().exists()).isTrue();
        assertThat(stored.resource().isReadable()).isTrue();
    }

    @Test
    void delete_whenMealNotFound_throwsNotFound() {
        UUID mealId = UUID.randomUUID();
        when(meals.findByIdAndUserId(mealId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(userId, mealId))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Meal log not found");

        verify(meals, never()).delete(any());
    }

    @Test
    void delete_whenMealOwned_deletesIt() {
        UUID mealId = UUID.randomUUID();
        MealLog meal = new MealLog();
        when(meals.findByIdAndUserId(mealId, userId)).thenReturn(Optional.of(meal));

        service.delete(userId, mealId);

        verify(meals).delete(meal);
    }

    /** A minimal payload that carries a real JPEG signature (FF D8 FF). */
    private static byte[] jpegBytes() {
        return new byte[] {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1
        };
    }

    @Test
    void createPhoto_whenFileEmpty_throwsBadRequest() {
        MockMultipartFile empty =
                new MockMultipartFile("file", "empty.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> service.createPhoto(userId, empty))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Photo file is required");

        verify(photos, never()).save(any());
    }

    @Test
    void createPhoto_whenValid_storesFileAndReturnsAiNotAvailable() {
        MockMultipartFile file =
                new MockMultipartFile("file", "meal.jpg", "image/jpeg", jpegBytes());
        when(photos.save(any(PhotoLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PhotoLogResponse response = service.createPhoto(userId, file);

        assertThat(response.status()).isEqualTo(PhotoStatus.AI_NOT_AVAILABLE);
        assertThat(response.originalFilename()).isEqualTo("meal.jpg");
        assertThat(response.contentType()).isEqualTo("image/jpeg");
        assertThat(response.linkedMealLogId()).isNull();
        assertThat(response.createdAt()).isNotNull();

        ArgumentCaptor<PhotoLog> captor = ArgumentCaptor.forClass(PhotoLog.class);
        verify(photos).save(captor.capture());
        PhotoLog saved = captor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getStatus()).isEqualTo(PhotoStatus.AI_NOT_AVAILABLE);
        assertThat(saved.getStoredFilename()).endsWith("-meal.jpg");
        assertThat(uploadDir.resolve(saved.getStoredFilename())).exists();
    }

    @Test
    void createPhoto_whenNotAnImage_throwsBadRequestAndStoresNothing() {
        MockMultipartFile pdf =
                new MockMultipartFile(
                        "file", "invoice.pdf", "application/pdf", "binarycontent".getBytes());

        assertThatThrownBy(() -> service.createPhoto(userId, pdf))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only image uploads are supported");

        verify(photos, never()).save(any());
        assertThat(uploadDir).isEmptyDirectory();
    }

    @Test
    void createPhoto_whenContentTypeSpoofed_throwsBadRequestAndStoresNothing() {
        // Declared image/jpeg, but the payload carries no image signature.
        MockMultipartFile spoofed =
                new MockMultipartFile(
                        "file", "meal.jpg", "image/jpeg", "%PDF-1.7 not a photo".getBytes());

        assertThatThrownBy(() -> service.createPhoto(userId, spoofed))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only image uploads are supported");

        verify(photos, never()).save(any());
        assertThat(uploadDir).isEmptyDirectory();
    }

    @Test
    void analyzePhoto_whenNotAnImage_throwsBadRequestAndStoresNothing() {
        MockMultipartFile pdf =
                new MockMultipartFile(
                        "file", "invoice.pdf", "application/pdf", "binarycontent".getBytes());

        assertThatThrownBy(() -> service.analyzePhoto(userId, pdf, null, ZoneOffset.UTC))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Only image uploads are supported");

        verify(analyzer, never()).analyze(any(), any(), any());
        assertThat(uploadDir).isEmptyDirectory();
    }

    @Test
    void analyzePhoto_whenAnalyzerFails_deletesStoredFile() {
        MockMultipartFile file =
                new MockMultipartFile("file", "meal.jpg", "image/jpeg", jpegBytes());
        when(analyzer.analyze(any(), any(), any())).thenThrow(new IllegalStateException("boom"));

        assertThatThrownBy(() -> service.analyzePhoto(userId, file, null, ZoneOffset.UTC))
                .isInstanceOf(IllegalStateException.class);

        verify(meals, never()).save(any());
        assertThat(uploadDir).isEmptyDirectory();
    }

    @Test
    void convertPhotoToManual_whenPhotoNotFound_throwsNotFound() {
        UUID photoId = UUID.randomUUID();
        when(photos.findByIdAndUserId(photoId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.convertPhotoToManual(userId, photoId, twoItemRequest()))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Photo log not found");

        verify(meals, never()).save(any());
    }

    @Test
    void convertPhotoToManual_whenAlreadyLinked_throwsBadRequest() {
        UUID photoId = UUID.randomUUID();
        PhotoLog photo = new PhotoLog();
        photo.setLinkedMealLog(new MealLog());
        when(photos.findByIdAndUserId(photoId, userId)).thenReturn(Optional.of(photo));

        assertThatThrownBy(() -> service.convertPhotoToManual(userId, photoId, twoItemRequest()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Photo log has already been converted");

        verify(meals, never()).save(any());
    }

    @Test
    void convertPhotoToManual_whenUnlinked_createsPhotoManualMealAndMarksCompleted() {
        UUID photoId = UUID.randomUUID();
        PhotoLog photo = new PhotoLog();
        ReflectionTestUtils.setField(photo, "id", photoId);
        photo.setStatus(PhotoStatus.AI_NOT_AVAILABLE);
        when(photos.findByIdAndUserId(photoId, userId)).thenReturn(Optional.of(photo));
        when(meals.save(any(MealLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(photos.save(any(PhotoLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MealResponse response = service.convertPhotoToManual(userId, photoId, twoItemRequest());

        assertThat(response.sourceType()).isEqualTo(SourceType.PHOTO_MANUAL);
        assertThat(response.calories()).isEqualByComparingTo("150");
        assertThat(response.photoUrl()).isEqualTo("/api/meals/photo/" + photoId + "/raw");

        assertThat(photo.getStatus()).isEqualTo(PhotoStatus.MANUALLY_COMPLETED);
        assertThat(photo.getLinkedMealLog()).isNotNull();
        assertThat(photo.getLinkedMealLog().getSourceType()).isEqualTo(SourceType.PHOTO_MANUAL);

        verify(meals, times(1)).save(any(MealLog.class));
        verify(photos, times(1)).save(photo);
    }
}
