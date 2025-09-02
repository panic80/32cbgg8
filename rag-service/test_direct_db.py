#!/usr/bin/env python3
"""Test direct database access to verify logging issue"""
import sqlite3
import uuid
from datetime import datetime

# Direct database test
db_path = "chroma_db/query_history.db"

# Insert a test record directly
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

query_id = str(uuid.uuid4())
timestamp = datetime.utcnow().isoformat()

# Insert with minimal fields
cursor.execute("""
    INSERT INTO query_history (
        id, timestamp, user_query, provider, model, use_rag, 
        processing_time, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", (
    query_id,
    timestamp,
    "Direct DB test query",
    "openai",
    "gpt-4",
    1,  # use_rag as integer
    1.5,
    "SUCCESS"
))

conn.commit()
print(f"Inserted test query: {query_id}")

# Verify it was inserted
cursor.execute("SELECT COUNT(*) FROM query_history")
count = cursor.fetchone()[0]
print(f"Total queries in DB: {count}")

conn.close()