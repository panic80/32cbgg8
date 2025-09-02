from app.core.config import settings
import os

print(f"Settings openai_api_key: {settings.openai_api_key[:20] if settings.openai_api_key else 'NOT SET'}...{settings.openai_api_key[-5:] if settings.openai_api_key else ''}")
print(f"Direct env OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'NOT SET')[:20]}...")
print(f"Settings object: {settings}")
print(f"All settings attributes: {[attr for attr in dir(settings) if not attr.startswith('_')]}")
