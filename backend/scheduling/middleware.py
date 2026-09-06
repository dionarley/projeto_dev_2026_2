"""Anti-spam leve no mesmo espírito do backend anterior (Express):

- limite de 5 requisições sensíveis por minuto por IP (token bucket em memória);
- a checagem de duplicidade (mesmo e-mail + opção + data em 60s) vive no Serializer.

Aviso: a contagem é por processo; com vários workers o teto efetivo multiplica.
É suficiente para conter spam de formulário sem depender de serviços externos.
"""

import time
from collections import defaultdict

from django.http import JsonResponse

LIMITED_PATHS = {"/api/registrations", "/api/login"}
PER_MINUTE = 5
WINDOW_SECONDS = 60.0


class RateLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self._hits: dict[str, list[float]] = defaultdict(list)

    def __call__(self, request):
        if request.method == "POST" and request.path in LIMITED_PATHS:
            ip = request.META.get("REMOTE_ADDR") or "unknown"
            now = time.time()
            self._hits[ip] = [t for t in self._hits[ip] if now - t < WINDOW_SECONDS]
            if len(self._hits[ip]) >= PER_MINUTE:
                return JsonResponse(
                    {"error": "Muitas tentativas. Aguarde um minuto."}, status=429
                )
            self._hits[ip].append(now)
        return self.get_response(request)