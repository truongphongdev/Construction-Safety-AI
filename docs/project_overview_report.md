# 📋 BÁO CÁO TỔNG QUAN DỰ ÁN — CONSTRUCTION SAFETY AI

> **Phiên bản:** v1.4 · **Ngày báo cáo:** 07/08/2026  
> **Tên dự án:** Industrial Safety AI Analytics (VisionGuard AI)  
> **Mục tiêu:** Hệ thống giám sát an toàn lao động nhà máy / công trường bằng AI thời gian thực

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1. Mô tả chung

Construction Safety AI là hệ thống giám sát an toàn lao động sử dụng trí tuệ nhân tạo (AI) kết hợp camera giám sát. Hệ thống phát hiện tự động các vi phạm an toàn trên công trường xây dựng và cảnh báo real-time cho quản lý.

### 1.2. Bốn tính năng AI chính

| # | Tính năng | Mô tả | Tần suất |
|---|-----------|-------|----------|
| 1 | **Re-ID** (Person Re-Identification) | Nhận diện danh tính công nhân qua camera bằng OSNet, so sánh cosine similarity | 1 lần/track mới |
| 2 | **PPE Detection** (Protective Equipment) | Phát hiện thiếu mũ bảo hiểm, áo phản quang, găng tay (5 class YOLOv8) | Mỗi 2 giây/người |
| 3 | **Restricted Zone** (Vùng cấm) | Phát hiện xâm nhập vùng cấm bằng point-in-polygon | Mỗi frame |
| 4 | **Fall Detection** (Phát hiện ngã) | Phát hiện sự kiện té ngã bằng Temporal Transformer trên chuỗi keypoints | Cửa sổ ~1 giây |

### 1.3. Công nghệ cốt lõi

| Thành phần | Công nghệ |
|------------|-----------|
| **Frontend** | React 19 + TypeScript + Vite 8 + React Router 7 |
| **Backend** | Python + FastAPI (port 8080) |
| **Database** | PostgreSQL 16 (qua SQLAlchemy ORM) |
| **AI Inference** | NVIDIA Triton Inference Server (gRPC :8001) |
| **Object Storage** | Cloudflare R2 (S3 API qua boto3) |
| **Containerization** | Docker Compose (Triton + PostgreSQL) |
| **Model** | YOLOv8/YOLO11n-pose + OSNet Re-ID + PPE classifiers + Fall Transformer |

---

## 2. KIẾN TRÚC HỆ THỐNG (6 TẦNG)

```
┌─────────────────────────────────────────────────────────────────┐
│  TẦNG 6 — React Dashboard (VisionGuard AI) — port :5173        │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 5 — Backend FastAPI — port :8080                         │
│  ├── REST API /api/v1 (cameras, violations, zones, auth...)    │
│  ├── WebSocket /ws/alerts (real-time push)                     │
│  └── MJPEG /stream/{camera_id} (video streaming)               │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 4 — Event Bus + Data Layer                               │
│  ├── EventBus (multiprocessing.Queue, non-blocking)            │
│  ├── EventConsumer (ghi DB + upload R2 + broadcast WS)         │
│  ├── PostgreSQL (violations, cameras, zones, users, events)    │
│  └── Cloudflare R2 (ảnh/video bằng chứng)                     │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 3 — Triton Inference Server — gRPC :8001                 │
│  ├── yolo_pose (YOLO11n-pose, FP16, dynamic batch 2)          │
│  ├── osnet_reid (FP16, max_batch 16)                           │
│  ├── ppe ×4 classifiers (head/face/hand/torso, FP16)           │
│  └── fall_model (Temporal Transformer, FP32)                   │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 2 — 4 Nhánh Phân Tích (Re-ID · PPE · Zone · Fall)       │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 1 — Camera Worker (1 process/camera, multiprocessing)    │
├─────────────────────────────────────────────────────────────────┤
│  TẦNG 0 — Camera USB (V4L2, MJPG 1280×720@25fps)              │
└─────────────────────────────────────────────────────────────────┘
```

### Ngân sách VRAM (GPU 4GB)

