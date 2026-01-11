import os
from functools import lru_cache

class Settings:
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development")

@lru_cache()
def get_settings():
    return Settings()
