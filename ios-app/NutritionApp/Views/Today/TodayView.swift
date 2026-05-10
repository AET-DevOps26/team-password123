import SwiftUI
import SwiftData

struct TodayView: View {
    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query(sort: \FoodLog.timestamp, order: .reverse) private var allLogs: [FoodLog]

    @Environment(\.modelContext) private var context
    @State private var showingLogSheet = false

    private var profile: UserProfile? { profiles.first }

    private var todaysLogs: [FoodLog] {
        let cal = Calendar.current
        return allLogs.filter { cal.isDateInToday($0.timestamp) }
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
                    }

                    HStack {
                        Text("Today's meals")
                            .font(.headline)
                        Spacer()
                        Text("\(todaysLogs.count)")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal)

                    if todaysLogs.isEmpty {
                        emptyState
                            .padding(.top, 24)
                    } else {
                        LazyVStack(spacing: 0) {
                            ForEach(todaysLogs) { log in
                                MealRow(log: log)
                                    .padding(.horizontal)
                                Divider().padding(.leading, 80)
                            }
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle(greeting)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingLogSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingLogSheet) {
                NavigationStack {
                    LogMealView()
                }
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Hello"
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
}
