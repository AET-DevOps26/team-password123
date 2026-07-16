import XCTest
import SwiftData
@testable import NutritionApp

/// Unit tests for the DTO ↔ SwiftData mapping layer and date handling used by
/// `SyncService`, plus the offline tombstone semantics. No network involved.
@MainActor
final class SyncMappingTests: XCTestCase {
    private var container: ModelContainer!
    private var context: ModelContext { container.mainContext }

    override func setUp() async throws {
        container = try TestSupport.makeInMemoryContainer()
    }

    private func mealDTO(
        id: String = "srv-1",
        mealType: String = "LUNCH",
        loggedAt: String = "2026-07-10T12:30:00.500Z",
        sourceType: String = "MANUAL",
        calories: Double = 456.6,
        notes: String? = nil,
        itemNames: [String] = ["Burrito"]
    ) -> MealResponseDTO {
        let items = itemNames.map {
            MealItemResponseDTO(
                id: UUID().uuidString, name: $0, quantity: 1, unit: "serving",
                calories: calories, proteinGrams: 30.5, carbsGrams: 50.5, fatGrams: 12.5, fiberGrams: 0
            )
        }
        return MealResponseDTO(
            id: id, mealType: mealType, loggedAt: loggedAt, sourceType: sourceType,
            calories: calories, proteinGrams: 30.5, carbsGrams: 50.5, fatGrams: 12.5, fiberGrams: 0,
            notes: notes, items: items
        )
    }

    // MARK: - FoodLog → ManualMealRequestDTO

    func test_manualRequest_collapsesToSingleItemWithEffectiveTotals() throws {
        let log = FoodLog(
            name: "Pasta", notes: "extra cheese", mealCategory: .dinner, servings: 2,
            calories: 300, proteinGrams: 20, carbsGrams: 30, fatsGrams: 10
        )
        context.insert(log)

        let request = DTOMapper.manualRequest(from: log)

        XCTAssertEqual(request.mealType, "DINNER")
        XCTAssertEqual(request.notes, "extra cheese")
        XCTAssertEqual(request.loggedAt, DateFmt.iso(log.timestamp))
        XCTAssertEqual(request.items.count, 1)
        let item = try XCTUnwrap(request.items.first)
        XCTAssertEqual(item.name, "Pasta")
        XCTAssertEqual(item.quantity, 1)
        XCTAssertEqual(item.unit, "serving")
        // servings-applied totals, matching the web client's convention
        XCTAssertEqual(item.calories, 600)
        XCTAssertEqual(item.proteinGrams, 40)
        XCTAssertEqual(item.carbsGrams, 60)
        XCTAssertEqual(item.fatGrams, 20)
        XCTAssertEqual(item.fiberGrams, 0)
    }

    func test_manualRequest_emptyName_fallsBackToCategoryLabel() {
        let log = FoodLog(name: "", mealCategory: .lunch, calories: 100)
        context.insert(log)
        let request = DTOMapper.manualRequest(from: log)
        XCTAssertEqual(request.items.first?.name, "Lunch")
        XCTAssertEqual(request.mealType, "LUNCH")
    }

    // MARK: - MealResponseDTO → FoodLog

    func test_foodLog_fromDTO_mapsAllFields() {
        let dto = mealDTO(sourceType: "PHOTO_AI", notes: "ai note")
        let log = DTOMapper.foodLog(from: dto)

        XCTAssertEqual(log.serverId, "srv-1")
        XCTAssertEqual(log.name, "Burrito")
        XCTAssertEqual(log.notes, "ai note")
        XCTAssertEqual(log.mealCategory, .lunch)
        XCTAssertFalse(log.isManual, "PHOTO_AI meals must not be flagged manual")
        XCTAssertEqual(log.calories, 457)  // 456.6 rounded
        XCTAssertEqual(log.proteinGrams, 30.5)
        XCTAssertEqual(log.carbsGrams, 50.5)
        XCTAssertEqual(log.fatsGrams, 12.5)
        XCTAssertEqual(log.servings, 1)
        // SwiftData surfaces a cleared to-many relationship as [] rather than nil.
        XCTAssertTrue((log.ingredients ?? []).isEmpty, "server payload carries no breakdown")
        XCTAssertFalse(log.dirty)
        XCTAssertEqual(log.timestamp, DateFmt.date("2026-07-10T12:30:00.500Z"))
    }

    func test_foodLog_manualSource_isManual() {
        XCTAssertTrue(DTOMapper.foodLog(from: mealDTO(sourceType: "MANUAL")).isManual)
        XCTAssertTrue(DTOMapper.foodLog(from: mealDTO(sourceType: "PHOTO_MANUAL")).isManual)
    }