| Model | Precision | VRAM |
|-------|-----------|------|
| CUDA context + Triton runtime | — | ~500 MB |
| yolo_pose (1 instance, 2 cam) | FP16 | ~400–600 MB |
| osnet_reid | FP16 | ~250 MB |
| ppe ×4 classifiers | FP16 | ~400 MB |
| fall_model (Transformer) | FP32 | ~50–100 MB |
| **Tổng** | | **~1.6–1.9 GB / 4 GB** |

---

## 3. FRONTEND — TÍNH NĂNG CHI TIẾT

### 3.1. Stack công nghệ

- **Framework:** React 19 + TypeScript
- **Build tool:** Vite 8
- **Routing:** React Router 7
- **Styling:** CSS Modules + CSS Variables (hỗ trợ theme sáng/tối)
- **Icons:** Google Material Symbols (Outlined)
- **State:** React hooks (useState, useEffect, useRef)

### 3.2. Cấu trúc thư mục

```
frontend/src/
├── App.tsx                     # Route chính
├── main.tsx                    # Entry point
├── index.css                   # Design system (CSS variables, theme)
├── pages/
│   ├── Dashboard/              # Trang chính — metrics + violations + test AI
│   ├── Cameras/                # Quản lý camera (grid, add/delete, AI overlay)
│   ├── Violations/             # Bảng vi phạm + lọc + xem chi tiết
│   ├── Reports/                # Báo cáo KPI + biểu đồ
│   ├── Settings/               # Cấu hình email, SMS, auto-record, retention
│   ├── Help/                   # Trang trợ giúp
│   ├── Login/                  # Đăng nhập
│   └── Register/               # Đăng ký
├── services/
│   └── api.ts                  # API service layer kết nối FastAPI
├── hooks/
│   └── useTheme.ts             # Quản lý theme sáng/tối
├── layouts/                    # MainLayout + AuthLayout
├── components/                 # Shared components
├── store/                      # State management
├── types/                      # TypeScript type definitions
├── utils/                      # Utility functions (translation...)
└── constants/                  # Constants
```

### 3.3. Các trang và tính năng Frontend

#### 📊 Dashboard (`/`)
- **Metrics cards:** Camera hoạt động, Vi phạm ghi nhận, Trạng thái Backend
- **Nhật ký vi phạm gần đây:** Bảng hiển thị 6 vi phạm mới nhất với hình ảnh thumbnail, loại vi phạm, camera, thời gian, mức độ, trạng thái
- **Test AI Upload:** Cho phép upload ảnh JPG/PNG để test YOLOv8 inference trực tiếp trên browser, vẽ bounding box lên canvas
- **Auto-polling:** Tự động cập nhật metrics và violations mỗi 10 giây
- **Toast notification:** Phát event `violation-detected` khi có vi phạm mới
- **Image Viewer Modal:** Click ảnh để phóng to xem chi tiết

#### 📹 Cameras (`/cameras`)
- Grid hiển thị tất cả camera
- Thêm / Xóa camera
- Bật/tắt camera (power toggle)
- AI overlay toggle (bật/tắt vẽ detection overlay)
- Modal telemetry + model checkbox (chọn model chạy per-camera)

#### ⚠️ Violations (`/violations`)
- **Bảng vi phạm:** Hiển thị toàn bộ danh sách vi phạm từ DB (phân trang limit=100)
- **Thanh tìm kiếm:** Lọc theo tên camera hoặc loại vi phạm
- **Bộ lọc mức độ:** Tất cả / Nguy hiểm (Danger) / Cảnh báo (Warning) / Thông tin (Info)
- **Modal chi tiết:** Click "Chi tiết" để xem đầy đủ thông tin vi phạm + ảnh bằng chứng
- **Severity mapping:** CRITICAL → danger (đỏ), MEDIUM → warning (vàng), LOW → info (xanh)

#### 📈 Reports (`/reports`)
- KPI overview (tổng hợp thống kê)
- Biểu đồ phân tích (đang phát triển)
- Xuất CSV/PDF (planned)

#### ⚙️ Settings (`/settings`)
- Cấu hình email digest (báo cáo hằng ngày 18:00)
- SMS khẩn cấp khi phát hiện nguy hiểm
- Auto-record (ghi clip 10s trước/sau vi phạm)
- Retention (số ngày lưu trữ snapshot)

