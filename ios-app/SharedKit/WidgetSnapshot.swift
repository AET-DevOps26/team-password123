import Foundation

/// JSON snapshot of today's totals, written by the app and read by the widget.
/// Sharing happens via the App Group container; if the group is unreachable
/// (e.g. unsigned builds without provisioning), readers fall back to a default.
struct WidgetSnapshot: Codable, Equatable {
    var calories: Int
    var calorieGoal: Int
    var protein: Double
    var proteinGoal: Double
    var carbs: Double
    var carbsGoal: Double
    var fats: Double
    var fatsGoal: Double
    var waterML: Int
    var waterGoalML: Int
    var streak: Int
    var lastUpdated: Date

    static let placeholder = WidgetSnapshot(
        calories: 1140,
        calorieGoal: 2000,
        protein: 76,
        proteinGoal: 130,
        carbs: 128,
        carbsGoal: 250,
        fats: 38,
        fatsGoal: 70,
        waterML: 1250,
        waterGoalML: 2000,
        streak: 4,
        lastUpdated: .now
    )

    var calorieProgress: Double {
        guard calorieGoal > 0 else { return 0 }
        return min(Double(calories) / Double(calorieGoal), 1.0)
    }
}

enum WidgetSnapshotStore {
    static let appGroupID = "group.com.password123.NutritionApp"
    static let fileName = "today-snapshot.json"

    static var fileURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupID)?
            .appendingPathComponent(fileName)
    }

    static func read() -> WidgetSnapshot {
        guard let url = fileURL,
              let data = try? Data(contentsOf: url),
              let snap = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
        else { return .placeholder }
        return snap
    }

    static func write(_ snapshot: WidgetSnapshot) {
        guard let url = fileURL else { return }
        let data = try? JSONEncoder().encode(snapshot)
        try? data?.write(to: url, options: .atomic)
    }
}
