import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max") }

            LogMealView()
                .tabItem { Label("Log", systemImage: "plus.circle.fill") }

            AnalyticsView()
                .tabItem { Label("Analytics", systemImage: "chart.bar.xaxis") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}