#### 🔐 Login & Register (`/login`, `/register`)
- Xác thực JWT (Access Token 15 phút + Refresh Token 7 ngày)
- Hỗ trợ role: ADMIN, SUPER_ADMIN

### 3.4. API Service Layer (Frontend → Backend)

Frontend giao tiếp với backend qua module `services/api.ts`:

| Function | HTTP | Endpoint | Mô tả |
|----------|------|----------|-------|
| `checkHealth()` | GET | `/api/v1/health` | Kiểm tra backend online |
| `fetchCameras()` | GET | `/api/v1/cameras` | Lấy danh sách camera |
| `createCamera()` | POST | `/api/v1/cameras` | Thêm camera mới |
| `deleteCamera()` | DELETE | `/api/v1/cameras/{id}` | Xóa camera |
| `fetchViolations()` | GET | `/api/v1/violations?limit=100` | Lấy danh sách vi phạm |
| `detectImage()` | POST | `/api/v1/detect/image` | Upload ảnh test AI inference |

#### WebSocket & Streaming

| Protocol | Endpoint | Mô tả |
|----------|----------|-------|
| **WebSocket** | `/ws/alerts` | Nhận cảnh báo vi phạm real-time (push notification) |
| **MJPEG** | `/stream/{camera_id}` | Video stream trực tiếp (dùng `<img>` tag) |

### 3.5. Tính năng Frontend còn thiếu

- ❌ Zone Editor (vẽ polygon vùng cấm trên giao diện)
- ❌ Loại vi phạm Fall Detection trên UI
- ❌ Trang quản lý nhân viên (gallery Re-ID)
- ❌ Route `/models` chưa đăng ký
- ❌ Biểu đồ Reports chưa render đúng (bug CSS)

---

## 4. BACKEND — LUỒNG LƯU TRỮ VI PHẠM CHI TIẾT

### 4.1. Kiến trúc Backend

```
backend/
├── main.py                     # Uvicorn entry point
├── app/
│   ├── main.py                 # FastAPI factory + lifespan (auto create tables + seed data)
│   ├── config.py               # Settings (env, DB, JWT, Triton, R2)
│   ├── core/
│   │   ├── database.py         # SQLAlchemy engine + session
│   │   ├── event_bus.py        # EventBus (multiprocessing.Queue)
│   │   ├── auth.py             # JWT authentication logic
│   │   └── security.py         # Password hashing (bcrypt)
│   ├── models/                 # SQLAlchemy ORM Models
│   │   ├── user.py             # UserModel
│   │   ├── camera.py           # CameraModel
│   │   ├── violation.py        # ViolationModel ⭐
│   │   ├── zone.py             # ZoneModel
│   │   └── system_event.py     # SystemEventModel
│   ├── schemas/                # Pydantic schemas (validation)
│   │   ├── violation.py        # ViolationCreate, ViolationUpdate, ViolationOut
│   │   ├── camera.py, user.py, detection.py
│   ├── services/               # Business logic layer
│   │   ├── violation_service.py # CRUD vi phạm
│   │   ├── detection_service.py # YOLOv8 inference
│   │   ├── camera_service.py
│   │   └── user_service.py
│   ├── api/v1/endpoints/       # REST API routers
│   │   ├── violations.py       # CRUD endpoints vi phạm
│   │   ├── cameras.py, zones.py, auth.py, users.py
│   │   ├── detection.py        # Upload ảnh detect
│   │   ├── stream.py           # MJPEG + WebSocket + Webcam AI
│   │   └── health.py
│   ├── storage/
│   │   └── r2_client.py        # Cloudflare R2 upload + presigned URL
│   └── ai/
│       └── triton_client.py    # Triton gRPC PPE client
├── workers/
│   ├── camera_worker.py        # CameraWorkerProcess (per-camera)
│   ├── event_consumer.py       # EventConsumerThread (DB + R2 + WS)
│   └── worker_manager.py       # WorkerManager (start/stop workers)
└── analytics/
    ├── ppe_checker.py          # PPE violation checker + cooldown
    └── zone_checker.py         # Zone intrusion checker + debounce
```

