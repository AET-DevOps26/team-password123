import XCTest
import SwiftData
@testable import NutritionApp

@MainActor
final class StreakCalculatorTests: XCTestCase {
    private var container: ModelContainer!

    override func setUp() async throws {
        container = try TestSupport.makeInMemoryContainer()
    }

    /// Inserted into the in-memory context so SwiftData relationship access is safe.
    private func log(_ calories: Int, daysAgo: Int) -> FoodLog {
        let l = FoodLog(timestamp: .noon(daysAgo: daysAgo), name: "Meal", calories: calories)
        container.mainContext.insert(l)
        return l
    }

    private func streak(_ logs: [FoodLog], goal: Int = 2000) -> Int {
        StreakCalculator.currentStreak(logs: logs, dailyCalorieGoal: goal)
    }

    func test_emptyHistory_isZero() {
        XCTAssertEqual(streak([]), 0)
    }

    func test_zeroGoal_isZero() {
        XCTAssertEqual(streak([log(2000, daysAgo: 0)], goal: 0), 0)
    }

    func test_singleDayOnGoal_isOne() {
        XCTAssertEqual(streak([log(2000, daysAgo: 0)]), 1)
    }

    func test_consecutiveDaysOnGoal_countAll() {
        let logs = [log(2000, daysAgo: 0), log(1900, daysAgo: 1), log(2100, daysAgo: 2)]
        XCTAssertEqual(streak(logs), 3)
    }

    func test_multipleLogsPerDay_areSummed() {
        let logs = [log(950, daysAgo: 0), log(1000, daysAgo: 0)]
        XCTAssertEqual(streak(logs), 1)
    }

    func test_gapDay_breaksStreak() {
        // Yesterday has no logs — only today counts.
        let logs = [log(2000, daysAgo: 0), log(2000, daysAgo: 2), log(2000, daysAgo: 3)]
        XCTAssertEqual(streak(logs), 1)
    }

    func test_todayNotYetLogged_continuesFromYesterday() {
        let logs = [log(2000, daysAgo: 1), log(2000, daysAgo: 2)]
        XCTAssertEqual(streak(logs), 2)
    }

    func test_todayLoggedButOffGoal_isZero() {
        // Documented behavior: a logged day only counts when within tolerance,
        // so an off-goal today zeroes the streak even after on-goal days.
        let logs = [log(500, daysAgo: 0), log(2000, daysAgo: 1)]
        XCTAssertEqual(streak(logs), 0)
    }

    func test_offGoalPastDay_stopsCounting() {
        let logs = [log(2000, daysAgo: 0), log(3000, daysAgo: 1), log(2000, daysAgo: 2)]
        XCTAssertEqual(streak(logs), 1)
    }

    func test_toleranceBounds_tenPercent() {
        // Goal 2000 ± 10% → roughly [1800, 2200]; use off-by-one values to dodge
        // floating-point fuzz at the exact bounds.
        XCTAssertEqual(streak([log(1801, daysAgo: 0)]), 1)
        XCTAssertEqual(streak([log(2199, daysAgo: 0)]), 1)
        XCTAssertEqual(streak([log(1799, daysAgo: 0)]), 0)
        XCTAssertEqual(streak([log(2201, daysAgo: 0)]), 0)
    }
}
