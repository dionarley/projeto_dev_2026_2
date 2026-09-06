import json

import whitenoise  # noqa: F401  (garante que o middleware está disponível na rota de import)

from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse


def frontend(request):
    """Servir o SPA (frontend/dist) nas rotas que não são de API/static/admin.

    Sem o frontend compilado, devolve uma dica amigável em vez de quebrar.
    """
    if str(request.path).startswith("/api/"):
        return JsonResponse({"error": "Endpoint não encontrado."}, status=404)

    index = settings.FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index.open("rb"), content_type="text/html")

    return HttpResponse(
        json.dumps(
            {
                "error": "Frontend não compilado.",
                "fix": "Execute `pnpm build` dentro de frontend/ (ou use o servidor de dev com o proxy do Vite).",
            },
            ensure_ascii=False,
        ),
        content_type="application/json",
        status=503,
    )