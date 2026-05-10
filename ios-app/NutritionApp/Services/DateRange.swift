import Foundation

enum AnalyticsRange: String, CaseIterable, Identifiable {
    case sevenDays, thirtyDays, ninetyDays

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sevenDays: return "7 days"
        case .thirtyDays: return "30 days"
        case .ninetyDays: return "90 days"
        }
    }

    var dayCount: Int {
        switch self {
        case .sevenDays: return 7
        case .thirtyDays: return 30
        case .ninetyDays: return 90
        }
    }
}
