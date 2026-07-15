import uuid
import pytest
from fastapi.testclient import TestClient


def test_user_crud(client: TestClient):
    unique_username = f"user_{uuid.uuid4().hex[:6]}"
    # 1. Create a user
    user_payload = {
        "username": unique_username,
        "full_name": "Test User Crud",
        "role": "ADMIN",
        "is_active": True,
        "password": "secretpassword"
    }
    response = client.post("/api/v1/users/", json=user_payload)
    assert response.status_code == 201
    user_data = response.json()
    assert user_data["username"] == unique_username
    assert user_data["full_name"] == "Test User Crud"
    assert "password_hash" not in user_data
    user_id = user_data["id"]

    # 2. Get the user
    response = client.get(f"/api/v1/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["username"] == unique_username

    # 3. Update the user
    update_payload = {
        "full_name": "Updated Name",
        "role": "SUPER_ADMIN"
    }
    response = client.put(f"/api/v1/users/{user_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Name"
    assert response.json()["role"] == "SUPER_ADMIN"

    # 4. Delete the user
    response = client.delete(f"/api/v1/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Người dùng đã được xóa thành công."

    # 5. Check user not found
    response = client.get(f"/api/v1/users/{user_id}")
    assert response.status_code == 404


def test_camera_crud(client: TestClient):
    camera_name = f"Camera_{uuid.uuid4().hex[:6]}"
    # 1. Create a camera
    camera_payload = {
        "name": camera_name,
        "location_desc": "Main Gate",
        "ip_address": "192.168.1.100",
        "status": "ACTIVE"
    }
    response = client.post("/api/v1/cameras/", json=camera_payload)
    assert response.status_code == 201
    camera_data = response.json()
    assert camera_data["name"] == camera_name
    camera_id = camera_data["id"]

    # 2. Get the camera
    response = client.get(f"/api/v1/cameras/{camera_id}")
    assert response.status_code == 200
    assert response.json()["location_desc"] == "Main Gate"

    # 3. Update the camera
    update_payload = {
        "status": "MAINTENANCE",
        "location_desc": "Updated Main Gate"
    }
    response = client.put(f"/api/v1/cameras/{camera_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "MAINTENANCE"
    assert response.json()["location_desc"] == "Updated Main Gate"

    # 4. Soft delete the camera
    response = client.delete(f"/api/v1/cameras/{camera_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Camera đã được xóa mềm thành công."

    # 5. Check camera not found (default get skips soft deleted)
    response = client.get(f"/api/v1/cameras/{camera_id}")
    assert response.status_code == 404

    # 6. Check camera found when including soft deleted
    response = client.get(f"/api/v1/cameras/{camera_id}?include_deleted=true")
    assert response.status_code == 200


def test_violation_crud_and_validation(client: TestClient):
    unique_username = f"reviewer_{uuid.uuid4().hex[:6]}"
    camera_name = f"cam_{uuid.uuid4().hex[:6]}"

    # Create user and camera first
    user_payload = {
        "username": unique_username,
        "full_name": "Reviewer",
        "role": "ADMIN",
        "password": "reviewerpassword"
    }
    response = client.post("/api/v1/users/", json=user_payload)
    assert response.status_code == 201
    user_id = response.json()["id"]

    camera_payload = {
        "name": camera_name,
        "location_desc": "Zone A",
        "status": "ACTIVE"
    }
    response = client.post("/api/v1/cameras/", json=camera_payload)
    assert response.status_code == 201
    camera_id = response.json()["id"]

    # 1. Create a violation with valid payload
    violation_payload = {
        "camera_id": camera_id,
        "detected_time": "2026-07-15T12:00:00Z",
        "violation_type": "NO_HELMET",
        "severity_level": "MEDIUM",
        "video_bucket": "safety-videos",
        "video_path": "20260715/no_helmet_01.mp4",
        "image_path": "20260715/no_helmet_01.jpg",
        "status": "PENDING",
        "reviewed_by": None,
        "reviewed_at": None,
        "ai_metadata": {"confidence": 0.88}
    }
    response = client.post("/api/v1/violations/", json=violation_payload)
    assert response.status_code == 201
    violation_data = response.json()
    assert violation_data["violation_type"] == "NO_HELMET"
    violation_id = violation_data["id"]

    # 2. Try to create violation with invalid payload (status PENDING but has reviewed_by)
    invalid_payload = violation_payload.copy()
    invalid_payload["reviewed_by"] = user_id
    response = client.post("/api/v1/violations/", json=invalid_payload)
    assert response.status_code == 422
    assert "reviewed_by và reviewed_at phải là null" in response.json()["detail"][0]["msg"]

    # 3. Update violation: confirm the review with user_id and status CONFIRMED
    update_payload = {
        "status": "CONFIRMED",
        "reviewed_by": user_id,
        "reviewed_at": "2026-07-15T12:05:00Z"
    }
    response = client.put(f"/api/v1/violations/{violation_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "CONFIRMED"
    assert response.json()["reviewed_by"] == user_id

    # 4. Try to update status back to PENDING while reviewed_by is still set (should trigger auto-nulling or exception)
    # Our service layer auto-nulls when status is PENDING, so it should succeed and set them to None
    response = client.put(f"/api/v1/violations/{violation_id}", json={"status": "PENDING"})
    assert response.status_code == 200
    assert response.json()["status"] == "PENDING"
    assert response.json()["reviewed_by"] is None
    assert response.json()["reviewed_at"] is None

    # 5. Soft delete the violation
    response = client.delete(f"/api/v1/violations/{violation_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Bản ghi vi phạm đã được xóa mềm thành công."
