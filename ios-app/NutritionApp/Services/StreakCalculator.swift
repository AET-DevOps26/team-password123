import Foundation

enum StreakCalculator {
    /// Number of consecutive days, ending today, that hit the calorie goal within ±tolerance.
    /// A day "hits" if it has at least one log AND total calories is within tolerance of the goal.
    /// Today counts only if at least one meal is logged.
    static func currentStreak(logs: [FoodLog], dailyCalorieGoal: Int, tolerance: Double = 0.10) -> Int {
        guard dailyCalorieGoal > 0 else { return 0 }
        let cal = Calendar.current
        let lower = Double(dailyCalorieGoal) * (1 - tolerance)
        let upper = Double(dailyCalorieGoal) * (1 + tolerance)

        var streak = 0
        var day = cal.startOfDay(for: .now)
        while true {
            let dayLogs = logs.filter { cal.isDate($0.timestamp, inSameDayAs: day) }
            if dayLogs.isEmpty {
                if streak == 0 && cal.isDateInToday(day) {
                    // Today not yet logged — not breaking the streak; check yesterday onward.
                    day = cal.date(byAdding: .day, value: -1, to: day)!
                    continue
                }
                break
            }
            let total = Double(dayLogs.totalCalories)
            if total >= lower && total <= upper {
                streak += 1
                day = cal.date(byAdding: .day, value: -1, to: day)!
            } else {
                break
            }
        }
        return streak
    }
}
