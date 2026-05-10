import Foundation
import SwiftData

@Model
final class UserProfile {
    var displayName: String
    var email: String?
    var dailyCalorieGoal: Int
    var proteinGoalGrams: Double
    var carbsGoalGrams: Double
    var fatsGoalGrams: Double
    var createdAt: Date

    init(
        displayName: String = "Me",
        email: String? = nil,
        dailyCalorieGoal: Int = 2000,
        proteinGoalGrams: Double = 130,
        carbsGoalGrams: Double = 250,
        fatsGoalGrams: Double = 70,
        createdAt: Date = .now
    ) {
        self.displayName = displayName
        self.email = email
        self.dailyCalorieGoal = dailyCalorieGoal
        self.proteinGoalGrams = proteinGoalGrams
        self.carbsGoalGrams = carbsGoalGrams
        self.fatsGoalGrams = fatsGoalGrams
        self.createdAt = createdAt
    }
}
