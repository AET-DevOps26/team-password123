import SwiftUI
import SwiftData

struct RootTabView: View {
    private enum Tab: Hashable {
        case today, history, log, analytics, profile
    }

    @State private var selectedTab: Tab = .today

    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Environment(Session.self) private var session
    @Environment(SyncService.self) private var sync

    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query private var allLogs: [FoodLog]
    @Query private var allWater: [WaterLog]

    private var profile: UserProfile? { profiles.first }

    var body: some View {
        Group {
            if session.isAuthenticated {
                mainTabs
            } else {
                AuthView()
            }
        }
    }

    private var mainTabs: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max") }
                .tag(Tab.today)

            HistoryView()
                .tabItem { Label("History", systemImage: "list.bullet.rectangle") }
                .tag(Tab.history)

            // Saving from the Log tab has nothing to dismiss, so jump to History
            // to show the freshly logged meal.
            LogMealView(onSaved: { selectedTab = .history })
                .tabItem { Label("Log", systemImage: "plus.circle.fill") }
                .tag(Tab.log)

            AnalyticsView()
                .tabItem { Label("Analytics", systemImage: "chart.bar.xaxis") }
                .tag(Tab.analytics)

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
        .sheet(isPresented: showOnboardingBinding) {
            if let profile {
                OnboardingView(profile: profile)
            }
        }
        .task {
            await sync.sync()
            refreshSnapshot()
        }
        .onChange(of: allLogs.count) { _, _ in refreshSnapshot() }
        .onChange(of: allWater.count) { _, _ in refreshSnapshot() }
        .onChange(of: profile?.dailyCalorieGoal) { _, _ in refreshSnapshot() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                refreshSnapshot()
                Task { await sync.sync() }   // re-pull server state on foreground
            }
        }
        // An expired/invalid token drops the user back to sign-in instead of failing
        // sync silently forever.
        .onChange(of: sync.sessionExpired) { _, expired in
            if expired {
                session.signOut()
                sync.sessionExpired = false
            }
        }
        // Surface a failed sync rather than showing stale data with no explanation.
        .safeAreaInset(edge: .top) {
            if sync.lastSyncFailed {
                Text("Offline — showing saved data")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(.thinMaterial)
            }
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
