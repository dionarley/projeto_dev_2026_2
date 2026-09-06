"""Middlewares de segurança do site (tarefas: XSS, MITM, privilégios).

- SecurityHeadersMiddleware: CSP, Referrer-Policy e Permissions-Policy em
  todas as respostas — mitigação de XSS/clickjacking/exfil.
- DjangoAdminGuardMiddleware: o Django admin é zona de superusuário; usuários
  com is_staff mas sem is_superuser (equipe Suporte/TI no painel de operação)
  recebem 403 em /admin/ em vez de acesso implícito.
"""

from django.http import HttpResponseForbidden
from django.urls import Resolver404, resolve

CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "img-src 'self' data:; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Content-Security-Policy"] = CSP_POLICY
        response["Referrer-Policy"] = "same-origin"
        response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class DjangoAdminGuardMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            resolved = resolve(request.path_info)
        except Resolver404:
            resolved = None
        if resolved is None or resolved.namespace != "admin":
            return self.get_response(request)

        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and not user.is_superuser:
            return HttpResponseForbidden(
                "Área restrita a superusuários (equipe administrativa)."
            )
        return self.get_response(request)