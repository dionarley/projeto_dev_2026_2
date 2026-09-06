export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin";
};

export type Option = {
  id: number;
  title: string;
  description: string;
  price_cents: number;
  duration_min: number;
  /** 0/1 vindo da API SQLite; aceita boolean nos formulários do painel. */
  active: number | boolean;
  registrations?: number;
};

export type Registration = {
  id: number;
  name: string;
  email: string;
  phone: string;
  option_id: number;
  option_title: string;
  scheduled_date: string;
  scheduled_time: string;
  status: "pendente" | "confirmado" | "cancelado";
  created_at: string;
  updated_at: string;
};

export type RegistrationPage = {
  items: Registration[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminStats = {
  total: number;
  pendente: number;
  confirmado: number;
  cancelado: number;
  hoje: number;
};

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;
  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const body = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      (body as { error?: string })?.error ?? "Algo deu errado. Tente novamente.",
      (body as { errors?: Record<string, string> })?.errors
    );
  }
  return body as T;
}

export const api = {
  me: () => req<User>("/api/me"),
  login: (email: string, password: string) =>
    req<User>("/api/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<void>("/api/logout", { method: "POST" }),

  publicOptions: () => req<Option[]>("/api/options"),
  createRegistration: (payload: Record<string, unknown>) =>
    req<{ message: string; registration: Registration }>("/api/registrations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  stats: () => req<AdminStats>("/api/admin/stats"),
  registrations: (params: { page: number; limit: number; status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page));
    qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.q) qs.set("q", params.q);
    return req<RegistrationPage>(`/api/admin/registrations?${qs.toString()}`);
  },
  setStatus: (id: number, status: "confirmado" | "cancelado") =>
    req<Registration>(`/api/admin/registrations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  adminOptions: () => req<Option[]>("/api/admin/options"),
  createOption: (payload: Partial<Option>) =>
    req<Option>("/api/admin/options", { method: "POST", body: JSON.stringify(payload) }),
  updateOption: (id: number, payload: Partial<Option>) =>
    req<Option>(`/api/admin/options/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
};

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}