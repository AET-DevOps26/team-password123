import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \UserProfile.createdAt) private var profiles: [UserProfile]
    @Query private var allLogs: [FoodLog]

    @State private var showingResetConfirm = false
    @State private var showingExportSheet = false
    @State private var exportedURL: URL?
    @State private var showingRecalcSheet = false

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
                        Stepper(
                            value: waterBinding(for: profile),
                            in: 500...5000,
                            step: 100
                        ) {
                            HStack {
                                Image(systemName: "drop.fill").foregroundStyle(.cyan)
                                Text("Water")
                                Spacer()
                                Text("\(profile.waterGoalML) ml").foregroundStyle(.secondary)
                            }
                        }

                        if profile.heightCm != nil && profile.weightKg != nil && profile.age != nil {
                            Button("Recalculate from body metrics") {
                                showingRecalcSheet = true
                            }
                        }
                    }

                    Section("Reminders") {
                        Toggle(
                            "Daily reminder",
                            isOn: remindersBinding(for: profile)
                        )
                        if profile.remindersEnabled {
                            DatePicker(
                                "Time",
                                selection: reminderTimeBinding(for: profile),
                                displayedComponents: .hourAndMinute
                            )
                        }
                    }
                }

                Section("Data") {
                    Button {
                        exportCSV()
                    } label: {
                        Label("Export logs as CSV", systemImage: "square.and.arrow.up")
                    }
                    .disabled(allLogs.isEmpty)
                }

                Section("About") {
                    LabeledContent("Logs stored", value: "\(allLogs.count)")
                    LabeledContent("Storage", value: "Local (SwiftData)")
                    LabeledContent("Version", value: "0.2.0")
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
            .sheet(isPresented: $showingExportSheet, onDismiss: { exportedURL = nil }) {
                if let exportedURL {
                    ShareSheet(items: [exportedURL])
                }
            }
            .sheet(isPresented: $showingRecalcSheet) {
                if let profile {
                    NavigationStack { RecalcGoalsView(profile: profile) }
                }
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

    private func waterBinding(for profile: UserProfile) -> Binding<Int> {
        Binding(
            get: { profile.waterGoalML },
            set: { profile.waterGoalML = $0; try? context.save() }
        )
    }

    private func remindersBinding(for profile: UserProfile) -> Binding<Bool> {
        Binding(
            get: { profile.remindersEnabled },
            set: { newValue in
                profile.remindersEnabled = newValue
                try? context.save()
                Task {
                    if newValue {
                        let granted = await NotificationsManager.requestAuthorization()
                        if granted {
                            await NotificationsManager.scheduleDailyReminder(
                                hour: profile.reminderHour,
                                minute: profile.reminderMinute
                            )
                        } else {
                            await MainActor.run {
                                profile.remindersEnabled = false
                                try? context.save()
                            }
                        }
                    } else {
                        NotificationsManager.cancelReminder()
                    }
                }
            }
        )
    }

    private func reminderTimeBinding(for profile: UserProfile) -> Binding<Date> {
        Binding(
            get: {
                var components = DateComponents()
                components.hour = profile.reminderHour
                components.minute = profile.reminderMinute
                return Calendar.current.date(from: components) ?? .now
            },
            set: { newValue in
                let comps = Calendar.current.dateComponents([.hour, .minute], from: newValue)
                profile.reminderHour = comps.hour ?? 19
                profile.reminderMinute = comps.minute ?? 0
                try? context.save()
                if profile.remindersEnabled {
                    Task {
                        await NotificationsManager.scheduleDailyReminder(
                            hour: profile.reminderHour,
                            minute: profile.reminderMinute
                        )
                    }
                }
            }
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

    private func exportCSV() {
        do {
            exportedURL = try CSVExporter.writeCSV(logs: allLogs)
            showingExportSheet = true
        } catch {
            // Fail silently for now; nothing to recover from in this UI.
        }
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private struct RecalcGoalsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Bindable var profile: UserProfile

    var body: some View {
        let calc = currentCalc
        Form {
            Section("Inputs") {
                LabeledContent("Sex", value: profile.biologicalSex?.label ?? "—")
                LabeledContent("Age", value: profile.age.map { "\($0)" } ?? "—")
                LabeledContent("Height", value: profile.heightCm.map { String(format: "%.0f cm", $0) } ?? "—")
                LabeledContent("Weight", value: profile.weightKg.map { String(format: "%.1f kg", $0) } ?? "—")
                LabeledContent("Activity", value: profile.activityLevel?.label.components(separatedBy: " (").first ?? "—")
                LabeledContent("Goal", value: profile.goalKind?.label ?? "—")
            }
            if let calc {
                Section("New goals") {
                    LabeledContent("Calories", value: "\(calc.calories) kcal")
                    LabeledContent("Protein", value: String(format: "%.0f g", calc.proteinGrams))
                    LabeledContent("Carbs", value: String(format: "%.0f g", calc.carbsGrams))
                    LabeledContent("Fats", value: String(format: "%.0f g", calc.fatsGrams))
                }
                Section {
                    Button("Apply") { apply(calc) }
                        .frame(maxWidth: .infinity)
                }
            } else {
                Section {
                    Text("Missing inputs — please complete them in onboarding to recalculate.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Recalculate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var currentCalc: CalculatedGoals? {
        guard
            let weight = profile.weightKg,
            let height = profile.heightCm,
            let age = profile.age,
            let sex = profile.biologicalSex,
            let activity = profile.activityLevel,
            let goal = profile.goalKind
        else { return nil }
        return GoalCalculator.calculate(
            weightKg: weight,
            heightCm: height,
            age: age,
            sex: sex,
            activity: activity,
            goal: goal
        )
    }

    private func apply(_ calc: CalculatedGoals) {
        profile.dailyCalorieGoal = calc.calories
        profile.proteinGoalGrams = calc.proteinGrams
        profile.carbsGoalGrams = calc.carbsGrams
        profile.fatsGoalGrams = calc.fatsGrams
        try? context.save()
        dismiss()
    }
}
