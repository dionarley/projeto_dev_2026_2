import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatBRL, type Option } from "../lib/api";

const features = [
  { icon: "🩺", title: "Consultas Online", desc: "Atendimento médico por vídeo, chat ou telefone com especialistas certificados." },
  { icon: "📋", title: "Prontuário Digital", desc: "Histórico completo de saúde acessível a qualquer momento, em qualquer dispositivo." },
  { icon: "💊", title: "Prescrição Eletrônica", desc: "Receitas digitais com validade legal, enviadas diretamente para sua farmácia." },
  { icon: "🔬", title: "Resultados de Exames", desc: "Laudos e resultados integrados ao seu prontuário em tempo real." },
  { icon: "🔒", title: "Dados Protegidos", desc: "Criptografia de ponta a ponta conforme a LGPD e padrões internacionais." },
  { icon: "⚡", title: "Atendimento 24h", desc: "Suporte médico disponível todos os dias, a qualquer hora do dia ou da noite." },
];

const testimonials = [
  { name: "Ana Souza", role: "Paciente", text: "Consulta rápida, médico atencioso e resultado disponível no app. Não volto mais ao pronto-socorro por ninharia.", avatar: "AS" },
  { name: "Carlos Mendes", role: "Paciente", text: "Renovei minha receita sem sair de casa. Processo simples, seguro e em menos de 20 minutos.", avatar: "CM" },
  { name: "Dr. Fernanda Lima", role: "Médica Parceira", text: "A plataforma me permite atender mais pacientes com menos burocracia. Prontuário integrado faz toda a diferença.", avatar: "FL" },
];

const fallbackSpecialties = ["Clínica Geral", "Cardiologia", "Dermatologia", "Psiquiatria", "Pediatria", "Ginecologia", "Ortopedia", "Neurologia"];

const inputBase: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E2E8F0",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
  color: "#0F172A",
  backgroundColor: "#FFFFFF",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

