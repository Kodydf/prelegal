from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Wire format is camelCase to match the frontend."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
