import SwiftUI

/// Login / register gate shown before the main app when there's no session.
struct AuthView: View {
    @Environment(Session.self) private var session

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var errorMessage: String?
    @State private var busy = false

    enum Mode: Hashable {
        case signIn, register
        var cta: String { self == .signIn ? "Sign in" : "Create account" }
    }

    var body: some View {
        VStack(spacing: 22) {
            Spacer()

            VStack(spacing: 8) {
                Image(systemName: "leaf.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.green)
                Text("calorieeasy").font(.largeTitle.bold())
                Text(mode == .signIn ? "Welcome back" : "Create your account")
                    .foregroundStyle(.secondary)
            }

            Picker("Mode", selection: $mode) {
                Text("Sign in").tag(Mode.signIn)
                Text("Create account").tag(Mode.register)
            }
            .pickerStyle(.segmented)

            VStack(spacing: 12) {
                if mode == .register {
                    LabeledField(title: "Name", systemImage: "person", text: $displayName)
                }
                LabeledField(title: "Email", systemImage: "envelope", text: $email,
                             keyboard: .emailAddress)
                LabeledField(title: "Password", systemImage: "lock", text: $password, secure: true)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: submit) {
                Group {
                    if busy { ProgressView() } else { Text(mode.cta).bold() }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .tint(.green)
            .disabled(busy || !formValid)

            // Offline-first: usable without an account. A guest session stays fully
            // local (SyncService.canSync is false without a token), so this never
            // triggers a network call or a sign-out loop.
            Button("Continue offline") { session.continueOffline() }
                .font(.footnote)

            Spacer()
        }
        .padding(24)
    }

    private var formValid: Bool {
        !email.isEmpty && password.count >= 8 && (mode == .signIn || !displayName.isEmpty)
    }

    private func submit() {
        busy = true
        errorMessage = nil
        Task {
            do {
                switch mode {
                case .signIn:
                    try await session.login(email: email, password: password)
                case .register:
                    try await session.register(email: email, password: password, displayName: displayName)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            busy = false
        }
    }
}

private struct LabeledField: View {
    let title: String
    let systemImage: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var secure: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            if secure {
                SecureField(title, text: $text)
            } else {
                TextField(title, text: $text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
