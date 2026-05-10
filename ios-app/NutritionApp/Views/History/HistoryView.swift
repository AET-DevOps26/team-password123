import SwiftUI
import SwiftData

struct HistoryView: View {
    @Query(sort: \FoodLog.timestamp, order: .reverse) private var allLogs: [FoodLog]
    @Environment(\.modelContext) private var context

    @State private var query: String = ""
    @State private var categoryFilter: MealCategory? = nil
    @State private var editingLog: FoodLog?

    private var filtered: [FoodLog] {
        var result = allLogs
        if let categoryFilter {
            result = result.filter { $0.inferredCategory == categoryFilter }
        }
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty {
            result = result.filter { log in
                log.name.lowercased().contains(q)
                    || (log.notes ?? "").lowercased().contains(q)
            }
        }
        return result
    }

    private var grouped: [(Date, [FoodLog])] {
        let cal = Calendar.current
        let dict = Dictionary(grouping: filtered) { cal.startOfDay(for: $0.timestamp) }
        return dict.keys.sorted(by: >).map { ($0, dict[$0] ?? []) }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .full
        return f
    }()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(title: "All", isOn: categoryFilter == nil) {
                            categoryFilter = nil
                        }
                        ForEach(MealCategory.allCases) { c in
                            FilterChip(
                                title: c.label,
                                systemImage: c.systemImage,
                                isOn: categoryFilter == c
                            ) {
                                categoryFilter = (categoryFilter == c) ? nil : c
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }

                List {
                    if filtered.isEmpty {
                        ContentUnavailableView(
                            "No matching meals",
                            systemImage: "magnifyingglass",
                            description: Text("Try a different search or filter.")
                        )
                    } else {
                        ForEach(grouped, id: \.0) { (day, logs) in
                            Section(Self.dayFormatter.string(from: day)) {
                                ForEach(logs) { log in
                                    MealRow(log: log)
                                        .contentShape(Rectangle())
                                        .onTapGesture { editingLog = log }
                                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                            Button(role: .destructive) {
                                                delete(log)
                                            } label: {
                                                Label("Delete", systemImage: "trash")
                                            }
                                        }
                                }
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("History")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
            .sheet(item: $editingLog) { log in
                NavigationStack { MealEditorView(mode: .edit(log)) }
            }
        }
    }

    private func delete(_ log: FoodLog) {
        context.delete(log)
        try? context.save()
    }
}

private struct FilterChip: View {
    let title: String
    var systemImage: String? = nil
    let isOn: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                if let systemImage {
                    Image(systemName: systemImage).font(.caption)
                }
                Text(title).font(.subheadline)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isOn ? Color.accentColor.opacity(0.18) : Color(.secondarySystemBackground))
            .foregroundStyle(isOn ? Color.accentColor : Color.primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
