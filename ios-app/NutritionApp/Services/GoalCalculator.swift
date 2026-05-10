import Foundation

struct CalculatedGoals {
    let calories: Int
    let proteinGrams: Double
    let carbsGrams: Double
    let fatsGrams: Double
}

enum GoalCalculator {
    /// Mifflin-St Jeor BMR (kcal/day).
    static func bmr(weightKg: Double, heightCm: Double, age: Int, sex: BiologicalSex) -> Double {
        let base = 10 * weightKg + 6.25 * heightCm - 5 * Double(age)
        switch sex {
        case .male: return base + 5
        case .female: return base - 161
        case .other: return base - 78  // average of the two corrections
        }
    }

    static func calculate(
        weightKg: Double,
        heightCm: Double,
        age: Int,
        sex: BiologicalSex,
        activity: ActivityLevel,
        goal: GoalKind
    ) -> CalculatedGoals {
        let tdee = bmr(weightKg: weightKg, heightCm: heightCm, age: age, sex: sex) * activity.multiplier
        let target = max(1200.0, tdee + Double(goal.calorieAdjustment))

        // Macro split: 30% protein / 40% carbs / 30% fats by calories.
        // 1g protein = 4 kcal, 1g carbs = 4 kcal, 1g fat = 9 kcal.
        let proteinG = (target * 0.30) / 4.0
        let carbsG = (target * 0.40) / 4.0
        let fatsG = (target * 0.30) / 9.0

        return CalculatedGoals(
            calories: Int(target.rounded()),
            proteinGrams: proteinG.rounded(),
            carbsGrams: carbsG.rounded(),
            fatsGrams: fatsG.rounded()
        )
    }
}
