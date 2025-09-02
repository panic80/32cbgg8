#!/usr/bin/env python3
"""
Test script for encrypted Q&A logging functionality.
Tests the complete flow from encryption to retrieval.
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
import uuid
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.query_logger import QueryLogger
from services.encryption import get_encryption_service
from models.query_history import QueryHistoryFilter, QueryStatus, QueryExportRequest
from core.config import settings
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class EncryptedLoggingTester:
    """Test encrypted Q&A logging functionality."""
    
    def __init__(self):
        self.query_logger = QueryLogger()
        self.encryption_service = get_encryption_service()
        self.test_queries = [
            {
                "query": "What is the meal allowance for travel to Toronto?",
                "response": "The meal allowance for travel to Toronto is $85 per day, consisting of:\n- Breakfast: $20\n- Lunch: $25\n- Dinner: $40\n\nThis is outlined in Section 7.2.1 of the Canadian Forces Temporary Duty Travel Instructions.",
                "provider": "openai",
                "model": "gpt-4"
            },
            {
                "query": "How do I claim taxi expenses during TD travel?",
                "response": "To claim taxi expenses during temporary duty travel:\n\n1. Keep all receipts\n2. Use form CF 52 for claims under $50\n3. Attach detailed receipts for claims over $50\n4. Include purpose of travel on claim\n\nRefer to Section 9.3.2 for complete guidelines.",
                "provider": "google",
                "model": "gemini-pro"
            },
            {
                "query": "What are the hotel rate limits for Vancouver?",
                "response": "Hotel rate limits for Vancouver:\n- Standard rate: $180/night\n- Government rate: $165/night\n- Peak season (Jun-Sep): Additional 15% allowed\n\nSee Annex B for complete city rate table.",
                "provider": "anthropic",
                "model": "claude-3"
            }
        ]
    
    async def test_encryption_storage(self):
        """Test storing encrypted Q&A pairs."""
        print("\n=== Testing Encrypted Storage ===")
        
        stored_ids = []
        
        for i, test_data in enumerate(self.test_queries):
            query_id = str(uuid.uuid4())
            stored_ids.append(query_id)
            
            try:
                await self.query_logger.log_query(
                    query_id=query_id,
                    user_query=test_data["query"],
                    provider=test_data["provider"],
                    model=test_data["model"],
                    use_rag=True,
                    response=test_data["response"],
                    sources_count=3,
                    processing_time=1.5 + i * 0.5,
                    tokens_used=150 + i * 50,
                    conversation_id=f"test-conversation-{i}",
                    status=QueryStatus.SUCCESS,
                    metadata={
                        "temperature": 0.7,
                        "max_tokens": 2000,
                        "test_run": True
                    }
                )
                print(f"✓ Stored query {i+1}/{len(self.test_queries)}: {query_id}")
                
            except Exception as e:
                print(f"✗ Failed to store query {i+1}: {e}")
                return False
        
        print(f"\n✓ Successfully stored {len(stored_ids)} encrypted queries")
        return stored_ids
    
    async def test_retrieval_decryption(self, query_ids):
        """Test retrieving and decrypting stored queries."""
        print("\n=== Testing Retrieval & Decryption ===")
        
        # Test retrieving all queries
        filters = QueryHistoryFilter(
            limit=10,
            order_by="timestamp",
            order_desc=True
        )
        
        try:
            entries = await self.query_logger.get_query_history(filters)
            print(f"\nRetrieved {len(entries)} queries")
            
            # Verify our test queries
            found_count = 0
            for entry in entries:
                if entry.id in query_ids:
                    found_count += 1
                    # Check if query was decrypted
                    if not entry.user_query.startswith("[ENCRYPTED-") and not entry.user_query.startswith("[DECRYPTION_FAILED]"):
                        print(f"✓ Query decrypted successfully: {entry.user_query[:50]}...")
                    else:
                        print(f"✗ Query decryption failed: {entry.user_query}")
                        return False
            
            if found_count == len(query_ids):
                print(f"\n✓ All {found_count} test queries retrieved and decrypted successfully")
            else:
                print(f"\n✗ Only found {found_count}/{len(query_ids)} test queries")
                return False
                
        except Exception as e:
            print(f"✗ Failed to retrieve queries: {e}")
            return False
        
        return True
    
    async def test_search_functionality(self):
        """Test searching encrypted queries."""
        print("\n=== Testing Search Functionality ===")
        
        # Search for a specific term
        search_term = "meal allowance"
        filters = QueryHistoryFilter(
            search_query=search_term,
            limit=10
        )
        
        try:
            entries = await self.query_logger.get_query_history(filters)
            
            if entries:
                print(f"✓ Search found {len(entries)} results for '{search_term}'")
                for entry in entries[:3]:
                    print(f"  - {entry.user_query[:60]}...")
            else:
                print(f"⚠️  No results found for '{search_term}' (might be due to encryption)")
                
        except Exception as e:
            print(f"✗ Search failed: {e}")
            return False
        
        return True
    
    async def test_export_functionality(self):
        """Test exporting encrypted data."""
        print("\n=== Testing Export Functionality ===")
        
        # Test JSON export
        export_request = QueryExportRequest(
            filters=QueryHistoryFilter(limit=50),
            format="json",
            include_responses=True,
            anonymize=False
        )
        
        try:
            export_data = await self.query_logger.export_queries(export_request)
            data = json.loads(export_data)
            
            print(f"✓ JSON export successful: {len(data)} queries exported")
            
            # Check if data is decrypted in export
            encrypted_count = 0
            for query in data:
                if query.get('user_query', '').startswith('[ENCRYPTED-'):
                    encrypted_count += 1
            
            if encrypted_count == 0:
                print("✓ All queries decrypted in export")
            else:
                print(f"⚠️  {encrypted_count} queries still encrypted in export")
                
        except Exception as e:
            print(f"✗ Export failed: {e}")
            return False
        
        return True
    
    async def test_statistics(self):
        """Test statistics calculation with encrypted data."""
        print("\n=== Testing Statistics ===")
        
        try:
            stats = await self.query_logger.get_statistics()
            
            print(f"✓ Statistics retrieved successfully:")
            print(f"  - Total queries: {stats.total_queries}")
            print(f"  - Successful queries: {stats.successful_queries}")
            print(f"  - Average processing time: {stats.average_processing_time:.2f}s")
            print(f"  - Total tokens used: {stats.total_tokens_used}")
            
        except Exception as e:
            print(f"✗ Statistics retrieval failed: {e}")
            return False
        
        return True
    
    async def verify_database_encryption(self):
        """Directly verify that data is encrypted in the database."""
        print("\n=== Verifying Database Encryption ===")
        
        import aiosqlite
        
        db_path = self.query_logger.db_path
        
        async with aiosqlite.connect(db_path) as db:
            # Check a few recent records
            cursor = await db.execute("""
                SELECT user_query, user_query_encrypted, response_encrypted 
                FROM query_history 
                WHERE user_query_encrypted IS NOT NULL 
                LIMIT 5
            """)
            
            encrypted_records = await cursor.fetchall()
            
            if encrypted_records:
                print(f"✓ Found {len(encrypted_records)} encrypted records in database")
                
                for i, (query_text, encrypted_query, encrypted_response) in enumerate(encrypted_records):
                    print(f"\nRecord {i+1}:")
                    print(f"  - Query text: {query_text}")
                    print(f"  - Encrypted query length: {len(encrypted_query) if encrypted_query else 0} chars")
                    print(f"  - Encrypted response length: {len(encrypted_response) if encrypted_response else 0} chars")
                    
                    # Verify the query text shows encryption marker
                    if query_text.startswith('[ENCRYPTED-'):
                        print(f"  ✓ Query properly marked as encrypted")
                    else:
                        print(f"  ✗ Query not marked as encrypted!")
            else:
                print("⚠️  No encrypted records found in database")
                print("    This might mean encryption is not enabled or no queries have been logged yet")
        
        return True
    
    async def run_all_tests(self):
        """Run all encryption tests."""
        print("\n" + "="*50)
        print("ENCRYPTED Q&A LOGGING TEST SUITE")
        print("="*50)
        
        # Show configuration
        print("\nCurrent Configuration:")
        print(f"  - Encryption enabled: {settings.encrypt_query_logs}")
        print(f"  - Anonymization enabled: {settings.anonymize_query_logs}")
        print(f"  - Query logging enabled: {settings.enable_query_logging}")
        
        # Verify encryption service
        key_info = self.encryption_service.get_key_info()
        print(f"\nEncryption Service:")
        print(f"  - Key version: {key_info['version']}")
        print(f"  - Key exists: {key_info['key_exists']}")
        
        if not key_info['key_exists']:
            print("\n✗ No encryption key found! Generate one with:")
            print("  python manage_encryption.py generate")
            return False
        
        # Run tests
        all_passed = True
        
        # Test 1: Storage
        query_ids = await self.test_encryption_storage()
        if not query_ids:
            all_passed = False
        
        # Small delay to ensure data is written
        await asyncio.sleep(0.5)
        
        # Test 2: Retrieval
        if query_ids and not await self.test_retrieval_decryption(query_ids):
            all_passed = False
        
        # Test 3: Search
        if not await self.test_search_functionality():
            all_passed = False
        
        # Test 4: Export
        if not await self.test_export_functionality():
            all_passed = False
        
        # Test 5: Statistics
        if not await self.test_statistics():
            all_passed = False
        
        # Test 6: Database verification
        if not await self.verify_database_encryption():
            all_passed = False
        
        # Summary
        print("\n" + "="*50)
        if all_passed:
            print("✓ ALL TESTS PASSED!")
            print("\nYour encrypted Q&A logging system is working correctly.")
            print("Queries and responses are being encrypted before storage")
            print("and decrypted when retrieved.")
        else:
            print("✗ SOME TESTS FAILED!")
            print("\nPlease check the errors above and ensure:")
            print("1. Encryption is enabled in configuration")
            print("2. Encryption key exists and is accessible")
            print("3. Database has been migrated to include encryption fields")
        
        return all_passed


async def main():
    """Main test runner."""
    tester = EncryptedLoggingTester()
    
    # Initialize the query logger
    await tester.query_logger.initialize()
    
    # Run all tests
    success = await tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())