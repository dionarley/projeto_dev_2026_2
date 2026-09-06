"""Anti-spam / ant-bruteforce leve no mesmo espírito do backend anterior (Express):

- limite por IP para requisições sensíveis (token bucket em memória);
- o login tem limite adicional POR CONTA (IP + e-mail) em janela mais longa,
  para conter força bruta distribuída;
- IP real respeita X-Forwarded-For quando `USE_X_FORWARDED_FOR=1` (produção
  atrás de proxy), com fallback para REMOTE_ADDR.

Aviso: a contagem é por processo; com vários workers o teto efetivo multiplica.
É suficiente para conter spam de formulário sem depender de serviços externos.
"""

import json
import os
import time
from collections import defaultdict

from django.http import JsonResponse

USE_X_FORWARDED_FOR = os.environ.get("USE_X_FORWARDED_FOR", "0").lower() == "1"

# Por IP (janela curta, conter spam/DDoS de formulário).
IP_LIMITS = {
    "/api/registrations": (int(os.environ.get("RATE_LIMIT_REG_PER_MINUTE", "5")), 60.0),
    "/api/login": (int(os.environ.get("RATE_LIMIT_LOGIN_PER_MINUTE", "30")), 60.0),
}

# Por conta (IP + e-mail) — janela maior para forçar bruteforce a esfriar.
ACCOUNT_LOGIN_LIMIT = (
    int(os.environ.get("RATE_LIMIT_LOGIN_ACCOUNT_PER_QUARTER", "10")),
    900.0,
)

# Compat: nomes usados por código/testes antigos.
LIMITED_PATHS = set(IP_LIMITS)
PER_MINUTE = IP_LIMITS["/api/registrations"][0]
WINDOW_SECONDS = IP_LIMITS["/api/registrations"][1]


def client_ip(request) -> str:
    """IP real do cliente: primeiro valor de X-Forwarded-For (produção) ou REMOTE_ADDR."""
    if USE_X_FORWARDED_FOR:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR") or ""
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
    return request.META.get("REMOTE_ADDR") or "unknown"


def _trim(timestamps: list[float], now: float, window: float) -> list[float]:
    return [t for t in timestamps if now - t < window]


def _limited(timestamps: list[float], limit: int, window: float, now: float) -> bool:
    fresh = _trim(timestamps, now, window)
    return len(fresh) >= limit, fresh


def _login_email(request) -> str:
    """E-mail enviado no POST /api/login — lido do corpo bruto (o middleware roda
    antes do DRF montar `request.data`)."""
    try:
        payload = json.loads(request.body or b"{}")
    except (ValueError, AttributeError):
        return ""
    return str(payload.get("email") or "").strip().lower()


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._account_hits: dict[str, list[float]] = defaultdict(list)

    def __call__(self, request):
        if request.method == "POST" and request.path in LIMITED_PATHS:
            ip = client_ip(request)
            now = time.time()

            limit, window = IP_LIMITS[request.path]
            blocked, fresh = _limited(self._hits[ip], limit, window, now)
            self._hits[ip] = fresh
            if blocked:
                return JsonResponse(
                    {"error": "Muitas tentativas. Aguarde alguns instantes."}, status=429
                )

            account_key = None
            if request.path == "/api/login":
                email = _login_email(request)
                # Sem e-mail não dá para separar por conta: cai só no teto por IP.
                if email:
                    account_key = f"{ip}|{email}"
                    acc_limit, acc_window = ACCOUNT_LOGIN_LIMIT
                    acc_blocked, acc_fresh = _limited(
                        self._account_hits[account_key], acc_limit, acc_window, now
                    )
                    self._account_hits[account_key] = acc_fresh
                    if acc_blocked:
                        return JsonResponse(
                            {"error": "Muitas tentativas de acesso. Aguarde alguns instantes."},
                            status=429,
                        )

            self._hits[ip].append(now)
            if account_key:
                self._account_hits[account_key].append(now)
        return self.get_response(request)