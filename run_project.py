#!/usr/bin/env python3
"""
Simple script to start both backend and frontend servers
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def run_command(cmd, cwd=None, background=False):
    """Run a command and return the process"""
    print(f"Running: {cmd}")
    if background:
        return subprocess.Popen(cmd, shell=True, cwd=cwd)
    else:
        return subprocess.run(cmd, shell=True, cwd=cwd)

def main():
    # Get the project root directory
    project_root = Path(__file__).parent
    
    print("Starting Stock Price Predictor...")
    print("=" * 50)
    
    # Start backend
    print("Starting FastAPI backend...")
    backend_cmd = "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
    backend_process = run_command(backend_cmd, cwd=project_root / "backend", background=True)
    
    # Wait a moment for backend to start
    time.sleep(3)
    
    # Start frontend
    print("Starting Next.js frontend...")
    frontend_cmd = "npm run dev"
    frontend_process = run_command(frontend_cmd, cwd=project_root / "frontend", background=True)
    
    print("=" * 50)
    print("Both servers are starting...")
    print("Backend: http://localhost:8000")
    print("Frontend: http://localhost:3000")
    print("API Docs: http://localhost:8000/docs")
    print("=" * 50)
    print("Press Ctrl+C to stop both servers")
    
    try:
        # Keep the script running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping servers...")
        if hasattr(backend_process, 'terminate'):
            backend_process.terminate()
        if hasattr(frontend_process, 'terminate'):
            frontend_process.terminate()
        print("Servers stopped")

if __name__ == "__main__":
    main()

