import sys
from sqlalchemy import text
from app.core.database import engine

def migrate():
    with engine.begin() as conn:
        # Add columns to cameras table if not exist
        conn.execute(text("""
            ALTER TABLE cameras 
            ADD COLUMN IF NOT EXISTS ppe_enabled BOOLEAN NOT NULL DEFAULT TRUE;
        """))
        conn.execute(text("""
            ALTER TABLE cameras 
            ADD COLUMN IF NOT EXISTS zone_enabled BOOLEAN NOT NULL DEFAULT TRUE;
        """))
        
        # Add columns to zones table if not exist
        conn.execute(text("""
            ALTER TABLE zones 
            ADD COLUMN IF NOT EXISTS color VARCHAR(10) NOT NULL DEFAULT '#ef4444';
        """))
        conn.execute(text("""
            ALTER TABLE zones 
            ADD COLUMN IF NOT EXISTS description TEXT;
        """))
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
