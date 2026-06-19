import Foundation
import Observation

/// Observable authentication state. The bearer token lives in the Keychain;
/// this object mirrors the signed-in identity for the UI and gates the app.
/// Not `@MainActor` — it holds no SwiftData context; its async methods are always
/// driven from the main-actor UI, so observable writes land on the main thread.
@Observable
final class Session {
    private(set) var userId: String?
    private(set) var email: String?
    private(set) var displayName: String?

    var isAuthenticated: Bool { userId != nil }

    private let api = APIClient.shared
    private let defaults = UserDefaults.standard

    init() {
        // Restore a previous session if a token is still in the Keychain.
        if KeychainStore.get(APIClient.tokenKey) != nil {
            userId = defaults.string(forKey: Keys.userId)
            email = defaults.string(forKey: Keys.email)
            displayName = defaults.string(forKey: Keys.displayName)
        }
    }

    func register(email: String, password: String, displayName: String) async throws {
        let res = try await api.register(.init(email: email, password: password, displayName: displayName))
        apply(res)
    }

    func login(email: String, password: String) async throws {
        let res = try await api.login(.init(email: email, password: password))
        apply(res)
    }

    /// Offline shortcut (mirrors the web client's OFFLINE_MODE guest).
    func continueOffline() {
        userId = "offline"
        email = "guest@local"
        displayName = "Guest"
    }

    func signOut() {
        KeychainStore.set(nil, for: APIClient.tokenKey)
        for key in [Keys.userId, Keys.email, Keys.displayName] { defaults.removeObject(forKey: key) }
        userId = nil
        email = nil
        displayName = nil
    }

    private func apply(_ res: AuthResponseDTO) {
        KeychainStore.set(res.accessToken, for: APIClient.tokenKey)
        userId = res.userId
        email = res.email
        displayName = res.displayName
        defaults.set(res.userId, forKey: Keys.userId)
        defaults.set(res.email, forKey: Keys.email)
        defaults.set(res.displayName, forKey: Keys.displayName)
    }

    private enum Keys {
        static let userId = "session.userId"
        static let email = "session.email"
        static let displayName = "session.displayName"
    }
}
