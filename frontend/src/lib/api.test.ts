import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

// Regressão: o Django ROTACIONA o token CSRF a cada login. O front precisa
// reler o cookie a cada mutação — um token antigo cacheado causava 403
// Forbidden ao confirmar/cancelar no painel (admin_set_status).
function stubResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("api — CSRF token (rotação no login)", () => {
  it("setStatus envia o token ATUAL do cookie, não um cache antigo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(stubResponse({ id: 1, status: "confirmado" }));
    vi.stubGlobal("fetch", fetchMock);

    // Token antes do login…
    document.cookie = "csrftoken=token-antigo; path=/";
    // …e o login rotaciona para um novo (nunca usar o antigo).
    document.cookie = "csrftoken=token-novo; path=/";

    await api.setStatus(1, "confirmado");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-CSRFToken"]).toBe(
      "token-novo",
    );
  });

  it("solicita um novo token quando o cookie de CSRF ainda não existe", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => {
        document.cookie = "csrftoken=token-via-cookie; path=/"; // simula /api/csrf
        return Promise.resolve(stubResponse({ csrfToken: "token-via-cookie" }));
      })
      .mockResolvedValue(stubResponse({ id: 1, status: "cancelado" }));
    vi.stubGlobal("fetch", fetchMock);

    document.cookie = ""; // sem cookie ainda (primeiro acesso)

    await api.setStatus(1, "cancelado");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/csrf");
    const init = fetchMock.mock.calls[1][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-CSRFToken"]).toBe(
      "token-via-cookie",
    );
  });
});