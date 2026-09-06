from rest_framework import serializers

from .models import Option, Registration
from .validators import (
    MAX_DESCRIPTION,
    MAX_EMAIL,
    MAX_NAME,
    MAX_TITLE,
    PHONE_RE,
    strip_control_chars,
)


def flatten_errors(errors: dict) -> dict:
    """Converte erros do DRF (listas de mensagens) em strings, para a UI consumir direto."""
    flat = {}
    for field, messages in errors.items():
        if isinstance(messages, (list, tuple)):
            flat[field] = str(messages[0])
        else:
            flat[field] = str(messages)
    return flat


class OptionSerializer(serializers.ModelSerializer):
    registrations = serializers.IntegerField(
        source="registration_count", read_only=True, default=0
    )

    class Meta:
        model = Option
        fields = [
            "id",
            "title",
            "description",
            "price_cents",
            "duration_min",
            "active",
            "registrations",
            "created_at",
            "updated_at",
        ]

    def validate_title(self, value: str) -> str:
        value = strip_control_chars(value)
        if len(value) < 3:
            raise serializers.ValidationError("O título deve ter pelo menos 3 caracteres.")
        if len(value) > MAX_TITLE:
            raise serializers.ValidationError(f"O título deve ter no máximo {MAX_TITLE} caracteres.")
        return value

    def validate_description(self, value: str) -> str:
        value = strip_control_chars(value)
        if len(value) > MAX_DESCRIPTION:
            raise serializers.ValidationError(
                f"A descrição deve ter no máximo {MAX_DESCRIPTION} caracteres."
            )
        return value

    def validate_price_cents(self, value: int) -> int:
        if value < 0:
            raise serializers.ValidationError("O preço não pode ser negativo.")
        return value

    def validate_duration_min(self, value: int) -> int:
        if not 10 <= value <= 240:
            raise serializers.ValidationError("A duração deve ficar entre 10 e 240 minutos.")
        return value


class RegistrationSerializer(serializers.ModelSerializer):
    option_title = serializers.CharField(source="option.title", read_only=True)
    option_id = serializers.PrimaryKeyRelatedField(
        source="option", queryset=Option.objects.all()
    )

    class Meta:
        model = Registration
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "option_id",
            "option_title",
            "scheduled_date",
            "scheduled_time",
            "status",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value: str) -> str:
        value = strip_control_chars(value)
        if len(value) < 3:
            raise serializers.ValidationError("Informe seu nome completo (mínimo 3 caracteres).")
        if len(value) > MAX_NAME:
            raise serializers.ValidationError(f"O nome deve ter no máximo {MAX_NAME} caracteres.")
        return value

    def validate_email(self, value: str) -> str:
        value = strip_control_chars(value).strip().lower()
        if len(value) > MAX_EMAIL:
            raise serializers.ValidationError(f"O e-mail deve ter no máximo {MAX_EMAIL} caracteres.")
        email_part = value.split("@")[-1]
        if "@" not in value or "." not in email_part or " " in value:
            raise serializers.ValidationError("Informe um e-mail válido.")
        return value

    def validate_option_id(self, value: Option) -> Option:
        if not value.active:
            raise serializers.ValidationError("Essa especialidade não está disponível no momento.")
        return value

    def validate_phone(self, value: str) -> str:
        value = strip_control_chars(value)
        if value and not PHONE_RE.match(value):
            raise serializers.ValidationError(
                "Informe um telefone válido (dígitos, +, espaço, ( ), . e -)."
            )
        return value

    def validate_scheduled_date(self, value) -> object:
        from django.utils import timezone

        if value < timezone.localdate():
            raise serializers.ValidationError("A data não pode estar no passado.")
        return value