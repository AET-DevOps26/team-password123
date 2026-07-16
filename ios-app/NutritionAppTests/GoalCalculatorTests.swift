import XCTest
@testable import NutritionApp

final class GoalCalculatorTests: XCTestCase {

    // MARK: - BMR (Mifflin-St Jeor)

    func test_bmr_male() {
        // 10*70 + 6.25*175 - 5*30 + 5
        XCTAssertEqual(GoalCalculator.bmr(weightKg: 70, heightCm: 175, age: 30, sex: .male), 1648.75, accuracy: 0.001)
    }

    func test_bmr_female() {
        // 10*70 + 6.25*175 - 5*30 - 161
        XCTAssertEqual(GoalCalculator.bmr(weightKg: 70, heightCm: 175, age: 30, sex: .female), 1482.75, accuracy: 0.001)
    }

    func test_bmr_other_isAverageOfMaleAndFemale() {
        let male = GoalCalculator.bmr(weightKg: 70, heightCm: 175, age: 30, sex: .male)
        let female = GoalCalculator.bmr(weightKg: 70, heightCm: 175, age: 30, sex: .female)
        let other = GoalCalculator.bmr(weightKg: 70, heightCm: 175, age: 30, sex: .other)
        XCTAssertEqual(other, (male + female) / 2, accuracy: 0.001)
    }

    func test_bmr_boundaryInputs() {
        // Small elderly female: 10*40 + 6.25*140 - 5*100 - 161
        XCTAssertEqual(GoalCalculator.bmr(weightKg: 40, heightCm: 140, age: 100, sex: .female), 614, accuracy: 0.001)
        // Large young male: 10*200 + 6.25*220 - 5*18 + 5
        XCTAssertEqual(GoalCalculator.bmr(weightKg: 200, heightCm: 220, age: 18, sex: .male), 3290, accuracy: 0.001)
    }

    // MARK: - Activity multipliers / goal adjustments

    func test_activityMultipliers() {
        XCTAssertEqual(ActivityLevel.sedentary.multiplier, 1.2)
        XCTAssertEqual(ActivityLevel.light.multiplier, 1.375)
        XCTAssertEqual(ActivityLevel.moderate.multiplier, 1.55)
        XCTAssertEqual(ActivityLevel.active.multiplier, 1.725)
        XCTAssertEqual(ActivityLevel.veryActive.multiplier, 1.9)
    }

    func test_goalCalorieAdjustments() {
        XCTAssertEqual(GoalKind.lose.calorieAdjustment, -500)
        XCTAssertEqual(GoalKind.maintain.calorieAdjustment, 0)
        XCTAssertEqual(GoalKind.gain.calorieAdjustment, 400)
    }

    // MARK: - calculate

    func test_calculate_maintain_referenceCase() {
        let goals = GoalCalculator.calculate(
            weightKg: 70, heightCm: 175, age: 30, sex: .male, activity: .moderate, goal: .maintain
        )
        // TDEE = 1648.75 * 1.55 = 2555.5625
        XCTAssertEqual(goals.calories, 2556)
        XCTAssertEqual(goals.proteinGrams, 192)  // 2555.5625 * 0.30 / 4 ≈ 191.67
        XCTAssertEqual(goals.carbsGrams, 256)    // 2555.5625 * 0.40 / 4 ≈ 255.56
        XCTAssertEqual(goals.fatsGrams, 85)      // 2555.5625 * 0.30 / 9 ≈ 85.19
    }

    func test_calculate_loseAndGain_shiftCaloriesByAdjustment() {
        func calc(_ goal: GoalKind) -> CalculatedGoals {
            GoalCalculator.calculate(
                weightKg: 70, heightCm: 175, age: 30, sex: .male, activity: .moderate, goal: goal
            )
        }
        let maintain = calc(.maintain)
        XCTAssertEqual(calc(.lose).calories, maintain.calories - 500)
        XCTAssertEqual(calc(.gain).calories, maintain.calories + 400)
    }

    func test_calculate_clampsToMinimum1200() {
        // TDEE = (10*40 + 6.25*140 - 5*80 - 161) * 1.2 = 856.8; lose → 356.8 → clamped.
        let goals = GoalCalculator.calculate(
            weightKg: 40, heightCm: 140, age: 80, sex: .female, activity: .sedentary, goal: .lose
        )
        XCTAssertEqual(goals.calories, 1200)
        XCTAssertEqual(goals.proteinGrams, 90)   // 1200 * 0.30 / 4
        XCTAssertEqual(goals.carbsGrams, 120)    // 1200 * 0.40 / 4
        XCTAssertEqual(goals.fatsGrams, 40)      // 1200 * 0.30 / 9
    }

    func test_calculate_macroCaloriesAddBackUpToTarget() {
        for activity in ActivityLevel.allCases {
            for goal in GoalKind.allCases {
                let g = GoalCalculator.calculate(
                    weightKg: 82.5, heightCm: 178, age: 41, sex: .other, activity: activity, goal: goal
                )
                let kcalFromMacros = g.proteinGrams * 4 + g.carbsGrams * 4 + g.fatsGrams * 9
                // Each macro is rounded to a whole gram, so allow the rounding slack.
                XCTAssertEqual(
                    kcalFromMacros, Double(g.calories), accuracy: 10,
                    "macro split should re-sum to the calorie target (\(activity)/\(goal))"
                )
            }
        }
    }
}
