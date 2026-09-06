from django.core.management.base import BaseCommand

from scheduling.models import Option

SEED_OPTIONS = [
    {
        "title": "Clínica Geral",
        "description": "Consulta médica para cuidados gerais, com avaliação inicial e encaminhamentos.",
        "price_cents": 12000,
        "duration_min": 20,
        "active": True,
    },
    {
        "title": "Cardiologia",
        "description": "Avaliação cardiológica com eletrocardiograma incluído.",
        "price_cents": 22000,
        "duration_min": 30,
        "active": True,
    },
    {
        "title": "Dermatologia",
        "description": "Consulta dermatológica para avaliação de pele, cabelo e unhas.",
        "price_cents": 20000,
        "duration_min": 30,
        "active": True,
    },
    {
        "title": "Psiquiatria",
        "description": "Acolhimento em saúde mental com médico psiquiatra.",
        "price_cents": 25000,
        "duration_min": 40,
        "active": True,
    },
    {
        "title": "Pediatria (teleducação)",
        "description": "Orientação pediátrica por teleconsulta para as famílias.",
        "price_cents": 15000,
        "duration_min": 25,
        "active": False,
    },
]


class Command(BaseCommand):
    help = "Insere as especialidades padrão (idempotente)."

    def handle(self, *args, **options):
        created = 0
        for data in SEED_OPTIONS:
            _, was_created = Option.objects.get_or_create(
                title=data["title"], defaults=data
            )
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(f"Opções conferidas. Criadas: {created}.")
        )