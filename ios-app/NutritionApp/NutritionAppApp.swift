import SwiftUI
import SwiftData

@main
struct NutritionAppApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(for: UserProfile.self, FoodLog.self)
        } catch {
            fatalError("Failed to set up SwiftData container: \(error)")
        }
        Self.seedProfileIfNeeded(container: container)
        if ProcessInfo.processInfo.arguments.contains("--seed-sample-data") {
            Self.seedSampleData(container: container)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
        }
        .modelContainer(container)
    }

    private static func seedProfileIfNeeded(container: ModelContainer) {
        let context = ModelContext(container)
        let descriptor = FetchDescriptor<UserProfile>()
        let count = (try? context.fetchCount(descriptor)) ?? 0
        guard count == 0 else { return }
        context.insert(UserProfile())
        try? context.save()
    }

    private static func seedSampleData(container: ModelContainer) {
        let context = ModelContext(container)
        let existing = (try? context.fetchCount(FetchDescriptor<FoodLog>())) ?? 0
        guard existing == 0 else { return }

        let cal = Calendar.current
        let now = Date.now
        func date(daysAgo: Int, hour: Int, minute: Int = 0) -> Date {
            let day = cal.date(byAdding: .day, value: -daysAgo, to: now)!
            return cal.date(bySettingHour: hour, minute: minute, second: 0, of: day)!
        }

        let samples: [(name: String, daysAgo: Int, hour: Int, minute: Int, kcal: Int, p: Double, c: Double, f: Double, manual: Bool)] = [
            ("Greek yogurt + berries", 0, 8, 15, 280, 22, 35, 6, true),
            ("Chicken quinoa bowl", 0, 13, 5, 620, 48, 65, 18, false),
            ("Apple + almonds", 0, 16, 30, 240, 6, 28, 14, true),
            ("Avocado toast + egg", 1, 8, 30, 410, 18, 36, 22, true),
            ("Turkey wrap", 1, 12, 45, 540, 32, 52, 19, false),
            ("Salmon, rice, broccoli", 1, 19, 0, 720, 45, 70, 28, true),
            ("Oatmeal + banana", 2, 8, 0, 360, 12, 64, 7, true),
            ("Caesar salad w/ chicken", 2, 13, 0, 580, 38, 28, 34, false),
            ("Pasta bolognese", 2, 19, 30, 780, 36, 90, 26, true),
            ("Protein smoothie", 3, 9, 0, 320, 30, 38, 5, true),
            ("Sushi (8 pcs)", 3, 13, 30, 560, 26, 78, 12, false),
            ("Steak + sweet potato", 3, 20, 0, 740, 52, 60, 28, true),
            ("Bagel + cream cheese", 4, 8, 30, 420, 12, 58, 16, true),
            ("Burrito bowl", 4, 13, 0, 690, 38, 78, 22, false),
            ("Stir-fry tofu + rice", 4, 19, 30, 580, 26, 72, 18, true),
            ("Granola + milk", 5, 8, 0, 340, 10, 52, 9, true),
            ("BLT sandwich", 5, 12, 30, 520, 22, 42, 28, true),
            ("Pizza (2 slices)", 5, 19, 0, 660, 28, 70, 24, false),
            ("Eggs + toast", 6, 8, 30, 380, 20, 32, 16, true),
            ("Poke bowl", 6, 13, 0, 600, 36, 64, 20, false),
            ("Pad Thai", 6, 19, 30, 720, 28, 86, 26, true)
        ]

        for s in samples {
            let log = FoodLog(
                timestamp: date(daysAgo: s.daysAgo, hour: s.hour, minute: s.minute),
                name: s.name,
                isManual: s.manual,
                calories: s.kcal,
                proteinGrams: s.p,
                carbsGrams: s.c,
                fatsGrams: s.f
            )
            context.insert(log)
        }
        try? context.save()
    }
}