    func test_update_nameFallbacks_itemThenNotesThenExisting() {
        XCTAssertEqual(DTOMapper.foodLog(from: mealDTO(notes: "note", itemNames: ["Item"])).name, "Item")
        XCTAssertEqual(DTOMapper.foodLog(from: mealDTO(notes: "note", itemNames: [])).name, "note")

        let existing = FoodLog(name: "Keep me", calories: 10)
        context.insert(existing)
        DTOMapper.update(existing, from: mealDTO(notes: nil, itemNames: []))
        XCTAssertEqual(existing.name, "Keep me")
    }

    func test_update_resetsServingsAndClearsIngredients() {
        let log = FoodLog(name: "Local", servings: 3, calories: 100)
        context.insert(log)
        let ingredient = Ingredient(name: "Cheese", calories: 50)
        context.insert(ingredient)
        log.ingredients = [ingredient]

        DTOMapper.update(log, from: mealDTO())

        XCTAssertEqual(log.servings, 1, "server totals already include quantities")
        XCTAssertEqual(log.ingredients ?? [], [], "server payload carries no breakdown")
    }

    // MARK: - UserResponseDTO / GoalResponseDTO → UserProfile

    func test_apply_userDTO_mapsAllFields() {
        let profile = UserProfile()
        let dto = UserResponseDTO(
            id: "user-9", email: "a@b.c", displayName: "Deniz", createdAt: nil,
            heightCm: 175, weightKg: 82.5, age: 41, sex: "male", activityLevel: "veryActive", goal: "gain"
        )
        DTOMapper.apply(dto, to: profile)

        XCTAssertEqual(profile.serverId, "user-9")
        XCTAssertEqual(profile.email, "a@b.c")
        XCTAssertEqual(profile.displayName, "Deniz")
        XCTAssertEqual(profile.heightCm, 175)
        XCTAssertEqual(profile.weightKg, 82.5)
        XCTAssertEqual(profile.age, 41)
        XCTAssertEqual(profile.biologicalSex, .male)
        XCTAssertEqual(profile.activityLevel, .veryActive)
        XCTAssertEqual(profile.goalKind, .gain)
    }

    func test_apply_userDTO_nilFields_keepLocalValues() {
        let profile = UserProfile(heightCm: 180, weightKg: 80, age: 30, biologicalSex: .female)
        let dto = UserResponseDTO(
            id: "user-9", email: "a@b.c", displayName: "Deniz", createdAt: nil,
            heightCm: nil, weightKg: nil, age: nil, sex: nil, activityLevel: nil, goal: nil
        )
        DTOMapper.apply(dto, to: profile)

        XCTAssertEqual(profile.heightCm, 180)
        XCTAssertEqual(profile.weightKg, 80)
        XCTAssertEqual(profile.age, 30)
        XCTAssertEqual(profile.biologicalSex, .female)
    }

    func test_apply_goalDTO_roundsCalories() {
        let profile = UserProfile()
        let dto = GoalResponseDTO(
            id: "g-1", dailyCalories: 2100.6, proteinGrams: 140, carbsGrams: 230, fatGrams: 70,
            fiberGrams: 30, updatedAt: nil
        )
        DTOMapper.apply(dto, to: profile)

        XCTAssertEqual(profile.dailyCalorieGoal, 2101)
        XCTAssertEqual(profile.proteinGoalGrams, 140)
        XCTAssertEqual(profile.carbsGoalGrams, 230)
        XCTAssertEqual(profile.fatsGoalGrams, 70)
    }

    func test_updateRequest_roundsHeightToWholeCentimeters() {
        let profile = UserProfile(
            displayName: "Deniz", heightCm: 175.6, weightKg: 82.5, age: 41,
            biologicalSex: .other, activityLevel: .light, goalKind: .lose
        )
        let request = DTOMapper.updateRequest(from: profile)

        XCTAssertEqual(request.displayName, "Deniz")
        XCTAssertEqual(request.heightCm, 176)
        XCTAssertEqual(request.weightKg, 82.5)
        XCTAssertEqual(request.age, 41)
        XCTAssertEqual(request.sex, "other")
        XCTAssertEqual(request.activityLevel, "light")
        XCTAssertEqual(request.goal, "lose")
    }

    func test_goalRequest_mapsGoals() {
        let profile = UserProfile(dailyCalorieGoal: 2100, proteinGoalGrams: 140, carbsGoalGrams: 230, fatsGoalGrams: 70)
        let request = DTOMapper.goalRequest(from: profile)

        XCTAssertEqual(request.dailyCalories, 2100)
        XCTAssertEqual(request.proteinGrams, 140)
        XCTAssertEqual(request.carbsGrams, 230)
        XCTAssertEqual(request.fatGrams, 70)
        XCTAssertEqual(request.fiberGrams, 0)
    }

