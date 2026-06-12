import XCTest
import SwiftData
import UIKit
@testable import NutritionApp

/// End-to-end integration tests that run the app's REAL networking + sync code
/// (`APIClient`, `DTOMapper`, `SyncService`) against the LIVE AET backend.
/// `AppConfig.baseURL` defaults to the AET ingress, so no configuration is needed.
final class LiveIntegrationTests: XCTestCase {

    private let api = APIClient.shared

    override func setUp() {
        super.setUp()
        KeychainStore.set(nil, for: APIClient.tokenKey)
    }

    private func uniqueEmail() -> String {
        "ios-e2e-\(Int(Date().timeIntervalSince1970))-\(UUID().uuidString.prefix(6))@example.com"
    }

    private func register(_ name: String) async throws {
        let auth = try await api.register(.init(email: uniqueEmail(), password: "Test1234!", displayName: name))
        XCTAssertFalse(auth.accessToken.isEmpty)
        KeychainStore.set(auth.accessToken, for: APIClient.tokenKey)
    }

    // MARK: - 1) Full API round-trip

    func test_01_apiRoundTrip() async throws {
        try await register("E2E Bot")

        let goals = try await api.saveGoals(
            .init(dailyCalories: 2100, proteinGrams: 140, carbsGrams: 230, fatGrams: 70, fiberGrams: 30)
        )
        XCTAssertEqual(Int(goals.dailyCalories), 2100)

        let item = MealItemRequestDTO(
            name: "Automated E2E Meal", quantity: 1, unit: "serving",
            calories: 555, proteinGrams: 40, carbsGrams: 50, fatGrams: 18, fiberGrams: 0
        )
        let created = try await api.createMeal(
            .init(mealType: "LUNCH", loggedAt: DateFmt.iso(Date()), notes: "ios e2e", items: [item])
        )
        XCTAssertEqual(Int(created.calories), 555)

        let from = DateFmt.day(Calendar.current.date(byAdding: .day, value: -1, to: Date())!)
        let meals = try await api.meals(from: from, to: DateFmt.day(Date()))
        XCTAssertTrue(
            meals.contains { $0.items.first?.name == "Automated E2E Meal" },
            "the meal created via the app's APIClient should come back from the live backend"
        )

        let streak = try await api.streak()
        XCTAssertGreaterThanOrEqual(streak.streak, 0)

        try await api.deleteMeal(id: created.id)   // cleanup
    }

    // MARK: - 2) SyncService pulls live server state into the SwiftData cache

    @MainActor
    func test_02_syncPullPopulatesCache() async throws {
        try await register("Sync Bot")
        _ = try await api.saveGoals(
            .init(dailyCalories: 1900, proteinGrams: 120, carbsGrams: 200, fatGrams: 60, fiberGrams: 25)
        )
        let item = MealItemRequestDTO(
            name: "Synced Salad", quantity: 1, unit: "serving",
            calories: 333, proteinGrams: 12, carbsGrams: 30, fatGrams: 18, fiberGrams: 0
        )
        _ = try await api.createMeal(
            .init(mealType: "DINNER", loggedAt: DateFmt.iso(Date()), notes: nil, items: [item])
        )

        let container = try ModelContainer(
            for: UserProfile.self, FoodLog.self, Ingredient.self, WaterLog.self, MealTombstone.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        container.mainContext.insert(UserProfile())
        try container.mainContext.save()

        let sync = SyncService(container: container)
        await sync.sync()

        let profile = try XCTUnwrap(try container.mainContext.fetch(FetchDescriptor<UserProfile>()).first)
        XCTAssertEqual(profile.dailyCalorieGoal, 1900, "goals should be pulled from analytics-service")
        XCTAssertTrue(profile.onboardingComplete, "server-side goals => onboarding considered complete")

        let logs = try container.mainContext.fetch(FetchDescriptor<FoodLog>())
        XCTAssertTrue(
            logs.contains { $0.name == "Synced Salad" && $0.serverId != nil },
            "SyncService should pull the server meal into the SwiftData cache with a serverId"
        )
    }

    // MARK: - 3) GenAI photo analysis path

    func test_03_genaiPhotoAnalyze() async throws {
        try await register("AI Bot")
        let result = try await api.analyze(imageData: Self.solidJPEG(), filename: "meal.jpg")
        XCTAssertFalse(result.message.isEmpty, "analyze should return a response from the genai-backed endpoint")
        XCTAssertGreaterThanOrEqual(result.meal.nutrition.calories, 0)
    }

    private static func solidJPEG() -> Data {
        let size = CGSize(width: 64, height: 64)
        let image = UIGraphicsImageRenderer(size: size).image { ctx in
            UIColor.systemOrange.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
        }
        return image.jpegData(compressionQuality: 0.8) ?? Data()
    }
}
