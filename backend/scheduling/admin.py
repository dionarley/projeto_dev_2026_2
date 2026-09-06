from django.contrib import admin

from .models import Option, Registration


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ("title", "active", "price_cents", "duration_min", "updated_at")
    list_filter = ("active",)
    search_fields = ("title",)


@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "option", "scheduled_date", "scheduled_time", "status", "created_at")
    list_filter = ("status", "scheduled_date")
    search_fields = ("name", "email")
    list_select_related = ("option",)