from django.test import SimpleTestCase, TestCase

from accounts.models import User


class EmailUserManagerTests(TestCase):
    def test_normalizes_email_domain(self):
        user = User.objects.create_user(
            email="Maria@Exemplo.COM", password="senha123", name="Maria"
        )
        self.assertEqual(user.email, "Maria@exemplo.com")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_user_requires_email(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email=None, password="senha123")

    def test_create_superuser_sets_flags(self):
        user = User.objects.create_superuser(
            email="admin@exemplo.com", password="senha123"
        )
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("senha123"))


class UserModelTests(SimpleTestCase):
    def test_username_is_none_and_email_is_identifier(self):
        user = User(email="ana@exemplo.com")
        self.assertIsNone(user.username)
        self.assertEqual(user.get_username(), "ana@exemplo.com")

    def test_str_is_email(self):
        user = User(email="ana@exemplo.com")
        self.assertEqual(str(user), "ana@exemplo.com")