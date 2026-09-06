import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


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
                "role": User.Role.ADMIN,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password", "role"])
            self.stdout.write(self.style.SUCCESS(f"Administrador criado: {email}"))
        else:
            user.role = User.Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.save(update_fields=["role", "is_staff", "is_superuser"])
            self.stdout.write(self.style.WARNING(f"Administrador já existe: {email}"))