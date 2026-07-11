<div align="center">

# 🦺 Construction Safety AI

### Hệ thống AI giám sát an toàn công trường thời gian thực

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-FF6F00?style=for-the-badge&logo=pytorch&logoColor=white)](https://ultralytics.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)

*Phát hiện thiếu đồ bảo hộ · Xâm nhập vùng cấm · Té ngã — tất cả trong thời gian thực*

</div>

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng](#-tính-năng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Cài đặt & Chạy thử](#-cài-đặt--chạy-thử)
- [API Reference](#-api-reference)
- [Roadmap](#-roadmap)
- [Đóng góp](#-đóng-góp)
- [Giấy phép](#-giấy-phép)

---

## 🎯 Giới thiệu

**Construction Safety AI** là hệ thống giám sát an toàn lao động thông minh, ứng dụng thị giác máy tính (Computer Vision) để phân tích luồng video từ camera công trường **theo thời gian thực**. Hệ thống tự động phát hiện các vi phạm an toàn, gửi cảnh báo tức thì và lưu trữ nhật ký sự cố giúp ban quản lý công trường phản ứng nhanh và giảm thiểu tai nạn lao động.

> **Mục tiêu:** Thay thế hoàn toàn việc giám sát thủ công bằng một hệ thống AI hoạt động 24/7, chính xác và có khả năng mở rộng.

---

## ✨ Tính năng

| Tính năng | Mô tả | Trạng thái |
|---|---|---|
| 🪖 **Phát hiện thiếu đồ bảo hộ** | Nhận diện thiếu mũ bảo hộ, áo phản quang, găng tay, giày bảo hộ | ✅ Đang phát triển |
| 🚧 **Phát hiện xâm nhập vùng cấm** | Cảnh báo khi người đi vào khu vực nguy hiểm đã được khoanh vùng | ✅ Đang phát triển |
| 🫸 **Phát hiện té ngã** | Nhận diện người ngã và phát cảnh báo khẩn cấp tức thì | ✅ Đang phát triển |
| 📊 **Dashboard cảnh báo** | Bảng điều khiển React hiển thị trực tiếp luồng video & nhật ký sự cố | ✅ Đang phát triển |
| 🔔 **Thông báo thời gian thực** | Gửi cảnh báo qua WebSocket / email / SMS | 🔜 Sắp ra mắt |
| 📈 **Báo cáo thống kê** | Phân tích xu hướng vi phạm theo ngày/tuần/tháng | 🔜 Sắp ra mắt |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                           │
│                   React Dashboard (Port 5173)                   │
│          Live Feed │ Alert Panel │ Statistics │ Reports         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                         BACKEND LAYER                           │
│                   FastAPI Server (Port 8000)                    │
│         REST API │ WebSocket │ Auth │ Alert Management          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                           AI LAYER                              │
│               YOLOv8 Inference Engine (Ultralytics)             │
│        PPE Detection │ Zone Intrusion │ Fall Detection          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                         DATA SOURCES                            │
│            IP Camera │ RTSP Stream │ File Upload (MP4/IMG)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Công nghệ sử dụng

### Backend
- **[FastAPI](https://fastapi.tiangolo.com/)** — Framework API hiệu năng cao, hỗ trợ async
- **[Uvicorn](https://www.uvicorn.org/)** — ASGI server
- **[Ultralytics YOLOv8](https://ultralytics.com/)** — Mô hình phát hiện đối tượng thời gian thực
- **[OpenCV](https://opencv.org/)** — Xử lý ảnh và video

### Frontend
- **[React 18](https://react.dev/)** — UI framework
- **[Vite](https://vitejs.dev/)** — Build tool
- **WebSocket** — Streaming cảnh báo thời gian thực

### AI / ML
- **YOLOv8** (Nano → Large tùy cấu hình phần cứng)
- **PyTorch** — Deep learning runtime
- Custom-trained model trên dataset công trường xây dựng

---

## 📁 Cấu trúc dự án

```
construction-safety-ai/
├── 📂 backend/                  # FastAPI server
│   ├── main.py                  # Entry point, định nghĩa app & router
│   ├── requirements.txt         # Python dependencies
│   ├── 📂 venv/                 # Môi trường ảo (không commit)
│   ├── 📂 routers/              # API route handlers (sẽ bổ sung)
│   │   ├── detection.py
│   │   └── alerts.py
│   ├── 📂 models/               # Pydantic schemas (sẽ bổ sung)
│   └── 📂 ai/                   # YOLOv8 inference modules (sẽ bổ sung)
│
├── 📂 frontend/                 # React dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   └── package.json
│
├── 📂 ai/                       # Model weights & training scripts
│   ├── weights/
│   └── notebooks/
│
├── .gitignore
└── README.md
```

---

## 🚀 Cài đặt & Chạy thử

### Yêu cầu hệ thống

- Python **3.10+**
- Node.js **18+**
- GPU (khuyến nghị) hoặc CPU

### 1. Clone repository

```bash
git clone https://github.com/<your-username>/construction-safety-ai.git
cd construction-safety-ai
```

### 2. Cài đặt Backend

```bash
cd backend

# Tạo & kích hoạt môi trường ảo
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### 3. Chạy Backend Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Truy cập **[http://localhost:8000/docs](http://localhost:8000/docs)** để xem Swagger UI tự động.

### 4. Cài đặt & Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

Truy cập **[http://localhost:5173](http://localhost:5173)** để xem dashboard.

---

## 📡 API Reference

### Base URL
```
http://localhost:8000
```

### Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/` | Health check cơ bản |
| `GET` | `/health` | Health check cho load balancer |
| `POST` | `/detect` | Gửi ảnh/video để phân tích *(sắp ra mắt)* |
| `GET` | `/alerts` | Lấy danh sách cảnh báo *(sắp ra mắt)* |
| `WS` | `/ws/stream` | WebSocket stream kết quả phát hiện *(sắp ra mắt)* |

> 📖 Tài liệu API đầy đủ & tương tác: **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## 🗺️ Roadmap

- [x] Khởi tạo dự án & cấu trúc thư mục
- [x] Thiết lập backend FastAPI cơ bản
- [ ] Tích hợp YOLOv8 inference pipeline
- [ ] Endpoint `/detect` xử lý ảnh & video
- [ ] WebSocket streaming kết quả thời gian thực
- [ ] Xây dựng React dashboard
- [ ] Hệ thống quản lý cảnh báo & nhật ký
- [ ] Xác thực & phân quyền (JWT)
- [ ] Docker hóa toàn bộ hệ thống
- [ ] CI/CD pipeline

---

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng thực hiện theo quy trình sau:

1. **Fork** repository
2. Tạo branch mới: `git checkout -b feature/ten-tinh-nang`
3. Commit thay đổi: `git commit -m 'feat: mô tả ngắn gọn'`
4. Push lên branch: `git push origin feature/ten-tinh-nang`
5. Tạo **Pull Request**

Vui lòng đọc [CONTRIBUTING.md](CONTRIBUTING.md) *(sắp có)* trước khi đóng góp.

---

## 📄 Giấy phép

Dự án được phân phối theo giấy phép **MIT**. Xem chi tiết tại [LICENSE](LICENSE).

---

<div align="center">

Made with ❤️ for safer construction sites

⭐ Nếu dự án hữu ích, hãy để lại một Star!

</div>
