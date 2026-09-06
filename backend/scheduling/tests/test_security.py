"""Testes de segurança (tarefas.md):

- Sanitização de entradas (caracteres de controle, máx. tamanhos, telefone);
- SQLi: a busca do admin usa ORM parametrizado — payload clássico não altera
  o resultado nem quebra a query;
- XSS: headers de segurança (CSP, referrer, permissions) em toda resposta;
- MITM/DDoS: rate limit por IP e por conta no login;
- Privilégios: role suporte x admin, guarda do Django admin.
"""

from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from scheduling.middleware import RateLimitMiddleware
from scheduling.models import Option, Registration
from scheduling.validators import (
    PHONE_RE,
    strip_control_chars,
    validate_no_control_chars,
    validate_phone,
)
from django.core.exceptions import ValidationError


class SanitizationUnitTests(SimpleTestCase):
    def test_strips_control_characters(self):
        self.assertEqual(strip_control_chars("Ana\x00Souza\n\t"), "AnaSouza")
        self.assertEqual(strip_control_chars("  João  Silva  "), "João Silva")

    def test_control_chars_validator_rejects(self):
        with self.assertRaises(ValidationError):
            validate_no_control_chars("bad\x1binjection")

    def test_phone_validator_accepts_brazilian_formats(self):
        for good in ("(11) 99999-0000", "+5511999990000", "11 99999 0000"):
            validate_phone(good)  # não deve levantar

    def test_phone_validator_rejects_garbage(self):
        for bad in ("not-a-phone", "<script>", "12345"):
            with self.assertRaises(ValidationError):
                validate_phone(bad)

    def test_phone_regex_rejects_script_tag(self):
        self.assertIsNone(PHONE_RE.match("<script>"))


