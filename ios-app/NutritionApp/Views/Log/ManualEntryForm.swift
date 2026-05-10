import SwiftUI
import SwiftData

struct ManualEntryForm: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var name: String = ""
    @State private var calories: Int = 0
    @State private var protein: Double = 0
    @State private var carbs: Double = 0
    @State private var fats: Double = 0
    @State private var notes: String = ""
    @State private var timestamp: Date = .now

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Form {
            Section("Meal") {
                TextField("Name (e.g. Chicken bowl)", text: $name)
                DatePicker("When", selection: $timestamp)
            }

            Section("Nutrition") {
                Stepper(value: $calories, in: 0...5000, step: 10) {
                    HStack {
                        Text("Calories")
                        Spacer()
                        Text("\(calories) kcal").foregroundStyle(.secondary)
                    }
                }
                macroStepper(label: "Protein", value: $protein, tint: .blue)
                macroStepper(label: "Carbs", value: $carbs, tint: .green)
                macroStepper(label: "Fats", value: $fats, tint: .pink)
            }

            Section("Notes") {
                TextField("Optional", text: $notes, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
            }

            Section {
                Button("Save meal") { save() }
                    .disabled(!canSave)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func macroStepper(label: String, value: Binding<Double>, tint: Color) -> some View {
        Stepper(value: value, in: 0...500, step: 1) {
            HStack {
                Circle().fill(tint).frame(width: 10, height: 10)
                Text(label)
                Spacer()
                Text(String(format: "%.0f g", value.wrappedValue))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func save() {
        let log = FoodLog(
            timestamp: timestamp,
            name: name.trimmingCharacters(in: .whitespaces),
            notes: notes.isEmpty ? nil : notes,
            isManual: true,
            calories: calories,
            proteinGrams: protein,
            carbsGrams: carbs,
            fatsGrams: fats
        )
        context.insert(log)
        try? context.save()
        dismiss()
    }
}
