from typing import Annotated

from fastapi import Depends

from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.database import get_db

# Shorthand type alias để dùng trong endpoint functions
SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]
