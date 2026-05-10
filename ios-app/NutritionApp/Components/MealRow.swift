import SwiftUI

struct MealRow: View {
    let log: FoodLog

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        HStack(spacing: 12) {
            thumbnail
                .frame(width: 52, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(log.name)
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(Self.timeFormatter.string(from: log.timestamp))
                    if log.servings != 1.0 {
                        Text("• \(String(format: "%.2gx", log.servings))")
                    }
                    if log.hasIngredientBreakdown {
                        Image(systemName: "list.bullet")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                Text(macroLine)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(log.effectiveCalories)")
                    .font(.headline)
                Text("kcal")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let data = log.imageData, let uiImage = UIImage(data: data) {
            Image(uiImage: uiImage)
                .resizable()
                .scaledToFill()
        } else {
            ZStack {
                Color(.tertiarySystemFill)
                Image(systemName: log.inferredCategory.systemImage)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var macroLine: String {
        String(
            format: "P %.0fg • C %.0fg • F %.0fg",
            log.effectiveProtein, log.effectiveCarbs, log.effectiveFats
        )
    }
}
