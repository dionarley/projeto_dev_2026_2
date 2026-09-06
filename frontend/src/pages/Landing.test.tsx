import fs from "node:fs";
import path from "node:path";

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Landing from "./Landing";
import { api } from "../lib/api";

// A Landing chama api.publicOptions() no mount; no teste simulamos a lista
// (vazia => usa o catálogo fallback) e o formatador de preços.
vi.mock("../lib/api", () => ({
  api: {
    publicOptions: vi.fn().mockResolvedValue([]),
  },
  formatBRL: (v: number) => `R$ ${v}`,
}));

const DOCTOR_ALT = "Médica em consulta por vídeo";

describe("Landing — imagem da médica (regressão: CSP bloqueava URL externa)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza uma imagem da médica no hero", async () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.publicOptions).toHaveBeenCalled());

    const img = screen.getByAltText(DOCTOR_ALT);
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBeTruthy();
  });

  it("aponta para um asset local do bundle (nunca uma URL remota)", async () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.publicOptions).toHaveBeenCalled());

    const src = screen.getByAltText(DOCTOR_ALT).getAttribute("src") ?? "";
    // A CSP do backend é `img-src 'self' data:` — uma URL externa (ex.: Unsplash)
    // era bloqueada e a imagem sumia. O asset deve vim do próprio app.
    expect(src).not.toMatch(/^https?:\/\//);
    expect(src).not.toContain("images.unsplash.com");
    expect(src.length).toBeGreaterThan(0);
  });

  it("o arquivo da imagem existe no repositório (self-hosted)", () => {
    const asset = path.resolve(process.cwd(), "src/assets/doctor-consulta.jpg");
    expect(fs.existsSync(asset)).toBe(true);
  });
});