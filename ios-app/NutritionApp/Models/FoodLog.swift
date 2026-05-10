import Foundation
import SwiftData

enum MealCategory: String, CaseIterable, Identifiable {
    case breakfast, lunch, dinner, snack

    var id: String { rawValue }

    var label: String {
        switch self {
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        case .snack: return "Snack"
        }
    }

    var systemImage: String {
        switch self {
        case .breakfast: return "sunrise"
        case .lunch: return "sun.max"
        case .dinner: return "moon.stars"
        case .snack: return "leaf"
        }
    }

    static func category(forHour hour: Int) -> MealCategory {
        switch hour {
        case 5..<11: return .breakfast
        case 11..<15: return .lunch
        case 17..<22: return .dinner
        default: return .snack
        }
    }
}

@Model
final class FoodLog {
    @Attribute(.unique) var id: UUID
    var timestamp: Date
    var name: String
    var notes: String?
    var isManual: Bool
    var mealCategoryRaw: String?
    var servings: Double

    @Attribute(.externalStorage) var imageData: Data?

    var calories: Int
    var proteinGrams: Double
    var carbsGrams: Double
    var fatsGrams: Double

    var confidenceScore: Double?

    @Relationship(deleteRule: .cascade) var ingredients: [Ingredient]?

    init(
        id: UUID = UUID(),
        timestamp: Date = .now,
        name: String,
        notes: String? = nil,
        isManual: Bool = true,
        mealCategory: MealCategory? = nil,
        servings: Double = 1.0,
        imageData: Data? = nil,
        calories: Int = 0,
        proteinGrams: Double = 0,
        carbsGrams: Double = 0,
        fatsGrams: Double = 0,
        confidenceScore: Double? = nil,
        ingredients: [Ingredient]? = nil
    ) {
        self.id = id
        self.timestamp = timestamp
        self.name = name
        self.notes = notes
        self.isManual = isManual
        self.mealCategoryRaw = mealCategory?.rawValue
        self.servings = servings
        self.imageData = imageData
        self.calories = calories
        self.proteinGrams = proteinGrams
        self.carbsGrams = carbsGrams
        self.fatsGrams = fatsGrams
        self.confidenceScore = confidenceScore
        self.ingredients = ingredients
    }

    var mealCategory: MealCategory? {
        get { mealCategoryRaw.flatMap(MealCategory.init(rawValue:)) }
        set { mealCategoryRaw = newValue?.rawValue }
    }

    var inferredCategory: MealCategory {
        mealCategory ?? MealCategory.category(forHour: Calendar.current.component(.hour, from: timestamp))
    }

    var hasIngredientBreakdown: Bool {
        !(ingredients ?? []).isEmpty
    }

    var effectiveCalories: Int {
        let base: Int
        if let ingredients, !ingredients.isEmpty {
            base = ingredients.reduce(0) { $0 + $1.calories }
        } else {
            base = calories
        }
        return Int((Double(base) * servings).rounded())
    }

    var effectiveProtein: Double {
        let base: Double
        if let ingredients, !ingredients.isEmpty {
            base = ingredients.reduce(0) { $0 + $1.proteinGrams }
        } else {
            base = proteinGrams
        }
        return base * servings
    }

    var effectiveCarbs: Double {
        let base: Double
        if let ingredients, !ingredients.isEmpty {
            base = ingredients.reduce(0) { $0 + $1.carbsGrams }
        } else {
            base = carbsGrams
        }
        return base * servings
    }

    var effectiveFats: Double {
        let base: Double
        if let ingredients, !ingredients.isEmpty {
            base = ingredients.reduce(0) { $0 + $1.fatsGrams }
        } else {
            base = fatsGrams
        }
        return base * servings
    }
}

@Model
final class Ingredient {
    @Attribute(.unique) var id: UUID
    var name: String
    var calories: Int
    var proteinGrams: Double
    var carbsGrams: Double
    var fatsGrams: Double
    var order: Int

    init(
        id: UUID = UUID(),
        name: String,
        calories: Int = 0,
        proteinGrams: Double = 0,
        carbsGrams: Double = 0,
        fatsGrams: Double = 0,
        order: Int = 0
    ) {
        self.id = id
        self.name = name
        self.calories = calories
        self.proteinGrams = proteinGrams
        self.carbsGrams = carbsGrams
        self.fatsGrams = fatsGrams
        self.order = order
    }
}

@Model
final class WaterLog {
    @Attribute(.unique) var id: UUID
    var timestamp: Date
    var amountML: Int

    init(id: UUID = UUID(), timestamp: Date = .now, amountML: Int) {
        self.id = id
        self.timestamp = timestamp
        self.amountML = amountML
    }
}

extension Array where Element == FoodLog {
    var totalCalories: Int { reduce(0) { $0 + $1.effectiveCalories } }
    var totalProtein: Double { reduce(0) { $0 + $1.effectiveProtein } }
    var totalCarbs: Double { reduce(0) { $0 + $1.effectiveCarbs } }
    var totalFats: Double { reduce(0) { $0 + $1.effectiveFats } }
}
