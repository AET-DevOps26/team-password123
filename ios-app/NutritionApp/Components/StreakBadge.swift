import SwiftUI

struct StreakBadge: View {
    let streak: Int

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .foregroundStyle(.orange)
            Text(streak == 0 ? "No streak yet" : "\(streak)-day streak")
                .font(.caption.weight(.medium))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.orange.opacity(streak == 0 ? 0.08 : 0.15))
        .clipShape(Capsule())
    }
}
