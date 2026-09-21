from pydantic import BaseModel, ConfigDict


class ListOptionsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    departments: list[str]
    positions: list[str]
    levels: list[str]


class AddOptionRequest(BaseModel):
    value: str


class RenameOptionRequest(BaseModel):
    old_value: str
    new_value: str


class RemoveOptionRequest(BaseModel):
    value: str
