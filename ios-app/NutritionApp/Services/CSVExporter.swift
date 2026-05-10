import Foundation

enum CSVExporter {
    static func makeCSV(logs: [FoodLog]) -> String {
        let header = "date,time,name,category,servings,calories,protein_g,carbs_g,fats_g,is_manual,notes"
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "yyyy-MM-dd"
        let timeFmt = DateFormatter()
        timeFmt.dateFormat = "HH:mm"

        let rows = logs.sorted { $0.timestamp < $1.timestamp }.map { log -> String in
            let category = log.mealCategory?.rawValue ?? ""
            let notes = (log.notes ?? "").replacingOccurrences(of: "\"", with: "\"\"")
            let name = log.name.replacingOccurrences(of: "\"", with: "\"\"")
            return [
                dateFmt.string(from: log.timestamp),
                timeFmt.string(from: log.timestamp),
                "\"\(name)\"",
                category,
                String(format: "%.2f", log.servings),
                String(log.effectiveCalories),
                String(format: "%.1f", log.effectiveProtein),
                String(format: "%.1f", log.effectiveCarbs),
                String(format: "%.1f", log.effectiveFats),
                log.isManual ? "true" : "false",
                "\"\(notes)\""
            ].joined(separator: ",")
        }

        return ([header] + rows).joined(separator: "\n")
    }

    static func writeCSV(logs: [FoodLog]) throws -> URL {
        let csv = makeCSV(logs: logs)
        let url = FileManager.default
            .temporaryDirectory
            .appendingPathComponent("nutrition-export-\(Int(Date.now.timeIntervalSince1970)).csv")
        try csv.write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}
