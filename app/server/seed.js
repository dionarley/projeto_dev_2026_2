// Cria (ou atualiza) o usuário admin via linha de comando:
//
//   ADMIN_EMAIL=novo@email.com ADMIN_PASSWORD=minhasenha node server/seed.js
//
// Se ADMIN_EMAIL já existir, apenas a senha é atualizada.
import bcrypt from "bcryptjs";
import { createDb, seedOptions } from "./db.js";

const email = (process.env.ADMIN_EMAIL || "admin@vidasaude.com").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || "admin123";
const name = process.env.ADMIN_NAME || "Dr. Admin (Gestão)";

if (!password || password.length < 6) {
  console.error("ADMIN_PASSWORD precisa ter ao menos 6 caracteres.");
  process.exit(1);
}

const db = createDb(process.env.DATABASE_PATH || "data.sqlite");
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
const hash = bcrypt.hashSync(password, 10);

if (existing) {
  db.prepare("UPDATE users SET password_hash = ?, name = ? WHERE id = ?").run(
    hash,
    name,
    existing.id
  );
  console.log(`Senha do admin ${email} atualizada.`);
} else {
  db.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  ).run(name, email, hash);
  console.log(`Admin ${email} criado.`);
}

if (seedOptions(db)) {
  console.log("Opções iniciais cadastradas.");
} else {
  console.log("Opções já existem; nada mudou.");
}

console.log("Concluído.");