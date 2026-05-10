import SwiftUI
import SwiftData
import Charts

struct AnalyticsView: View {
    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query(sort: \FoodLog.timestamp, order: .reverse) private var allLogs: [FoodLog]

    @State private var range: AnalyticsRange = .sevenDays

    private var profile: UserProfile? { profiles.first }

    private struct DailyTotals: Identifiable {
        let date: Date
        let calories: Int
        let protein: Double
        let carbs: Double
        let fats: Double
        var id: Date { date }
    }

    private var rangeDays: [DailyTotals] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let count = range.dayCount
        return (0..<count).reversed().map { offset in
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

    private var averageCalories: Int {
        let nonZero = rangeDays.filter { $0.calories > 0 }
        guard !nonZero.isEmpty else { return 0 }
        let total = nonZero.reduce(0) { $0 + $1.calories }
        return total / nonZero.count
    }

    private var streak: Int {
        guard let profile else { return 0 }
        return StreakCalculator.currentStreak(logs: allLogs, dailyCalorieGoal: profile.dailyCalorieGoal)
    }

    private struct CategoryShare: Identifiable {
        let category: MealCategory
        let calories: Int
        var id: String { category.rawValue }
    }

    private var todayMealDistribution: [CategoryShare] {
        let cal = Calendar.current
        let today = allLogs.filter { cal.isDateInToday($0.timestamp) }
        var buckets: [MealCategory: Int] = [:]
        for log in today {
            buckets[log.inferredCategory, default: 0] += log.effectiveCalories
        }
        return MealCategory.allCases.map { c in
            CategoryShare(category: c, calories: buckets[c] ?? 0)
        }
    }

    private var todayHasMeals: Bool {
        todayMealDistribution.contains { $0.calories > 0 }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Range", selection: $range) {
                        ForEach(AnalyticsRange.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    summaryCard

                    chartCard(title: "Calories — last \(range.dayCount) days") {
                        caloriesChart.frame(height: 220)
                    }

                    chartCard(title: "Macros — last \(range.dayCount) days") {
                        macrosChart.frame(height: 220)
                    }

                    chartCard(title: "Today by meal") {
                        if todayHasMeals {
                            mealDistributionChart.frame(height: 220)
                        } else {
                            Text("No meals logged today yet.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .padding(.vertical, 24)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Analytics")
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading) {
                    Text("\(range.dayCount)-day average")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("\(averageCalories)")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("kcal / day")
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                StreakBadge(streak: streak)
            }
            if let profile, averageCalories > 0 {
                let goal = profile.dailyCalorieGoal
                let delta = averageCalories - goal
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

    private func chartCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content()
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
            ForEach(rangeDays) { day in
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
            AxisMarks(values: .stride(by: xAxisUnit)) { _ in
                AxisValueLabel(format: xAxisFormat)
                AxisGridLine()
            }
        }
    }

    private var macrosChart: some View {
        Chart {
            ForEach(rangeDays) { day in
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
            AxisMarks(values: .stride(by: xAxisUnit)) { _ in
                AxisValueLabel(format: xAxisFormat)
                AxisGridLine()
            }
        }
    }

    private var mealDistributionChart: some View {
        Chart {
            ForEach(todayMealDistribution) { share in
                BarMark(
                    x: .value("Category", share.category.label),
                    y: .value("Calories", share.calories)
                )
                .foregroundStyle(by: .value("Category", share.category.label))
            }
        }
        .chartForegroundStyleScale([
            MealCategory.breakfast.label: Color.yellow,
            MealCategory.lunch.label: Color.orange,
            MealCategory.dinner.label: Color.purple,
            MealCategory.snack.label: Color.green
        ])
        .chartLegend(.hidden)
    }

    private var xAxisUnit: Calendar.Component {
        switch range {
        case .sevenDays: return .day
        case .thirtyDays: return .weekOfYear
        case .ninetyDays: return .month
        }
    }

    private var xAxisFormat: Date.FormatStyle {
        switch range {
        case .sevenDays: return .dateTime.weekday(.narrow)
        case .thirtyDays: return .dateTime.day()
        case .ninetyDays: return .dateTime.month(.abbreviated)
        }
    }
}
