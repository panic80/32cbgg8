#!/usr/bin/env python3
"""Debug why query logging isn't working"""
import sys
import os

# Check if the query logger is being created properly
from app.services.query_logger import query_logger, get_query_logger

print(f"Global query_logger instance: {query_logger}")
print(f"  Enabled: {query_logger.enabled}")
print(f"  DB Path: {query_logger.db_path}")
print(f"  Encrypt: {query_logger.encrypt_queries}")

# Get through function
ql2 = get_query_logger()
print(f"\nget_query_logger() returns: {ql2}")
print(f"  Same instance: {ql2 is query_logger}")

# Check settings
from app.core.config import settings
print(f"\nSettings:")
print(f"  enable_query_logging: {getattr(settings, 'enable_query_logging', None)}")
print(f"  encrypt_query_logs: {getattr(settings, 'encrypt_query_logs', None)}")

# Check if database exists
if os.path.exists(query_logger.db_path):
    print(f"\nDatabase exists at: {query_logger.db_path}")
    print(f"  Size: {os.path.getsize(query_logger.db_path)} bytes")
else:
    print(f"\nDatabase NOT FOUND at: {query_logger.db_path}")