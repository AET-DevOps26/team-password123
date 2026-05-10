import SwiftUI

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

            switch mode {
            case .manual:
                ManualEntryForm()
            case .photo:
                PhotoEntryForm()
            }
        }
        .navigationTitle("Log a meal")
        .navigationBarTitleDisplayMode(.inline)
    }
}
