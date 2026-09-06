from django.urls import include, path, re_path
from django.contrib import admin

from .views import frontend

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("scheduling.urls")),
]

# Fallback SPA: qualquer rota não-API/static devolve o index.html do frontend.
urlpatterns += [
    re_path(r"^.*$", frontend),
]