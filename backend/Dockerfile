# =============================================================================
# Dockerfile — Construction Safety AI Backend
# Build: docker build -t safety-ai-backend .
# Run:   docker run -p 8000:8000 safety-ai-backend
# =============================================================================

FROM python:3.11-slim

# Tránh tạo file .pyc và bật log ngay lập tức
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Cài dependencies hệ thống cần cho OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Cài Python dependencies (layer riêng để tận dụng cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Chạy server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
