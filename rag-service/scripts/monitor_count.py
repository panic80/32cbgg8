#!/usr/bin/env python3
"""Monitor document count changes."""
import requests
import time
from datetime import datetime

last_count = None
last_change = datetime.now()

print("Monitoring document count... (Ctrl+C to stop)\n")

while True:
    try:
        response = requests.get("http://localhost:8000/api/v1/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            count = data['components']['vector_store']['document_count']
            
            if last_count is None:
                last_count = count
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Initial count: {count}")
            elif count != last_count:
                delta = count - last_count
                elapsed = (datetime.now() - last_change).total_seconds()
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Count: {count} (+{delta}) after {elapsed:.0f}s")
                last_count = count
                last_change = datetime.now()
            
        time.sleep(5)
    except KeyboardInterrupt:
        break
    except:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Service not responding")
        time.sleep(10)