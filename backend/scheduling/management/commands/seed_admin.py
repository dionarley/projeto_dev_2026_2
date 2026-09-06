import os

from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Cria/atualiza o usuário administrador do painel (ambiente e .env)."

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL", "admin@vidasaude.com").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "admin123")
        name = os.environ.get("ADMIN_NAME", "Administrador (VidaSaúde)")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "name": name,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
            self.stdout.write(self.style.SUCCESS(f"Administrador criado: {email}"))
        else:
            self.stdout.write(self.style.WARNING(f"Administrador já existe: {email}"))