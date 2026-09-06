from django.db import models

from .validators import validate_no_control_chars, validate_phone


class Option(models.Model):
    """Especialidade/atendimento oferecido (agendável na página pública)."""

    title = models.CharField("título", max_length=120, validators=[validate_no_control_chars])
    description = models.TextField(
        "descrição", blank=True, default="", validators=[validate_no_control_chars]
    )
    price_cents = models.PositiveIntegerField("preço (centavos)", default=0)
    duration_min = models.PositiveIntegerField("duração (min)", default=30)
    active = models.BooleanField("ativa", default=True)
    created_at = models.DateTimeField("criado em", auto_now_add=True)
    updated_at = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        ordering = ["id"]

    @property
    def registration_count(self) -> int:
        return self.registrations.count()

    def __str__(self) -> str:
        return self.title


class Registration(models.Model):
    """Agendamento feito pelo formulário público."""

    class Status(models.TextChoices):
        PENDENTE = "pendente", "Pendente"
        CONFIRMADO = "confirmado", "Confirmado"
        CANCELADO = "cancelado", "Cancelado"

    name = models.CharField(
        "nome", max_length=150, validators=[validate_no_control_chars]
    )
    email = models.EmailField("e-mail")
    phone = models.CharField(
        "telefone",
        max_length=30,
        blank=True,
        default="",
        validators=[validate_phone],
    )
    option = models.ForeignKey(
        Option, on_delete=models.CASCADE, related_name="registrations"
    )
    scheduled_date = models.DateField("data agendada")
    scheduled_time = models.TimeField("hora agendada")
    status = models.CharField(
        "status", max_length=12, choices=Status.choices, default=Status.PENDENTE
    )
    created_at = models.DateTimeField("criado em", auto_now_add=True)
    updated_at = models.DateTimeField("atualizado em", auto_now=True)

    class Meta:
        ordering = ["scheduled_date", "scheduled_time", "created_at"]

    def __str__(self) -> str:
        return f"{self.name} — {self.option.title}"