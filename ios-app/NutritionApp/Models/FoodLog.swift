import Foundation
import SwiftData

@Model
final class FoodLog {
    @Attribute(.unique) var id: UUID
    var timestamp: Date
    var name: String
    var notes: String?
    var isManual: Bool

    @Attribute(.externalStorage) var imageData: Data?

    var calories: Int
    var proteinGrams: Double
    var carbsGrams: Double
    var fatsGrams: Double

    // Reserved for the GenAI integration; nil for manual entries.
    var confidenceScore: Double?

    init(
        id: UUID = UUID(),
        timestamp: Date = .now,
        name: String,
        notes: String? = nil,
        isManual: Bool = true,
        imageData: Data? = nil,
        calories: Int = 0,
        proteinGrams: Double = 0,
        carbsGrams: Double = 0,
        fatsGrams: Double = 0,
        confidenceScore: Double? = nil
    ) {
        self.id = id
        self.timestamp = timestamp
        self.name = name
        self.notes = notes
        self.isManual = isManual
        self.imageData = imageData
        self.calories = calories
        self.proteinGrams = proteinGrams
        self.carbsGrams = carbsGrams
        self.fatsGrams = fatsGrams
        self.confidenceScore = confidenceScore
    }
}

extension Array where Element == FoodLog {
    var totalCalories: Int { reduce(0) { $0 + $1.calories } }
    var totalProtein: Double { reduce(0) { $0 + $1.proteinGrams } }
    var totalCarbs: Double { reduce(0) { $0 + $1.carbsGrams } }
    var totalFats: Double { reduce(0) { $0 + $1.fatsGrams } }
}
