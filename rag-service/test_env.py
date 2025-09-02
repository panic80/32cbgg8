#\!/usr/bin/env python3
import os
import sys
print(f"Python: {sys.executable}")
print(f"CWD: {os.getcwd()}")
print(f"OPENAI_API_KEY from env: {os.getenv('OPENAI_API_KEY', 'NOT SET')[:30]}...")

# Try loading from main .env
try:
    with open('/var/www/cbthis/.env', 'r') as f:
        for line in f:
            if line.startswith('OPENAI_API_KEY='):
                print(f"OPENAI_API_KEY from file: {line.strip()[15:35]}...")
                break
except Exception as e:
    print(f"Error reading .env: {e}")

# Check config
try:
    from app.core.config import settings
    print(f"Settings API key: {settings.openai_api_key[:30] if settings.openai_api_key else 'NOT SET'}...")
except Exception as e:
    print(f"Error loading settings: {e}")
