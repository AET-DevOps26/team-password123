import XCTest
import SwiftData
@testable import NutritionApp

@MainActor
final class CSVExporterTests: XCTestCase {
    private var container: ModelContainer!

    private static let header = "date,time,name,category,servings,calories,protein_g,carbs_g,fats_g,is_manual,notes"

    override func setUp() async throws {
        container = try TestSupport.makeInMemoryContainer()
    }

    private func insert(_ log: FoodLog) -> FoodLog {
        container.mainContext.insert(log)
        return log
    }

    private func fixedDate(day: Int = 5, hour: Int = 8, minute: Int = 15) -> Date {
        Calendar.current.date(from: DateComponents(year: 2026, month: 3, day: day, hour: hour, minute: minute))!
    }

    func test_emptyLogs_producesHeaderOnly() {
        XCTAssertEqual(CSVExporter.makeCSV(logs: []), Self.header)
    }

    func test_singleLog_fullRow() {
        let log = insert(FoodLog(
            timestamp: fixedDate(),
            name: "Oatmeal",
            isManual: true,
            mealCategory: .breakfast,
            servings: 1.0,
            calories: 350,
            proteinGrams: 12,
            carbsGrams: 60,
            fatsGrams: 7
        ))
        let lines = CSVExporter.makeCSV(logs: [log]).components(separatedBy: "\n")
        XCTAssertEqual(lines.count, 2)
        XCTAssertEqual(lines[0], Self.header)
        XCTAssertEqual(lines[1], "2026-03-05,08:15,\"Oatmeal\",breakfast,1.00,350,12.0,60.0,7.0,true,\"\"")
    }

    func test_quotesAndCommasInName_areEscaped() {
        let log = insert(FoodLog(
            timestamp: fixedDate(),
            name: "Chicken \"Spicy\", Bowl",
            calories: 500
        ))
        let csv = CSVExporter.makeCSV(logs: [log])
        XCTAssertTrue(csv.contains("\"Chicken \"\"Spicy\"\", Bowl\""), "name must be quoted with doubled inner quotes")
    }

    func test_quotesInNotes_areEscaped() {
        let log = insert(FoodLog(
            timestamp: fixedDate(),
            name: "Snack",
            notes: "He said \"wow\"",
            calories: 100
        ))
        let csv = CSVExporter.makeCSV(logs: [log])
        XCTAssertTrue(csv.contains("\"He said \"\"wow\"\"\""))
    }

    func test_newlineInName_staysInsideQuotedField() {
        let log = insert(FoodLog(
            timestamp: fixedDate(),
            name: "Line1\nLine2",
            calories: 100
        ))
        let csv = CSVExporter.makeCSV(logs: [log])
        XCTAssertTrue(csv.contains("\"Line1\nLine2\""), "multi-line name must remain a single quoted field")
    }

    func test_rowsAreSortedByTimestampAscending() {
        let later = insert(FoodLog(timestamp: fixedDate(day: 6), name: "Later", calories: 1))
        let earlier = insert(FoodLog(timestamp: fixedDate(day: 4), name: "Earlier", calories: 1))
        let lines = CSVExporter.makeCSV(logs: [later, earlier]).components(separatedBy: "\n")
        XCTAssertTrue(lines[1].contains("Earlier"))
        XCTAssertTrue(lines[2].contains("Later"))
    }

    func test_servingsApplyToExportedMacros() {
        let log = insert(FoodLog(
            timestamp: fixedDate(),
            name: "Half Pizza",
            isManual: false,
            servings: 1.5,
            calories: 400,
            proteinGrams: 20,
            carbsGrams: 40,
            fatsGrams: 10
        ))
        let lines = CSVExporter.makeCSV(logs: [log]).components(separatedBy: "\n")
        // effective = base * 1.5; servings formatted %.2f, macros %.1f
        XCTAssertEqual(lines[1], "2026-03-05,08:15,\"Half Pizza\",,1.50,600,30.0,60.0,15.0,false,\"\"")
    }

    func test_missingCategory_isEmptyField() {
        let log = insert(FoodLog(timestamp: fixedDate(), name: "X", calories: 1))
        let lines = CSVExporter.makeCSV(logs: [log]).components(separatedBy: "\n")
        XCTAssertTrue(lines[1].contains(",\"X\",,"), "nil category must export as an empty field")
    }
}
