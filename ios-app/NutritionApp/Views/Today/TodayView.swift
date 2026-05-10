import SwiftUI
import SwiftData

struct TodayView: View {
    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query(sort: \FoodLog.timestamp, order: .reverse) private var allLogs: [FoodLog]
    @Query(sort: \WaterLog.timestamp, order: .reverse) private var allWater: [WaterLog]

    @Environment(\.modelContext) private var context
    @State private var showingLogSheet = false
    @State private var editingLog: FoodLog?

    private var profile: UserProfile? { profiles.first }

    private var todaysLogs: [FoodLog] {
        let cal = Calendar.current
        return allLogs.filter { cal.isDateInToday($0.timestamp) }
    }

    private var todaysWaterML: Int {
        let cal = Calendar.current
        return allWater
            .filter { cal.isDateInToday($0.timestamp) }
            .reduce(0) { $0 + $1.amountML }
    }

    private var groupedByCategory: [(MealCategory, [FoodLog])] {
        var buckets: [MealCategory: [FoodLog]] = [:]
        for log in todaysLogs {
            buckets[log.inferredCategory, default: []].append(log)
        }
        return MealCategory.allCases.compactMap { c in
            guard let logs = buckets[c], !logs.isEmpty else { return nil }
            return (c, logs.sorted { $0.timestamp < $1.timestamp })
        }
    }

    private var recentForQuickAdd: [FoodLog] {
        // Last 30 days, distinct by name, most recent first, capped at 5.
        let cal = Calendar.current
        let cutoff = cal.date(byAdding: .day, value: -30, to: .now) ?? .now
        var seen: Set<String> = []
        var result: [FoodLog] = []
        for log in allLogs where log.timestamp >= cutoff {
            let key = log.name.lowercased()
            if seen.insert(key).inserted {
                result.append(log)
                if result.count >= 5 { break }
            }
        }
        return result
    }

    private var streak: Int {
        guard let profile else { return 0 }
        return StreakCalculator.currentStreak(logs: allLogs, dailyCalorieGoal: profile.dailyCalorieGoal)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let profile {
                        MacroSummaryCard(
                            calories: todaysLogs.totalCalories,
                            calorieGoal: profile.dailyCalorieGoal,
                            protein: todaysLogs.totalProtein,
                            proteinGoal: profile.proteinGoalGrams,
                            carbs: todaysLogs.totalCarbs,
                            carbsGoal: profile.carbsGoalGrams,
                            fats: todaysLogs.totalFats,
                            fatsGoal: profile.fatsGoalGrams
                        )
                        .padding(.horizontal)

                        WaterCard(
                            consumedML: todaysWaterML,
                            goalML: profile.waterGoalML,
                            onAdd: addWater
                        )
                        .padding(.horizontal)
                    }

                    if !recentForQuickAdd.isEmpty {
                        quickAddSection
                    }

                    if todaysLogs.isEmpty {
                        emptyState
                            .padding(.top, 8)
                    } else {
                        ForEach(groupedByCategory, id: \.0) { (category, logs) in
                            categorySection(category, logs: logs)
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle(greeting)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    StreakBadge(streak: streak)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingLogSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingLogSheet) {
                NavigationStack { LogMealView() }
            }
            .sheet(item: $editingLog) { log in
                NavigationStack {
                    MealEditorView(mode: .edit(log))
                }
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let name = profile?.displayName ?? "there"
        switch hour {
        case 5..<12: return "Morning, \(name)"
        case 12..<17: return "Afternoon, \(name)"
        case 17..<22: return "Evening, \(name)"
        default: return "Hi, \(name)"
        }
    }

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Log again")
                    .font(.headline)
                Spacer()
            }
            .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(recentForQuickAdd) { log in
                        Button { quickAdd(log) } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(log.name)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                Text("\(log.calories) kcal")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(width: 140, alignment: .leading)
                            .padding(10)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
            }
        }
    }

    private func categorySection(_ category: MealCategory, logs: [FoodLog]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: category.systemImage).foregroundStyle(.secondary)
                Text(category.label)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(logs.totalCalories) kcal")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)
            .padding(.bottom, 4)

            LazyVStack(spacing: 0) {
                ForEach(logs) { log in
                    MealRow(log: log)
                        .padding(.horizontal)
                        .contentShape(Rectangle())
                        .onTapGesture { editingLog = log }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                delete(log)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                quickAdd(log)
                            } label: {
                                Label("Log again", systemImage: "arrow.clockwise")
                            }
                            .tint(.blue)
                        }
                    Divider().padding(.leading, 80)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "fork.knife.circle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No meals logged yet today")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Log a meal") { showingLogSheet = true }
                .buttonStyle(.borderedProminent)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private func addWater(_ amount: Int) {
        context.insert(WaterLog(timestamp: .now, amountML: amount))
        try? context.save()
    }

    private func delete(_ log: FoodLog) {
        context.delete(log)
        try? context.save()
    }

    private func quickAdd(_ log: FoodLog) {
        let copy = FoodLog(
            timestamp: .now,
            name: log.name,
            notes: log.notes,
            isManual: true,
            mealCategory: MealCategory.category(forHour: Calendar.current.component(.hour, from: .now)),
            servings: log.servings,
            calories: log.calories,
            proteinGrams: log.proteinGrams,
            carbsGrams: log.carbsGrams,
            fatsGrams: log.fatsGrams
        )
        context.insert(copy)
        try? context.save()
    }
}
