import Foundation
import Observation
import SwiftData

/// Bridges the local SwiftData cache and the backend. Views keep reading SwiftData
/// via `@Query`; they route *mutations* through this object, which writes locally
/// (optimistic) and pushes to the API. `sync()` pulls the server state into the
/// cache and flushes anything queued while offline.
@MainActor
@Observable
final class SyncService {
    var lastSyncFailed = false
    /// Set when a sync call hits an expired/invalid token (401 or empty-body 403).
    /// RootTabView observes this and signs the user out so they can log in again.
    var sessionExpired = false

    private let container: ModelContainer
    private let api = APIClient.shared

    nonisolated init(container: ModelContainer) {
        self.container = container
    }

    private var context: ModelContext { container.mainContext }

    /// Only talk to the backend when we hold a real bearer token and aren't in the
    /// launch-flag offline mode. A tokenless "Continue offline" guest stays fully
    /// local — which is what makes offline-first work without a sign-out loop.
    private var canSync: Bool {
        !AppConfig.offline && KeychainStore.get(APIClient.tokenKey) != nil
    }

    // MARK: - Pull + flush

    /// Full reconciliation: flush queued offline changes, then pull server state.
    func sync() async {
        guard canSync else { return }
        await flushTombstones()
        await pushUnsynced()
        await pullProfile()
        await pullGoals()
        await pullMeals()
    }

    private func pullProfile() async {
        guard let dto = try? await api.currentUser(), let profile = currentProfile() else { return }
        DTOMapper.apply(dto, to: profile)
        try? context.save()
    }

    private func pullGoals() async {
        guard let profile = currentProfile() else { return }
        // `try?` flattens the already-optional return, so this is a single unwrap:
        // nil = request failed OR 204 (no goals yet) — either way, leave onboarding as-is.
        guard let dto = try? await api.goals() else { return }
        DTOMapper.apply(dto, to: profile)
        // Server-side goals exist → this account has already onboarded.
        profile.onboardingComplete = true
        try? context.save()
    }

    private func pullMeals() async {
        let to = Date.now
        // 90 days: match the History/Analytics range picker so older days aren't blank.
        let from = Calendar.current.date(byAdding: .day, value: -90, to: to) ?? to
        let dtos: [MealResponseDTO]
        do {
            dtos = try await api.meals(from: DateFmt.day(from), to: DateFmt.day(to))
        } catch APIError.unauthorized {
            sessionExpired = true
            lastSyncFailed = true
            return
        } catch {
            lastSyncFailed = true
            return
        }
        lastSyncFailed = false

        let existing = syncedLogsByServerId()
        for dto in dtos {
            if let log = existing[dto.id] {
                // Don't clobber local edits that haven't been pushed yet.
                if !log.dirty { DTOMapper.update(log, from: dto) }
            } else {
                context.insert(DTOMapper.foodLog(from: dto))
            }
        }

        // Purge phantoms: a synced meal inside the pulled window that the server no
        // longer returns was deleted elsewhere. Offline creates (serverId == nil) and
        // rows outside the window are left alone.
        let returnedIds = Set(dtos.map { $0.id })
        for (sid, log) in existing where !returnedIds.contains(sid) {
            if log.timestamp >= from && log.timestamp <= to { context.delete(log) }
        }

        try? context.save()
    }

    // MARK: - Mutations (called by views)

    func addMeal(_ log: FoodLog) {
        context.insert(log)
        try? context.save()
        // A non-nil serverId means the meal is already on the backend (AI photo flow,
        // which persists on analyze) — insert locally only, don't double-create.
        if log.serverId == nil {
            Task { await pushCreate(log) }
        }
    }

    /// Sends a photo to the GenAI vision model. The backend analyzes *and persists*
    /// the meal; the returned `AnalyzedMealDTO.id` is its server id.
    func analyzePhoto(_ imageData: Data) async throws -> AnalyzedMealDTO {
        try await api.analyze(imageData: imageData, filename: "meal.jpg").meal
    }

    func updateMeal(_ log: FoodLog) {
        log.dirty = true
        try? context.save()
        Task { await pushUpdate(log) }
    }

    /// Best-effort delete of a server-side meal by id — used to clean up an AI photo
    /// meal that was analyzed (and thus persisted) but never saved, or that was
    /// replaced by a re-analysis. Tombstoned for retry if it can't go through now.
    func discardServerMeal(_ serverId: String) {
        Task { await pushDelete(serverId) }
    }

