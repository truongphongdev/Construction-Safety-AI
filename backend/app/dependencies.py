from typing import Annotated

from fastapi import Depends

from app.config import Settings, get_settings

# Shorthand type alias để dùng trong endpoint functions
SettingsDep = Annotated[Settings, Depends(get_settings)]
