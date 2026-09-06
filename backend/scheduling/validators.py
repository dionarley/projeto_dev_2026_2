"""Sanitização e validação de entradas de usuário (tarefa: "Sanitizar entradas").

Reutilizado por serializers (fronteira da API) e modelos (fronteira do Django
admin/forms). Nenhuma dessas validações depende de banco, então não geram
migrações.
"""

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

# Caracteres de controle (incluindo quebra de linha, \x00..\x1f e \x7f) — nunca
# têm uso legítimo em nome/telefone/descrição e são vetor clássico de XSS/injection.
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

PHONE_RE = re.compile(r"^\+?[0-9\s().\-]{8,30}$")

MAX_NAME = 150
MAX_TITLE = 120
MAX_DESCRIPTION = 2000
MAX_EMAIL = 254


def strip_control_chars(value: str) -> str:
    """Remove caracteres de controle e normaliza espaços em branco reais."""
    if not value:
        return ""
    value = CONTROL_CHARS.sub("", value)
    return " ".join(value.split())


def validate_no_control_chars(value):
    """Validador de modelo: rejeita qualquer caractere de controle."""
    if CONTROL_CHARS.search(value or ""):
        raise ValidationError(_("Não são aceitos caracteres de controle."))


def validate_phone(value):
    """Validador de modelo: telefone deve bater o padrão (8–30 dígitos/+() .- espaço)."""
    value = strip_control_chars(value or "")
    if value and not PHONE_RE.match(value):
        raise ValidationError(_("Informe um telefone válido (apenas dígitos, +, espaço, (), . e -)."))