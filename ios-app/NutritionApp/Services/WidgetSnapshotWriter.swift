import Foundation
import SwiftData
import WidgetKit

enum WidgetSnapshotWriter {
    /// Compute today's snapshot from SwiftData and persist it to the App Group container,
    /// then ask WidgetKit to refresh. Safe to call frequently — JSON write is cheap.
    @MainActor
    static func refresh(context: ModelContext) {
        guard let profile = try? context.fetch(FetchDescriptor<UserProfile>()).first else {
            return
        }
        let foodLogs = (try? context.fetch(FetchDescriptor<FoodLog>())) ?? []
        let waterLogs = (try? context.fetch(FetchDescriptor<WaterLog>())) ?? []

        let cal = Calendar.current
        let todays = foodLogs.filter { cal.isDateInToday($0.timestamp) }
        let waterToday = waterLogs
            .filter { cal.isDateInToday($0.timestamp) }
            .reduce(0) { $0 + $1.amountML }

        let streak = StreakCalculator.currentStreak(
            logs: foodLogs,
            dailyCalorieGoal: profile.dailyCalorieGoal
        )

        let snapshot = WidgetSnapshot(
            calories: todays.totalCalories,
            calorieGoal: profile.dailyCalorieGoal,
            protein: todays.totalProtein,
            proteinGoal: profile.proteinGoalGrams,
            carbs: todays.totalCarbs,
            carbsGoal: profile.carbsGoalGrams,
            fats: todays.totalFats,
            fatsGoal: profile.fatsGoalGrams,
            waterML: waterToday,
            waterGoalML: profile.waterGoalML,
            streak: streak,
            lastUpdated: .now
        )
        WidgetSnapshotStore.write(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
