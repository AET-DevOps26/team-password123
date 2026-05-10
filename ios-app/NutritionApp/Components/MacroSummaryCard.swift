import SwiftUI

struct MacroSummaryCard: View {
    let calories: Int
    let calorieGoal: Int
    let protein: Double
    let proteinGoal: Double
    let carbs: Double
    let carbsGoal: Double
    let fats: Double
    let fatsGoal: Double

    private var calorieProgress: Double {
        guard calorieGoal > 0 else { return 0 }
        return min(Double(calories) / Double(calorieGoal), 1.0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Calories")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(calories)")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                    Text("/ \(calorieGoal) kcal")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: calorieProgress)
                    .tint(.orange)
            }

            HStack(spacing: 12) {
                MacroProgressRing(label: "Protein", current: protein, goal: proteinGoal, unit: "g", tint: .blue)
                MacroProgressRing(label: "Carbs", current: carbs, goal: carbsGoal, unit: "g", tint: .green)
                MacroProgressRing(label: "Fats", current: fats, goal: fatsGoal, unit: "g", tint: .pink)
            }
            .frame(maxWidth: .infinity)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
