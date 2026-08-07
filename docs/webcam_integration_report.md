# Báo Cáo Tích Hợp Webcam AI & Tối Ưu Hóa Storage (MinIO)
**Dự án:** Construction Safety AI  
**Ngày báo cáo:** 07/08/2026

---

## 1. Tổng quan các thay đổi

Trong phiên làm việc này, hệ thống đã được nâng cấp đáng kể ở cả Frontend (giao diện), Backend (xử lý logic) và Infrastructure (lưu trữ) nhằm mang lại trải nghiệm real-time mượt mà hơn và cấu trúc dữ liệu chuẩn production.

Các mục tiêu đã hoàn thành:
- **Tích hợp Global Webcam Context:** Hỗ trợ bật/tắt luồng camera trực tiếp từ thiết bị (laptop) trên toàn cục ứng dụng.
- **Tối ưu Dashboard:** Cung cấp trải nghiệm "Webcam AI Live" ngay trên trang chủ thay cho chức năng "Upload ảnh" tĩnh.
- **Rút gọn Camera Seed:** Lược bỏ các camera rác, chỉ giữ lại 1 camera mặc định ("Camera 01 - Webcam Laptop").
- **Chuyển đổi Storage:** Từ bỏ việc lưu ảnh vật lý trên máy chủ (`backend/evidence_spool/`), chuyển sang sử dụng Object Storage chuyên nghiệp thông qua **MinIO** (S3 Compatible).

---

## 2. Chi tiết kỹ thuật

### 2.1 Frontend
- **`WebcamContext.tsx`**: Được xây dựng theo pattern Context API của React, giúp duy trì trạng thái của MediaStream (webcam) xuyên suốt quá trình điều hướng giữa các trang (Dashboard, Cameras, Violations). Video stream sẽ không bị ngắt khi chuyển trang.
- Quá trình capture frame từ thẻ `<video>` ẩn (hidden canvas) diễn ra mỗi `500ms`. Frame được mã hóa dạng `blob` và gửi POST về API `/stream/webcam/{camera_id}` của Backend.
- Trả về từ Backend là chuỗi `base64` đã được overlay bounding box vi phạm (nếu có), hiển thị real-time ngay trên giao diện.

### 2.2 Backend
- **Chỉnh sửa Seed Data (`main.py`)**: Tự động xóa 2 ID camera thừa. Khi migrate/khởi động lần đầu, DB chỉ tự động insert 1 ID duy nhất `00000000-0000-0000-0000-000000000001` (Webcam Laptop).
- **Tích hợp MinIO (`minio_client.py`)**: Viết lại Storage API dựa trên thư viện `boto3`. 
  - Ảnh vi phạm sinh ra từ `EventConsumerThread` sẽ được upload trực tiếp lên bucket `construction-safety-evidence`.
  - Backend cung cấp hàm tạo `presigned_url` (hết hạn trong 1 giờ) để Frontend lấy hiển thị thay vì public folder `static`.

### 2.3 Cơ sở dữ liệu & DevOps
- Đã cấu hình thêm service `minio` và `minio-create-bucket` vào `docker-compose.yml`.
- Dữ liệu vi phạm trong PostgreSQL (`violations` table) được thiết kế lưu trường `evidence_key` và `image_path` dưới dạng S3 object key thay vì file path cục bộ.

---

## 3. Hướng dẫn Kiểm thử (Dành cho QA / User)

Để đảm bảo các tính năng hoạt động trơn tru, vui lòng thực hiện kịch bản kiểm thử sau:

**Bước 1: Reset dữ liệu (Khuyến nghị)**
Mở terminal và chạy lệnh để clear DB cũ (tránh xung đột seed data):
```bash
docker compose down -v postgres
docker compose up -d
```
Sau đó khởi động lại Backend (FastAPI) và Frontend (React).

**Bước 2: Kiểm tra Dashboard**
- Truy cập `http://localhost:5173`.
- Chỉ số "Camera hoạt động" sẽ hiển thị `1`.
- Nhấn **Bật Webcam** ở panel "Webcam AI Live" bên phải. Cho phép trình duyệt truy cập camera.
- Đảm bảo video hiển thị bình thường. Thử đưa mũ / áo bảo hộ vào khung hình xem AI có bắt được bounding box không.
- Thử chuyển qua trang "Danh sách Camera" rồi quay lại "Dashboard", webcam vẫn phải đang chạy mà không bị tắt.

**Bước 3: Kiểm tra luồng tạo Vi phạm (E2E)**
- Cố tình để đầu trần (không mũ bảo hộ) trước webcam trong vài giây.
- Sẽ xuất hiện **chuông thông báo (toast)** trên góc phải màn hình báo có vi phạm.
- Click sang trang "Nhật ký Vi phạm", bản ghi vi phạm mới sẽ xuất hiện, kèm **ảnh bằng chứng (presigned URL)** tải từ MinIO.

**Bước 4: Kiểm tra MinIO Storage**
- Mở URL: `http://localhost:9001` (user: `minioadmin`, pass: `minioadmin`).
- Truy cập bucket `construction-safety-evidence`.
- Xác nhận các ảnh vi phạm (files đuôi `.jpg`) đã được lưu thành công trên này.

---
**[KẾT THÚC BÁO CÁO]**
