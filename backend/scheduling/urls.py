from django.urls import path

from . import views

urlpatterns = [
    path("api/csrf", views.csrf_token),
    path("api/login", views.login_view),
    path("api/logout", views.logout_view),
    path("api/me", views.me_view),
    path("api/options", views.list_options),
    path("api/registrations", views.create_registration),
    path("api/admin/stats", views.admin_stats),
    path("api/admin/registrations", views.admin_registrations),
    path("api/admin/registrations/<int:pk>/status", views.admin_set_status),
    path("api/admin/options", views.admin_options),
    path("api/admin/options/<int:pk>", views.admin_option_update),
]