import SwiftUI
import SwiftData
import PhotosUI

struct PhotoEntryForm: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @State private var pickerItem: PhotosPickerItem?
    @State private var imageData: Data?
    @State private var name: String = ""
    @State private var calories: Int = 0
    @State private var protein: Double = 0
    @State private var carbs: Double = 0
    @State private var fats: Double = 0
    @State private var timestamp: Date = .now

    private var canSave: Bool {
        imageData != nil && !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        Form {
            Section("Photo") {
                photoPreview

                PhotosPicker(
                    selection: $pickerItem,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Label(imageData == nil ? "Choose photo" : "Replace photo",
                          systemImage: "photo.on.rectangle")
                }
            }

            Section("Meal") {
                TextField("Name", text: $name)
                DatePicker("When", selection: $timestamp)
            }

            Section {
                Text("GenAI nutrition recognition is coming soon. For now, enter macros manually — they'll be auto-filled once the AI service is wired up.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
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

            Section {
                Button("Save meal") { save() }
                    .disabled(!canSave)
                    .frame(maxWidth: .infinity)
            }
        }
        .onChange(of: pickerItem) { _, newItem in
            Task { await loadImage(from: newItem) }
        }
    }

    @ViewBuilder
    private var photoPreview: some View {
        if let imageData, let uiImage = UIImage(data: imageData) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 220)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(.tertiarySystemFill))
                    .frame(height: 160)
                VStack(spacing: 6) {
                    Image(systemName: "camera")
                        .font(.title2)
                    Text("No photo selected")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
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

    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item else { return }
        if let data = try? await item.loadTransferable(type: Data.self) {
            await MainActor.run { imageData = data }
        }
    }

    private func save() {
        let log = FoodLog(
            timestamp: timestamp,
            name: name.trimmingCharacters(in: .whitespaces),
            isManual: false,
            imageData: imageData,
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
