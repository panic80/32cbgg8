#!/usr/bin/env python3
"""
Rollback script for retrieval optimization deployment.

This script provides safe rollback capabilities for the gated retrieval optimization
by toggling feature flags and environment variables.
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any
import logging

# Set up basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RetrievalRollbackManager:
    """Manages rollback operations for retrieval optimizations."""
    
    def __init__(self):
        self.config_file = Path(__file__).parent.parent / "app" / "core" / "config.py"
        self.backup_file = Path(__file__).parent / "config_backup.py"
        
    async def create_backup(self) -> bool:
        """Create a backup of the current configuration."""
        try:
            if self.config_file.exists():
                content = self.config_file.read_text()
                self.backup_file.write_text(content)
                logger.info(f"Configuration backup created at {self.backup_file}")
                return True
            else:
                logger.error(f"Configuration file not found: {self.config_file}")
                return False
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return False
    
    async def restore_backup(self) -> bool:
        """Restore configuration from backup."""
        try:
            if self.backup_file.exists():
                content = self.backup_file.read_text()
                self.config_file.write_text(content)
                logger.info(f"Configuration restored from backup")
                return True
            else:
                logger.error(f"Backup file not found: {self.backup_file}")
                return False
        except Exception as e:
            logger.error(f"Failed to restore backup: {e}")
            return False
    
    async def disable_gated_retrieval(self) -> bool:
        """Disable gated retrieval by setting feature flags to False."""
        try:
            config_content = self.config_file.read_text()
            
            # Replace gated retrieval settings
            replacements = [
                ("enable_gated_retrieval: bool = True", "enable_gated_retrieval: bool = False"),
                ("gated_retrieval_rollout_percentage: float = 1.0", "gated_retrieval_rollout_percentage: float = 0.0"),
                ("delayed_streaming_enabled: bool = True", "delayed_streaming_enabled: bool = False"),
            ]
            
            modified = False
            for old, new in replacements:
                if old in config_content:
                    config_content = config_content.replace(old, new)
                    modified = True
                    logger.info(f"Applied rollback: {old} -> {new}")
            
            if modified:
                self.config_file.write_text(config_content)
                logger.info("Gated retrieval disabled successfully")
                return True
            else:
                logger.warning("No gated retrieval settings found to disable")
                return False
                
        except Exception as e:
            logger.error(f"Failed to disable gated retrieval: {e}")
            return False
    
    async def enable_gated_retrieval(self, rollout_percentage: float = 0.1) -> bool:
        """Enable gated retrieval with specified rollout percentage."""
        try:
            config_content = self.config_file.read_text()
            
            # Replace gated retrieval settings
            replacements = [
                ("enable_gated_retrieval: bool = False", "enable_gated_retrieval: bool = True"),
                (f"gated_retrieval_rollout_percentage: float = 0.0", 
                 f"gated_retrieval_rollout_percentage: float = {rollout_percentage}"),
            ]
            
            modified = False
            for old, new in replacements:
                if old in config_content:
                    config_content = config_content.replace(old, new)
                    modified = True
                    logger.info(f"Applied setting: {old} -> {new}")
            
            if modified:
                self.config_file.write_text(config_content)
                logger.info(f"Gated retrieval enabled with {rollout_percentage*100}% rollout")
                return True
            else:
                logger.warning("No gated retrieval settings found to enable")
                return False
                
        except Exception as e:
            logger.error(f"Failed to enable gated retrieval: {e}")
            return False
    
    async def get_current_status(self) -> Dict[str, Any]:
        """Get current status from configuration file."""
        try:
            config_content = self.config_file.read_text()
            
            # Extract key configuration values
            status = {}
            
            # Parse boolean settings
            bool_settings = [
                ("enable_gated_retrieval", "gated_retrieval_enabled"),
                ("delayed_streaming_enabled", "delayed_streaming_enabled"), 
                ("enable_l2_retrieval_cache", "l2_cache_enabled"),
                ("enable_deduplication", "deduplication_enabled"),
            ]
            
            for config_name, status_name in bool_settings:
                if f"{config_name}: bool = True" in config_content:
                    status[status_name] = True
                elif f"{config_name}: bool = False" in config_content:
                    status[status_name] = False
                else:
                    status[status_name] = "unknown"
            
            # Parse numeric settings
            import re
            
            # Extract rollout percentage
            rollout_match = re.search(r'gated_retrieval_rollout_percentage: float = ([0-9.]+)', config_content)
            status["rollout_percentage"] = float(rollout_match.group(1)) if rollout_match else 0.0
            
            # Extract RRF k value
            rrf_match = re.search(r'rrf_k: int = ([0-9]+)', config_content)
            status["rrf_k"] = int(rrf_match.group(1)) if rrf_match else 60
            
            # Extract timeouts
            vector_timeout_match = re.search(r'vector_retriever_timeout: float = ([0-9.]+)', config_content)
            status["vector_timeout"] = float(vector_timeout_match.group(1)) if vector_timeout_match else 0.15
            
            bm25_timeout_match = re.search(r'bm25_retriever_timeout: float = ([0-9.]+)', config_content)
            status["bm25_timeout"] = float(bm25_timeout_match.group(1)) if bm25_timeout_match else 0.20
            
            multiquery_timeout_match = re.search(r'multiquery_retriever_timeout: float = ([0-9.]+)', config_content)
            status["multiquery_timeout"] = float(multiquery_timeout_match.group(1)) if multiquery_timeout_match else 0.30
            
            return status
        except Exception as e:
            logger.error(f"Failed to get current status: {e}")
            return {}
    
    async def gradual_rollout(self, target_percentage: float, step_size: float = 0.1, 
                            step_delay: int = 300) -> bool:
        """Gradually increase rollout percentage."""
        try:
            current_status = await self.get_current_status()
            current_percentage = current_status.get("rollout_percentage", 0.0)
            
            logger.info(f"Starting gradual rollout from {current_percentage*100}% to {target_percentage*100}%")
            
            while current_percentage < target_percentage:
                next_percentage = min(current_percentage + step_size, target_percentage)
                
                if await self.enable_gated_retrieval(next_percentage):
                    logger.info(f"Rollout increased to {next_percentage*100}%")
                    current_percentage = next_percentage
                    
                    if next_percentage < target_percentage:
                        logger.info(f"Waiting {step_delay} seconds before next step...")
                        await asyncio.sleep(step_delay)
                else:
                    logger.error("Failed to update rollout percentage")
                    return False
            
            logger.info(f"Gradual rollout completed at {target_percentage*100}%")
            return True
            
        except Exception as e:
            logger.error(f"Failed during gradual rollout: {e}")
            return False


async def main():
    """Main CLI interface for rollback operations."""
    parser = argparse.ArgumentParser(description="Retrieval Optimization Rollback Manager")
    parser.add_argument("action", choices=[
        "status", "disable", "enable", "backup", "restore", "rollout"
    ], help="Action to perform")
    
    parser.add_argument("--percentage", type=float, default=0.1, 
                       help="Rollout percentage for enable/rollout actions (0.0-1.0)")
    parser.add_argument("--step-size", type=float, default=0.1,
                       help="Step size for gradual rollout (default: 0.1)")
    parser.add_argument("--step-delay", type=int, default=300,
                       help="Delay between rollout steps in seconds (default: 300)")
    
    args = parser.parse_args()
    
    manager = RetrievalRollbackManager()
    
    try:
        if args.action == "status":
            status = await manager.get_current_status()
            print("\nCurrent Retrieval Optimization Status:")
            print("=" * 40)
            for key, value in status.items():
                print(f"{key}: {value}")
                
        elif args.action == "disable":
            print("Creating backup before rollback...")
            if await manager.create_backup():
                print("Disabling gated retrieval...")
                if await manager.disable_gated_retrieval():
                    print("✅ Gated retrieval disabled successfully")
                    print("⚠️  You may need to restart the service for changes to take effect")
                else:
                    print("❌ Failed to disable gated retrieval")
                    sys.exit(1)
            else:
                print("❌ Failed to create backup")
                sys.exit(1)
                
        elif args.action == "enable":
            if args.percentage < 0.0 or args.percentage > 1.0:
                print("❌ Percentage must be between 0.0 and 1.0")
                sys.exit(1)
                
            print(f"Enabling gated retrieval with {args.percentage*100}% rollout...")
            if await manager.enable_gated_retrieval(args.percentage):
                print("✅ Gated retrieval enabled successfully")
                print("⚠️  You may need to restart the service for changes to take effect")
            else:
                print("❌ Failed to enable gated retrieval")
                sys.exit(1)
                
        elif args.action == "backup":
            print("Creating configuration backup...")
            if await manager.create_backup():
                print("✅ Backup created successfully")
            else:
                print("❌ Failed to create backup")
                sys.exit(1)
                
        elif args.action == "restore":
            print("Restoring configuration from backup...")
            if await manager.restore_backup():
                print("✅ Configuration restored successfully")
                print("⚠️  You may need to restart the service for changes to take effect")
            else:
                print("❌ Failed to restore backup")
                sys.exit(1)
                
        elif args.action == "rollout":
            if args.percentage < 0.0 or args.percentage > 1.0:
                print("❌ Percentage must be between 0.0 and 1.0")
                sys.exit(1)
                
            print(f"Starting gradual rollout to {args.percentage*100}%...")
            if await manager.gradual_rollout(
                target_percentage=args.percentage,
                step_size=args.step_size,
                step_delay=args.step_delay
            ):
                print("✅ Gradual rollout completed successfully")
            else:
                print("❌ Gradual rollout failed")
                sys.exit(1)
                
    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())