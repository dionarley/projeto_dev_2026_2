import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { createSessionStore } from "./sessionStore.js";
import { VALID_STATUS } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, "../dist");

/* ── Helpers de validação ─────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valida o payload público de um agendamento. Retorna uma lista de erros. */
export function validateRegistration(body, activeOptions) {
  const errors = {};

  if (!body.name || String(body.name).trim().length < 3) {
    errors.name = "Informe seu nome completo.";
  }

  if (!body.email || !EMAIL_RE.test(String(body.email))) {
    errors.email = "Informe um e-mail válido.";
  }

  if (body.phone && !/^[\d\s()+.-]{8,20}$/.test(String(body.phone))) {
    errors.phone = "Telefone inválido.";
  }

  const option = activeOptions.find((o) => o.id === Number(body.option_id));
  if (!option) {
    errors.option_id = "Escolha uma especialidade disponível.";
  }

  if (!body.scheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.scheduled_date))) {
    errors.scheduled_date = "Informe uma data válida.";
  } else if (String(body.scheduled_date) < todayLocal()) {
    errors.scheduled_date = "A data não pode estar no passado.";
  }

  if (!body.scheduled_time || !TIME_RE.test(String(body.scheduled_time))) {
    errors.scheduled_time = "Informe um horário válido (HH:MM).";
  }

  return { option, errors };
}

function isAdminSession(req) {
  return Boolean(req.session?.userId);
}

function requireAdmin(req, res, next) {
  if (!isAdminSession(req)) {
    return res.status(401).json({ error: "Não autenticado." });
  }
  next();
}

/* ── Rate limit / anti-spam no envio público ──────────────────────────── */

function createTokenBucket(limitPerMinute) {
  const buckets = new Map();
  return function check(key) {
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now - entry.resetAt > 60_000) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (entry.count >= limitPerMinute) return false;
    entry.count += 1;
    return true;
  };
}

/* ── App ──────────────────────────────────────────────────────────────── */

