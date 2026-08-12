from sqlalchemy import text
from app.core.database import engine

with engine.begin() as conn:
    conn.execute(text('ALTER TABLE violations ALTER COLUMN image_path TYPE VARCHAR(1024);'))
print("Cập nhật cột image_path thành công!")