function Field({
  label, type = "text", placeholder, value, onChange, error, min, options, children,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  min?: string;
  options?: Option[];
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>
        {label}
      </label>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputBase, backgroundColor: "#FFFFFF" }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "#DC2626" : "#E2E8F0";
          }}
        >
          <option value="">Selecione...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title} — {formatBRL(o.price_cents)} · {o.duration_min} min
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={inputBase}
          onFocus={(e) => {
            e.target.style.borderColor = "#2563EB";
            e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? "#DC2626" : "#E2E8F0";
            e.target.style.boxShadow = "none";
          }}
        />
      )}
      {children}
      {error && <p className="text-xs mt-1" style={{ color: "#DC2626" }}>{error}</p>}
    </div>
  );
}

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Landing() {
  const [options, setOptions] = useState<Option[]>([]);
  const [optionsError, setOptionsError] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    option_id: "",
    scheduled_date: "",
    scheduled_time: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success">("idle");
  const [serverMessage, setServerMessage] = useState("");

  useEffect(() => {
    api
      .publicOptions()
      .then(setOptions)
      .catch(() => setOptionsError(true));
  }, []);

  const specialties = useMemo(
    () => (options.length > 0 ? options.map((o) => o.title) : fallbackSpecialties),
    [options]
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Informe um e-mail válido.";
    if (form.phone && !/^[\d\s()+.-]{8,20}$/.test(form.phone)) e.phone = "Telefone inválido.";
    if (!form.option_id) e.option_id = "Escolha uma especialidade.";
    if (!form.scheduled_date) e.scheduled_date = "Informe uma data.";
    else if (form.scheduled_date < todayLocal()) e.scheduled_date = "A data não pode estar no passado.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.scheduled_time)) e.scheduled_time = "Informe um horário (HH:MM).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerMessage("");
    if (!validate()) return;
    setSubmitState("submitting");
    try {
      const res = await api.createRegistration({
        name: form.name,
        email: form.email,
        phone: form.phone,
        option_id: Number(form.option_id),
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
      });
      setServerMessage(res.message);
      setSubmitState("success");
      setForm({ name: "", email: "", phone: "", option_id: "", scheduled_date: "", scheduled_time: "" });
    } catch (err) {
      if (err instanceof Error && "errors" in err) {
        const apiErr = err as { errors?: Record<string, string>; message: string };
        setErrors(apiErr.errors ?? {});
        setServerMessage(apiErr.errors ? "" : apiErr.message);
      } else {
        setServerMessage(err instanceof Error ? err.message : "Erro ao enviar. Tente novamente.");
      }
      setSubmitState("idle");
    }
  };

  const scrollToAgendar = () =>
    document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-full" style={{ backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white border-b" style={{ borderColor: "#E2E8F0" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: "#2563EB" }}>
              <span className="text-white text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>V</span>
            </div>
            <span className="font-semibold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>VidaSaúde</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#64748B" }}>
            <a href="#features" className="transition-colors hover:text-[#2563EB]">Serviços</a>
            <a href="#agendar" className="transition-colors hover:text-[#2563EB]">Agendar</a>
            <a href="#testimonials" className="transition-colors hover:text-[#2563EB]">Depoimentos</a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#agendar"
              onClick={(e) => { e.preventDefault(); scrollToAgendar(); }}
              className="text-sm px-4 py-2 rounded font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#10B981" }}
            >
              Agendar consulta
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2">
          <div style={{ backgroundColor: "#0F172A" }} />
          <div className="hidden md:block" style={{ backgroundColor: "#F8FAFC" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-12 md:py-20 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#10B981" }}>
              Telemedicina de precisão
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-6 text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Saúde de qualidade,<br />
              <span style={{ color: "#10B981" }}>onde você estiver.</span>
            </h1>
            <p className="text-lg leading-relaxed mb-8" style={{ color: "#94A3B8" }}>
              Consulte médicos especialistas por vídeo em minutos. Sem filas, sem deslocamento, sem espera.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={scrollToAgendar}
                className="px-6 py-3 rounded font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#10B981" }}
              >
                Agendar agora
              </button>
              <Link
                to="/login"
                className="px-6 py-3 rounded font-semibold text-sm transition-all"
                style={{ border: "1px solid #334155", color: "#94A3B8" }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.borderColor = "#10B981";
                  (e.target as HTMLElement).style.color = "#10B981";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.borderColor = "#334155";
                  (e.target as HTMLElement).style.color = "#94A3B8";
                }}
              >
                Sou da equipe
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-8 mt-10">
              {[["98%", "Satisfação"], ["50k+", "Consultas/mês"], ["800+", "Médicos"]].map(([n, l]) => (
                <div key={l}>
                  <p className="text-2xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{n}</p>
                  <p className="text-xs" style={{ color: "#64748B" }}>{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right side card */}
          <div className="relative">
            <div className="rounded-xl overflow-hidden shadow-2xl" style={{ border: "1px solid #E2E8F0" }}>
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=640&h=400&fit=crop&auto=format"
                alt="Médica em consulta por vídeo"
                className="w-full h-64 object-cover"
              />
              <div className="bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                    DR
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>Dra. Renata Figueiredo</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>Clínica Geral · CRM 54.321</p>
                  </div>
                  <span className="ml-auto text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: "#ECFDF5", color: "#10B981" }}>
                    ● Disponível
                  </span>
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid #E2E8F0" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs" style={{ color: "#64748B" }}>Próxima disponibilidade</p>
                      <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>Hoje, 14:30</p>
                    </div>
                    <button onClick={scrollToAgendar} className="text-xs text-white px-3 py-1.5 rounded font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: "#2563EB" }}>
                      Agendar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative md:absolute md:-bottom-4 md:-left-4 bg-white rounded-lg p-3 shadow-lg" style={{ border: "1px solid #E2E8F0" }}>
              <p className="text-xs" style={{ color: "#64748B" }}>Tempo médio</p>
              <p className="font-bold text-sm" style={{ color: "#0F172A" }}>~8 min de espera</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <div className="bg-white border-y py-4" style={{ borderColor: "#E2E8F0" }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm" style={{ color: "#64748B" }}>
          {["CFM Credenciado", "LGPD Compliant", "ISO 27001", "Disponível 24/7", "800+ Especialistas"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span style={{ color: "#10B981" }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="py-20 max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#10B981" }}>
            Como funciona
          </p>
          <h2 className="text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
            Tudo que você precisa em um só lugar
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ backgroundColor: "#E2E8F0", border: "1px solid #E2E8F0" }}>
          {features.map((f) => (
            <div key={f.title} className="bg-white p-6 transition-colors group cursor-default hover:bg-[#F8FAFC]">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-semibold mb-2 transition-colors group-hover:text-[#2563EB]" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Especialidades (opções reais do banco) ── */}
      <section className="py-16 bg-white border-y" style={{ borderColor: "#E2E8F0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#10B981" }}>Especialidades</p>
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
            Médicos especialistas prontos para te atender
          </h2>
          <p className="text-sm mb-8" style={{ color: "#64748B" }}>
            {optionsError
              ? "Não foi possível carregar a lista agora. Tente novamente em instantes."
              : options.length > 0
                ? "Lista de especialidades disponíveis — gerida pela equipe no painel."
                : ""}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg p-4 transition-all" style={{ border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>{o.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{o.duration_min} min · {formatBRL(o.price_cents)}</p>
                </div>
                <button
                  onClick={() => {
                    const f = document.getElementById("agendar");
                    if (f) {
                      setForm((prev) => ({ ...prev, option_id: String(o.id) }));
                      f.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#2563EB", color: "#FFF" }}
                >
                  Agendar
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formulário de agendamento ── */}
      <section id="agendar" className="py-20" style={{ backgroundColor: "#0F172A" }}>
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#10B981" }}>Agendamento</p>
          <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Agende sua consulta
          </h2>
          <p className="text-sm mb-8" style={{ color: "#94A3B8" }}>
            Preencha os dados abaixo. Você recebe a confirmação da equipe em breve.
          </p>

          {submitState === "success" ? (
            <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" }}>
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl" style={{ backgroundColor: "#10B981" }}>
                ✓
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "#065F46", fontFamily: "'Outfit', sans-serif" }}>Solicitação enviada!</h3>
              <p className="text-sm mb-6" style={{ color: "#047857" }}>{serverMessage}</p>
              <button
                onClick={() => setSubmitState("idle")}
                className="text-sm px-5 py-2 rounded font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#059669" }}
              >
                Fazer outro agendamento
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-xl bg-white p-6 md:p-8 space-y-5"
              style={{ border: "1px solid #E2E8F0" }}
              noValidate
            >
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Nome completo" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Maria da Silva" error={errors.name} />
                <Field label="E-mail" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="maria@email.com" error={errors.email} />
              </div>

              <Field label="Telefone / WhatsApp" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(11) 99999-9999" error={errors.phone} />

              <Field
                label="Especialidade"
                value={form.option_id}
                onChange={(v) => setForm((f) => ({ ...f, option_id: v }))}
                error={errors.option_id}
                options={options}
              >
                {optionsError && (
                  <p className="text-xs mt-1" style={{ color: "#D97706" }}>
                    Não foi possível carregar as especialidades — tente de novo em instantes.
                  </p>
                )}
              </Field>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Data" type="date" min={todayLocal()} value={form.scheduled_date} onChange={(v) => setForm((f) => ({ ...f, scheduled_date: v }))} error={errors.scheduled_date} />
                <Field label="Horário" type="time" value={form.scheduled_time} onChange={(v) => setForm((f) => ({ ...f, scheduled_time: v }))} error={errors.scheduled_time} />
              </div>

              {serverMessage && (
                <div
                  role="alert"
                  className="rounded px-3 py-2 text-xs"
                  style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
                >
                  {serverMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitState === "submitting"}
                className="w-full py-3 rounded font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#10B981" }}
              >
                {submitState === "submitting" ? "Enviando..." : "Solicitar agendamento"}
              </button>

              <p className="text-xs text-center" style={{ color: "#64748B" }}>
                Seus dados são protegidos conforme a LGPD. A equipe entra em contato para confirmar.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Steps ── */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#10B981" }}>Processo</p>
          <h2 className="text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>Em 3 passos simples</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { n: "01", title: "Preencha o formulário", desc: "Diga a especialidade, data e horário que funcionam para você." },
            { n: "02", title: "A equipe confirma", desc: "Recebe sua solicitação e agenda com o médico especialista." },
            { n: "03", title: "Consulte online", desc: "Entre na videochamada, receba diagnóstico e prescrição digital." },
          ].map((step) => (
            <div key={step.n}>
              <p className="text-6xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#E2E8F0" }}>{step.n}</p>
              <div className="-mt-4">
                <h3 className="font-semibold text-lg mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#64748B" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-20 border-y" style={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#10B981" }}>Depoimentos</p>
          <h2 className="text-3xl font-bold mb-10" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
            O que dizem nossos usuários
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-lg p-6 transition-all"
                style={{ border: "1px solid #E2E8F0" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563EB")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
              >
                <p className="text-sm leading-relaxed mb-6 italic" style={{ color: "#0F172A" }}>"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>{t.name}</p>
                    <p className="text-xs" style={{ color: "#64748B" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
          Sua saúde não pode esperar.
        </h2>
        <p className="mb-8 max-w-md mx-auto" style={{ color: "#64748B" }}>
          Escolha a especialidade e agende agora. A confirmação chega pela equipe.
        </p>
        <button
          onClick={scrollToAgendar}
          className="px-8 py-3 rounded font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#10B981" }}
        >
          Agendar consulta
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8 bg-white" style={{ borderColor: "#E2E8F0" }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: "#64748B" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: "#2563EB" }}>
              <span className="text-white text-xs font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>V</span>
            </div>
            <span>VidaSaúde Telemedicina</span>
          </div>
          <p>© 2026 VidaSaúde. Todos os direitos reservados. LGPD compliant.</p>
          <div className="flex gap-4">
            <a href="#agendar" onClick={(e) => { e.preventDefault(); scrollToAgendar(); }} className="hover:text-[#2563EB] transition-colors">Agendar</a>
            <Link to="/login" className="hover:text-[#2563EB] transition-colors">Painel</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}