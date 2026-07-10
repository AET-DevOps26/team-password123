import SwiftUI
import SwiftData
import PhotosUI

/// Unified add / edit form for FoodLog entries. Supports manual and photo modes.
struct MealEditorView: View {
    enum Mode {
        case create(isPhoto: Bool)
        case edit(FoodLog)
    }

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Environment(SyncService.self) private var sync

    let mode: Mode

    // Meal fields
    @State private var name: String = ""
    @State private var notes: String = ""
    @State private var timestamp: Date = .now
    @State private var category: MealCategory? = nil
    @State private var servings: Double = 1.0
    @State private var calories: Int = 0
    @State private var protein: Double = 0
    @State private var carbs: Double = 0
    @State private var fats: Double = 0

    // Ingredient breakdown
    @State private var useIngredients: Bool = false
    @State private var ingredientDrafts: [IngredientDraft] = []

    // Photo
    @State private var pickerItem: PhotosPickerItem?
    @State private var imageData: Data?

    // GenAI photo analysis
    @State private var aiServerId: String?
    @State private var aiConfidence: Double?
    @State private var analyzing = false
    @State private var aiError: String?
    // Tracks the in-flight analysis so cancel/re-analyze can disown its result. A
    // reference type (not @State) so the running task still sees `abandoned` after
    // the view is dismissed.
    @State private var analysis: AnalysisLifetime?

    private var isPhotoMode: Bool {
        switch mode {
        case .create(let isPhoto): return isPhoto
        case .edit(let log): return !log.isManual || log.imageData != nil
        }
    }

