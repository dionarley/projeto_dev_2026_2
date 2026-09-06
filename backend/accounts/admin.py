from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Pessoal", {"fields": ("name",)}),
        ("Permissões", {"fields": ("is_active", "is_staff", "is_superuser", "role", "groups", "user_permissions")}),
        ("Datas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "name", "role", "is_staff", "is_superuser")}),
    )
    ordering = ("email",)
    list_display = ("email", "name", "role", "is_staff", "is_active")
    search_fields = ("email", "name")