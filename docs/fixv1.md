# Báo cáo Cập nhật & Tối ưu hóa (Fix V1)

**Ngày thực hiện:** 07/08/2026
**Mục tiêu:** Khắc phục lỗi không nhận được vi phạm từ MinIO, khắc phục tình trạng giật lag webcam và cấu hình GPU NVIDIA.

---

## 1. Khắc phục lỗi Pydantic (Không trả về được Vi phạm)
* **Nguyên nhân:** Khi AI quét thấy vi phạm, nó lưu thành công vào PostgreSQL. Tuy nhiên, khi Frontend gọi API để lấy danh sách vi phạm, hàm `get_presigned_url()` của MinIO tạo ra các URL có độ dài khoảng 400-500 ký tự. Do trường `image_path` bị giới hạn `max_length=255`, thư viện Pydantic đã từ chối trả về kết quả (lỗi HTTP 422 Unprocessable Entity).
* **Các thay đổi:**
  - **`backend/app/schemas/violation.py`:** Tăng `max_length` của `image_path` lên 1024. Chuyển đổi `video_path` và `video_bucket` thành tuỳ chọn (`Optional`) để phù hợp với luồng dữ liệu từ webcam.
  - **`backend/app/models/violation.py`:** Đổi kiểu dữ liệu cột `image_path` trong Database schema thành `String(1024)`.
  - **Thực thi SQL trực tiếp:** Chạy lệnh `ALTER TABLE violations ALTER COLUMN image_path TYPE VARCHAR(1024);` để áp dụng ngay lập tức thay đổi vào PostgreSQL mà không cần qua Alembic.

## 2. Khắc phục lỗi MinIO chưa được khởi tạo
* **Nguyên nhân:** Dù file `requirements.txt` có ghi thư viện `boto3`, nhưng môi trường ảo (`venv`) của dự án chưa được cài đặt thư viện này, dẫn đến việc `MinioStorageClient` không thể kết nối tới MinIO.
* **Các thay đổi:**
  - Cài đặt bổ sung thư viện bằng lệnh: `.\venv\Scripts\pip install boto3`
  - Thêm một khoảng trắng trong `minio_client.py` để ép `uvicorn` khởi động lại server nhằm nhận diện thư viện mới.

## 3. Tối ưu Hiệu suất AI (Khắc phục giật/lác Webcam)
* **Nguyên nhân:** Xử lý AI của YOLOv8 được chạy đồng bộ (synchronous) trên main thread. Một khung hình 640x480 xử lý bằng CPU mất khoảng 200-500ms, khiến toàn bộ Backend bị "đứng hình" (block) trong lúc chờ đợi, dẫn đến việc hàng loạt khung hình từ Frontend gửi tới bị nghẽn mạng.
* **Các thay đổi:**
  - **`backend/app/api/v1/endpoints/stream.py`:** Tách hàm chạy AI sang thread riêng (background) bằng `asyncio.get_running_loop().run_in_executor()`. Việc này giúp FastAPI không bị block và tiếp tục nhận/trả các request khác.
  - **`backend/ai/detector.py`:** Bổ sung tham số `imgsz=320` vào hàm `self.model.predict()`. Do AI không cần ảnh quá to để nhận diện, việc ép YOLOv8 xử lý ảnh cỡ nhỏ (320px thay vì 640px) làm giảm tới 75% khối lượng tính toán.
  - **`frontend/src/contexts/WebcamContext.tsx`:** Thay vì ép AI đọc khung hình 6 lần mỗi giây (khoảng cách 150ms), khoảng cách gửi đã được tăng lên 500ms (2 khung hình/giây). Đồng thời, thẻ canvas vẽ lại khung hình cũng được thu nhỏ còn 320x240 để giảm dung lượng file gửi qua mạng.

## 4. Tích hợp NVIDIA GPU (CUDA)
* **Nguyên nhân:** Thư viện `torch` cũ trong máy là bản dành riêng cho CPU (`2.13.0+cpu`).
* **Các thay đổi:**
  - Chạy ngầm lệnh tải và cài đặt lại PyTorch mới nhất (hỗ trợ kiến trúc CUDA 12.4). Khi tiến trình cài đặt gói dữ liệu 2.5GB này hoàn tất, YOLOv8 sẽ tự động kích hoạt GPU NVIDIA, mang lại khả năng phân tích cực kỳ nhanh (có thể đạt tốc độ nhận diện dưới 30ms/khung hình).
