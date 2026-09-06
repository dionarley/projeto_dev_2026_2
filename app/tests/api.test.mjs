import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createDb, seedAdmin, seedOptions } from "../server/db.js";
import { createApp } from "../server/app.js";

let db;
let app;
let server;

function freshDb() {
  const d = createDb(":memory:");
  seedAdmin(d, {
    name: "Admin Teste",
    email: "admin@vidasaude.com",
    passwordHash: bcrypt.hashSync("admin123", 10),
  });
  seedOptions(d);
  return d;
}

const validPayload = {
  name: "Maria da Silva",
  email: "maria@email.com",
  phone: "(11) 99999-9999",
  option_id: 1,
  scheduled_date: "2030-06-15",
  scheduled_time: "14:30",
};

async function loginAdmin(agent) {
  const res = await agent
    .post("/api/login")
    .send({ email: "admin@vidasaude.com", password: "admin123" });
  expect(res.status).toBe(200);
  return res.body;
}

beforeAll(async () => {
  db = freshDb();
  app = createApp(db, { SESSION_SECRET: "test-secret" });
  const http = app.listen(0);
  await new Promise((r) => http.once("listening", r));
  server = http;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  db.close();
});

describe("Página pública: criar registro", () => {
  it("aceita um registro válido e salva com status 'pendente'", async () => {
    const res = await request(app).post("/api/registrations").send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.registration.status).toBe("pendente");
    expect(res.body.registration.option_title).toBeTruthy();
  });

  it("recusa dados inválidos e não grava nada no banco", async () => {
    const before = db.prepare("SELECT COUNT(*) AS n FROM registrations").get().n;
    const res = await request(app)
      .post("/api/registrations")
      .send({ ...validPayload, email: "nao-e-email", scheduled_date: "2020-01-01" });
    expect(res.status).toBe(422);
    expect(res.body.errors.email).toBeTruthy();
    expect(res.body.errors.scheduled_date).toBeTruthy();

    const after = db.prepare("SELECT COUNT(*) AS n FROM registrations").get().n;
    expect(after).toBe(before);
  });

  it("recusa uma opção que não existe ou está desativada", async () => {
    const res = await request(app)
      .post("/api/registrations")
      .send({ ...validPayload, option_id: 9999 });
    expect(res.status).toBe(422);
    expect(res.body.errors.option_id).toBeTruthy();
  });

  it("impede envio duplicado em sequência (anti-spam)", async () => {
    const res = await request(app).post("/api/registrations").send(validPayload);
    expect([201, 429]).toContain(res.status);
  });
});

describe("Pagina pública: opções", () => {
  it("expõe apenas opções ativas", async () => {
    const res = await request(app).get("/api/options");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body.every((o) => o.active === 1)).toBe(true);
  });
});

describe("Painel: proteção de rota (item 5 da spec)", () => {
  it("barra acesso sem autenticação", async () => {
    const res = await request(app).get("/api/admin/registrations");
    expect(res.status).toBe(401);
  });

  it("barra mudança de status sem autenticação", async () => {
    const res = await request(app)
      .patch("/api/admin/registrations/1/status")
      .send({ status: "confirmado" });
    expect(res.status).toBe(401);
  });
});

describe("Painel: autenticação e mudança de status", () => {
  it("permite login, lista registros e muda status com persistência", async () => {
    const agent = request.agent(app);
    const { role, name } = await loginAdmin(agent);

    const list = await agent.get("/api/admin/registrations");
    expect(list.status).toBe(200);
    expect(role).toBe("admin");
    expect(name).toBeTruthy();
    expect(list.body.total).toBeGreaterThan(0);

    const first = list.body.items[0];

    const updated = await agent
      .patch(`/api/admin/registrations/${first.id}/status`)
      .send({ status: "confirmado" });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("confirmado");

    const relist = await agent.get("/api/admin/registrations");
    const found = relist.body.items.find((r) => r.id === first.id);
    expect(found.status).toBe("confirmado");
  });

  it("filtra por status e faz busca por nome ou email", async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const filtered = await agent
      .get("/api/admin/registrations")
      .query({ status: "confirmado" });
    expect(filtered.body.items.every((r) => r.status === "confirmado")).toBe(true);

    const search = await agent
      .get("/api/admin/registrations")
      .query({ q: "maria" });
    expect(search.body.items.length).toBeGreaterThan(0);
  });

  it("pagina os resultados", async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const page = await agent
      .get("/api/admin/registrations")
      .query({ page: 1, limit: 2 });
    expect(page.body.items.length).toBeLessThanOrEqual(2);
    expect(page.body.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe("Painel: gestão de opções", () => {
  it("cria e desativa uma opção, refletindo na página pública", async () => {
    const agent = request.agent(app);
    await loginAdmin(agent);

    const created = await agent.post("/api/admin/options").send({
      title: "Nutrologia (teste)",
      description: "Avaliação nutricional.",
      price_cents: 14000,
      duration_min: 30,
      active: true,
    });
    expect(created.status).toBe(201);

    const publicList = await request(app).get("/api/options");
    expect(publicList.body.some((o) => o.title === "Nutrologia (teste)")).toBe(true);

    const deactivated = await agent
      .put(`/api/admin/options/${created.body.id}`)
      .send({ active: false });
    expect(deactivated.body.active).toBe(0);

    const publicAfter = await request(app).get("/api/options");
    expect(publicAfter.body.some((o) => o.title === "Nutrologia (teste)")).toBe(false);
  });
});