    private var canSave: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return false }
        if case .create(let isPhoto) = mode, isPhoto, imageData == nil { return false }
        return true
    }

    private var totals: (cal: Int, p: Double, c: Double, f: Double) {
        if useIngredients {
            let cal = ingredientDrafts.reduce(0) { $0 + $1.calories }
            let p = ingredientDrafts.reduce(0) { $0 + $1.protein }
            let c = ingredientDrafts.reduce(0) { $0 + $1.carbs }
            let f = ingredientDrafts.reduce(0) { $0 + $1.fats }
            return (cal, p, c, f)
        }
        return (calories, protein, carbs, fats)
    }

    var body: some View {
        Form {
            if isPhotoMode {
                photoSection
            }

            Section("Meal") {
                TextField("Name (e.g. Chicken bowl)", text: $name)
                DatePicker("When", selection: $timestamp)
                Picker("Category", selection: $category) {
                    Text("Auto").tag(MealCategory?.none)
                    ForEach(MealCategory.allCases) { c in
                        Label(c.label, systemImage: c.systemImage).tag(MealCategory?.some(c))
                    }
                }
                HStack {
                    Text("Servings")
                    Spacer()
                    Stepper(value: $servings, in: 0.25...10, step: 0.25) {
                        Text(String(format: "%.2f", servings))
                            .foregroundStyle(.secondary)
                            .frame(minWidth: 50, alignment: .trailing)
                    }
                }
            }

            Section {
                Toggle("Use ingredient breakdown", isOn: $useIngredients)
                if useIngredients {
                    ForEach($ingredientDrafts) { $draft in
                        IngredientDraftRow(draft: $draft)
                    }
                    .onDelete { offsets in
                        ingredientDrafts.remove(atOffsets: offsets)
                    }
                    Button {
                        ingredientDrafts.append(IngredientDraft())
                    } label: {
                        Label("Add ingredient", systemImage: "plus.circle")
                    }
                }
            } header: {
                Text("Ingredients")
            } footer: {
                if useIngredients {
                    Text("Meal totals are summed from ingredients.")
                }
            }

            if let aiConfidence {
                Section {
                    Label("AI estimate · \(Int(aiConfidence * 100))% match", systemImage: "sparkles")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                if useIngredients {
                    LabeledContent("Calories", value: "\(totals.cal) kcal")
                    LabeledContent("Protein", value: String(format: "%.0f g", totals.p))
                    LabeledContent("Carbs", value: String(format: "%.0f g", totals.c))
                    LabeledContent("Fats", value: String(format: "%.0f g", totals.f))
                } else {
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
                if servings != 1.0 {
                    LabeledContent(
                        "Logged total",
                        value: "\(Int(Double(totals.cal) * servings)) kcal"
                    )
                    .foregroundStyle(.secondary)
                }
            } header: {
                Text(useIngredients ? "Per-serving (computed)" : "Nutrition (per serving)")
            }

            Section("Notes") {
                TextField("Optional", text: $notes, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
            }

            Section {
                Button(saveButtonLabel) { save() }
                    .disabled(!canSave)
                    .frame(maxWidth: .infinity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(navTitle)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") {
                    // Disown any in-flight analysis so it discards its result when it
                    // returns, and drop an already-finished AI meal — either way the
                    // server-side meal isn't left orphaned.
                    analysis?.abandoned = true
                    if let orphan = aiServerId { sync.discardServerMeal(orphan) }
                    dismiss()
                }
            }
        }
        .onAppear { populateFromMode() }
        .onChange(of: pickerItem) { _, newItem in
            Task { await loadImage(from: newItem) }
        }
    }

    private var navTitle: String {
        switch mode {
        case .create: return "Log a meal"
        case .edit: return "Edit meal"
        }
    }

    private var saveButtonLabel: String {
        switch mode {
        case .create: return "Save meal"
        case .edit: return "Save changes"
        }
    }

    @ViewBuilder
    private var photoSection: some View {
        Section("Photo") {
            if let imageData, let uiImage = UIImage(data: imageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(.tertiarySystemFill))
                        .frame(height: 140)
                    VStack(spacing: 4) {
                        Image(systemName: "camera").font(.title2)
                        Text("No photo selected").font(.caption)
                    }
                    .foregroundStyle(.secondary)
                }
            }
            PhotosPicker(selection: $pickerItem, matching: .images, photoLibrary: .shared()) {
                Label(imageData == nil ? "Choose photo" : "Replace photo",
                      systemImage: "photo.on.rectangle")
            }
            if imageData != nil {
                Button {
                    Task { await analyze() }
                } label: {
                    if analyzing {
                        ProgressView()
                    } else {
                        Label("Analyze with AI", systemImage: "sparkles")
                    }
                }
                .disabled(analyzing)
            }
            if let aiError {
                Text(aiError).font(.footnote).foregroundStyle(.red)
            }
        }
    }

    private func analyze() async {
        guard let imageData else { return }
        // Re-analyzing: the previous analysis already persisted a meal server-side.
        // Mark it abandoned (in case it's still in flight) and drop any finished one.
        analysis?.abandoned = true
        if let previous = aiServerId {
            sync.discardServerMeal(previous)
            aiServerId = nil
        }
        // Own this run with a fresh token. We deliberately do NOT cancel the network
        // request on abandon — the backend persists the meal, so we let the call
        // finish to learn its id, then discard it if the user has moved on.
        let lifetime = AnalysisLifetime()
        analysis = lifetime
        analyzing = true
        aiError = nil
        do {
            let meal = try await sync.analyzePhoto(imageData)
            if lifetime.abandoned {
                // Cancelled / re-analyzed while this request was in flight — discard
                // the server-side meal instead of orphaning it.
                sync.discardServerMeal(meal.id)
                return
            }
            name = meal.dishName
            calories = Int(meal.nutrition.calories.rounded())
            protein = meal.nutrition.protein
            carbs = meal.nutrition.carbs
            fats = meal.nutrition.fat
            useIngredients = false
            aiServerId = meal.id
            aiConfidence = meal.confidence
        } catch {
            if !lifetime.abandoned {
                aiError = "Couldn't analyze the photo — enter the details manually."
            }
        }
        if !lifetime.abandoned { analyzing = false }
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

    private func populateFromMode() {
        if case .edit(let log) = mode {
            name = log.name
            notes = log.notes ?? ""
            timestamp = log.timestamp
            category = log.mealCategory
            servings = log.servings
            calories = log.calories
            protein = log.proteinGrams
            carbs = log.carbsGrams
            fats = log.fatsGrams
            imageData = log.imageData
            let existing = (log.ingredients ?? []).sorted { $0.order < $1.order }
            useIngredients = !existing.isEmpty
            ingredientDrafts = existing.map {
                IngredientDraft(
                    name: $0.name,
                    calories: $0.calories,
                    protein: $0.proteinGrams,
                    carbs: $0.carbsGrams,
                    fats: $0.fatsGrams
                )
            }
        }
    }

    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        // Re-encode to a downscaled JPEG before storing/uploading: iPhone captures are
        // often multi-MB HEIC, which the backend's Pillow can't decode and which can
        // exceed the ingress body cap. Fall back to the raw bytes if decoding fails.
        let prepared = Self.downscaledJPEG(from: data) ?? data
        await MainActor.run { imageData = prepared }
    }

    /// Decode (handles HEIC/PNG/JPEG), downscale so the longest side is <= maxDimension,
    /// and re-encode as JPEG. Returns nil only if the input can't be decoded at all.
    private static func downscaledJPEG(
        from data: Data, maxDimension: CGFloat = 1280, quality: CGFloat = 0.7
    ) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        let scale = longest > maxDimension ? maxDimension / longest : 1
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: quality)
    }

    private func save() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let finalCal: Int
        let finalP: Double
        let finalC: Double
        let finalF: Double
        if useIngredients {
            finalCal = totals.cal
            finalP = totals.p
            finalC = totals.c
            finalF = totals.f
        } else {
            finalCal = calories
            finalP = protein
            finalC = carbs
            finalF = fats
        }

        switch mode {
        case .create(let isPhoto):
            let log = FoodLog(
                timestamp: timestamp,
                name: trimmedName,
                notes: notes.isEmpty ? nil : notes,
                isManual: !isPhoto,
                mealCategory: category,
                servings: servings,
                imageData: imageData,
                calories: finalCal,
                proteinGrams: finalP,
                carbsGrams: finalC,
                fatsGrams: finalF,
                confidenceScore: aiConfidence
            )
            if useIngredients {
                log.ingredients = ingredientDrafts.enumerated().map { idx, d in
                    Ingredient(
                        name: d.name,
                        calories: d.calories,
                        proteinGrams: d.protein,
                        carbsGrams: d.carbs,
                        fatsGrams: d.fats,
                        order: idx
                    )
                }
            }
            // The AI flow already persisted this meal; link its id so addMeal
            // inserts locally without creating a duplicate on the backend.
            log.serverId = aiServerId
            sync.addMeal(log)
            // Push any edits the user made to the AI estimate (PUT keeps sourceType).
            if aiServerId != nil { sync.updateMeal(log) }

        case .edit(let log):
            log.name = trimmedName
            log.notes = notes.isEmpty ? nil : notes
            log.timestamp = timestamp
            log.mealCategory = category
            log.servings = servings
            log.imageData = imageData
            log.calories = finalCal
            log.proteinGrams = finalP
            log.carbsGrams = finalC
            log.fatsGrams = finalF
            if useIngredients {
                let mapped: [Ingredient] = ingredientDrafts.enumerated().map { idx, d in
                    Ingredient(
                        name: d.name,
                        calories: d.calories,
                        proteinGrams: d.protein,
                        carbsGrams: d.carbs,
                        fatsGrams: d.fats,
                        order: idx
                    )
                }
                log.ingredients = mapped
            } else {
                log.ingredients = nil
            }
            sync.updateMeal(log)
        }

        dismiss()
    }
}

