from pydantic import BaseModel, ConfigDict


class AppSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invite_only_signup: bool
    use_outlook_for_violations: bool


class AppSettingsUpdate(BaseModel):
    invite_only_signup: bool | None = None
    use_outlook_for_violations: bool | None = None
