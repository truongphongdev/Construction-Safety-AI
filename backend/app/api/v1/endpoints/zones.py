import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.zone import ZoneModel
from app.models.camera import CameraModel

router = APIRouter(prefix="/zones", tags=["Zones"])

class ZoneCreate(BaseModel):
    camera_id: str
    name: str
    polygon_coords: List[List[float]]  # Ex: [[x1, y1], [x2, y2], [x3, y3], ...]
    severity: str = "CRITICAL"
    is_active: bool = True

class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    polygon_coords: Optional[List[List[float]]] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None

class ZoneResponse(BaseModel):
    id: str
    camera_id: str
    name: str
    polygon_coords: List[List[float]]
    severity: str
    is_active: bool
    created_at: str

    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[dict])
def list_zones(camera_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ZoneModel)
    if camera_id:
        try:
            cam_uuid = uuid.UUID(camera_id)
            query = query.filter(ZoneModel.camera_id == cam_uuid)
        except ValueError:
            return []
    zones = query.all()
    return [
        {
            "id": str(z.id),
            "camera_id": str(z.camera_id),
            "name": z.name,
            "polygon_coords": z.polygon_coords,
            "severity": z.severity,
            "is_active": z.is_active,
            "created_at": z.created_at.isoformat() if z.created_at else None,
        }
        for z in zones
    ]

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_zone(req: ZoneCreate, db: Session = Depends(get_db)):
    try:
        cam_uuid = uuid.UUID(req.camera_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="camera_id không hợp lệ.")

    camera = db.query(CameraModel).filter(CameraModel.id == cam_uuid).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera không tồn tại.")

    zone = ZoneModel(
        id=uuid.uuid4(),
        camera_id=cam_uuid,
        name=req.name,
        polygon_coords=req.polygon_coords,
        severity=req.severity,
        is_active=req.is_active,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)

    return {
        "id": str(zone.id),
        "camera_id": str(zone.camera_id),
        "name": zone.name,
        "polygon_coords": zone.polygon_coords,
        "severity": zone.severity,
        "is_active": zone.is_active,
        "created_at": zone.created_at.isoformat(),
    }

@router.put("/{zone_id}", response_model=dict)
def update_zone(zone_id: str, req: ZoneUpdate, db: Session = Depends(get_db)):
    try:
        z_uuid = uuid.UUID(zone_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="zone_id không hợp lệ.")

    zone = db.query(ZoneModel).filter(ZoneModel.id == z_uuid).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone không tồn tại.")

    if req.name is not None:
        zone.name = req.name
    if req.polygon_coords is not None:
        zone.polygon_coords = req.polygon_coords
    if req.severity is not None:
        zone.severity = req.severity
    if req.is_active is not None:
        zone.is_active = req.is_active

    db.commit()
    db.refresh(zone)

    return {
        "id": str(zone.id),
        "camera_id": str(zone.camera_id),
        "name": zone.name,
        "polygon_coords": zone.polygon_coords,
        "severity": zone.severity,
        "is_active": zone.is_active,
    }

@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(zone_id: str, db: Session = Depends(get_db)):
    try:
        z_uuid = uuid.UUID(zone_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="zone_id không hợp lệ.")

    zone = db.query(ZoneModel).filter(ZoneModel.id == z_uuid).first()
    if zone:
        db.delete(zone)
        db.commit()
    return None
