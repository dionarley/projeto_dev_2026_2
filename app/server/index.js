import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { createDb, seedAdmin, seedOptions } from "./db.js";
import { createApp } from "./app.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3333);
const DB_PATH = process.env.DATABASE_PATH || "data.sqlite";

// Credenciais do admin. Em desenvolvimento há um padrão que aparece no
// README; em produção defina ADMIN_EMAIL / ADMIN_PASSWORD no .env.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@vidasaude.com";
const ADMIN_NAME = process.env.ADMIN_NAME || "Dr. Admin (Gestão)";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const db = createDb(DB_PATH);

const adminCreated = seedAdmin(db, {
  name: ADMIN_NAME,
  email: ADMIN_EMAIL.toLowerCase().trim(),
  passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
});
if (adminCreated) {
  console.log(`[vida-saude] Usuário admin criado: ${ADMIN_EMAIL}`);
}

if (seedOptions(db)) {
  console.log("[vida-saude] Opções iniciais cadastradas.");
}

const app = createApp(db, { ...process.env });

app.listen(PORT, () => {
  console.log(`[vida-saude] API ouvindo em http://localhost:${PORT}`);
  if (!process.env.DATABASE_PATH) {
    console.log(`[vida-saude] Banco de dados: ${DB_PATH}`);
  }
});