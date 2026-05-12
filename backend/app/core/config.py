from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_exp_minutes: int = 60 * 24

    ocr_api_base_url: str = "http://136.116.56.229:8000/apis/ocr"
    ocr_api_timeout_seconds: float = 30.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
