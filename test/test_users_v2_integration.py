"""
Tests de integración para endpoints de administración de usuarios (V2)
"""
import pytest
import requests

BASE_URL = "http://localhost:8500"


@pytest.fixture(scope="module")
def superadmin_token():
    """Obtiene token de superadmin para los tests."""
    response = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        data={
            "username": "superadmin@emerald.com",
            "password": "SuperAdmin123!"
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 200, f"Login falló: {response.json()}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(superadmin_token):
    """Headers con autenticación Bearer."""
    return {"Authorization": f"Bearer {superadmin_token}"}


def test_create_user_success(auth_headers):
    """Test: Crear usuario exitosamente."""
    payload = {
        "email": f"test.{__name__}@emerald.com",
        "username": f"testuser_{__name__}",
        "password": "TestPassword123!",
        "full_name": "Test User Integration"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v2/users/",
        json=payload,
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert data["is_active"] is True
    assert data["is_superuser"] is False
    assert "id" in data
    
    return data["id"]


def test_create_user_duplicate_email(auth_headers):
    """Test: Crear usuario con email duplicado debe fallar."""
    payload = {
        "email": "superadmin@emerald.com",  # Ya existe
        "username": "nuevo_username",
        "password": "TestPassword123!",
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v2/users/",
        json=payload,
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "ya registrado" in response.json()["detail"].lower()


def test_reset_password_success(auth_headers):
    """Test: Reset de contraseña exitoso."""
    # Crear usuario de prueba
    create_payload = {
        "email": "reset.test@emerald.com",
        "username": "reset_test",
        "password": "InitialPass123!",
    }
    create_resp = requests.post(
        f"{BASE_URL}/api/v2/users/",
        json=create_payload,
        headers=auth_headers
    )
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]
    
    # Reset password
    reset_resp = requests.post(
        f"{BASE_URL}/api/v2/users/{user_id}/reset-password",
        headers=auth_headers
    )
    
    assert reset_resp.status_code == 200
    data = reset_resp.json()
    assert "temporary_password" in data
    assert "user_id" in data
    assert data["user_id"] == user_id
    assert len(data["temporary_password"]) >= 8


def test_reset_password_own_blocked(auth_headers):
    """Test: Admin no puede resetear su propia contraseña."""
    # Obtener ID del superadmin
    me_resp = requests.get(
        f"{BASE_URL}/api/v1/auth/me",
        headers=auth_headers
    )
    assert me_resp.status_code == 200
    admin_id = me_resp.json()["id"]
    
    # Intentar reset propio
    reset_resp = requests.post(
        f"{BASE_URL}/api/v2/users/{admin_id}/reset-password",
        headers=auth_headers
    )
    
    assert reset_resp.status_code == 400
    assert "propia contraseña" in reset_resp.json()["detail"].lower()


def test_update_status_deactivate_and_reactivate(auth_headers):
    """Test: Desactivar y reactivar usuario."""
    # Crear usuario de prueba
    create_payload = {
        "email": "status.test@emerald.com",
        "username": "status_test",
        "password": "StatusPass123!",
    }
    create_resp = requests.post(
        f"{BASE_URL}/api/v2/users/",
        json=create_payload,
        headers=auth_headers
    )
    assert create_resp.status_code == 201
    user_id = create_resp.json()["id"]
    
    # Desactivar
    deactivate_resp = requests.patch(
        f"{BASE_URL}/api/v2/users/{user_id}/status",
        json={"is_active": False},
        headers=auth_headers
    )
    assert deactivate_resp.status_code == 200
    assert deactivate_resp.json()["is_active"] is False
    
    # Reactivar
    reactivate_resp = requests.patch(
        f"{BASE_URL}/api/v2/users/{user_id}/status",
        json={"is_active": True},
        headers=auth_headers
    )
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["is_active"] is True


def test_update_status_own_blocked(auth_headers):
    """Test: Admin no puede cambiar su propio estado."""
    # Obtener ID del superadmin
    me_resp = requests.get(
        f"{BASE_URL}/api/v1/auth/me",
        headers=auth_headers
    )
    assert me_resp.status_code == 200
    admin_id = me_resp.json()["id"]
    
    # Intentar desactivarse
    status_resp = requests.patch(
        f"{BASE_URL}/api/v2/users/{admin_id}/status",
        json={"is_active": False},
        headers=auth_headers
    )
    
    assert status_resp.status_code == 400
    assert "propio estado" in status_resp.json()["detail"].lower()


def test_unauthorized_access_without_token():
    """Test: Acceso sin token debe ser rechazado."""
    response = requests.post(
        f"{BASE_URL}/api/v2/users/",
        json={
            "email": "test@test.com",
            "username": "test",
            "password": "Test123!"
        }
    )
    
    assert response.status_code == 401


def test_forbidden_access_non_superuser():
    """Test: Usuario no-superuser debe ser rechazado."""
    # Crear usuario regular
    regular_payload = {
        "email": "regular.user@emerald.com",
        "username": "regularuser",
        "password": "RegularPass123!",
    }
    
    # Registrar usuario regular
    register_resp = requests.post(
        f"{BASE_URL}/api/v1/auth/register",
        json=regular_payload
    )
    assert register_resp.status_code == 201
    
    # Login como usuario regular
    login_resp = requests.post(
        f"{BASE_URL}/api/v1/auth/login",
        data={
            "username": regular_payload["email"],
            "password": regular_payload["password"]
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert login_resp.status_code == 200
    regular_token = login_resp.json()["access_token"]
    
    # Intentar crear usuario (sin ser superuser)
    create_resp = requests.post(
        f"{BASE_URL}/api/v2/users/",
        json={
            "email": "should.fail@emerald.com",
            "username": "shouldfail",
            "password": "Fail123!"
        },
        headers={"Authorization": f"Bearer {regular_token}"}
    )
    
    assert create_resp.status_code == 403
    assert "permisos" in create_resp.json()["detail"].lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
