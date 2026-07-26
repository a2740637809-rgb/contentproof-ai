from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./contentproof.db"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2:1.5b"

    model_config = SettingsConfigDict(env_prefix="CONTENTPROOF_", env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()

