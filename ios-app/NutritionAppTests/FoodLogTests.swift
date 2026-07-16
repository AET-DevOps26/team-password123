import XCTest
import SwiftData
@testable import NutritionApp

@MainActor
final class FoodLogTests: XCTestCase {
    private var container: ModelContainer!
    private var context: ModelContext { container.mainContext }

    override func setUp() async throws {
        container = try TestSupport.makeInMemoryContainer()
    }

    private func makeLog(
        servings: Double = 1.0,
        calories: Int = 0,
        protein: Double = 0,
        carbs: Double = 0,
        fats: Double = 0
    ) -> FoodLog {
        let log = FoodLog(
            name: "Meal", servings: servings,
            calories: calories, proteinGrams: protein, carbsGrams: carbs, fatsGrams: fats
        )
        context.insert(log)
        return log
    }

    private func addIngredients(_ log: FoodLog, _ specs: [(cal: Int, p: Double, c: Double, f: Double)]) {
        var ingredients: [Ingredient] = []
        for (i, spec) in specs.enumerated() {
            let ing = Ingredient(
                name: "Ingredient \(i)", calories: spec.cal,
                proteinGrams: spec.p, carbsGrams: spec.c, fatsGrams: spec.f, order: i
            )
            context.insert(ing)
            ingredients.append(ing)
        }
        log.ingredients = ingredients
    }

    // MARK: - effective* without ingredients

    func test_noIngredients_usesOwnMacros() {
        let log = makeLog(calories: 400, protein: 25, carbs: 50, fats: 12)
        XCTAssertEqual(log.effectiveCalories, 400)
        XCTAssertEqual(log.effectiveProtein, 25)
        XCTAssertEqual(log.effectiveCarbs, 50)
        XCTAssertEqual(log.effectiveFats, 12)
    }

    func test_emptyIngredientArray_fallsBackToOwnMacros() {
        let log = makeLog(calories: 400, protein: 25)
        log.ingredients = []
        XCTAssertEqual(log.effectiveCalories, 400)
        XCTAssertEqual(log.effectiveProtein, 25)
        XCTAssertFalse(log.hasIngredientBreakdown)
    }

    // MARK: - effective* with ingredients

    func test_ingredients_overrideOwnMacros() {
        // Own macros deliberately bogus — the ingredient sum must win.
        let log = makeLog(calories: 999, protein: 999, carbs: 999, fats: 999)
        addIngredients(log, [(100, 8, 10, 2), (200, 12, 20, 6)])
        XCTAssertEqual(log.effectiveCalories, 300)
        XCTAssertEqual(log.effectiveProtein, 20)
        XCTAssertEqual(log.effectiveCarbs, 30)
        XCTAssertEqual(log.effectiveFats, 8)
        XCTAssertTrue(log.hasIngredientBreakdown)
    }

    // MARK: - servings multiplier

    func test_servingsMultiplier_scalesAllMacros() {
        let log = makeLog(servings: 2, calories: 400, protein: 25, carbs: 50, fats: 12)
        XCTAssertEqual(log.effectiveCalories, 800)
        XCTAssertEqual(log.effectiveProtein, 50)
        XCTAssertEqual(log.effectiveCarbs, 100)
        XCTAssertEqual(log.effectiveFats, 24)
    }

    func test_servingsZero_zeroesEverything() {
        let log = makeLog(servings: 0, calories: 400, protein: 25, carbs: 50, fats: 12)
        XCTAssertEqual(log.effectiveCalories, 0)
        XCTAssertEqual(log.effectiveProtein, 0)
        XCTAssertEqual(log.effectiveCarbs, 0)
        XCTAssertEqual(log.effectiveFats, 0)
    }

    func test_fractionalServings_roundCalories() {
        // 333 * 0.5 = 166.5 → .rounded() rounds half away from zero → 167
        let log = makeLog(servings: 0.5, calories: 333, protein: 10)
        XCTAssertEqual(log.effectiveCalories, 167)
        XCTAssertEqual(log.effectiveProtein, 5)
    }

    func test_servingsApplyToIngredientSums() {
        let log = makeLog(servings: 1.5)
        addIngredients(log, [(100, 8, 10, 2), (200, 12, 20, 6)])
        XCTAssertEqual(log.effectiveCalories, 450)
        XCTAssertEqual(log.effectiveProtein, 30)
    }

    // MARK: - category inference

    func test_categoryForHour_boundaries() {
        XCTAssertEqual(MealCategory.category(forHour: 4), .snack)
        XCTAssertEqual(MealCategory.category(forHour: 5), .breakfast)
        XCTAssertEqual(MealCategory.category(forHour: 10), .breakfast)
        XCTAssertEqual(MealCategory.category(forHour: 11), .lunch)
        XCTAssertEqual(MealCategory.category(forHour: 14), .lunch)
        XCTAssertEqual(MealCategory.category(forHour: 15), .snack)  // 15–17 gap = snack window
        XCTAssertEqual(MealCategory.category(forHour: 16), .snack)
        XCTAssertEqual(MealCategory.category(forHour: 17), .dinner)
        XCTAssertEqual(MealCategory.category(forHour: 21), .dinner)
        XCTAssertEqual(MealCategory.category(forHour: 22), .snack)
        XCTAssertEqual(MealCategory.category(forHour: 0), .snack)
    }

    func test_inferredCategory_prefersExplicitCategory() {
        let log = FoodLog(name: "Meal", mealCategory: .dinner)
        context.insert(log)
        XCTAssertEqual(log.inferredCategory, .dinner)
    }

    func test_inferredCategory_fallsBackToTimestampHour() {
        let morning = Calendar.current.date(
            bySettingHour: 8, minute: 0, second: 0, of: .now
        )!
        let log = FoodLog(timestamp: morning, name: "Meal")
        context.insert(log)
        XCTAssertEqual(log.inferredCategory, .breakfast)
    }

    // MARK: - array totals

    func test_arrayTotals_sumEffectiveValues() {
        let a = makeLog(servings: 2, calories: 100, protein: 10, carbs: 20, fats: 5)
        let b = makeLog(calories: 300, protein: 15, carbs: 30, fats: 10)
        let logs = [a, b]
        XCTAssertEqual(logs.totalCalories, 500)
        XCTAssertEqual(logs.totalProtein, 35)
        XCTAssertEqual(logs.totalCarbs, 70)
        XCTAssertEqual(logs.totalFats, 20)
    }
}
