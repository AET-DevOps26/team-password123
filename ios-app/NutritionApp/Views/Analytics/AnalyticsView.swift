import SwiftUI
import SwiftData
import Charts

struct AnalyticsView: View {
    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query(sort: \FoodLog.timestamp, order: .reverse) private var allLogs: [FoodLog]

    private var profile: UserProfile? { profiles.first }

    private struct DailyTotals: Identifiable {
        let date: Date
        let calories: Int
        let protein: Double
        let carbs: Double
        let fats: Double
        var id: Date { date }
    }

    private var lastSevenDays: [DailyTotals] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        return (0..<7).reversed().map { offset in
            let day = cal.date(byAdding: .day, value: -offset, to: today)!
            let dayLogs = allLogs.filter { cal.isDate($0.timestamp, inSameDayAs: day) }
            return DailyTotals(
                date: day,
                calories: dayLogs.totalCalories,
                protein: dayLogs.totalProtein,
                carbs: dayLogs.totalCarbs,
                fats: dayLogs.totalFats
            )
        }
    }

    private var weeklyAverageCalories: Int {
        let total = lastSevenDays.reduce(0) { $0 + $1.calories }
        return total / max(lastSevenDays.count, 1)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    summaryCard

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Calories — last 7 days")
                            .font(.headline)
                        caloriesChart
                            .frame(height: 220)
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Macros — last 7 days")
                            .font(.headline)
                        macrosChart
                            .frame(height: 220)
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .padding()
            }
            .navigationTitle("Analytics")
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("7-day average")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("\(weeklyAverageCalories)")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                Text("kcal / day")
                    .foregroundStyle(.secondary)
            }
            if let profile {
                let goal = profile.dailyCalorieGoal
                let delta = weeklyAverageCalories - goal
                Text(delta == 0
                     ? "On goal"
                     : "\(delta > 0 ? "+" : "")\(delta) vs \(goal) kcal goal")
                    .font(.caption)
                    .foregroundStyle(deltaColor(delta))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func deltaColor(_ delta: Int) -> Color {
        if delta == 0 { return .gray }
        return delta > 0 ? .orange : .green
    }

    private var caloriesChart: some View {
        Chart {
            ForEach(lastSevenDays) { day in
                BarMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Calories", day.calories)
                )
                .foregroundStyle(.orange)
            }
            if let profile {
                RuleMark(y: .value("Goal", profile.dailyCalorieGoal))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(.secondary)
            }
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .day)) { value in
                AxisValueLabel(format: .dateTime.weekday(.narrow))
                AxisGridLine()
            }
        }
    }

    private var macrosChart: some View {
        Chart {
            ForEach(lastSevenDays) { day in
                LineMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Protein", day.protein)
                )
                .foregroundStyle(by: .value("Macro", "Protein"))

                LineMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Carbs", day.carbs)
                )
                .foregroundStyle(by: .value("Macro", "Carbs"))

                LineMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Fats", day.fats)
                )
                .foregroundStyle(by: .value("Macro", "Fats"))
            }
        }
        .chartForegroundStyleScale([
            "Protein": Color.blue,
            "Carbs": Color.green,
            "Fats": Color.pink
        ])
        .chartXAxis {
            AxisMarks(values: .stride(by: .day)) { _ in
                AxisValueLabel(format: .dateTime.weekday(.narrow))
                AxisGridLine()
            }
        }
    }
}
