import SwiftUI
import SwiftData

struct OnboardingView: View {
    @Environment(\.modelContext) private var context
    @Bindable var profile: UserProfile

    @State private var step: Int = 0
    @State private var name: String = ""
    @State private var sex: BiologicalSex = .female
    @State private var age: Int = 30
    @State private var heightCm: Int = 170
    @State private var weightKg: Double = 70
    @State private var activity: ActivityLevel = .moderate
    @State private var goal: GoalKind = .maintain

    private var calculated: CalculatedGoals {
        GoalCalculator.calculate(
            weightKg: weightKg,
            heightCm: Double(heightCm),
            age: age,
            sex: sex,
            activity: activity,
            goal: goal
        )
    }

    var body: some View {
        NavigationStack {
            VStack {
                ProgressView(value: Double(step + 1), total: 4)
                    .padding(.horizontal)
                    .padding(.top, 8)

                Group {
                    switch step {
                    case 0: namingStep
                    case 1: bodyStep
                    case 2: activityStep
                    default: reviewStep
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.horizontal)

                HStack {
                    if step > 0 {
                        Button("Back") { step -= 1 }
                    }
                    Spacer()
                    if step < 3 {
                        Button("Next") { step += 1 }
                            .buttonStyle(.borderedProminent)
                            .disabled(!canAdvance)
                    } else {
                        Button("Finish") { finish() }
                            .buttonStyle(.borderedProminent)
                    }
                }
                .padding()
            }
            .navigationTitle("Welcome")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled()
            .onAppear {
                if name.isEmpty { name = profile.displayName }
            }
        }
    }

    private var canAdvance: Bool {
        switch step {
        case 0: return !name.trimmingCharacters(in: .whitespaces).isEmpty
        default: return true
        }
    }

    @ViewBuilder
    private var namingStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("What should we call you?")
                .font(.title2).bold()
            TextField("Your name", text: $name)
                .textFieldStyle(.roundedBorder)
            Text("This stays on your device — there's no account.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.top, 24)
    }

    @ViewBuilder
    private var bodyStep: some View {
        Form {
            Section {
                Picker("Sex", selection: $sex) {
                    ForEach(BiologicalSex.allCases) { Text($0.label).tag($0) }
                }
                Stepper(value: $age, in: 13...100) {
                    HStack {
                        Text("Age"); Spacer(); Text("\(age)").foregroundStyle(.secondary)
                    }
                }
                Stepper(value: $heightCm, in: 120...230) {
                    HStack {
                        Text("Height"); Spacer(); Text("\(heightCm) cm").foregroundStyle(.secondary)
                    }
                }
                Stepper(value: $weightKg, in: 35...250, step: 0.5) {
                    HStack {
                        Text("Weight"); Spacer()
                        Text(String(format: "%.1f kg", weightKg)).foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("About you")
            } footer: {
                Text("We use these to estimate your daily calorie needs (Mifflin–St Jeor).")
            }
        }
    }

    @ViewBuilder
    private var activityStep: some View {
        Form {
            Section("Activity level") {
                ForEach(ActivityLevel.allCases) { lvl in
                    Button {
                        activity = lvl
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(lvl.label.components(separatedBy: " (").first ?? lvl.label)
                                    .foregroundStyle(.primary)
                                Text(lvl.label.components(separatedBy: " (").dropFirst().first.map { "(\($0)" } ?? "")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if activity == lvl {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint)
                            }
                        }
                    }
                }
            }
            Section("Goal") {
                ForEach(GoalKind.allCases) { g in
                    Button {
                        goal = g
                    } label: {
                        HStack {
                            Text(g.label).foregroundStyle(.primary)
                            Spacer()
                            if goal == g {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var reviewStep: some View {
        let calc = calculated
        Form {
            Section {
                LabeledContent("Calories", value: "\(calc.calories) kcal")
                LabeledContent("Protein", value: String(format: "%.0f g", calc.proteinGrams))
                LabeledContent("Carbs", value: String(format: "%.0f g", calc.carbsGrams))
                LabeledContent("Fats", value: String(format: "%.0f g", calc.fatsGrams))
            } header: {
                Text("Suggested daily goals")
            } footer: {
                Text("You can fine-tune any of these later from Profile.")
            }
        }
    }

    private func finish() {
        let calc = calculated
        profile.displayName = name.trimmingCharacters(in: .whitespaces)
        profile.biologicalSex = sex
        profile.age = age
        profile.heightCm = Double(heightCm)
        profile.weightKg = weightKg
        profile.activityLevel = activity
        profile.goalKind = goal
        profile.dailyCalorieGoal = calc.calories
        profile.proteinGoalGrams = calc.proteinGrams
        profile.carbsGoalGrams = calc.carbsGrams
        profile.fatsGoalGrams = calc.fatsGrams
        profile.onboardingComplete = true
        try? context.save()
    }
}
