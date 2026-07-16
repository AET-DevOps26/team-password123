import XCTest
import SwiftData
@testable import NutritionApp

final class WidgetSnapshotTests: XCTestCase {

    func test_calorieProgress_zeroGoal_isZero() {
        var snap = WidgetSnapshot.placeholder
        snap.calories = 500
        snap.calorieGoal = 0
        XCTAssertEqual(snap.calorieProgress, 0)
    }

    func test_calorieProgress_partial() {
        var snap = WidgetSnapshot.placeholder
        snap.calories = 500
        snap.calorieGoal = 2000
        XCTAssertEqual(snap.calorieProgress, 0.25)
    }

    func test_calorieProgress_capsAtOne() {
        var snap = WidgetSnapshot.placeholder
        snap.calories = 2500
        snap.calorieGoal = 2000
        XCTAssertEqual(snap.calorieProgress, 1.0)
    }

    func test_codableRoundTrip() throws {
        let original = WidgetSnapshot.placeholder
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
        XCTAssertEqual(decoded, original)
    }
}

@MainActor
final class WidgetSnapshotWriterTests: XCTestCase {

    /// End-to-end over the snapshot pipeline: SwiftData → refresh() → App Group JSON.
    func test_refresh_writesTodaysTotalsOnly() throws {
        try XCTSkipIf(
            WidgetSnapshotStore.fileURL == nil,
            "App Group container unavailable in this test environment"
        )

        let container = try TestSupport.makeInMemoryContainer()
        let context = container.mainContext
        let profile = UserProfile(
            dailyCalorieGoal: 2000, proteinGoalGrams: 130, carbsGoalGrams: 250, fatsGoalGrams: 70,
            waterGoalML: 2500
        )
        context.insert(profile)

        context.insert(FoodLog(timestamp: .noon(daysAgo: 0), name: "A", calories: 300, proteinGrams: 20, carbsGrams: 30, fatsGrams: 10))
        context.insert(FoodLog(timestamp: .noon(daysAgo: 0), name: "B", calories: 200, proteinGrams: 10, carbsGrams: 15, fatsGrams: 5))
        context.insert(FoodLog(timestamp: .noon(daysAgo: 1), name: "Yesterday", calories: 999, proteinGrams: 99, carbsGrams: 99, fatsGrams: 99))
        context.insert(WaterLog(timestamp: .noon(daysAgo: 0), amountML: 250))
        context.insert(WaterLog(timestamp: .noon(daysAgo: 0), amountML: 500))
        context.insert(WaterLog(timestamp: .noon(daysAgo: 1), amountML: 999))
        try context.save()

        WidgetSnapshotWriter.refresh(context: context)

        let snap = WidgetSnapshotStore.read()
        XCTAssertEqual(snap.calories, 500, "only today's meals count")
        XCTAssertEqual(snap.calorieGoal, 2000)
        XCTAssertEqual(snap.protein, 30)
        XCTAssertEqual(snap.proteinGoal, 130)
        XCTAssertEqual(snap.carbs, 45)
        XCTAssertEqual(snap.carbsGoal, 250)
        XCTAssertEqual(snap.fats, 15)
        XCTAssertEqual(snap.fatsGoal, 70)
        XCTAssertEqual(snap.waterML, 750, "only today's water counts")
        XCTAssertEqual(snap.waterGoalML, 2500)
        XCTAssertEqual(snap.streak, 0, "500 kcal is far off the 2000 goal, so no streak")
    }
}