### 4.2. Database Schema — PostgreSQL

#### Bảng `violations` (Bảng lưu trữ vi phạm chính)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | ID vi phạm, auto gen `gen_random_uuid()` |
| `camera_id` | UUID (FK → cameras.id) | Camera phát hiện vi phạm |
| `detected_time` | DateTime (timezone) | Thời gian phát hiện vi phạm |
| `violation_type` | String(50) | Loại vi phạm: `NO_HELMET`, `NO_VEST`, `ZONE_INTRUSION`, `FALL`... |
| `severity_level` | String(20) | Mức độ: `LOW` \| `MEDIUM` \| `CRITICAL` |
| `worker_code` | String(50), nullable | Mã số công nhân (nếu Re-ID xác định được) |
| `track_id` | String(50), nullable | ID theo dõi đối tượng (tracking ID từ BoT-SORT) |
| `evidence_key` | String(255), nullable | Key lưu trên R2 (tên file bằng chứng) |
| `video_bucket` | String(50), nullable | Bucket lưu video clip |
| `video_path` | String(255), nullable | Đường dẫn file video |
| `image_path` | String(255), nullable | Đường dẫn ảnh snapshot (local hoặc R2) |
| `status` | String(20) | Trạng thái: `PENDING` \| `CONFIRMED` \| `WARNING_SENT` \| `FALSE_ALARM` |
| `reviewed_by` | UUID (FK → users.id), nullable | Người phê duyệt/xác nhận |
| `reviewed_at` | DateTime, nullable | Thời điểm phê duyệt |
| `ai_metadata` | JSONB | Metadata AI: confidence score, bounding box, zone_name, event_type |
| `created_at` | DateTime (timezone) | Thời điểm tạo bản ghi |
| `updated_at` | DateTime (timezone) | Thời điểm cập nhật |
| `deleted_at` | DateTime, nullable | Soft delete timestamp |

**Constraints:**
- `chk_violation_severity`: severity_level ∈ {LOW, MEDIUM, CRITICAL}
- `chk_violation_status`: status ∈ {PENDING, CONFIRMED, WARNING_SENT, FALSE_ALARM}
- `chk_review_consistency`: Nếu status = PENDING → reviewed_by và reviewed_at phải NULL

#### Bảng `cameras`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | ID camera |
| `name` | String(100) | Tên camera |
| `location_desc` | Text | Mô tả vị trí |
| `ip_address` | String(45) | Địa chỉ IP |
| `status` | String(20) | `ACTIVE` \| `INACTIVE` \| `MAINTENANCE` |
| `created_at` / `updated_at` / `deleted_at` | DateTime | Timestamps |

#### Bảng `zones`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | ID vùng cấm |
| `camera_id` | UUID (FK → cameras.id) | Camera chứa vùng cấm |
| `name` | String(100) | Tên vùng cấm |
| `polygon_coords` | JSONB | Tọa độ polygon (mảng các điểm [x, y]) |
| `severity` | String(20) | `LOW` \| `MEDIUM` \| `CRITICAL` |
| `is_active` | Boolean | Trạng thái kích hoạt |

#### Bảng `users`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | ID người dùng |
| `username` | String(50), unique | Tên đăng nhập |
| `password_hash` | String(255) | Mật khẩu đã hash (bcrypt) |
| `full_name` | String(100) | Họ tên |
| `role` | String(20) | `ADMIN` \| `SUPER_ADMIN` |
| `is_active` | Boolean | Trạng thái hoạt động |

#### Bảng `system_events`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | ID sự kiện |
| `event_type` | String(50) | `CAMERA_OFFLINE`, `WORKER_CRASH`, `TRITON_RECONNECT`... |
| `camera_id` | UUID (FK), nullable | Camera liên quan |
| `level` | String(20) | `INFO`, `WARNING`, `ERROR`... |
| `message` | Text | Nội dung sự kiện |

### 4.3. Luồng lưu trữ vi phạm End-to-End

