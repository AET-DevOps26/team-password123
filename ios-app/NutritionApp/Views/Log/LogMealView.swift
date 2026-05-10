import SwiftUI

/// Top-level "Log a meal" sheet: lets user pick manual vs photo flow,
/// then hands off to the unified MealEditorView.
struct LogMealView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case manual = "Manual"
        case photo = "Photo"
        var id: String { rawValue }
    }

    @State private var mode: Mode = .manual

    var body: some View {
        VStack(spacing: 0) {
            Picker("Entry mode", selection: $mode) {
                ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()

            MealEditorView(mode: .create(isPhoto: mode == .photo))
                .id(mode)  // reset state when switching
        }
        .navigationTitle("Log a meal")
        .navigationBarTitleDisplayMode(.inline)
    }
}
