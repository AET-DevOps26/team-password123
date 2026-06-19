import Foundation

// MARK: - Auth (auth-service)

struct RegisterRequestDTO: Encodable {
    let email: String
    let password: String
    let displayName: String
}

struct LoginRequestDTO: Encodable {
    let email: String
    let password: String
}

struct AuthResponseDTO: Decodable {
    let tokenType: String
    let accessToken: String
    let expiresAt: String?
    let userId: String
    let email: String
    let displayName: String
}

// MARK: - User (auth-service)

struct UserResponseDTO: Decodable {
    let id: String
    let email: String
    let displayName: String
    let createdAt: String?
    let heightCm: Int?
    let weightKg: Double?
    let age: Int?
    let sex: String?           // wire values: female | male | other
    let activityLevel: String? // sedentary | light | moderate | active | veryActive
    let goal: String?          // lose | maintain | gain
}

struct UpdateUserRequestDTO: Encodable {
    let displayName: String
    let heightCm: Int?
    let weightKg: Double?
    let age: Int?
    let sex: String?
    let activityLevel: String?
    let goal: String?
}

// MARK: - Goals (analytics-service)

struct GoalRequestDTO: Encodable {
    let dailyCalories: Double
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let fiberGrams: Double
}

struct GoalResponseDTO: Decodable {
    let id: String
    let dailyCalories: Double
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let fiberGrams: Double
    let updatedAt: String?
}

// MARK: - Analytics (analytics-service)

struct AnalyticsResponseDTO: Decodable {
    let from: String
    let to: String
    let mealCount: Int
    let calories: Double
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let fiberGrams: Double
}

struct StreakResponseDTO: Decodable {
    let streak: Int
}

// MARK: - Meals (meals-service)

struct MealItemRequestDTO: Encodable {
    let name: String
    let quantity: Double
    let unit: String
    let calories: Double
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let fiberGrams: Double
}

struct ManualMealRequestDTO: Encodable {
    let mealType: String   // BREAKFAST | LUNCH | DINNER | SNACK
    let loggedAt: String   // ISO-8601
    let notes: String?
    let items: [MealItemRequestDTO]
}

struct MealItemResponseDTO: Decodable {
    let id: String
    let name: String
    let quantity: Double
    let unit: String
    let calories: Double
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let fiberGrams: Double
}

struct MealResponseDTO: Decodable {
    let id: String
    let mealType: String
    let loggedAt: String
    let sourceType: String   // MANUAL | PHOTO_MANUAL | PHOTO_AI
    let calories: Double
    let proteinGrams: Double
    let carbsGrams: Double
    let fatGrams: Double
    let fiberGrams: Double
    let notes: String?
    let items: [MealItemResponseDTO]
}

// MARK: - Photo analysis (meals-service → genai)

struct NutritionSummaryDTO: Decodable {
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
}

struct AnalyzedMealDTO: Decodable {
    let id: String
    let dishName: String
    let imageUrl: String
    let nutrition: NutritionSummaryDTO
    let confidence: Double
    let analyzedAt: String
}

struct MealAnalysisResponseDTO: Decodable {
    let meal: AnalyzedMealDTO
    let message: String
}

// MARK: - Typed endpoints

extension APIClient {
    // auth-service
    func register(_ body: RegisterRequestDTO) async throws -> AuthResponseDTO {
        try await post("api/auth/register", body: body, authorized: false)
    }

    func login(_ body: LoginRequestDTO) async throws -> AuthResponseDTO {
        try await post("api/auth/login", body: body, authorized: false)
    }

    func currentUser() async throws -> UserResponseDTO {
        try await get("api/users/me")
    }

    func updateUser(_ body: UpdateUserRequestDTO) async throws -> UserResponseDTO {
        try await put("api/users/me", body: body)
    }

    // analytics-service
    func goals() async throws -> GoalResponseDTO? {
        try await getOptional("api/goals")
    }

    func saveGoals(_ body: GoalRequestDTO) async throws -> GoalResponseDTO {
        try await put("api/goals", body: body)
    }

    func streak() async throws -> StreakResponseDTO {
        try await get("api/analytics/streak")
    }

    func daily(date: String) async throws -> AnalyticsResponseDTO {
        try await get("api/analytics/daily?date=\(date)")
    }

    func weekly(weekStart: String) async throws -> AnalyticsResponseDTO {
        try await get("api/analytics/weekly?weekStart=\(weekStart)")
    }

    // meals-service
    func meals(from: String, to: String) async throws -> [MealResponseDTO] {
        try await get("api/meals?from=\(from)&to=\(to)")
    }

    func createMeal(_ body: ManualMealRequestDTO) async throws -> MealResponseDTO {
        try await post("api/meals/manual", body: body)
    }

    func updateMeal(id: String, _ body: ManualMealRequestDTO) async throws -> MealResponseDTO {
        try await put("api/meals/\(id)", body: body)
    }

    func deleteMeal(id: String) async throws {
        try await delete("api/meals/\(id)")
    }
}
