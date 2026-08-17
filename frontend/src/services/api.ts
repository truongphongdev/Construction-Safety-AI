/**
 * API Service Layer — Kết nối Frontend React với FastAPI & gRPC Backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface Camera {
  id: string;
  name: string;
  rtsp_url?: string;
  location?: string;
  location_desc?: string;
  ip_address?: string;
  status: 'online' | 'offline' | 'error' | 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | string;
  resolution?: string;
  fps?: number;
  created_at?: string;
}

export interface Violation {
  id: string;
  camera_id: string;
  type: string;
  severity: 'danger' | 'warning' | 'info';
  timestamp: string;
  image_url?: string;
  video_url?: string;
  status: string;
  details?: string;
}

// Backend raw schema (maps to ViolationOut from FastAPI)
interface BackendViolation {
  id: string;
  camera_id: string;
  violation_type: string;
  severity_level: 'LOW' | 'MEDIUM' | 'CRITICAL';
  detected_time: string;
  image_path?: string;
  video_path?: string;
  status: string;
  ai_metadata?: Record<string, unknown>;
}

interface BackendViolationList {
  total: number;
  offset: number;
  limit: number;
  items: BackendViolation[];
}

function mapSeverity(level: string): 'danger' | 'warning' | 'info' {
  if (level === 'CRITICAL') return 'danger';
  if (level === 'MEDIUM') return 'warning';
  return 'info';
}

const DEFAULT_CAMERA_NAMES: Record<string, string> = {
  '00000000-0000-0000-0000-000000000000': 'Dashboard Demo Camera',
  '00000000-0000-0000-0000-000000000001': 'Camera 01 - Webcam Laptop',
};

export function resolveCameraName(camId: string, cameraMap?: Record<string, string>): string {
  if (cameraMap && cameraMap[camId]) return cameraMap[camId];
  if (DEFAULT_CAMERA_NAMES[camId]) return DEFAULT_CAMERA_NAMES[camId];
  if (camId && camId.length > 12) {
    return `Cam ${camId.substring(0, 8)}`;
  }
  return camId || 'Camera không xác định';
}

function mapBackendViolation(v: BackendViolation, cameraMap?: Record<string, string>): Violation {
  let formattedTime = '';
  if (v.detected_time) {
    const raw = v.detected_time;
    const str = (raw.endsWith('Z') || raw.includes('+')) ? raw : `${raw}Z`;
    const d = new Date(str);
    formattedTime = isNaN(d.getTime()) ? new Date(raw).toLocaleString('vi-VN') : d.toLocaleString('vi-VN');
  }
  return {
    id: v.id,
    camera_id: resolveCameraName(v.camera_id, cameraMap),
    type: v.violation_type,
    severity: mapSeverity(v.severity_level),
    timestamp: formattedTime,
    image_url: v.image_path,
    video_url: v.video_path,
    status: v.status,
    details: v.ai_metadata ? JSON.stringify(v.ai_metadata) : undefined,
  };
}

export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox: BoundingBox;
  is_violation: boolean;
}

export interface DetectionResponse {
  total_violations: number;
  objects: DetectedObject[];
  inference_time_ms: number;
  image_width: number;
  image_height: number;
}

// ── 2. Detection API ─────────────────────────────────────────────────────────
export const detectImage = async (file: File): Promise<DetectionResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/detect/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi khi gửi ảnh phân tích AI');
  }

  return await response.json();
};

// ── 3. Cameras API ───────────────────────────────────────────────────────────
export const fetchCameras = async (): Promise<Camera[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/cameras`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}: Không thể tải danh sách camera`);
    const data = await response.json();
    const items: Camera[] = Array.isArray(data) ? data : (data.items ?? []);
    // Lọc bỏ camera rác tự động khởi tạo từ các luồng stream ngầm
    return items.filter(c => 
      c.name !== 'Dashboard Demo Camera' && 
      !c.name?.startsWith('Camera cam_') &&
      !(c.location_desc && c.location_desc.includes('Tự động tạo'))
    );
  } catch (err) {
    console.warn('[API Service] Lỗi khi fetch danh sách camera:', err);
    return [];
  }
};

export const createCamera = async (camera: Partial<Camera>): Promise<Camera> => {
  const response = await fetch(`${API_BASE_URL}/cameras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(camera),
  });
  if (!response.ok) throw new Error('Không thể thêm camera mới');
  return await response.json();
};

// ── 4. Violations API ────────────────────────────────────────────────────────
export interface PagedViolationsResult {
  items: Violation[];
  total: number;
  offset: number;
  limit: number;
  page: number;
  totalPages: number;
}

export const fetchViolations = async (cameraMap?: Record<string, string>): Promise<Violation[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/violations?limit=100`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}: Không thể tải danh sách vi phạm`);
    const data: BackendViolationList = await response.json();
    const items = Array.isArray(data) ? data : (data.items ?? []);
    return (items as BackendViolation[]).map(v => mapBackendViolation(v, cameraMap));
  } catch (err) {
    console.warn('[API Service] Lỗi khi fetch danh sách vi phạm:', err);
    return [];
  }
};

export const fetchViolationsPaged = async (
  page: number = 1,
  pageSize: number = 10,
  cameraMap?: Record<string, string>,
  cameraId?: string,
  status?: string
): Promise<PagedViolationsResult> => {
  try {
    const offset = (page - 1) * pageSize;
    let url = `${API_BASE_URL}/violations?limit=${pageSize}&offset=${offset}`;
    if (cameraId) url += `&camera_id=${encodeURIComponent(cameraId)}`;
    if (status && status !== 'all') url += `&status=${encodeURIComponent(status)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}: Không thể tải danh sách vi phạm`);
    const data: BackendViolationList = await response.json();
    const rawItems = Array.isArray(data) ? data : (data.items ?? []);
    const items = (rawItems as BackendViolation[]).map(v => mapBackendViolation(v, cameraMap));
    const total = data.total ?? items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items,
      total,
      offset,
      limit: pageSize,
      page,
      totalPages,
    };
  } catch (err) {
    console.warn('[API Service] Lỗi khi fetch danh sách vi phạm phân trang:', err);
    return {
      items: [],
      total: 0,
      offset: 0,
      limit: pageSize,
      page: 1,
      totalPages: 1,
    };
  }
};

// ── 5. Health Check ──────────────────────────────────────────────────────────
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

// ── 6. Delete Camera ─────────────────────────────────────────────────────────
export const deleteCamera = async (cameraId: string): Promise<boolean> => {
  const response = await fetch(`${API_BASE_URL}/cameras/${cameraId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể xóa camera');
  }
  return true;
};
