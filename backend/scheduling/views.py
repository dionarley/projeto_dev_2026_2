import math
from datetime import timedelta

from django.contrib.auth import authenticate as dj_authenticate
from django.contrib.auth import login as dj_login
from django.contrib.auth import logout as dj_logout
from django.db.models import Count, Q
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils import timezone
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import Option, Registration
from .serializers import (
    OptionSerializer,
    RegistrationSerializer,
    flatten_errors,
)

REGISTRATION_STATUSES = Registration.Status.values


# ---------------------------------------------------------------------------
# Autenticação (mesmo contrato do backend Express anterior)
# ---------------------------------------------------------------------------
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_token(request):
    return Response({"csrfToken": get_token(request)})


@ensure_csrf_cookie
@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email = str(request.data.get("email") or "").strip().lower()
    password = str(request.data.get("password") or "")
    if not email or not password:
        return Response({"error": "Informe e-mail e senha."}, status=status.HTTP_400_BAD_REQUEST)
    user = dj_authenticate(request, username=email, password=password)
    if user is None:
        return Response({"error": "E-mail ou senha inválidos."}, status=status.HTTP_401_UNAUTHORIZED)
    dj_login(request, user)
    role = "admin" if user.is_staff else "user"
    return Response({"id": user.id, "name": user.name, "email": user.email, "role": role})


@api_view(["POST"])
def logout_view(request):
    dj_logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def me_view(request):
    user = request.user
    role = "admin" if user.is_staff else "user"
    return Response({"id": user.id, "name": user.name, "email": user.email, "role": role})


# ---------------------------------------------------------------------------
# Página pública
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def list_options(request):
    options = Option.objects.filter(active=True)
    return Response(OptionSerializer(options, many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def create_registration(request):
    email = str(request.data.get("email") or "").strip().lower()
    option_id = request.data.get("option_id")
    scheduled_date = request.data.get("scheduled_date")
    if email and option_id and scheduled_date:
        recent = Registration.objects.filter(
            email=email,
            option_id=option_id,
            scheduled_date=scheduled_date,
            created_at__gte=timezone.now() - timedelta(minutes=1),
        ).exists()
        if recent:
            return Response(
                {"error": "Você já enviou esse agendamento. Aguarde alguns instantes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

    serializer = RegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"errors": flatten_errors(serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    registration = serializer.save()
    return Response(
        {
            "message": "Agendamento recebido! Retornaremos em breve para confirmar.",
            "registration": RegistrationSerializer(registration).data,
        },
        status=status.HTTP_201_CREATED,
    )


# ---------------------------------------------------------------------------
# Painel administrativo (somente staff)
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_stats(request):
    bucket = dict(
        Registration.objects.values("status")
        .annotate(count=Count("id"))
        .values_list("status", "count")
    )
    total = sum(bucket.values())
    hoje = Registration.objects.filter(scheduled_date=timezone.localdate()).count()
    return Response(
        {
            "total": total,
            "pendente": bucket.get("pendente", 0),
            "confirmado": bucket.get("confirmado", 0),
            "cancelado": bucket.get("cancelado", 0),
            "hoje": hoje,
        }
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_registrations(request):
    queryset = Registration.objects.select_related("option")
    _status = request.query_params.get("status")
    if _status in REGISTRATION_STATUSES:
        queryset = queryset.filter(status=_status)
    _q = request.query_params.get("q", "").strip()
    if _q:
        queryset = queryset.filter(Q(name__icontains=_q) | Q(email__icontains=_q))

    total = queryset.count()
    limit = min(100, max(1, int(request.query_params.get("limit", 10) or 10)))
    page = max(1, int(request.query_params.get("page", 1) or 1))
    total_pages = max(1, math.ceil(total / limit))
    page = min(page, total_pages)
    start = (page - 1) * limit
    items = queryset[start : start + limit]
    return Response(
        {
            "items": RegistrationSerializer(items, many=True).data,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
        }
    )


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def admin_set_status(request, pk: int):
    try:
        registration = Registration.objects.get(pk=pk)
    except Registration.DoesNotExist:
        return Response({"error": "Agendamento não encontrado."}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get("status")
    if new_status not in REGISTRATION_STATUSES:
        return Response({"error": "Status inválido."}, status=status.HTTP_400_BAD_REQUEST)
    if new_status == registration.status:
        return Response(
            {"error": f"O agendamento já está como {new_status}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    registration.status = new_status
    registration.save(update_fields=["status", "updated_at"])
    return Response(RegistrationSerializer(registration).data)


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def admin_options(request):
    if request.method == "GET":
        return Response(OptionSerializer(Option.objects.all(), many=True).data)

    serializer = OptionSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"errors": flatten_errors(serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    option = serializer.save()
    return Response(
        OptionSerializer(option).data, status=status.HTTP_201_CREATED
    )


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def admin_option_update(request, pk: int):
    try:
        option = Option.objects.get(pk=pk)
    except Option.DoesNotExist:
        return Response({"error": "Opção não encontrada."}, status=status.HTTP_404_NOT_FOUND)

    serializer = OptionSerializer(option, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(
            {"errors": flatten_errors(serializer.errors)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer.save()
    return Response(OptionSerializer(option).data)