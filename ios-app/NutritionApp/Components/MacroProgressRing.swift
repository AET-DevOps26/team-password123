import SwiftUI

struct MacroProgressRing: View {
    let label: String
    let current: Double
    let goal: Double
    let unit: String
    let tint: Color

    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(current / goal, 1.0)
    }

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(tint.opacity(0.15), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(tint, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.4), value: progress)
                VStack(spacing: 0) {
                    Text("\(Int(current))")
                        .font(.headline)
                        .fontWeight(.semibold)
                    Text(unit)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 72, height: 72)

            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
