import Foundation
import Security

// MARK: - Configuration

/// Backend configuration. All requests go to a single base URL — the AET ingress
/// reverse-proxies `/api/*` to the auth / meals / analytics microservices, exactly
/// like the web client's nginx. Override with the `API_BASE_URL` env var (scheme
/// argument) to point at a local docker-compose stack during development.
enum AppConfig {
    static let baseURL: URL = {
        let raw = ProcessInfo.processInfo.environment["API_BASE_URL"]
            ?? "https://team-password123-devops-ss26.stud.k8s.aet.cit.tum.de"
        return URL(string: raw)!
    }()

    /// When true, the app never hits the network and behaves as a brand-new local
    /// user (mirrors the web client's OFFLINE_MODE). Toggled with `--offline`.
    static let offline: Bool = ProcessInfo.processInfo.arguments.contains("--offline")
}

// MARK: - Keychain (JWT storage)

/// Minimal Keychain wrapper for the bearer token. The token is the single source of
/// truth for "is the user signed in" — `APIClient` reads it on every request.
enum KeychainStore {
    private static let service = "com.password123.NutritionApp"

    static func set(_ value: String?, for key: String) {
        delete(key)
        guard let value, let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Errors

enum APIError: LocalizedError {
    case offline
    case unauthorized
    case http(status: Int, message: String)
    case decoding(Error)
    case transport(Error)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .offline: return "You're offline."
        case .unauthorized: return "Your session has expired. Please sign in again."
        case let .http(status, message):
            return message.isEmpty ? "Request failed (\(status))." : message
        case .decoding: return "Couldn't read the server response."
        case let .transport(error): return error.localizedDescription
        case .invalidResponse: return "Unexpected server response."
        }
    }
}

// MARK: - API client

/// Thin async/await wrapper over `URLSession`. Stateless: the bearer token is read
/// from the Keychain per request, so there's one source of truth for auth state.
struct APIClient {
    static let shared = APIClient()

    static let tokenKey = "accessToken"

    private let session: URLSession = .shared

    private var encoder: JSONEncoder {
        let e = JSONEncoder()
        return e
    }

    private var decoder: JSONDecoder {
        let d = JSONDecoder()
        return d
    }

    // MARK: Requests

    func get<Response: Decodable>(_ path: String, authorized: Bool = true) async throws -> Response {
        try await send(path, method: "GET", body: Optional<Empty>.none, authorized: authorized)
    }

    @discardableResult
    func post<Body: Encodable, Response: Decodable>(
        _ path: String, body: Body, authorized: Bool = true
    ) async throws -> Response {
        try await send(path, method: "POST", body: body, authorized: authorized)
    }

    @discardableResult
    func put<Body: Encodable, Response: Decodable>(
        _ path: String, body: Body, authorized: Bool = true
    ) async throws -> Response {
        try await send(path, method: "PUT", body: body, authorized: authorized)
    }

    func delete(_ path: String, authorized: Bool = true) async throws {
        let _: Empty = try await send(path, method: "DELETE", body: Optional<Empty>.none, authorized: authorized)
    }

    /// Returns the decoded body, or `nil` for a 204 No Content (e.g. `GET /api/goals`).
    func getOptional<Response: Decodable>(_ path: String, authorized: Bool = true) async throws -> Response? {
        try await sendOptional(path, method: "GET", body: Optional<Empty>.none, authorized: authorized)
    }

    // MARK: Multipart (photo analyze)

    /// `POST /api/meals/analyze` — multipart upload with the image part named `image`.
    func analyze(imageData: Data, filename: String) async throws -> MealAnalysisResponseDTO {
        guard !AppConfig.offline else { throw APIError.offline }
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: AppConfig.baseURL.appendingPathComponent("api/meals/analyze"))
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        attachAuth(&request)

        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"image\"; filename=\"\(filename)\"\r\n")
        body.appendString("Content-Type: image/jpeg\r\n\r\n")
        body.append(imageData)
        body.appendString("\r\n--\(boundary)--\r\n")
        request.httpBody = body

        let (data, response) = try await perform(request)
        try validate(response, data: data)
        do {
            return try decoder.decode(MealAnalysisResponseDTO.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    // MARK: Core

    private func send<Body: Encodable, Response: Decodable>(
        _ path: String, method: String, body: Body?, authorized: Bool
    ) async throws -> Response {
        guard let value: Response = try await sendOptional(path, method: method, body: body, authorized: authorized) else {
            // A 204 where the caller expects a value: surface as empty Decodable if possible.
            if let empty = Empty() as? Response { return empty }
            throw APIError.invalidResponse
        }
        return value
    }

    private func sendOptional<Body: Encodable, Response: Decodable>(
        _ path: String, method: String, body: Body?, authorized: Bool
    ) async throws -> Response? {
        guard !AppConfig.offline else { throw APIError.offline }

        var request = URLRequest(url: AppConfig.baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if authorized { attachAuth(&request) }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await perform(request)
        try validate(response, data: data)

        if data.isEmpty { return nil }            // 204 No Content
        if Response.self == Empty.self { return Empty() as? Response }
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func perform(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }
    }

    private func attachAuth(_ request: inout URLRequest) {
        if let token = KeychainStore.get(Self.tokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch http.statusCode {
        case 200...299: return
        case 401: throw APIError.unauthorized
        default:
            let message = String(data: data, encoding: .utf8) ?? ""
            throw APIError.http(status: http.statusCode, message: message)
        }
    }
}

/// Placeholder body/response for requests with no JSON payload.
struct Empty: Codable {}

private extension Data {
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) { append(data) }
    }
}
