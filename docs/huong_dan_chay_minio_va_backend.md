# 📘 Hướng Dẫn Khởi Chạy MinIO & Backend FastAPI
**Dự án:** Construction Safety AI — Hệ thống AI Giám sát An toàn Công trường

---

## 📌 1. Bảng Thông Tin Cổng & Dịch Vụ

| Dịch vụ | Địa chỉ truy cập / Cổng | Thông tin đăng nhập mặc định |
| :--- | :--- | :--- |
| **FastAPI Backend Server** | `http://localhost:8000` | Swagger UI: `http://localhost:8000/docs` |
| **MinIO API (S3 Endpoint)** | `http://localhost:9002` (hoặc `9000`) | Access Key: `minioadmin`<br>Secret Key: `minioadmin` |
| **MinIO Web Console UI** | `http://localhost:9001` | User: `minioadmin`<br>Password: `minioadmin` |
| **PostgreSQL Database** | `localhost:5432` | User: `postgres`<br>Password: `123456` (hoặc cấu hình trong `.env`)<br>DB: `construction_safety` |
| **Frontend React Dashboard** | `http://localhost:5173` | - |

---

## 🪣 2. Hướng Dẫn Khởi Chạy MinIO

Bạn có thể lựa chọn **Cách A (Không cần Docker)** hoặc **Cách B (Dùng Docker)**:

### Cách A: Chạy file `minio.exe` trực tiếp trên Windows (Native - Khuyên dùng nếu không thích Docker)

1. Mở cửa sổ **PowerShell** (với quyền Admin hoặc User thông thường).
2. Tải file chạy `minio.exe` chính thức (chỉ cần làm lần đầu):
   ```powershell
   # Tạo thư mục chứa MinIO
   mkdir C:\minio -ErrorAction SilentlyContinue

   # Tải file thực thi MinIO cho Windows
   Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile "C:\minio\minio.exe"
   ```
3. Khởi chạy MinIO Server trực tiếp:
   ```powershell
   $env:MINIO_ROOT_USER="minioadmin"
   $env:MINIO_ROOT_PASSWORD="minioadmin"

   # Lưu dữ liệu vào thư mục C:\minio\data
   C:\minio\minio.exe server C:\minio\data --address ":9002" --console-address ":9001"
   ```
   > 💡 Giữ nguyên cửa sổ terminal này để MinIO duy trì hoạt động.

---

### Cách B: Chạy qua Docker Container

Nếu máy tính của bạn đã cài **Docker Desktop**:

1. Mở PowerShell tại thư mục gốc dự án `d:\Construction-safety-ai`:
   ```powershell
   docker compose -f docker-compose.dev.yml up
   ```
   *Hoặc chạy lệnh đơn:*
   ```powershell
   docker run --rm -it --name safety_minio -p 9002:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data --console-address ":9001"
   ```

---

### ⚙️ Thiết lập Bucket trên MinIO Web Console (Chỉ cần làm 1 lần)

1. Mở trình duyệt truy cập: **[http://localhost:9001](http://localhost:9001)**
2. Đăng nhập với tài khoản:
   - **Username:** `minioadmin`
   - **Password:** `minioadmin`
3. Điều hướng đến **Administrator** -> **Buckets** -> Nhấn nút **Create Bucket**:
   - **Bucket Name:** `construction-safety-evidence`
   - Nhấn **Create Bucket**.
4. Chọn bucket vừa tạo -> Vào tab **Access Policy** -> Chuyển từ *Private* sang **Public** (hoặc Custom Read/Write) để cho phép hiển thị ảnh/video trực tiếp lên giao diện Web.

---

## 🚀 3. Hướng Dẫn Khởi Chạy Backend (FastAPI)

### Bước 1: Cấu hình file môi trường `.env`

Đảm bảo file `d:\Construction-safety-ai\backend\.env` có các thông số sau:

```env
# ── Server ───────────────────────────────────────────────────────────────────
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=["http://localhost:5173","http://localhost:3000"]

# ── AI Model Weights ─────────────────────────────────────────────────────────
MODEL_PATH=ai/weights/best.pt
CONFIDENCE_THRESHOLD=0.5
IOU_THRESHOLD=0.45
DEVICE=cuda                      # Sử dụng 'cuda' nếu có GPU NVIDIA, hoặc 'cpu'

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:123456@localhost:5432/construction_safety

# ── MinIO S3 Object Storage ──────────────────────────────────────────────────
MINIO_ENDPOINT=localhost:9002
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=construction-safety-evidence
MINIO_USE_SSL=False
```

---

### Bước 2: Kích hoạt Virtual Environment & Khởi chạy Server

Mở một cửa sổ **PowerShell mới**:

```powershell
# 1. Di chuyển vào thư mục backend
cd d:\Construction-safety-ai\backend

# 2. Kích hoạt môi trường ảo Python
.\venv\Scripts\Activate.ps1

# 3. Cài đặt thư viện phụ thuộc (nếu chưa cài)
pip install -r requirements.txt

# 4. Khởi chạy Backend Server
python main.py
```

*Hoặc chạy trực tiếp với lệnh Uvicorn:*
```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Khi màn hình xuất hiện thông báo:
```text
INFO:     Started server process [...]
INFO:     Waiting for application startup.
DATABASE CONNECTION & TABLE CREATION: SUCCESS
DATABASE SEEDING: SUCCESS
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```
Tức là Backend đã sẵn sàng!

---

## 🔍 4. Kiểm Tra & Xác Nhận Hệ Thống

1. **Kiểm tra API Backend:**
   Truy cập [http://localhost:8000/docs](http://localhost:8000/docs) để mở giao diện kiểm thử Swagger UI tương tác.
2. **Kiểm tra Healthcheck:**
   Truy cập [http://localhost:8000/health](http://localhost:8000/health) -> Nhận kết quả `{"status": "healthy"}`.
3. **Cơ chế Fallback Tự động (Local Storage):**
   Nếu MinIO chưa bật hoặc gặp sự cố mạng, hệ thống **tự động lưu video clip 6 giây và ảnh thumbnail** trực tiếp vào thư mục cục bộ [backend/static/violations/](file:///d:/Construction-safety-ai/backend/static/violations) mà không làm gián đoạn việc giám sát AI.

---

## 🛠️ 5. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| `Bind for 0.0.0.0:9002 failed: port is already allocated` | Cổng 9002 đang bị tiến trình khác chiếm | Đổi cổng sang `9003` trong lệnh chạy và cập nhật lại `MINIO_ENDPOINT=localhost:9003` trong file `.env`. |
| `Could not connect to the endpoint URL: http://localhost:9002/...` | MinIO chưa được bật | Khởi động MinIO theo mục 2, hoặc để trống biến `MINIO_ENDPOINT` trong `.env` để sử dụng lưu trữ cục bộ. |
| `DATABASE CONNECTION / TABLE CREATION FAILED` | PostgreSQL chưa khởi động hoặc sai mật khẩu | Kiểm tra dịch vụ PostgreSQL trên Windows Services hoặc kiểm tra mật khẩu trong chuỗi `DATABASE_URL`. |
| `CUDA out of memory` / `Torch not compiled with CUDA` | Thiếu GPU hoặc chưa cài PyTorch CUDA | Đổi `DEVICE=cpu` trong file [backend/.env](file:///d:/Construction-safety-ai/backend/.env). |