Dưới đây là luồng xử lý chi tiết khi một vi phạm được phát hiện:

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │ BƯỚC 1: Camera Worker phát hiện vi phạm                             │
 │ ─────────────────────────────────────────                           │
 │ CameraWorkerProcess (1 process/camera):                             │
 │  ① Đọc frame mới nhất từ camera (LatestFrameReader)                │
 │  ② Gửi frame qua gRPC tới Triton → YOLOv8 detection               │
 │  ③ BoT-SORT tracking → gán track_id cho mỗi người                 │
 │  ④ PPEChecker.check() → phát hiện NO_HELMET/NO_VEST               │
 │     (cooldown 30s chống ghi trùng cùng track_id)                   │
 │  ⑤ ZoneChecker.check() → phát hiện ZONE_INTRUSION                 │
 │     (debounce 5 frame + cooldown 30s)                               │
 └────────────────────────┬─────────────────────────────────────────────┘
                          │ event dict: {event_type, camera_id,
                          │   violation_type, severity_level, track_id,
                          │   frame_jpg (numpy), bbox, confidence}
                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ BƯỚC 2: EventBus (multiprocessing.Queue)                            │
 │ ─────────────────────────────────────────                           │
 │ global_event_bus.publish(event)                                     │
 │ → Non-blocking put (nếu queue đầy → bỏ event mới nhất)            │
 │ → maxsize = 1000 events                                            │
 └────────────────────────┬─────────────────────────────────────────────┘
                          │
                          ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ BƯỚC 3: EventConsumerThread (daemon thread duy nhất)                │
 │ ─────────────────────────────────────────────────────               │
 │ _process_event(event):                                              │
 │                                                                     │
 │  3a. ENCODE ẢNH                                                    │
 │      ├─ Nếu frame_jpg là numpy array → cv2.imencode(".jpg") → bytes│
 │      └─ Nếu đã là bytes → dùng trực tiếp                          │
 │                                                                     │
 │  3b. LƯU BẰNG CHỨNG (R2 + Local Spool)                            │
 │      ├─ Tạo evidence_key = "evidence_{camera_id}_{timestamp}_{hex}"│
 │      ├─ Spool ra đĩa local: evidence_spool/{key}.jpg (backup)     │
 │      ├─ Upload lên Cloudflare R2 (retry 3 lần, delay 0.5s×attempt)│
 │      └─ Nếu R2 thất bại → fallback URL: /static/evidence/{key}.jpg│
 │                                                                     │
 │  3c. GHI VÀO POSTGRESQL                                            │
 │      INSERT INTO violations (                                       │
 │        id, camera_id, detected_time, violation_type,                │
 │        severity_level, track_id, evidence_key,                      │
 │        image_path, video_bucket, video_path, status,                │
 │        ai_metadata                                                  │
 │      )                                                              │
 │      ai_metadata = {                                                │
 │        "event_type": "ppe_violation" | "zone_intrusion",            │
 │        "confidence": 0.85,                                          │
 │        "bbox": [x1, y1, x2, y2],                                   │
 │        "zone_name": "Khu vực nguy hiểm A" (nếu zone event)        │
 │      }                                                              │
 │      status mặc định = "PENDING"                                    │
 │                                                                     │
 │  3d. BROADCAST WEBSOCKET                                            │
 │      ├─ Tạo alert_payload JSON                                     │
 │      ├─ Gọi registered callbacks → broadcast tới tất cả WS clients│
 │      └─ Frontend nhận → hiện toast cảnh báo + cập nhật bảng        │
 └──────────────────────────────────────────────────────────────────────┘
```

### 4.4. Chiến lược lưu trữ tách đôi

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│    DỮ LIỆU CÓ CẤU TRÚC     │     │   DỮ LIỆU PHI CẤU TRÚC     │
│    (PostgreSQL)              │     │   (Cloudflare R2)            │
├─────────────────────────────┤     ├─────────────────────────────┤
│ • Bản ghi vi phạm           │     │ • Ảnh snapshot bằng chứng   │
│ • Thông tin camera           │     │ • Video clip 20s            │
│ • Vùng cấm (polygon JSON)   │     │ • Ring buffer frames        │
│ • Users + Auth               │     │                             │
│ • System events              │     │ Fallback: local disk        │
│                              │     │ (evidence_spool/*.jpg)      │
│ DB chỉ lưu evidence_key     │ ──► │ R2 lưu file thực tế        │
│ + image_path (URL)           │     │ Presigned URL hết hạn 1h   │
└─────────────────────────────┘     └─────────────────────────────┘
```

