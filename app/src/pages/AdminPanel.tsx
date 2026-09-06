import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  formatBRL,
  type AdminStats,
  type Option,
  type Registration,
  type RegistrationPage,
  type User,
} from "../lib/api";

type Props = { user: User };

type Tab = "dashboard" | "registrations" | "options";

const STATUS_META: Record<Registration["status"], { label: string; bg: string; color: string }> = {
  pendente: { label: "Pendente", bg: "#EFF6FF", color: "#2563EB" },
  confirmado: { label: "Confirmado", bg: "#ECFDF5", color: "#10B981" },
  cancelado: { label: "Cancelado", bg: "#FEF2F2", color: "#DC2626" },
};

const STATUS_KEYS = ["pendente", "confirmado", "cancelado"] as const;

const inputBase: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E2E8F0",
  borderRadius: 6,
  padding: "9px 12px",
  fontSize: 14,
  color: "#0F172A",
  backgroundColor: "#FFF",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

function printDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function printDateTime(iso: string) {
  const [date, time] = iso.replace("T", " ").split(" ");
  return `${printDate(date)} ${time?.slice(0, 5) ?? ""}`;
}

export default function AdminPanel({ user }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; kind: "ok" | "err"; text: string }[]>([]);

  const toast = useCallback((kind: "ok" | "err", text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    navigate("/", { replace: true });
  };

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "registrations", label: "Solicitações", icon: "📝" },
    { id: "options", label: "Especialidades", icon: "🩺" },
  ];

  return (
    <div className="min-h-full flex" style={{ backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ backgroundColor: "#0F172A" }}
      >
        <div className="p-5" style={{ borderBottom: "1px solid #1E293B" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: "#2563EB" }}>
              <span className="text-white font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>V</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>VidaSaúde</p>
              <p className="text-xs" style={{ color: "#64748B" }}>Painel Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors"
              style={{
                backgroundColor: tab === item.id ? "#2563EB" : "transparent",
                color: tab === item.id ? "#FFFFFF" : "#64748B",
              }}
              onMouseEnter={(e) => {
                if (tab !== item.id) {
                  e.currentTarget.style.backgroundColor = "#1E293B";
                  e.currentTarget.style.color = "#F8FAFC";
                }
              }}
              onMouseLeave={(e) => {
                if (tab !== item.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#64748B";
                }
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4" style={{ borderTop: "1px solid #1E293B" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: "#2563EB" }}>
              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.name}</p>
              <p className="text-xs truncate" style={{ color: "#64748B" }}>{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs text-left px-1 transition-colors"
            style={{ color: "#64748B" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
          >
            ⎋ Sair
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" style={{ backgroundColor: "rgba(0,0,0,.5)" }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="bg-white h-14 flex items-center justify-between px-6 shrink-0" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden" style={{ color: "#64748B" }} onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="font-semibold text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
              {navItems.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <span className="text-xs" style={{ color: "#64748B" }}>Olá, {user.name.split(" ")[0]}</span>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {tab === "dashboard" && <DashboardTab onGoTo={setTab} toast={toast} />}
          {tab === "registrations" && <RegistrationsTab toast={toast} />}
          {tab === "options" && <OptionsTab toast={toast} />}
        </div>

        {/* Toasts */}
        <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="rounded-lg px-4 py-3 text-sm shadow-lg text-white"
              style={{ backgroundColor: t.kind === "ok" ? "#10B981" : "#DC2626" }}
            >
              {t.text}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* ── Dashboard ── */

function DashboardTab({ onGoTo, toast }: { onGoTo: (t: Tab) => void; toast: (k: "ok" | "err", s: string) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<Registration[]>([]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => toast("err", "Não foi possível carregar o resumo."));
    api
      .registrations({ page: 1, limit: 5, status: "pendente" })
      .then((r) => setPending(r.items))
      .catch(() => {});
  }, [toast]);

  const cards = stats
    ? [
        { label: "Solicitações totais", value: String(stats.total), color: "#0F172A" },
        { label: "Pendentes", value: String(stats.pendente), color: "#2563EB" },
        { label: "Confirmadas", value: String(stats.confirmado), color: "#10B981" },
        { label: "Canceladas", value: String(stats.cancelado), color: "#DC2626" },
        { label: "Agendadas p/ hoje", value: String(stats.hoje), color: "#D97706" },
      ]
    : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#64748B" }}>
          Acompanhe os agendamentos que chegam pela página pública.
        </p>
        <button
          onClick={() => onGoTo("registrations")}
          className="text-sm px-4 py-2 rounded font-medium text-white transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: "#2563EB" }}
        >
          Ver solicitações
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {stats
          ? cards.map((s) => (
              <div key={s.label} className="bg-white rounded-lg p-5" style={{ border: "1px solid #E2E8F0" }}>
                <p className="text-xs mb-1" style={{ color: "#64748B" }}>{s.label}</p>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: s.color }}>{s.value}</p>
              </div>
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-5 animate-pulse" style={{ border: "1px solid #E2E8F0" }}>
                <div className="h-3 w-2/3 rounded mb-3" style={{ backgroundColor: "#E2E8F0" }} />
                <div className="h-6 w-1/3 rounded" style={{ backgroundColor: "#E2E8F0" }} />
              </div>
            ))}
      </div>

      <div className="bg-white rounded-lg" style={{ border: "1px solid #E2E8F0" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #E2E8F0" }}>
          <h2 className="font-semibold text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
            Pendentes mais recentes
          </h2>
          <button onClick={() => onGoTo("registrations")} className="text-xs hover:underline" style={{ color: "#2563EB" }}>
            Ver todas
          </button>
        </div>
        {pending.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "#64748B" }}>
            Nenhuma solicitação pendente no momento.
          </div>
        ) : (
          <div>
            {pending.map((r, i) => (
              <div key={r.id} className="px-5 py-3 flex items-center gap-4 text-sm" style={{ borderTop: i > 0 ? "1px solid #E2E8F0" : undefined }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                  {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: "#0F172A" }}>{r.name}</p>
                  <p className="text-xs truncate" style={{ color: "#64748B" }}>{r.option_title} · {printDate(r.scheduled_date)} às {r.scheduled_time}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded shrink-0" style={STATUS_META[r.status]}>
                  {STATUS_META[r.status].label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs" style={{ color: "#94A3B8" }}>
        Dica: acesse "Solicitações" para confirmar ou cancelar e "Especialidades" para manter a página pública atualizada.
      </p>
    </>
  );
}

/* ── Solicitações ── */

function RegistrationsTab({ toast }: { toast: (k: "ok" | "err", s: string) => void }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [data, setData] = useState<RegistrationPage | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const reload = useCallback(() => {
    api
      .registrations({ page, limit: 10, status, q: debouncedQ })
      .then(setData)
      .catch(() => toast("err", "Não foi possível carregar as solicitações."));
  }, [page, status, debouncedQ, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const changeStatus = async (reg: Registration, next: "confirmado" | "cancelado") => {
    setBusyId(reg.id);
    try {
      await api.setStatus(reg.id, next);
      toast("ok", `Solicitação de ${reg.name.split(" ")[0]} ${next === "confirmado" ? "confirmada" : "cancelada"}.`);
      reload();
    } catch (err) {
      toast("err", err instanceof Error ? err.message : "Não foi possível alterar o status.");
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Nome", "E-mail", "Telefone", "Especialidade", "Data", "Horário", "Status", "Criado em"],
      ...data.items.map((r) => [
        r.name,
        r.email,
        r.phone,
        r.option_title,
        r.scheduled_date,
        r.scheduled_time,
        r.status,
        r.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "solicitacoes-vidasaude.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("ok", "CSV da página atual exportado.");
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm" style={{ color: "#64748B" }}>
          {data ? `${data.total} solicitação(ões) no total` : "Carregando..."}
        </p>
        <button
          onClick={exportCsv}
          className="text-sm px-4 py-2 rounded font-medium text-white transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: "#0F172A" }}
        >
          ⤓ Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por nome ou e-mail..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="flex-1 min-w-[220px] rounded px-3 py-2 text-sm bg-white outline-none transition-all"
          style={inputBase}
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          style={{ ...inputBase, width: "auto", minWidth: 160 }}
        >
          <option value="">Todos os status</option>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #E2E8F0" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              <tr>
                {["Nome", "E-mail", "Especialidade", "Data", "Horário", "Status", "Criado em", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "#64748B" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? "1px solid #E2E8F0" : undefined }}>
                    <td colSpan={8}>
                      <div className="h-10 animate-pulse" style={{ backgroundColor: i % 2 ? "#F8FAFC" : "#FFF" }} />
                    </td>
                  </tr>
                ))}
              {data?.items.map((r, i) => {
                const meta = STATUS_META[r.status];
                return (
                  <tr
                    key={r.id}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    style={{ borderTop: i > 0 ? "1px solid #E2E8F0" : undefined }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                          {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-medium" style={{ color: "#0F172A" }}>{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#64748B" }}>{r.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#64748B" }}>{r.option_title}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: "#0F172A" }}>{printDate(r.scheduled_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: "#0F172A" }}>{r.scheduled_time}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#94A3B8" }}>{printDateTime(r.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {r.status === "pendente" && (
                        <div className="flex gap-2 justify-end">
                          <button
                            disabled={busyId === r.id}
                            onClick={() => changeStatus(r, "confirmado")}
                            className="text-xs px-3 py-1 rounded font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: "#10B981" }}
                          >
                            Confirmar
                          </button>
                          <button
                            disabled={busyId === r.id}
                            onClick={() => changeStatus(r, "cancelado")}
                            className="text-xs px-3 py-1 rounded font-semibold transition-colors"
                            style={{ border: "1px solid #FECACA", color: "#DC2626" }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {r.status !== "pendente" && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => changeStatus(r, r.status === "confirmado" ? "cancelado" : "confirmado")}
                          className="text-xs hover:underline disabled:opacity-50"
                          style={{ color: "#64748B" }}
                        >
                          Reverter
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data && data.items.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: "#64748B" }}>
            Nenhuma solicitação encontrada com esses filtros.
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs" style={{ color: "#64748B" }}>
            Página {data.page} de {data.totalPages} · {data.total} registro(s)
          </p>
          <div className="flex gap-2">
            <button
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-sm px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-40"
              style={{ border: "1px solid #E2E8F0", color: "#0F172A", backgroundColor: "#FFF" }}
            >
              ← Anterior
            </button>
            <button
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-sm px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-40"
              style={{ border: "1px solid #E2E8F0", color: "#0F172A", backgroundColor: "#FFF" }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Especialidades (opções) ── */

type OptionForm = { title: string; description: string; price_cents: string; duration_min: number; active: boolean };

const EMPTY_FORM: OptionForm = { title: "", description: "", price_cents: "", duration_min: 30, active: true };

function OptionsTab({ toast }: { toast: (k: "ok" | "err", s: string) => void }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [form, setForm] = useState<OptionForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Option | null>(null);
  const [formError, setFormError] = useState("");

  const reload = useCallback(() => {
    api.adminOptions().then(setOptions).catch(() => toast("err", "Não foi possível carregar as especialidades."));
  }, [toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const startEdit = (opt: Option) => {
    setEditing(opt);
    setForm({
      title: opt.title,
      description: opt.description,
      price_cents: String((opt.price_cents / 100).toFixed(2).replace(".", ",")),
      duration_min: opt.duration_min,
      active: opt.active === 1,
    });
    setFormError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const priceCents = Math.round(Number(form.price_cents.replace(",", ".")) * 100);
    if (form.title.trim().length < 3) return setFormError("Título precisa ter ao menos 3 caracteres.");
    if (Number.isNaN(priceCents) || priceCents < 0) return setFormError("Preço inválido.");
    try {
      if (editing) {
        await api.updateOption(editing.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          price_cents: priceCents,
          duration_min: form.duration_min,
          active: form.active,
        });
        toast("ok", "Especialidade atualizada.");
      } else {
        await api.createOption({
          title: form.title.trim(),
          description: form.description.trim(),
          price_cents: priceCents,
          duration_min: form.duration_min,
          active: form.active,
        });
        toast("ok", "Especialidade criada e publicada.");
      }
      setEditing(null);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  };

  const toggleActive = async (opt: Option) => {
    try {
      await api.updateOption(opt.id, { active: opt.active === 1 ? false : true });
      toast("ok", opt.active === 1 ? `"${opt.title}" ocultada da página pública.` : `"${opt.title}" publicada.`);
      reload();
    } catch (err) {
      toast("err", err instanceof Error ? err.message : "Erro ao atualizar.");
    }
  };

  const isOpen = editing !== null || form.title !== "" || form.price_cents !== "" || Object.values(form).some((v) => v === false && form.active === false);

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      {/* Lista */}
      <div className="lg:col-span-2 space-y-4">
        <p className="text-sm" style={{ color: "#64748B" }}>
          {options ? `${options.length} especialidade(s) cadastrada(s). As ativas aparecem na página pública.` : "Carregando..."}
        </p>

        {!options &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-5 animate-pulse" style={{ border: "1px solid #E2E8F0" }}>
              <div className="h-4 w-1/3 rounded mb-3" style={{ backgroundColor: "#E2E8F0" }} />
              <div className="h-3 w-2/3 rounded" style={{ backgroundColor: "#E2E8F0" }} />
            </div>
          ))}

        {options?.length === 0 && (
          <div className="bg-white rounded-lg p-10 text-center text-sm" style={{ border: "1px solid #E2E8F0", color: "#64748B" }}>
            Nenhuma especialidade ainda. Adicione a primeira ao lado →
          </div>
        )}

        {options?.map((opt) => (
          <div
            key={opt.id}
            className="bg-white rounded-lg p-5 flex flex-wrap items-center gap-4"
            style={{ border: "1px solid #E2E8F0", opacity: opt.active === 1 ? 1 : 0.65 }}
          >
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>{opt.title}</p>
                {opt.active === 1 ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#ECFDF5", color: "#10B981" }}>Ativa</span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#F8FAFC", color: "#64748B" }}>Desativada</span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: "#64748B" }}>
                {opt.duration_min} min · {formatBRL(opt.price_cents)} · {opt.registrations ?? 0} solicitação(ões)
              </p>
              {opt.description && (
                <p className="text-xs mt-1" style={{ color: "#64748B" }}>{opt.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => startEdit(opt)}
                className="text-xs px-3 py-1.5 rounded font-semibold transition-colors"
                style={{ border: "1px solid #E2E8F0", color: "#2563EB" }}
              >
                Editar
              </button>
              <button
                onClick={() => toggleActive(opt)}
                className="text-xs px-3 py-1.5 rounded font-semibold transition-colors"
                style={{ border: "1px solid #E2E8F0", color: opt.active === 1 ? "#D97706" : "#059669" }}
              >
                {opt.active === 1 ? "Ocultar" : "Publicar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Formulário */}
      <form onSubmit={submit} className="bg-white rounded-lg p-5 space-y-4" style={{ border: "1px solid #E2E8F0" }}>
        <div>
          <h2 className="font-semibold text-sm" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
            {editing ? `Editar: ${editing.title}` : "Nova especialidade"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            Os campos marcados como ativos aparecem no formulário da página pública a partir de hoje.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>Título</label>
          <input style={inputBase} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Dermatologia" />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>Descrição</label>
          <input style={inputBase} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Resumo do atendimento" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>Preço (R$)</label>
            <input style={inputBase} value={form.price_cents} onChange={(e) => setForm((f) => ({ ...f, price_cents: e.target.value }))} placeholder="120,00" inputMode="decimal" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>Duração (min)</label>
            <input type="number" min={10} max={240} style={inputBase} value={form.duration_min} onChange={(e) => setForm((f) => ({ ...f, duration_min: Number(e.target.value) }))} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#0F172A" }}>
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            style={{ accentColor: "#10B981", width: 16, height: 16 }}
          />
          Ativa na página pública
        </label>

        {formError && (
          <div className="rounded px-3 py-2 text-xs" role="alert" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
            {formError}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" className="flex-1 py-2.5 rounded font-semibold text-sm text-white transition-opacity hover:opacity-90" style={{ backgroundColor: "#10B981" }}>
            {editing ? "Salvar alterações" : "Criar especialidade"}
          </button>
          {(editing || isOpen) && (
            <button
              type="button"
              onClick={() => { setEditing(null); setForm(EMPTY_FORM); setFormError(""); }}
              className="px-4 py-2.5 rounded font-semibold text-sm transition-colors"
              style={{ border: "1px solid #E2E8F0", color: "#64748B" }}
            >
              Limpar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}