    func deleteMeal(_ log: FoodLog) {
        let serverId = log.serverId
        context.delete(log)
        try? context.save()
        guard let serverId else { return }   // never reached the server — nothing to delete
        Task { await pushDelete(serverId) }
    }

    func addWater(_ log: WaterLog) {
        // Water has no backend endpoint — local-only by design.
        context.insert(log)
        try? context.save()
    }

    /// Push the local profile (identity + physical data) and goals to the backend.
    func saveProfile() async {
        guard canSync, let profile = currentProfile() else { return }
        _ = try? await api.updateUser(DTOMapper.updateRequest(from: profile))
        _ = try? await api.saveGoals(DTOMapper.goalRequest(from: profile))
    }

    // MARK: - Push helpers

    private func pushCreate(_ log: FoodLog) async {
        guard canSync else { return }
        guard let res = try? await api.createMeal(DTOMapper.manualRequest(from: log)) else { return }
        log.serverId = res.id
        try? context.save()
    }

    private func pushUpdate(_ log: FoodLog) async {
        guard canSync, let serverId = log.serverId else { return }
        guard (try? await api.updateMeal(id: serverId, DTOMapper.manualRequest(from: log))) != nil else { return }
        log.dirty = false   // edits landed on the server
        try? context.save()
    }

    private func pushDelete(_ serverId: String) async {
        guard canSync else { addTombstone(serverId); return }
        do { try await api.deleteMeal(id: serverId) }
        catch APIError.http(let status, _) where status == 404 { /* already gone — done */ }
        catch { addTombstone(serverId) }
    }

