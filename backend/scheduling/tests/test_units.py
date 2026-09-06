"""Testes unitários — lógica isolada (serializers e anti-spam), sem HTTP.

Cobrem as unidades que os testes de integração (test_api.py) exercitam só
"pedaço por pedaço": validações de campos e a política de rate limit.
"""

from datetime import timedelta

from django.test import RequestFactory, SimpleTestCase, TestCase
from django.utils import timezone

from scheduling.middleware import RateLimitMiddleware
from scheduling.models import Option, Registration
from scheduling.serializers import (
    OptionSerializer,
    RegistrationSerializer,
    flatten_errors,
)


class OptionSerializerTests(TestCase):
    def _data(self, **overrides):
        payload = {
            "title": "Ortopedia",
            "description": "",
            "price_cents": 18000,
            "duration_min": 30,
            "active": True,
        }
        payload.update(overrides)
        return payload

    def test_valid_option_serializes(self):
        serializer = OptionSerializer(data=self._data())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["title"], "Ortopedia")

    def test_rejects_short_title(self):
        serializer = OptionSerializer(data=self._data(title="Uc"))
        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_rejects_negative_price(self):
        serializer = OptionSerializer(data=self._data(price_cents=-1))
        self.assertFalse(serializer.is_valid())
        self.assertIn("price_cents", serializer.errors)

    def test_rejects_duration_out_of_range(self):
        too_short = OptionSerializer(data=self._data(duration_min=5))
        too_long = OptionSerializer(data=self._data(duration_min=300))
        self.assertFalse(too_short.is_valid())
        self.assertFalse(too_long.is_valid())
        self.assertIn("duration_min", too_short.errors)
        self.assertIn("duration_min", too_long.errors)

    def test_registrations_count_comes_from_related_rows(self):
        option = Option.objects.create(
            title="Ortopedia", price_cents=18000, duration_min=30, active=True
        )
        Registration.objects.create(
            name="Maria",
            email="maria@exemplo.com",
            option=option,
            scheduled_date=timezone.localdate(),
            scheduled_time="09:30",
        )
        serializer = OptionSerializer(option)
        self.assertEqual(serializer.data["registrations"], 1)


class RegistrationSerializerTests(TestCase):
    def setUp(self):
        self.active = Option.objects.create(
            title="Clínica Geral", price_cents=12000, duration_min=20, active=True
        )
        self.inactive = Option.objects.create(
            title="Pediatria (teleducação)", price_cents=15000, duration_min=25, active=False
        )
        self.tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()

    def _data(self, **overrides):
        payload = {
            "name": "Maria da Silva",
            "email": "maria@exemplo.com",
            "phone": "(11) 99999-0000",
            "option_id": self.active.id,
            "scheduled_date": self.tomorrow,
            "scheduled_time": "09:30",
        }
        payload.update(overrides)
        return payload

    def test_valid_registration_serializer(self):
        serializer = RegistrationSerializer(data=self._data())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["email"], "maria@exemplo.com")

    def test_option_title_is_read_only_and_reflected(self):
        registration = Registration.objects.create(
            name="Maria da Silva",
            email="maria@exemplo.com",
            option=self.active,
            scheduled_date=self.tomorrow,
            scheduled_time="09:30",
        )
        serializer = RegistrationSerializer(registration)
        self.assertEqual(serializer.data["option_title"], "Clínica Geral")
        self.assertEqual(serializer.data["option_id"], self.active.id)

    def test_normalizes_email_to_lowercase(self):
        serializer = RegistrationSerializer(data=self._data(email="  Maria@Exemplo.COM "))
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["email"], "maria@exemplo.com")

    def test_rejects_name_shorter_than_3(self):
        serializer = RegistrationSerializer(data=self._data(name="Ao"))
        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_rejects_malformed_email(self):
        serializer = RegistrationSerializer(data=self._data(email="sem-arroba"))
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

    def test_rejects_short_phone(self):
        serializer = RegistrationSerializer(data=self._data(phone="123"))
        self.assertFalse(serializer.is_valid())
        self.assertIn("phone", serializer.errors)

    def test_rejects_past_date(self):
        serializer = RegistrationSerializer(
            data=self._data(scheduled_date=(timezone.localdate() - timedelta(days=1)).isoformat())
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("scheduled_date", serializer.errors)

    def test_rejects_inactive_option(self):
        serializer = RegistrationSerializer(data=self._data(option_id=self.inactive.id))
        self.assertFalse(serializer.is_valid())
        self.assertIn("option_id", serializer.errors)

    def test_flatten_errors_converts_lists_to_strings(self):
        detail = {"name": ["Muito curto.", "Outra mensagem."], "email": "inválido"}
        flat = flatten_errors(detail)
        self.assertEqual(flat["name"], "Muito curto.")
        self.assertEqual(flat["email"], "inválido")


class RateLimitMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

        def get_response(request):
            from django.http import HttpResponse

            return HttpResponse("ok")

        self.middleware = RateLimitMiddleware(get_response)

    def _post(self):
        request = self.factory.post("/api/registrations")
        request.META["REMOTE_ADDR"] = "203.0.113.10"
        return request

    def test_allows_five_then_blocks_the_sixth(self):
        for _ in range(5):
            response = self.middleware(self._post())
            self.assertEqual(response.status_code, 200)

        blocked = self.middleware(self._post())
        self.assertEqual(blocked.status_code, 429)

    def test_different_ips_have_independent_buckets(self):
        for ip in ("203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4", "203.0.113.5"):
            for _ in range(5):
                request = self.factory.post("/api/registrations")
                request.META["REMOTE_ADDR"] = ip
                self.assertEqual(self.middleware(request).status_code, 200)

    def test_login_endpoint_is_also_limited(self):
        for _ in range(5):
            request = self.factory.post("/api/login")
            request.META["REMOTE_ADDR"] = "203.0.113.20"
            self.assertEqual(self.middleware(request).status_code, 200)

        request = self.factory.post("/api/login")
        request.META["REMOTE_ADDR"] = "203.0.113.20"
        self.assertEqual(self.middleware(request).status_code, 429)