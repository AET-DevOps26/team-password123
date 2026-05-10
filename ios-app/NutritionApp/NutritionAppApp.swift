import SwiftUI
import SwiftData

@main
struct NutritionAppApp: App {
    let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(
                for: UserProfile.self,
                FoodLog.self,
                Ingredient.self,
                WaterLog.self
            )
        } catch {
            fatalError("Failed to set up SwiftData container: \(error)")
        }
        Self.seedProfileIfNeeded(container: container)
        if ProcessInfo.processInfo.arguments.contains("--seed-sample-data") {
            Self.seedSampleData(container: container)
        }
        if ProcessInfo.processInfo.arguments.contains("--skip-onboarding") {
            Self.markOnboardingComplete(container: container)
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
        let count = (try? context.fetchCount(FetchDescriptor<UserProfile>())) ?? 0
        guard count == 0 else { return }
        context.insert(UserProfile())
        try? context.save()
    }

    private static func markOnboardingComplete(container: ModelContainer) {
        let context = ModelContext(container)
        if let profile = try? context.fetch(FetchDescriptor<UserProfile>()).first {
            profile.onboardingComplete = true
            try? context.save()
        }
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

        let samples: [(name: String, daysAgo: Int, hour: Int, minute: Int, kcal: Int, p: Double, c: Double, f: Double, manual: Bool, cat: MealCategory)] = [
            ("Greek yogurt + berries", 0, 8, 15, 280, 22, 35, 6, true, .breakfast),
            ("Chicken quinoa bowl", 0, 13, 5, 620, 48, 65, 18, false, .lunch),
            ("Apple + almonds", 0, 16, 30, 240, 6, 28, 14, true, .snack),
            ("Avocado toast + egg", 1, 8, 30, 410, 18, 36, 22, true, .breakfast),
            ("Turkey wrap", 1, 12, 45, 540, 32, 52, 19, false, .lunch),
            ("Salmon, rice, broccoli", 1, 19, 0, 720, 45, 70, 28, true, .dinner),
            ("Oatmeal + banana", 2, 8, 0, 360, 12, 64, 7, true, .breakfast),
            ("Caesar salad w/ chicken", 2, 13, 0, 580, 38, 28, 34, false, .lunch),
            ("Pasta bolognese", 2, 19, 30, 780, 36, 90, 26, true, .dinner),
            ("Protein smoothie", 3, 9, 0, 320, 30, 38, 5, true, .breakfast),
            ("Sushi (8 pcs)", 3, 13, 30, 560, 26, 78, 12, false, .lunch),
            ("Steak + sweet potato", 3, 20, 0, 740, 52, 60, 28, true, .dinner),
            ("Bagel + cream cheese", 4, 8, 30, 420, 12, 58, 16, true, .breakfast),
            ("Burrito bowl", 4, 13, 0, 690, 38, 78, 22, false, .lunch),
            ("Stir-fry tofu + rice", 4, 19, 30, 580, 26, 72, 18, true, .dinner),
            ("Granola + milk", 5, 8, 0, 340, 10, 52, 9, true, .breakfast),
            ("BLT sandwich", 5, 12, 30, 520, 22, 42, 28, true, .lunch),
            ("Pizza (2 slices)", 5, 19, 0, 660, 28, 70, 24, false, .dinner),
            ("Eggs + toast", 6, 8, 30, 380, 20, 32, 16, true, .breakfast),
            ("Poke bowl", 6, 13, 0, 600, 36, 64, 20, false, .lunch),
            ("Pad Thai", 6, 19, 30, 720, 28, 86, 26, true, .dinner)
        ]

        for s in samples {
            let log = FoodLog(
                timestamp: date(daysAgo: s.daysAgo, hour: s.hour, minute: s.minute),
                name: s.name,
                isManual: s.manual,
                mealCategory: s.cat,
                calories: s.kcal,
                proteinGrams: s.p,
                carbsGrams: s.c,
                fatsGrams: s.f
            )
            context.insert(log)
        }

        // Water samples for last 7 days.
        for daysAgo in 0..<7 {
            let amounts = [250, 250, 500, 250, 350]
            for (i, amt) in amounts.enumerated() {
                let log = WaterLog(timestamp: date(daysAgo: daysAgo, hour: 9 + i * 2), amountML: amt)
                context.insert(log)
            }
        }

        // Mark onboarding as complete in seeded mode so we land on Today.
        if let profile = try? context.fetch(FetchDescriptor<UserProfile>()).first {
            profile.onboardingComplete = true
        }

        try? context.save()
    }
}
