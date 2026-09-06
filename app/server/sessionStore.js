// Store de sessão do express-session que persiste as sessões em SQLite.
// Usa a mesma conexão better-sqlite3 do resto do app — nada de outro processo
// ou serviço: as sessões sobrevivem a restart do servidor e a tabela é limpa
// quando expira.
import { Store } from "express-session";

const DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export function createSessionStore(db) {
  const ps = {
    get: db.prepare("SELECT data, expires_at FROM sessions WHERE sid = ?"),
    set: db.prepare(
      `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`
    ),
    destroy: db.prepare("DELETE FROM sessions WHERE sid = ?"),
    prune: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),
  };

  class SqliteStore extends Store {
    get(sid, cb) {
      try {
        const row = ps.get.get(sid);
        if (!row) return cb(null, null);
        if (row.expires_at < Date.now()) {
          ps.destroy.run(sid);
          return cb(null, null);
        }
        cb(null, JSON.parse(row.data));
      } catch (err) {
        cb(err);
      }
    }

    set(sid, session, cb) {
      try {
        const expires =
          typeof session.cookie?.expires === "object" && session.cookie.expires instanceof Date
            ? session.cookie.expires.getTime()
            : Date.now() + DAYS_MS;
        ps.set.run(sid, JSON.stringify(session), expires);
        cb?.(null);
      } catch (err) {
        cb?.(err);
      }
    }

    destroy(sid, cb) {
      try {
        ps.destroy.run(sid);
        cb?.(null);
      } catch (err) {
        cb?.(err);
      }
    }

    prune() {
      ps.prune.run(Date.now());
    }
  }

  const store = new SqliteStore();
  setInterval(() => store.prune(), CLEANUP_INTERVAL_MS).unref?.();
  return store;
}