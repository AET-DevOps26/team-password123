import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query private var allLogs: [FoodLog]

    @State private var showingResetConfirm = false

    private var profile: UserProfile? { profiles.first }

    var body: some View {
        NavigationStack {
            Form {
                if let profile {
                    Section("Profile") {
                        TextField("Name", text: nameBinding(for: profile))
                        TextField("Email (optional)", text: emailBinding(for: profile))
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                    }

                    Section("Daily goals") {
                        Stepper(
                            value: caloriesBinding(for: profile),
                            in: 1000...6000,
                            step: 50
                        ) {
                            HStack {
                                Text("Calories")
                                Spacer()
                                Text("\(profile.dailyCalorieGoal) kcal")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        macroStepper(
                            label: "Protein",
                            value: doubleBinding(\.proteinGoalGrams, on: profile),
                            tint: .blue
                        )
                        macroStepper(
                            label: "Carbs",
                            value: doubleBinding(\.carbsGoalGrams, on: profile),
                            tint: .green
                        )
                        macroStepper(
                            label: "Fats",
                            value: doubleBinding(\.fatsGoalGrams, on: profile),
                            tint: .pink
                        )
                    }
                }

                Section("About") {
                    LabeledContent("Logs stored", value: "\(allLogs.count)")
                    LabeledContent("Storage", value: "Local (SwiftData)")
                    LabeledContent("Version", value: "0.1.0")
                }

                Section {
                    Button(role: .destructive) {
                        showingResetConfirm = true
                    } label: {
                        Text("Delete all logs")
                    }
                }
            }
            .navigationTitle("Profile")
            .confirmationDialog(
                "Delete all food logs?",
                isPresented: $showingResetConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive, action: deleteAllLogs)
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This removes every meal you've logged. This cannot be undone.")
            }
        }
    }

    // MARK: - Bindings

    private func nameBinding(for profile: UserProfile) -> Binding<String> {
        Binding(
            get: { profile.displayName },
            set: { profile.displayName = $0; try? context.save() }
        )
    }

    private func emailBinding(for profile: UserProfile) -> Binding<String> {
        Binding(
            get: { profile.email ?? "" },
            set: { profile.email = $0.isEmpty ? nil : $0; try? context.save() }
        )
    }

    private func caloriesBinding(for profile: UserProfile) -> Binding<Int> {
        Binding(
            get: { profile.dailyCalorieGoal },
            set: { profile.dailyCalorieGoal = $0; try? context.save() }
        )
    }

    private func doubleBinding(
        _ keyPath: ReferenceWritableKeyPath<UserProfile, Double>,
        on profile: UserProfile
    ) -> Binding<Double> {
        Binding(
            get: { profile[keyPath: keyPath] },
            set: { profile[keyPath: keyPath] = $0; try? context.save() }
        )
    }

    // MARK: - Components

    private func macroStepper(label: String, value: Binding<Double>, tint: Color) -> some View {
        Stepper(value: value, in: 0...500, step: 5) {
            HStack {
                Circle().fill(tint).frame(width: 10, height: 10)
                Text(label)
                Spacer()
                Text(String(format: "%.0f g", value.wrappedValue))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func deleteAllLogs() {
        for log in allLogs { context.delete(log) }
        try? context.save()
    }
}
