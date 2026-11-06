import Social
import UniformTypeIdentifiers

/// Receives only text that the user explicitly shares. Never reads Messages history.
final class ShareViewController: SLComposeServiceViewController {
    override func isContentValid() -> Bool {
        return !contentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Saboia Cleaning"
        placeholder = Locale.preferredLanguages.first?.hasPrefix("pt") == true
            ? "Compartilhe a mensagem. Depois abra Saboia Cleaning para conferir."
            : "Share the message, then open Saboia Cleaning to review."
    }
    override func didSelectPost() {
        let text = contentText.trimmingCharacters(in: .whitespacesAndNewlines)
        // A single pending, explicitly shared message; app consumes and deletes it.
        if !text.isEmpty, let defaults = UserDefaults(suiteName: "group.com.saboiacleaning.app") {
            defaults.set(String(text.prefix(8000)), forKey: "pendingMessage")
            defaults.set(Date().timeIntervalSince1970, forKey: "pendingMessageTime")
        }
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
    override func configurationItems() -> [Any]! { return [] }
}