/// One in-flight photo analysis. `abandoned` flips to true when the user cancels or
/// re-analyzes; the running task checks it after the (deliberately un-cancelled)
/// network call returns, so it can discard the server-persisted meal rather than
/// leave it orphaned.
private final class AnalysisLifetime {
    var abandoned = false
}

struct IngredientDraft: Identifiable {
    let id = UUID()
    var name: String = ""
    var calories: Int = 0
    var protein: Double = 0
    var carbs: Double = 0
    var fats: Double = 0
}

private struct IngredientDraftRow: View {
    @Binding var draft: IngredientDraft

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Ingredient", text: $draft.name)
            HStack(spacing: 12) {
                miniField(label: "kcal", value: Binding(
                    get: { Double(draft.calories) },
                    set: { draft.calories = Int($0) }
                ), step: 10, max: 2000)
                miniField(label: "P", value: $draft.protein, step: 1, max: 200, suffix: "g", tint: .blue)
                miniField(label: "C", value: $draft.carbs, step: 1, max: 300, suffix: "g", tint: .green)
                miniField(label: "F", value: $draft.fats, step: 1, max: 200, suffix: "g", tint: .pink)
            }
        }
        .padding(.vertical, 4)
    }

    private func miniField(
        label: String,
        value: Binding<Double>,
        step: Double,
        max: Double,
        suffix: String = "",
        tint: Color = .secondary
    ) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 2) {
                if tint != .secondary {
                    Circle().fill(tint).frame(width: 6, height: 6)
                }
                Text(label).font(.caption2).foregroundStyle(.secondary)
            }
            HStack(spacing: 4) {
                Button {
                    value.wrappedValue = Swift.max(0, value.wrappedValue - step)
                } label: { Image(systemName: "minus.circle") }
                Text("\(Int(value.wrappedValue))\(suffix)")
                    .font(.caption)
                    .frame(minWidth: 32)
                Button {
                    value.wrappedValue = Swift.min(max, value.wrappedValue + step)
                } label: { Image(systemName: "plus.circle") }
            }
            .buttonStyle(.borderless)
        }
        .frame(maxWidth: .infinity)
    }
}
