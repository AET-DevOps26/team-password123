import WidgetKit
import SwiftUI

struct NutritionEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct NutritionTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> NutritionEntry {
        NutritionEntry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (NutritionEntry) -> Void) {
        completion(NutritionEntry(date: .now, snapshot: WidgetSnapshotStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NutritionEntry>) -> Void) {
        let snap = WidgetSnapshotStore.read()
        let entry = NutritionEntry(date: .now, snapshot: snap)
        // Refresh every 30 minutes — WidgetKit may delay or coalesce.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NutritionWidgetEntryView: View {
    var entry: NutritionEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall: smallView
        case .systemMedium: mediumView
        default: smallView
        }
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Today")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\(entry.snapshot.calories)")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                Text("kcal")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: entry.snapshot.calorieProgress)
                .tint(.orange)

            Text("of \(entry.snapshot.calorieGoal) goal")
                .font(.caption2)
                .foregroundStyle(.secondary)

            if entry.snapshot.streak > 0 {
                HStack(spacing: 3) {
                    Image(systemName: "flame.fill").foregroundStyle(.orange)
                    Text("\(entry.snapshot.streak)d")
                }
                .font(.caption2.weight(.medium))
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding()
    }

    private var mediumView: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Today")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(entry.snapshot.calories)")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                    Text("/ \(entry.snapshot.calorieGoal) kcal")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: entry.snapshot.calorieProgress)
                    .tint(.orange)
                if entry.snapshot.streak > 0 {
                    HStack(spacing: 3) {
                        Image(systemName: "flame.fill").foregroundStyle(.orange)
                        Text("\(entry.snapshot.streak)-day streak")
                    }
                    .font(.caption2.weight(.medium))
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                macroRow("Protein", entry.snapshot.protein, entry.snapshot.proteinGoal, .blue)
                macroRow("Carbs", entry.snapshot.carbs, entry.snapshot.carbsGoal, .green)
                macroRow("Fats", entry.snapshot.fats, entry.snapshot.fatsGoal, .pink)
                HStack(spacing: 4) {
                    Image(systemName: "drop.fill").foregroundStyle(.cyan)
                    Text("\(entry.snapshot.waterML) / \(entry.snapshot.waterGoalML) ml")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 2)
            }
        }
        .padding()
    }

    private func macroRow(_ label: String, _ value: Double, _ goal: Double, _ tint: Color) -> some View {
        HStack(spacing: 4) {
            Circle().fill(tint).frame(width: 6, height: 6)
            Text(label).font(.caption2)
            Spacer()
            Text(String(format: "%.0f / %.0f g", value, goal))
                .font(.caption2)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
    }
}

@main
struct NutritionWidget: Widget {
    let kind = "NutritionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NutritionTimelineProvider()) { entry in
            NutritionWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Today's nutrition")
        .description("Calories, macros, water, and streak — at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
