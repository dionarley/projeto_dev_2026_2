from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from scheduling.models import Option, Registration

EMAIL_ADMIN = "admin@vidasaude.com"
PASSWORD_ADMIN = "admin123"


class PublicFlowTests(APITestCase):
    def setUp(self):
        self.clinica = Option.objects.create(
            title="Clínica Geral", price_cents=12000, duration_min=20, active=True
        )
        self.pediatria = Option.objects.create(
            title="Pediatria (teleducação)", price_cents=15000, duration_min=25, active=False
        )

    def test_registration_valid_creates_pendente(self):
        payload = {
            "name": "Maria da Silva",
            "email": "maria@exemplo.com",
            "phone": "(11) 99999-0000",
            "option_id": self.clinica.id,
            "scheduled_date": str(timezone.localdate()),
            "scheduled_time": "09:30",
        }
        response = self.client.post("/api/registrations", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        reg = response.data["registration"]
        self.assertEqual(reg["status"], "pendente")
        self.assertEqual(reg["option_title"], "Clínica Geral")
        self.assertEqual(reg["scheduled_time"], "09:30:00")
        self.assertIn("message", response.data)

    def test_registration_invalid_fields_return_400_and_does_not_persist(self):
        base = {
            "name": "Jo",
            "email": "email-invalido",
            "phone": "1",
            "option_id": self.clinica.id,
            "scheduled_date": "1999-01-01",
            "scheduled_time": "25:99",
        }
        response = self.client.post("/api/registrations", base, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)
        self.assertTrue(response.data["errors"]["name"])
        self.assertTrue(response.data["errors"]["email"])
        self.assertTrue(response.data["errors"]["scheduled_date"])
        self.assertEqual(Registration.objects.count(), 0)

    def test_registration_rejects_inactive_option(self):
        payload = {
            "name": "José Pereira",
            "email": "jose@exemplo.com",
            "option_id": self.pediatria.id,
            "scheduled_date": str(timezone.localdate()),
            "scheduled_time": "10:00",
        }
        response = self.client.post("/api/registrations", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data["errors"]["option_id"])

    def test_duplicate_registration_within_window_is_rejected(self):
        payload = {
            "name": "Ana Souza",
            "email": "ana@exemplo.com",
            "option_id": self.clinica.id,
            "scheduled_date": str(timezone.localdate()),
            "scheduled_time": "08:00",
        }
        first = self.client.post("/api/registrations", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post("/api/registrations", payload, format="json")
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(Registration.objects.count(), 1)

    def test_public_options_list_only_active(self):
        response = self.client.get("/api/options")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item["title"] for item in response.data}
        self.assertEqual(titles, {"Clínica Geral"})
        self.assertNotIn("Pediatria (teleducação)", titles)

    def test_registration_missing_email_returns_400_with_errors(self):
        payload = {
            "name": "Maria da Silva",
            "option_id": self.clinica.id,
            "scheduled_date": str(timezone.localdate()),
            "scheduled_time": "09:30",
        }
        response = self.client.post("/api/registrations", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data["errors"])

    def test_registration_same_window_but_different_email_is_allowed(self):
        payload = {
            "name": "Ana Souza",
            "email": "ana@exemplo.com",
            "option_id": self.clinica.id,
            "scheduled_date": str(timezone.localdate()),
            "scheduled_time": "08:00",
        }
        first = self.client.post("/api/registrations", payload, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            "/api/registrations",
            {**payload, "email": "outra@exemplo.com"},
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Registration.objects.count(), 2)


class AdminFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email=EMAIL_ADMIN, password=PASSWORD_ADMIN,
            name="Administrador", is_staff=True,
        )
        self.clinica = Option.objects.create(
            title="Clínica Geral", price_cents=12000, duration_min=20, active=True
        )
        self.registration = Registration.objects.create(
            name="Maria da Silva",
            email="maria@exemplo.com",
            option=self.clinica,
            scheduled_date=timezone.localdate(),
            scheduled_time="09:30",
        )

    def _login(self):
        response = self.client.post(
            "/api/login", {"email": EMAIL_ADMIN, "password": PASSWORD_ADMIN}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_requires_authentication(self):
        response = self.client.get("/api/admin/registrations")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_login_and_status_change_persists(self):
        self._login()
        response = self.client.get("/api/me")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], EMAIL_ADMIN)

        patch = self.client.patch(
            f"/api/admin/registrations/{self.registration.id}/status",
            {"status": "confirmado"},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertEqual(patch.data["status"], "confirmado")

        self.registration.refresh_from_db()
        self.assertEqual(self.registration.status, "confirmado")

    def test_admin_list_filters_and_pagination(self):
        self._login()
        Registration.objects.create(
            name="José Pereira",
            email="jose@exemplo.com",
            option=self.clinica,
            scheduled_date=timezone.localdate(),
            scheduled_time="10:00",
        )
        response = self.client.get("/api/admin/registrations?q=maria&limit=1&page=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["totalPages"], 1)

    def test_admin_stats_counts(self):
        self._login()
        Registration.objects.create(
            name="José Pereira",
            email="jose@exemplo.com",
            option=self.clinica,
            scheduled_date=timezone.localdate(),
            scheduled_time="10:00",
            status=Registration.Status.CONFIRMADO,
        )
        response = self.client.get("/api/admin/stats")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["pendente"], 1)
        self.assertEqual(response.data["confirmado"], 1)
        self.assertEqual(response.data["hoje"], 2)

    def test_admin_manages_options(self):
        self._login()
        created = self.client.post(
            "/api/admin/options",
            {
                "title": "Ortopedia",
                "description": "Consulta ortopédica.",
                "price_cents": 18000,
                "duration_min": 30,
                "active": True,
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        new_id = created.data["id"]

        updated = self.client.put(
            f"/api/admin/options/{new_id}",
            {
                "title": "Ortopedia e Traumatologia",
                "description": "Consulta ortopédica.",
                "price_cents": 20000,
                "duration_min": 35,
                "active": False,
            },
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["title"], "Ortopedia e Traumatologia")
        self.assertIs(updated.data["active"], False)

        public = self.client.get("/api/options")
        self.assertNotIn("Ortopedia e Traumatologia", [o["title"] for o in public.data])

    def test_auth_cookie_csrf_flow(self):
        self._login()
        self.client.post("/api/logout")
        response = self.client.get("/api/me")
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_set_status_rejects_invalid_value(self):
        self._login()
        response = self.client.patch(
            f"/api/admin/registrations/{self.registration.id}/status",
            {"status": "lixo"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_set_status_returns_400_when_unchanged(self):
        self._login()
        response = self.client.patch(
            f"/api/admin/registrations/{self.registration.id}/status",
            {"status": "pendente"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_set_status_unknown_registration_returns_404(self):
        self._login()
        response = self.client.patch(
            "/api/admin/registrations/99999/status",
            {"status": "confirmado"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_unknown_option_returns_404(self):
        self._login()
        response = self.client.put(
            "/api/admin/options/99999",
            {"title": "X"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_options_includes_inactive(self):
        self._login()
        Option.objects.create(
            title="Pediatria (teleducação)",
            price_cents=15000,
            duration_min=25,
            active=False,
        )
        response = self.client.get("/api/admin/options")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item["title"] for item in response.data}
        self.assertIn(self.clinica.title, titles)
        self.assertIn("Pediatria (teleducação)", titles)

    def test_toggle_option_active_status_via_partial_update(self):
        self._login()
        inactive = Option.objects.create(
            title="Pediatria (teleducação)",
            price_cents=15000,
            duration_min=25,
            active=False,
        )
        response = self.client.put(
            f"/api/admin/options/{inactive.id}",
            {"active": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data["active"], True)
        public = self.client.get("/api/options")
        self.assertIn(inactive.title, [o["title"] for o in public.data])