**Quy trình lưu bằng chứng R2:**

1. **Spool trước** → ghi file `.jpg` vào `evidence_spool/` trên đĩa local (đảm bảo không mất dữ liệu dù R2 lỗi)
2. **Upload R2** → retry tối đa 3 lần (delay tăng dần 0.5s → 1s → 1.5s)
3. **Presigned URL** → khi frontend yêu cầu xem ảnh → generate URL tạm thời hết hạn sau 1 giờ
4. **Fallback** → nếu không cấu hình R2 hoặc upload thất bại → serve từ static files local

### 4.5. REST API Violations — Endpoints chi tiết

| Method | Endpoint | Mô tả | Response |
|--------|----------|-------|----------|
| `POST` | `/api/v1/violations/` | Tạo bản ghi vi phạm mới | `201` + ViolationOut |
| `GET` | `/api/v1/violations/` | Lấy danh sách (phân trang + lọc) | ViolationList |
| `GET` | `/api/v1/violations/{id}` | Xem chi tiết 1 vi phạm | ViolationOut |
| `PUT` | `/api/v1/violations/{id}` | Cập nhật vi phạm (review/confirm) | ViolationOut |
| `DELETE` | `/api/v1/violations/{id}` | Soft delete vi phạm | Message |

**Query parameters cho GET list:**
- `limit` (1–100, default 20)
- `offset` (≥0, default 0)
- `camera_id` (UUID, lọc theo camera)
- `status` (PENDING/CONFIRMED/WARNING_SENT/FALSE_ALARM)
- `include_deleted` (boolean, bao gồm cả đã soft delete)

**Validation khi tạo/cập nhật:**
- Camera ID phải tồn tại trong DB
- Reviewed_by (nếu có) phải là user hợp lệ
- Nếu status = PENDING → reviewed_by và reviewed_at phải NULL

---

## 5. LUỒNG XỬ LÝ REAL-TIME

### 5.1. Chuỗi sự kiện khi phát hiện công nhân không đội mũ

```
Camera USB → CameraWorker →  Triton (YOLOv8) → Phát hiện "no_helmet"
                                                          │
                              PPEChecker (cooldown 30s) ◄──┘
                                        │
                              EventBus.publish({
                                event_type: "ppe_violation",
                                violation_type: "NO_HELMET",
                                severity_level: "CRITICAL",
                                camera_id: "...",
                                track_id: "cam1-42",
                                bbox: [120, 80, 280, 350],
                                confidence: 0.87,
                                frame_jpg: <numpy>
                              })
                                        │
                              EventConsumer ◄──────────────┘
                                 ├── Encode JPEG
                                 ├── Spool local + Upload R2
                                 ├── INSERT violations (PostgreSQL)
                                 └── Broadcast WS /ws/alerts
                                              │
                              React Dashboard ◄───────────┘
                                 ├── Toast đỏ "🚨 Phát hiện: NO_HELMET"
                                 ├── Cập nhật bảng vi phạm
                                 └── Đèn camera nhấp nháy
```

### 5.2. Webcam AI (mode browser-based)

Ngoài camera USB vật lý, backend còn hỗ trợ nhận frame trực tiếp từ webcam browser:

```
POST /webcam/{camera_id} (multipart/form-data)
  → Nhận frame JPEG từ client
  → Triton YOLOv8 inference
  → PPEChecker + ZoneChecker
  → Đẩy violations vào EventBus
  → Trả về annotated image (base64) + detected objects
```

---

## 6. TRẠNG THÁI TRIỂN KHAI (LỘ TRÌNH)