export function createApp(db, env = {}) {
  const app = express();

  const {
    sessionSecret = env.SESSION_SECRET || "troque-esta-chave-em-producao",
    adminEmail = env.ADMIN_EMAIL || "admin@vidasaude.com",
  } = env;

  app.set("trust proxy", 1);

  app.use(express.json({ limit: "100kb" }));
  app.use(
    session({
      store: createSessionStore(db),
      name: "vs_session",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: false, // true quando rodando por HTTPS
      },
    })
  );

  const registrationRateLimit = createTokenBucket(5);

  const stmts = {
    getAdminByEmail: db.prepare(
      "SELECT id, name, email, password_hash, role FROM users WHERE email = ? AND role = 'admin'"
    ),
    getUserById: db.prepare("SELECT id, name, email, role FROM users WHERE id = ?"),
    activeOptions: db.prepare(
      "SELECT id, title, description, price_cents, duration_min, active FROM options WHERE active = 1 ORDER BY title"
    ),
    allOptions: db.prepare("SELECT * FROM options ORDER BY title"),
    createRegistration: db.prepare(
      `INSERT INTO registrations
         (name, email, phone, option_id, scheduled_date, scheduled_time)
       VALUES (@name, @email, @phone, @option_id, @scheduled_date, @scheduled_time)`
    ),
    recentDuplicate: db.prepare(
      `SELECT id FROM registrations
       WHERE email = ? AND option_id = ? AND scheduled_date = ? AND created_at >= datetime('now', '-1 minute')
       LIMIT 1`
    ),
    getRegistration: db.prepare("SELECT * FROM registrations WHERE id = ?"),
    updateStatus: db.prepare(
      "UPDATE registrations SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ),
    stats: db.prepare(
      `SELECT status, COUNT(*) AS n FROM registrations GROUP BY status`
    ),
    statsToday: db.prepare(
      "SELECT COUNT(*) AS n FROM registrations WHERE scheduled_date = date('now')"
    ),
    insertOption: db.prepare(
      `INSERT INTO options (title, description, price_cents, duration_min, active)
       VALUES (@title, @description, @price_cents, @duration_min, @active)`
    ),
    updateOption: db.prepare(
      `UPDATE options SET title = @title, description = @description,
         price_cents = @price_cents, duration_min = @duration_min,
         active = @active, updated_at = datetime('now')
       WHERE id = @id`
    ),
    getOption: db.prepare("SELECT * FROM options WHERE id = ?"),
  };

  /* ── Auth ── */

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha." });
    }
    const user = stmts.getAdminByEmail.get(String(email).toLowerCase().trim());
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }
    req.session.userId = user.id;
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.get("/api/me", (req, res) => {
    if (!isAdminSession(req)) return res.status(401).json({ error: "Não autenticado." });
    const user = stmts.getUserById.get(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Sessão expirada." });
    }
    res.json(user);
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => res.status(204).end());
  });

  /* ── Público ── */

  app.get("/api/options", (req, res) => {
    res.json(stmts.activeOptions.all());
  });

  app.post("/api/registrations", (req, res) => {
    const clientIp = req.ip || "unknown";
    if (!registrationRateLimit(clientIp)) {
      return res.status(429).json({ error: "Muitos envios em pouco tempo. Aguarde um minuto." });
    }

    const body = req.body ?? {};
    const activeOptions = stmts.activeOptions.all();
    const { option, errors } = validateRegistration(body, activeOptions);
    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ errors });
    }

    const dup = stmts.recentDuplicate.get(
      String(body.email).toLowerCase().trim(),
      option.id,
      String(body.scheduled_date)
    );
    if (dup) {
      return res.status(429).json({
        error: "Você já enviou este agendamento. Aguarde um instante.",
      });
    }

    const info = stmts.createRegistration.run({
      name: String(body.name).trim(),
      email: String(body.email).toLowerCase().trim(),
      phone: String(body.phone ?? "").trim(),
      option_id: option.id,
      scheduled_date: String(body.scheduled_date),
      scheduled_time: String(body.scheduled_time),
    });

    const created = stmts.getRegistration.get(info.lastInsertRowid);
    res.status(201).json({
      message: "Agendamento enviado! Aguarde a confirmação da equipe.",
      registration: {
        ...created,
        option_title: option.title,
      },
    });
  });

  /* ── Painel (somente admin) ── */

  app.use("/api/admin", requireAdmin);

  app.get("/api/admin/stats", (req, res) => {
    const rows = stmts.stats.all();
    const counts = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    res.json({
      total: rows.reduce((acc, r) => acc + r.n, 0),
      pendente: counts.pendente ?? 0,
      confirmado: counts.confirmado ?? 0,
      cancelado: counts.cancelado ?? 0,
      hoje: stmts.statsToday.get().n,
    });
  });

  app.get("/api/admin/registrations", (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const { status, q } = req.query;

    const where = [];
    const params = {};

    if (status && VALID_STATUS.includes(String(status))) {
      where.push("reg.status = @status");
      params.status = String(status);
    }
    if (q) {
      where.push("(reg.name LIKE @q OR reg.email LIKE @q)");
      params.q = `%${String(q).trim()}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = db
      .prepare(
        `SELECT COUNT(*) AS n FROM registrations reg
         JOIN options opt ON opt.id = reg.option_id
         ${whereSql}`
      )
      .get(params).n;
    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
    const safePage = Math.min(page, totalPages);

    const items = db
      .prepare(
        `SELECT reg.*, opt.title AS option_title
         FROM registrations reg
         JOIN options opt ON opt.id = reg.option_id
         ${whereSql}
         ORDER BY reg.scheduled_date ASC, reg.scheduled_time ASC, reg.created_at ASC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset: (safePage - 1) * limit });

    res.json({ items, total, page: safePage, limit, totalPages });
  });

  app.patch("/api/admin/registrations/:id/status", (req, res) => {
    const reg = stmts.getRegistration.get(Number(req.params.id));
    if (!reg) return res.status(404).json({ error: "Registro não encontrado." });

    const status = req.body?.status;
    if (!VALID_STATUS.includes(status)) {
      return res.status(422).json({ error: "Status inválido." });
    }
    if (status === reg.status) {
      return res.status(422).json({ error: "O registro já está com este status." });
    }

    stmts.updateStatus.run(status, reg.id);
    res.json(stmts.getRegistration.get(reg.id));
  });

  app.get("/api/admin/options", (req, res) => {
    const options = stmts.allOptions.all();
    const counts = db
      .prepare(
        "SELECT option_id, COUNT(*) AS n FROM registrations GROUP BY option_id"
      )
      .all();
    const byId = Object.fromEntries(counts.map((c) => [c.option_id, c.n]));
    res.json(options.map((o) => ({ ...o, registrations: byId[o.id] ?? 0 })));
  });

  app.post("/api/admin/options", (req, res) => {
    const body = req.body ?? {};
    const title = String(body.title ?? "").trim();
    if (title.length < 3) {
      return res.status(422).json({ error: "O título precisa ter ao menos 3 caracteres." });
    }
    const info = stmts.insertOption.run({
      title,
      description: String(body.description ?? "").trim(),
      price_cents: Math.max(0, Number(body.price_cents) || 0),
      duration_min: Math.min(
        240,
        Math.max(10, Number(body.duration_min) || 30)
      ),
      active: body.active === false || body.active === 0 ? 0 : 1,
    });
    res.status(201).json(stmts.getOption.get(info.lastInsertRowid));
  });

  app.put("/api/admin/options/:id", (req, res) => {
    const existing = stmts.getOption.get(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: "Opção não encontrada." });

    const body = req.body ?? {};
    const title =
      body.title !== undefined ? String(body.title).trim() : existing.title;
    if (title.length < 3) {
      return res.status(422).json({ error: "O título precisa ter ao menos 3 caracteres." });
    }

    stmts.updateOption.run({
      id: existing.id,
      title,
      description:
        body.description !== undefined ? String(body.description).trim() : existing.description,
      price_cents:
        body.price_cents !== undefined ? Math.max(0, Number(body.price_cents) || 0) : existing.price_cents,
      duration_min:
        body.duration_min !== undefined
          ? Math.min(240, Math.max(10, Number(body.duration_min) || 30))
          : existing.duration_min,
      active:
        body.active !== undefined ? (body.active === false || body.active === 0 ? 0 : 1) : existing.active,
    });
    res.json(stmts.getOption.get(existing.id));
  });

  /* ── Front estático (produção) ── */

  if (env.serveStatic !== false && env.serveStatic !== "none") {
    app.use(express.static(DIST_DIR));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      res.sendFile(path.join(DIST_DIR, "index.html"));
    });
  }

  // Aviso simples para quem roda sem variáveis de ambiente.
  if (!env.SESSION_SECRET) {
    console.warn(
      "[vida-saude] SESSION_SECRET não definido. Usando valor de desenvolvimento."
    );
  }

  return app;
}