    // MARK: - DateFmt

    private func utcDate(
        _ year: Int, _ month: Int, _ day: Int, _ hour: Int = 0, _ minute: Int = 0, _ second: Int = 0
    ) -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal.date(from: DateComponents(year: year, month: month, day: day, hour: hour, minute: minute, second: second))!
    }

    func test_day_formatsInUTC() {
        XCTAssertEqual(DateFmt.day(Date(timeIntervalSince1970: 0)), "1970-01-01")
        XCTAssertEqual(DateFmt.day(Date(timeIntervalSince1970: 86_399)), "1970-01-01")
        XCTAssertEqual(DateFmt.day(Date(timeIntervalSince1970: 86_400)), "1970-01-02")
    }

    func test_iso_roundTripsThroughDate() throws {
        let original = Date(timeIntervalSince1970: 1_752_600_000.123)
        let parsed = try XCTUnwrap(DateFmt.date(DateFmt.iso(original)))
        XCTAssertEqual(parsed.timeIntervalSince1970, original.timeIntervalSince1970, accuracy: 0.002)
    }

    func test_date_parsesPlainAndFractionalISO() throws {
        let plain = try XCTUnwrap(DateFmt.date("2026-07-16T10:00:00Z"))
        XCTAssertEqual(plain, utcDate(2026, 7, 16, 10))

        let fractional = try XCTUnwrap(DateFmt.date("2026-07-16T10:00:00.500Z"))
        XCTAssertEqual(fractional.timeIntervalSince1970, utcDate(2026, 7, 16, 10).timeIntervalSince1970 + 0.5, accuracy: 0.002)
    }

    func test_date_padsShortFractions() throws {
        // Backend suppresses trailing zeros: ".12Z" must parse as 120 ms.
        let short = try XCTUnwrap(DateFmt.date("2026-07-16T10:00:00.12Z"))
        let full = try XCTUnwrap(DateFmt.date("2026-07-16T10:00:00.120Z"))
        XCTAssertEqual(short.timeIntervalSince1970, full.timeIntervalSince1970, accuracy: 0.0001)
    }

    func test_date_trimsNanosecondFractions() throws {
        let nanos = try XCTUnwrap(DateFmt.date("2026-07-16T10:00:00.123456789Z"))
        let millis = try XCTUnwrap(DateFmt.date("2026-07-16T10:00:00.123Z"))
        XCTAssertEqual(nanos.timeIntervalSince1970, millis.timeIntervalSince1970, accuracy: 0.001)
    }

    func test_date_parsesOffsetTimezones() throws {
        let offset = try XCTUnwrap(DateFmt.date("2026-07-16T12:00:00+02:00"))
        XCTAssertEqual(offset, utcDate(2026, 7, 16, 10))
    }

    func test_date_invalidString_returnsNil() {
        XCTAssertNil(DateFmt.date("not-a-date"))
        XCTAssertNil(DateFmt.date(""))
    }

    // MARK: - Offline delete → tombstone

    func test_deleteMeal_syncedMeal_whileOffline_leavesTombstone() async throws {
        KeychainStore.set(nil, for: APIClient.tokenKey)  // no token → SyncService can't reach the backend

        let sync = SyncService(container: container)
        let log = FoodLog(name: "Synced meal", calories: 100)
        log.serverId = "srv-42"
        context.insert(log)
        try context.save()

        sync.deleteMeal(log)

        // The push runs in a fire-and-forget MainActor task; yield until it lands.
        var tombstones: [MealTombstone] = []
        for _ in 0..<500 {
            await Task.yield()
            tombstones = try context.fetch(FetchDescriptor<MealTombstone>())
            if !tombstones.isEmpty { break }
        }

        XCTAssertEqual(tombstones.map(\.serverId), ["srv-42"], "offline delete of a synced meal must queue a tombstone")
        XCTAssertTrue(try context.fetch(FetchDescriptor<FoodLog>()).isEmpty, "the local row is removed immediately")
    }

    func test_deleteMeal_localOnlyMeal_leavesNoTombstone() async throws {
        KeychainStore.set(nil, for: APIClient.tokenKey)

        let sync = SyncService(container: container)
        let log = FoodLog(name: "Never synced", calories: 100)  // serverId == nil
        context.insert(log)
        try context.save()

        sync.deleteMeal(log)
        for _ in 0..<50 { await Task.yield() }

        XCTAssertTrue(try context.fetch(FetchDescriptor<MealTombstone>()).isEmpty, "nothing to delete server-side")
        XCTAssertTrue(try context.fetch(FetchDescriptor<FoodLog>()).isEmpty)
    }
}
