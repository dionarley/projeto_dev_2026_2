import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

const inputStyle = {
  width: "100%",
  border: "1px solid #E2E8F0",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
  color: "#0F172A",
  backgroundColor: "#FFF",
  outline: "none",
  transition: "border-color .15s, box-shadow .15s",
} as const;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.login(email, password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex" style={{ backgroundColor: "#F8FAFC", fontFamily: "'Inter', sans-serif" }}>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12" style={{ backgroundColor: "#0F172A" }}>
        <Link
          to="/"
          className="flex items-center gap-2 text-sm w-fit transition-colors"
          style={{ color: "#64748B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
        >
          ← Voltar
        </Link>

        <div>
          <div className="w-10 h-10 rounded flex items-center justify-center mb-8" style={{ backgroundColor: "#2563EB" }}>
            <span className="text-white font-bold text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>V</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Bem-vindo de volta.
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "#64748B" }}>
            Acesso restrito à equipe de gestão do VidaSaúde.
          </p>

          <div className="mt-12 rounded-lg p-5" style={{ border: "1px solid #1E293B" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>
              Acesso de demonstração
            </p>
            <div className="space-y-2 text-xs" style={{ color: "#94A3B8" }}>
              <p>
                <span style={{ color: "#10B981" }}>Admin (seed):</span> admin@vidasaude.com / admin123
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs" style={{ color: "#334155" }}>© 2026 VidaSaúde · LGPD compliant</p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <Link
          to="/"
          className="lg:hidden mb-8 self-start flex items-center gap-2 text-sm transition-colors"
          style={{ color: "#64748B" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#2563EB")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
        >
          ← Voltar
        </Link>

        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Outfit', sans-serif", color: "#0F172A" }}>
            Painel de gestão
          </h1>
          <p className="text-sm mb-8" style={{ color: "#64748B" }}>
            Entre com as credenciais da equipe
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>
                E-mail
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vidasaude.com"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = "#2563EB";
                  e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E2E8F0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#0F172A" }}>
                Senha
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = "#2563EB";
                  e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#E2E8F0";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded px-3 py-2 text-xs"
                style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#2563EB" }}
            >
              {loading ? "Entrando..." : "Entrar no painel"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}