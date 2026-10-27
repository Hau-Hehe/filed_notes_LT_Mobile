type SessionUser = { username: string; token: string };
type SecureStorage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
export type SessionState = {
  user: SessionUser | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
  retrySignOut: boolean;
};

const TOKEN = "user_token";
const USERNAME = "username";
const REVOKED = "field_notes_session_revoked";

export function createSessionController(storage: SecureStorage) {
  let state: SessionState = { user: null, ready: false, busy: false, error: null, retrySignOut: false };
  const listeners = new Set<() => void>();
  let running: Promise<void> | null = null;
  const publish = (next: Partial<SessionState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  const perform = (action: () => Promise<void>, isSignOut = false) => {
    if (running) return running;
    publish({ busy: true, error: null, retrySignOut: false });
    running = Promise.resolve().then(action).catch((error: unknown) => {
      publish({ user: null, retrySignOut: isSignOut, error: error instanceof Error ? error.message : "Không thể truy cập phiên đăng nhập. Vui lòng thử lại." });
    }).finally(() => {
      running = null;
      publish({ ready: true, busy: false });
    });
    return running;
  };

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    restore: () => perform(async () => {
      const [revoked, token, username] = await Promise.all([
        storage.getItemAsync(REVOKED), storage.getItemAsync(TOKEN),
        storage.getItemAsync(USERNAME),
      ]);
      if (revoked || !token || !username) { publish({ user: null }); return; }
      publish({ user: { username, token } });
    }),
    signIn: (username: string, password: string) => perform(async () => {
      if (!username.trim() || !password) throw new Error("Vui lòng nhập tên đăng nhập và mật khẩu.");
      // Preserve the existing mock authentication; there is no server session.
      // Write the revocation marker first so a partial sign-in cannot restore.
      await storage.setItemAsync(REVOKED, "1");
      await storage.setItemAsync(USERNAME, username);
      const token = "mock_jwt_token_1923050645";
      await storage.setItemAsync(TOKEN, token);
      await storage.deleteItemAsync(REVOKED);
      publish({ user: { username, token } });
    }),
    signOut: () => perform(async () => {
      // Remove protected screens immediately, even if secure storage fails.
      publish({ user: null });
      let markerWritten = false;
      try { await storage.setItemAsync(REVOKED, "1"); markerWritten = true; } catch { /* Still attempt both deletions. */ }
      const deleted = await Promise.allSettled([
        storage.deleteItemAsync(TOKEN), storage.deleteItemAsync(USERNAME),
      ]);
      if (deleted.some((result) => result.status === "rejected")) {
        throw new Error(markerWritten
          ? "Đã khóa phiên, nhưng chưa xóa hết thông tin SecureStore. Nhấn Thử xóa phiên lại."
          : "SecureStore đang lỗi: đã khóa giao diện nhưng chưa bảo đảm xóa phiên sau khi mở lại ứng dụng. Nhấn Thử xóa phiên lại trước khi đóng ứng dụng.");
      }
      // Keep a successfully written revocation marker until the next explicit sign-in.
    }, true),
  };
}