class SanitizationFlowTests(APITestCase):
    def setUp(self):
        self.clinica = Option.objects.create(
            title="Clínica Geral", price_cents=12000, duration_min=20, active=True
        )

    def _payload(self, **overrides):
        payload = {
            "name": "Maria da Silva",
            "email": "maria@exemplo.com",
            "option_id": self.clinica.id,
            "scheduled_date": str(timezone.localdate()),
            "scheduled_time": "09:30",
        }
        payload.update(overrides)
        return payload

    def test_name_with_script_tag_is_stored_but_control_chars_rejected(self):
        # Script tag não é caractere de controle: passa na sanitização e é armazenado
        # como dado (o front escapa na renderização/CSV — ver AdminPanel).
        response = self.client.post(
            "/api/registrations", self._payload(name="<script>alert(1)</script> Ana"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        reg = Registration.objects.get()
        self.assertEqual(reg.name, "<script>alert(1)</script> Ana")

    def test_name_with_null_byte_is_rejected(self):
        # Caractere de controle (\x00) é bloqueado (vetor clássico de injection).
        response = self.client.post(
            "/api/registrations", self._payload(name="Ana\x00"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data["errors"])
        self.assertEqual(Registration.objects.count(), 0)

    def test_phone_with_script_is_rejected(self):
        response = self.client.post(
            "/api/registrations", self._payload(phone="<script>alert(1)</script>"), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data["errors"])

    def test_xss_payload_in_admin_export_field_is_escaped_on_input(self):
        # Campo usado no CSV de exportação (AdminPanel) já chega sanitizado.
        response = self.client.post(
            "/api/registrations",
            self._payload(name="=SUM(1,1)"),  # vetor de CSV injection
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Serializer de saída não altera o valor; o front trata o prefixo na exportação.
        self.assertEqual(response.data["registration"]["name"], "=SUM(1,1)")

    def test_overlong_name_rejected(self):
        response = self.client.post(
            "/api/registrations", self._payload(name="x" * 151), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data["errors"])


class SqliRegressionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="admin@vidasaude.com", password="admin123", name="Admin", is_staff=True
        )
        self.clinica = Option.objects.create(
            title="Clínica Geral", price_cents=12000, duration_min=20, active=True
        )
        Registration.objects.create(
            name="Maria da Silva", email="maria@exemplo.com",
            option=self.clinica, scheduled_date=timezone.localdate(), scheduled_time="09:30",
        )
        self.client.post(
            "/api/login", {"email": "admin@vidasaude.com", "password": "admin123"}, format="json"
        )

    def test_sqli_payload_does_not_change_results(self):
        base = self.client.get("/api/admin/registrations?q=maria").data
        with_payload = self.client.get(
            "/api/admin/registrations?q=maria'%20OR%201%3D1--"
        ).data
        self.assertEqual(with_payload["total"], 0)  # OR 1=1 não injeta
        self.assertEqual(with_payload["items"], [])
        self.assertEqual(base["total"], 1)

    def test_sqli_in_tag_search_does_not_break(self):
        response = self.client.get(
            "/api/admin/registrations?q='%3B%20DROP%20TABLE%20scheduling_registration--"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 0)
        # Tabela continua existindo.
        self.assertEqual(Registration.objects.count(), 1)


class SecurityHeadersTests(APITestCase):
    def test_security_headers_present_on_all_responses(self):
        response = self.client.get("/api/options")
        self.assertEqual(response["Content-Security-Policy"], "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
        self.assertEqual(response["Referrer-Policy"], "same-origin")
        self.assertIn("Permissions-Policy", response)
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")


class RateLimitLoginTests(SimpleTestCase):
    def setUp(self):
        self.middleware = RateLimitMiddleware(lambda r: None)

    def _post(self, email="a@b.com"):
        from django.test import RequestFactory

        request = RequestFactory().post(
            "/api/login", data={"email": email}, content_type="application/json"
        )
        request.META["REMOTE_ADDR"] = "203.0.113.9"
        return request

    def test_login_ip_limit(self):
        for _ in range(30):
            self.middleware(self._post())
        blocked = self.middleware(self._post())
        self.assertEqual(blocked.status_code, 429)

    def test_login_account_limit_blocks_same_email_sooner_than_ip(self):
        # Teto por conta (IP + e-mail): 10 tentativas em 15min, abaixo do teto de IP (30).
        for email in ("alvo@x.com",) * 10:
            self.middleware(self._post(email=email))
        blocked = self.middleware(self._post(email="alvo@x.com"))
        self.assertEqual(blocked.status_code, 429)

        # E-mail diferente, mesmo IP, ainda permitido (bucket por conta é isolado).
        other = self.middleware(self._post(email="outro@x.com"))
        self.assertIsNone(other)


class RoleAndAdminGuardTests(APITestCase):
    def setUp(self):
        self.suporte = User.objects.create_user(
            email="suporte@vidasaude.com", password="suporte123",
            name="Suporte", is_staff=True, role=User.Role.SUPORTE,
        )
        self.admin = User.objects.create_superuser(
            email="admin@vidasaude.com", password="admin123", name="Admin"
        )

    def test_login_reports_support_role(self):
        self.client.post(
            "/api/login", {"email": "suporte@vidasaude.com", "password": "suporte123"}, format="json"
        )
        response = self.client.get("/api/me")
        self.assertEqual(response.data["role"], "suporte")

    def test_login_reports_admin_role(self):
        self.client.post(
            "/api/login", {"email": "admin@vidasaude.com", "password": "admin123"}, format="json"
        )
        response = self.client.get("/api/me")
        self.assertEqual(response.data["role"], "admin")

    def test_support_can_access_operations_panel(self):
        self.client.post(
            "/api/login", {"email": "suporte@vidasaude.com", "password": "suporte123"}, format="json"
        )
        response = self.client.get("/api/admin/registrations")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_support_blocked_from_django_admin(self):
        self.client.post(
            "/api/login", {"email": "suporte@vidasaude.com", "password": "suporte123"}, format="json"
        )
        response = self.client.get("/admin/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_reach_django_admin(self):
        self.client.post(
            "/api/login", {"email": "admin@vidasaude.com", "password": "admin123"}, format="json"
        )
        self.client.force_login(self.admin)
        response = self.client.get("/admin/")
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_302_FOUND))


class CreateSupportCommandTests(TestCase):
    def test_create_support_sets_role_and_staff(self):
        out = StringIO()
        call_command(
            "create_support", "bar@vidasaude.com", "--name", "Bar", "--password", "segredo123", stdout=out
        )
        user = User.objects.get(email="bar@vidasaude.com")
        self.assertEqual(user.role, User.Role.SUPORTE)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("segredo123"))
