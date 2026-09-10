from pydantic import BaseModel, ConfigDict


class AppSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invite_only_signup: bool


class AppSettingsUpdate(BaseModel):
    invite_only_signup: bool | None = None