| # | Hạng mục | Trạng thái |
|---|----------|------------|
| 1 | Re-ID + PPE lên Triton | ✅ Hoàn thành |
| 2 | Kiến trúc + Serving + Tái cấu trúc thư mục | ✅ Hoàn thành |
| 3 | YOLO11n-pose uint8 + BoxMOT + per-camera worker | ⬜ Chưa bắt đầu |
| 4 | Zone intrusion end-to-end (DB → checker → event) | ⬜ Chưa bắt đầu |
| 5 | PostgreSQL + R2 + Event Bus | ✅ Đã triển khai (code sẵn sàng) |
| 6 | Backend API REST + WS + MJPEG → nối frontend | ✅ Đã triển khai |
| 7 | Fall model convert ONNX → retune F2 → field-test | 🔄 Đang tiến hành |

### Các vấn đề kỹ thuật cần lưu ý

1. **Fall Detection recall thấp:** precision 0.93 nhưng recall chỉ 0.45 (bỏ sót 55% cú ngã) — cần retune threshold F2
2. **Chưa có Alembic migration:** Database schema thay đổi cần tay tạo lại bảng
3. **Zone editor UI chưa có:** Admin phải tạo polygon qua API thủ công
4. **Tracker đang dùng fallback đơn giản:** Chưa tích hợp BoT-SORT thật (đang dùng counter ID)

---

## 7. CẤU TRÚC THƯ MỤC TỔNG QUAN

```
Construction-safety-ai/
├── ai/                            # Jupyter notebook train model PPE YOLOv8
│   └── PPE-Yolov8.ipynb
├── backend/                       # FastAPI Backend
│   ├── app/                       # Ứng dụng chính
│   │   ├── api/v1/endpoints/      # REST endpoints
│   │   ├── core/                  # Database, EventBus, Auth, Security
│   │   ├── models/                # SQLAlchemy ORM (5 bảng)
│   │   ├── schemas/               # Pydantic validation
│   │   ├── services/              # Business logic
│   │   ├── storage/               # R2 client
│   │   └── ai/                    # Triton client
│   ├── workers/                   # Camera Worker + Event Consumer
│   ├── analytics/                 # PPE Checker + Zone Checker
│   ├── evidence_spool/            # Local spool backup ảnh bằng chứng
│   ├── static/                    # Static files server
│   └── requirements.txt
├── frontend/                      # React 19 + Vite 8 Dashboard
│   ├── src/                       # Source code
│   └── dist/                      # Build output
├── triton_model_repo/             # Triton model repository
│   └── yolo_pose, osnet_reid, ppe×4, fall_model
├── ppe_5classes_model_results/    # Model training results
├── export_scripts/                # Export .pt → .onnx scripts
├── video_demo/                    # Video demo files
├── docs/                          # Tài liệu dự án
├── docker-compose.yml             # Triton + PostgreSQL containers
├── ARCHITECTURE.md                # Tài liệu kiến trúc chi tiết
└── README.MD                      # Hướng dẫn chung
```

---

## 8. TÓM TẮT

| Tiêu chí | Chi tiết |
|----------|---------|
| **Mục đích** | Giám sát an toàn lao động thời gian thực bằng AI |
| **Input** | 2 camera USB 720p@25fps |
| **AI Models** | YOLOv8 PPE (5 class) + YOLO11n-pose + OSNet Re-ID + Fall Transformer |
| **Inference** | NVIDIA Triton Server (gRPC, dynamic batching, ~1.6-1.9GB VRAM) |
| **Frontend** | React 19 Dashboard: 8 trang, metrics, bảng vi phạm, test AI, real-time alerts |
| **Backend** | FastAPI: REST + WebSocket + MJPEG streaming |
| **Database** | PostgreSQL 16 (5 bảng ORM), soft delete, JSONB metadata |
| **Storage** | Cloudflare R2 (ảnh bằng chứng) + local spool fallback |
| **Latency** | Glass-to-glass ~200-400ms, WebSocket alert <150ms |
| **Deployment** | Docker Compose (Triton + Postgres) + Host (Workers + Backend + Frontend) |

---

> **Tài liệu này được tạo tự động từ phân tích mã nguồn dự án.** Để biết thêm chi tiết kỹ thuật, tham khảo [ARCHITECTURE.md](../ARCHITECTURE.md).
