import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS options (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  duration_min  INTEGER NOT NULL DEFAULT 30,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL DEFAULT '',
  option_id      INTEGER NOT NULL REFERENCES options(id),
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','confirmado','cancelado')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registrations_date ON registrations(scheduled_date, scheduled_time);

CREATE TABLE IF NOT EXISTS sessions (
  sid       TEXT PRIMARY KEY,
  data      TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
`;

// Status válidos, centralizados para reuso em validações.
export const VALID_STATUS = ["pendente", "confirmado", "cancelado"];

export function createDb(path = ":memory:") {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

// Inserção do usuário admin (apenas se ainda não existir).
export function seedAdmin(db, { name, email, passwordHash }) {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return false;
  db.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  ).run(name, email, passwordHash);
  return true;
}

// Opções iniciais que dão vida à página pública (executadas apenas se a tabela estiver vazia).
export function seedOptions(db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM options").get().n;
  if (count > 0) return false;

  const insert = db.prepare(
    `INSERT INTO options (title, description, price_cents, duration_min, active)
     VALUES (@title, @description, @price_cents, @duration_min, @active)`
  );
  const seed = [
    {
      title: "Clínica Geral",
      description: "Consulta de acolhimento inicial com sintomas e encaminhamentos.",
      price_cents: 12000,
      duration_min: 20,
      active: 1,
    },
    {
      title: "Cardiologia",
      description: "Avaliação cardiológica com receita e acompanhamento.",
      price_cents: 22000,
      duration_min: 30,
      active: 1,
    },
    {
      title: "Dermatologia",
      description: "Análise de lesões, manchas e tratamentos de pele.",
      price_cents: 20000,
      duration_min: 30,
      active: 1,
    },
    {
      title: "Psiquiatria",
      description: "Acompanhamento psiquiátrico com emissão de receitas digitais.",
      price_cents: 25000,
      duration_min: 40,
      active: 1,
    },
    {
      title: "Pediatria (teleducação)",
      description: "Orientações pediátricas para pais e cuidadores.",
      price_cents: 15000,
      duration_min: 25,
      active: 0, // exemplifica uma opção desativada
    },
  ];
  const tx = db.transaction(() => {
    for (const row of seed) insert.run(row);
  });
  tx();
  return true;
}