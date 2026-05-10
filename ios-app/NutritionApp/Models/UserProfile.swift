import Foundation
import SwiftData

enum BiologicalSex: String, CaseIterable, Identifiable {
    case female, male, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .female: return "Female"
        case .male: return "Male"
        case .other: return "Prefer not to say"
        }
    }
}

enum ActivityLevel: String, CaseIterable, Identifiable {
    case sedentary, light, moderate, active, veryActive

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sedentary: return "Sedentary (desk job, little exercise)"
        case .light: return "Lightly active (1–3 sessions/week)"
        case .moderate: return "Moderately active (3–5 sessions/week)"
        case .active: return "Active (6–7 sessions/week)"
        case .veryActive: return "Very active (twice daily / physical job)"
        }
    }

    var multiplier: Double {
        switch self {
        case .sedentary: return 1.2
        case .light: return 1.375
        case .moderate: return 1.55
        case .active: return 1.725
        case .veryActive: return 1.9
        }
    }
}

enum GoalKind: String, CaseIterable, Identifiable {
    case lose, maintain, gain

    var id: String { rawValue }

    var label: String {
        switch self {
        case .lose: return "Lose weight"
        case .maintain: return "Maintain"
        case .gain: return "Gain weight"
        }
    }

    var calorieAdjustment: Int {
        switch self {
        case .lose: return -500
        case .maintain: return 0
        case .gain: return 400
        }
    }
}

@Model
final class UserProfile {
    var displayName: String
    var email: String?
    var dailyCalorieGoal: Int
    var proteinGoalGrams: Double
    var carbsGoalGrams: Double
    var fatsGoalGrams: Double
    var createdAt: Date

    var onboardingComplete: Bool

    var heightCm: Double?
    var weightKg: Double?
    var age: Int?
    var biologicalSexRaw: String?
    var activityLevelRaw: String?
    var goalKindRaw: String?

    var waterGoalML: Int
    var remindersEnabled: Bool
    var reminderHour: Int
    var reminderMinute: Int

    init(
        displayName: String = "Me",
        email: String? = nil,
        dailyCalorieGoal: Int = 2000,
        proteinGoalGrams: Double = 130,
        carbsGoalGrams: Double = 250,
        fatsGoalGrams: Double = 70,
        createdAt: Date = .now,
        onboardingComplete: Bool = false,
        heightCm: Double? = nil,
        weightKg: Double? = nil,
        age: Int? = nil,
        biologicalSex: BiologicalSex? = nil,
        activityLevel: ActivityLevel? = nil,
        goalKind: GoalKind? = nil,
        waterGoalML: Int = 2000,
        remindersEnabled: Bool = false,
        reminderHour: Int = 19,
        reminderMinute: Int = 0
    ) {
        self.displayName = displayName
        self.email = email
        self.dailyCalorieGoal = dailyCalorieGoal
        self.proteinGoalGrams = proteinGoalGrams
        self.carbsGoalGrams = carbsGoalGrams
        self.fatsGoalGrams = fatsGoalGrams
        self.createdAt = createdAt
        self.onboardingComplete = onboardingComplete
        self.heightCm = heightCm
        self.weightKg = weightKg
        self.age = age
        self.biologicalSexRaw = biologicalSex?.rawValue
        self.activityLevelRaw = activityLevel?.rawValue
        self.goalKindRaw = goalKind?.rawValue
        self.waterGoalML = waterGoalML
        self.remindersEnabled = remindersEnabled
        self.reminderHour = reminderHour
        self.reminderMinute = reminderMinute
    }

    var biologicalSex: BiologicalSex? {
        get { biologicalSexRaw.flatMap(BiologicalSex.init(rawValue:)) }
        set { biologicalSexRaw = newValue?.rawValue }
    }

    var activityLevel: ActivityLevel? {
        get { activityLevelRaw.flatMap(ActivityLevel.init(rawValue:)) }
        set { activityLevelRaw = newValue?.rawValue }
    }

    var goalKind: GoalKind? {
        get { goalKindRaw.flatMap(GoalKind.init(rawValue:)) }
        set { goalKindRaw = newValue?.rawValue }
    }
}
