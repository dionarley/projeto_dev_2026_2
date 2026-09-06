from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Cria um usuário da equipe Suporte (painel de operação, sem acesso ao /admin/)."

    def add_arguments(self, parser):
        parser.add_argument("email", type=str)
        parser.add_argument("--name", type=str, default="Equipe de Suporte")
        parser.add_argument("--password", type=str, default="")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        name = options["name"].strip()

        if not email:
            raise CommandError("Informe o e-mail do usuário suporte.")

        if User.objects.filter(email=email).exists():
            raise CommandError(f"Já existe usuário com e-mail {email}.")

        if not password:
            password = User.objects.make_random_password(length=16)

        user = User.objects.create_user(
            email=email,
            password=password,
            name=name,
            is_staff=True,
            role=User.Role.SUPORTE,
        )
        self.stdout.write(self.style.SUCCESS(f"Suporte criado: {email}"))
        self.stdout.write(f"  equipe: {user.role}")
        self.stdout.write(f"  acesso ao painel /api/admin/**: sim")
        self.stdout.write(f"  acesso ao /admin/ (Django admin): não (superuser apenas)")