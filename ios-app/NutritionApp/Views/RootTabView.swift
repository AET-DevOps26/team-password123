import SwiftUI
import SwiftData

struct RootTabView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase

    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query private var allLogs: [FoodLog]
    @Query private var allWater: [WaterLog]

    private var profile: UserProfile? { profiles.first }

    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max") }

            HistoryView()
                .tabItem { Label("History", systemImage: "list.bullet.rectangle") }

            LogMealView()
                .tabItem { Label("Log", systemImage: "plus.circle.fill") }

            AnalyticsView()
                .tabItem { Label("Analytics", systemImage: "chart.bar.xaxis") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
        .sheet(isPresented: showOnboardingBinding) {
            if let profile {
                OnboardingView(profile: profile)
            }
        }
        .task { refreshSnapshot() }
        .onChange(of: allLogs.count) { _, _ in refreshSnapshot() }
        .onChange(of: allWater.count) { _, _ in refreshSnapshot() }
        .onChange(of: profile?.dailyCalorieGoal) { _, _ in refreshSnapshot() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { refreshSnapshot() }
        }
    }

    private var showOnboardingBinding: Binding<Bool> {
        Binding(
            get: { profile?.onboardingComplete == false },
            set: { _ in }
        )
    }

    private func refreshSnapshot() {
        WidgetSnapshotWriter.refresh(context: context)
    }
}
