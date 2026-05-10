import SwiftUI

struct WaterCard: View {
    let consumedML: Int
    let goalML: Int
    let onAdd: (Int) -> Void

    private var progress: Double {
        guard goalML > 0 else { return 0 }
        return min(Double(consumedML) / Double(goalML), 1.0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Water", systemImage: "drop.fill")
                    .foregroundStyle(.cyan)
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text("\(consumedML) / \(goalML) ml")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: progress)
                .tint(.cyan)

            HStack(spacing: 8) {
                ForEach([200, 250, 500], id: \.self) { ml in
                    Button {
                        onAdd(ml)
                    } label: {
                        Text("+\(ml) ml")
                            .font(.caption.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(Color.cyan.opacity(0.12))
                            .foregroundStyle(.cyan)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
