from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class EmailUserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("O e-mail é obrigatório.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser precisa de is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser precisa de is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Usuário customizado com login por e-mail (exigido pelo contrato da API).

    `role` distingue as equipes: "admin" (superusuário no Django admin e todas
    as operações) vs "suporte" (painel de operação — devoluções/opções — mas
    bloqueado no /admin/ e na gestão de usuários).
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        SUPORTE = "suporte", "Suporte"

    username = None
    email = models.EmailField("e-mail", unique=True)
    name = models.CharField("nome", max_length=150, blank=True)
    role = models.CharField(
        "equipe", max_length=12, choices=Role.choices, default=Role.ADMIN
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = EmailUserManager()

    @property
    def is_support(self) -> bool:
        return self.role == self.Role.SUPORTE

    def __str__(self) -> str:
        return self.email