    private func pushUnsynced() async {
        // New offline creates (no serverId yet)...
        let creates = FetchDescriptor<FoodLog>(predicate: #Predicate { $0.serverId == nil })
        for log in (try? context.fetch(creates)) ?? [] { await pushCreate(log) }
        // ...and rows edited while offline (already have a serverId, marked dirty).
        let edits = FetchDescriptor<FoodLog>(predicate: #Predicate { $0.dirty && $0.serverId != nil })
        for log in (try? context.fetch(edits)) ?? [] { await pushUpdate(log) }
    }

    private func flushTombstones() async {
        guard let tombstones = try? context.fetch(FetchDescriptor<MealTombstone>()) else { return }
        for tomb in tombstones {
            do {
                try await api.deleteMeal(id: tomb.serverId)
                context.delete(tomb)
            } catch APIError.http(let status, _) where status == 404 {
                context.delete(tomb)   // already gone on the server — treat as done
            } catch { /* keep for next attempt */ }
        }
        try? context.save()
    }

    // MARK: - Local lookups

    private func currentProfile() -> UserProfile? {
        try? context.fetch(FetchDescriptor<UserProfile>(sortBy: [SortDescriptor(\.createdAt)])).first
    }

    private func syncedLogsByServerId() -> [String: FoodLog] {
        let all = (try? context.fetch(FetchDescriptor<FoodLog>())) ?? []
        var map: [String: FoodLog] = [:]
        for log in all { if let sid = log.serverId { map[sid] = log } }
        return map
    }

    private func addTombstone(_ serverId: String) {
        context.insert(MealTombstone(serverId: serverId))
        try? context.save()
    }
}

// MARK: - Tombstone

/// Records a server meal id whose delete couldn't be pushed (offline / failure),
/// so the next `sync()` can retry it.
@Model
final class MealTombstone {
    @Attribute(.unique) var serverId: String
    init(serverId: String) { self.serverId = serverId }
}

// MARK: - Mapping

enum DTOMapper {
    // FoodLog <-> meals-service

    static func manualRequest(from log: FoodLog) -> ManualMealRequestDTO {
        // Collapse to a single item carrying the effective (servings-applied) totals,
        // matching the web client's singleItemFromMacros convention. Ingredient
        // breakdown stays a local-only nicety.
        let item = MealItemRequestDTO(
            name: log.name.isEmpty ? log.inferredCategory.label : log.name,
            quantity: 1,
            unit: "serving",
            calories: Double(log.effectiveCalories),
            proteinGrams: log.effectiveProtein,
            carbsGrams: log.effectiveCarbs,
            fatGrams: log.effectiveFats,
            fiberGrams: 0
        )
        return ManualMealRequestDTO(
            mealType: log.inferredCategory.rawValue.uppercased(),
            loggedAt: DateFmt.iso(log.timestamp),
            notes: log.notes,
            items: [item]
        )
    }

    static func foodLog(from dto: MealResponseDTO) -> FoodLog {
        let log = FoodLog(name: dto.items.first?.name ?? dto.notes ?? "Meal")
        update(log, from: dto)
        return log
    }

    static func update(_ log: FoodLog, from dto: MealResponseDTO) {
        log.serverId = dto.id
        log.name = dto.items.first?.name ?? dto.notes ?? log.name
        log.notes = dto.notes
        log.timestamp = DateFmt.date(dto.loggedAt) ?? log.timestamp
        log.mealCategory = MealCategory(rawValue: dto.mealType.lowercased())
        log.servings = 1
        log.isManual = dto.sourceType != "PHOTO_AI"
        log.calories = Int(dto.calories.rounded())
        log.proteinGrams = dto.proteinGrams
        log.carbsGrams = dto.carbsGrams
        log.fatsGrams = dto.fatGrams
        log.ingredients = nil
    }

    // UserProfile <-> auth-service + analytics-service

    static func apply(_ dto: UserResponseDTO, to profile: UserProfile) {
        profile.displayName = dto.displayName
        profile.email = dto.email
        profile.serverId = dto.id
        if let h = dto.heightCm { profile.heightCm = Double(h) }
        if let w = dto.weightKg { profile.weightKg = w }
        if let a = dto.age { profile.age = a }
        if let s = dto.sex { profile.biologicalSex = BiologicalSex(rawValue: s) }
        if let al = dto.activityLevel { profile.activityLevel = ActivityLevel(rawValue: al) }
        if let g = dto.goal { profile.goalKind = GoalKind(rawValue: g) }
    }

    static func apply(_ dto: GoalResponseDTO, to profile: UserProfile) {
        profile.dailyCalorieGoal = Int(dto.dailyCalories.rounded())
        profile.proteinGoalGrams = dto.proteinGrams
        profile.carbsGoalGrams = dto.carbsGrams
        profile.fatsGoalGrams = dto.fatGrams
    }

    static func updateRequest(from profile: UserProfile) -> UpdateUserRequestDTO {
        UpdateUserRequestDTO(
            displayName: profile.displayName,
            heightCm: profile.heightCm.map { Int($0.rounded()) },
            weightKg: profile.weightKg,
            age: profile.age,
            sex: profile.biologicalSex?.rawValue,
            activityLevel: profile.activityLevel?.rawValue,
            goal: profile.goalKind?.rawValue
        )
    }

    static func goalRequest(from profile: UserProfile) -> GoalRequestDTO {
        GoalRequestDTO(
            dailyCalories: Double(profile.dailyCalorieGoal),
            proteinGrams: profile.proteinGoalGrams,
            carbsGrams: profile.carbsGoalGrams,
            fatGrams: profile.fatsGoalGrams,
            fiberGrams: 0
        )
    }
}

// MARK: - Date formatting

enum DateFmt {
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func iso(_ date: Date) -> String { isoFractional.string(from: date) }

    static func day(_ date: Date) -> String { dayFormatter.string(from: date) }

    static func date(_ string: String) -> Date? {
        if let d = isoFractional.date(from: string) { return d }
        if let d = isoPlain.date(from: string) { return d }
        // Backend OffsetDateTime can carry nanoseconds; trim to milliseconds and retry.
        let normalized = normalizeFraction(string)
        return isoFractional.date(from: normalized) ?? isoPlain.date(from: normalized)
    }

    private static func normalizeFraction(_ s: String) -> String {
        guard let dot = s.firstIndex(of: ".") else { return s }
        var idx = s.index(after: dot)
        var digits = ""
        while idx < s.endIndex, s[idx].isNumber {
            digits.append(s[idx])
            idx = s.index(after: idx)
        }
        // Pad short fractions up to 3 digits: the backend suppresses trailing zeros
        // (".120Z" comes back as ".12Z"), which the strict parser otherwise rejects,
        // dropping the meal onto today's date.
        let millis = String((digits + "000").prefix(3))
        return String(s[s.startIndex..<dot]) + "." + millis + String(s[idx...])
    }
}
