import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
import { api, type User } from "./lib/api";

/** Rota protegida: só renderiza o painel com sessão válida.
 *  Sem sessão, redireciona para /login (vale para acesso direto pela URL). */
function ProtectedAdmin() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((u) => {
        if (!alive) return;
        setUser(u);
        setState("ok");
      })
      .catch(() => alive && setState("denied"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div
        className="min-h-full flex items-center justify-center"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <p className="text-sm" style={{ color: "#64748B" }}>
          Verificando sessão...
        </p>
      </div>
    );
  }
  if (state === "denied") return <Navigate to="/login" replace />;
  return <AdminPanel user={user!} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedAdmin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}