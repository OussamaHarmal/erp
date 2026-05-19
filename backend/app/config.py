"""
Configuration Settings
Centralized config using pydantic-settings
"""
from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/smart_cms"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production-minimum-32-characters"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # App / Branding
    APP_NAME: str = "Universal Invest Strategy CMS"
    COMPANY_NAME: str = "UNIVERSAL INVEST STRATEGY"
    COMPANY_EMAIL: str = "contact@ui-strategy.com"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = '["http://localhost:3000","http://localhost:5173"]'

    # SMTP email sending (optional; disabled automatically if SMTP_HOST is empty)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Universal Invest Strategy"
    SMTP_USE_TLS: bool = True


    # Sage desktop auto-import watcher (Windows only)
    SAGE_AUTO_IMPORT_ENABLED: bool = False
    SAGE_AUTO_IMPORT_FOLDER: str = r"C:\SAGE_AUTO_IMPORT\pending"
    SAGE_IMPORTED_FOLDER: str = r"C:\SAGE_AUTO_IMPORT\imported"
    SAGE_ERROR_FOLDER: str = r"C:\SAGE_AUTO_IMPORT\errors"
    SAGE_IMPORT_LOG_FILE: str = r"C:\SAGE_AUTO_IMPORT\logs\import.log"
    SAGE_EXE_PATH: str = r"C:\Program Files (x86)\Sage\iComptabilité\Maestria.exe"
    SAGE_PROCESS_NAME: str = "Maestria.exe"
    SAGE_MAE_FILE: str = r"C:\Users\dell\Downloads\import vente us.ema"
    SAGE_STARTUP_WAIT: int = 15
    SAGE_SCAN_INTERVAL: int = 5

    # AI Chatbot (OpenAI-compatible API)
    # Works with OpenAI or any compatible endpoint. If API key is empty, the chatbot uses a local fallback.
    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    AI_CHATBOT_ENABLED: bool = True

    # Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB

    def get_allowed_origins(self) -> List[str]:
        try:
            return json.loads(self.ALLOWED_ORIGINS)
        except Exception:
            return ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
