import time
from typing import Dict, Any, Optional
from fastapi import HTTPException, Request

class RateLimiter:
    def __init__(self, requests_limit: int, time_window: int):
        self.requests_limit = requests_limit
        self.time_window = time_window
        self.requests: Dict[str, list] = {}

    async def __call__(self, request: Request):
        client_ip = request.client.host
        now = time.time()
        
        if client_ip not in self.requests:
            self.requests[client_ip] = []
            
        # Clean old requests
        self.requests[client_ip] = [req_time for req_time in self.requests[client_ip] if now - req_time < self.time_window]
        
        if len(self.requests[client_ip]) >= self.requests_limit:
            raise HTTPException(status_code=429, detail="Too many requests")
            
        self.requests[client_ip].append(now)

class CacheManager:
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}

    def initialize(self):
        self.cache = {}

    def clear(self):
        self.cache = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            entry = self.cache[key]
            if entry["expiry"] > time.time():
                return entry["value"]
            else:
                del self.cache[key]
        return None

    def set(self, key: str, value: Any, ttl: int):
        self.cache[key] = {
            "value": value,
            "expiry": time.time() + ttl
        }

cache_manager = CacheManager()
