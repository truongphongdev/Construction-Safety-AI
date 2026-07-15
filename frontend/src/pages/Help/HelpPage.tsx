import styles from './HelpPage.module.css';

export default function HelpPage() {
  return (
    <div className={`${styles.card} glass-panel`}>
      <div className={styles.title}>
        <span className="material-symbols-outlined text-primary">help</span>
        Hướng dẫn & Trợ giúp (VisionGuard Help Center)
      </div>

      <div className={styles.content}>
        <h4 className={styles.sectionTitle}>Các câu hỏi thường gặp (FAQs)</h4>
        
        <div className={styles.faqItem}>
          <div className={styles.question}>1. Làm thế nào để thêm camera RTSP mới?</div>
          <div className={styles.answer}>
            Vào menu <strong>Cameras</strong>, click <strong>Thêm Camera mới</strong>, điền mã số và vị trí ghi hình. Ở bản cập nhật tiếp theo, bạn có thể cấu hình chi tiết link RTSP stream `rtsp://username:password@ip_address:port/h264`.
          </div>
        </div>

        <div className={styles.faqItem}>
          <div className={styles.question}>2. Làm thế nào để cấu hình vùng phát hiện nguy hiểm (Safety Zones)?</div>
          <div className={styles.answer}>
            Trong cấu hình camera, chọn vẽ vùng cách ly (Polygon). Hệ thống AI sẽ tự động bỏ qua các hoạt động bên ngoài vùng vẽ và chỉ cảnh báo khi vật thể vi phạm bên trong vùng này.
          </div>
        </div>

        <div className={styles.faqItem}>
          <div className={styles.question}>3. Yêu cầu phần cứng tối thiểu để chạy YOLOv8?</div>
          <div className={styles.answer}>
            Hệ thống yêu cầu GPU tối thiểu NVIDIA GTX 1660 hoặc cao hơn để chạy phân tích thời gian thực ổn định cho 4 luồng camera 1080p (khoảng 30fps). Hãy thiết lập CUDA driver và TensorRT để tối ưu hóa tốc độ suy luận.
          </div>
        </div>
      </div>
    </div>
  );
}
