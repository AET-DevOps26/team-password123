import SwiftUI

/// Top-level "Log a meal" sheet: lets user pick manual vs photo flow,
/// then hands off to the unified MealEditorView.
struct LogMealView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case manual = "Manual"
        case photo = "Photo"
        var id: String { rawValue }
    }

    /// Called after a successful save. The Log tab uses this to jump to History;
    /// when presented as a sheet it can stay nil (the editor dismisses itself).
    var onSaved: (() -> Void)? = nil

    @State private var mode: Mode = .manual
    @State private var session = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("Entry mode", selection: $mode) {
                ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()

            MealEditorView(mode: .create(isPhoto: mode == .photo), onSaved: {
                session += 1   // fresh editor for the next meal
                onSaved?()
            })
            .id("\(mode.rawValue)-\(session)")  // reset state on mode switch or save
        }
        .navigationTitle("Log a meal")
        .navigationBarTitleDisplayMode(.inline)
    }
}
