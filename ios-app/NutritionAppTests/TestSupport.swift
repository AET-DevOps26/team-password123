import Foundation
import SwiftData
@testable import NutritionApp

/// Shared helpers for unit tests. All SwiftData work goes through an in-memory
/// container so tests never touch the app's persistent store.
enum TestSupport {
    static func makeInMemoryContainer() throws -> ModelContainer {
        try ModelContainer(
            for: UserProfile.self, FoodLog.self, Ingredient.self, WaterLog.self, MealTombstone.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
    }
}

extension Date {
    /// Noon local time, `days` before today — anchoring mid-day keeps the
    /// timestamp safely inside its calendar day regardless of when tests run.
    static func noon(daysAgo days: Int) -> Date {
        let cal = Calendar.current
        let start = cal.startOfDay(for: .now)
        let day = cal.date(byAdding: .day, value: -days, to: start)!
        return cal.date(byAdding: .hour, value: 12, to: day)!
    }
}
