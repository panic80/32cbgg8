#!/usr/bin/env python3
"""
Backup ChromaDB and associated indices
"""
import os
import sys
import shutil
import tarfile
from datetime import datetime
from pathlib import Path
import logging
import argparse

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChromaDBBackup:
    def __init__(self, base_dir: str = "./", max_backups: int = 5):
        self.base_dir = Path(base_dir)
        self.backup_dir = self.base_dir / "backups"
        self.max_backups = max_backups
        self.backup_dir.mkdir(exist_ok=True)
        
    def create_backup(self, compress: bool = True) -> Path:
        """Create a timestamped backup of ChromaDB and indices"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"chromadb_backup_{timestamp}"
        backup_path = self.backup_dir / backup_name
        
        try:
            # Create backup directory
            backup_path.mkdir(exist_ok=True)
            
            # Backup ChromaDB
            chromadb_path = self.base_dir / "chroma_db"
            if chromadb_path.exists():
                logger.info(f"Backing up ChromaDB from {chromadb_path}")
                shutil.copytree(chromadb_path, backup_path / "chroma_db")
            else:
                logger.warning(f"ChromaDB directory not found at {chromadb_path}")
            
            # Backup BM25 index
            bm25_index = self.base_dir / "bm25_index.pkl"
            if bm25_index.exists():
                logger.info("Backing up BM25 index")
                shutil.copy2(bm25_index, backup_path / "bm25_index.pkl")
            
            # Backup co-occurrence matrix
            cooc_matrix = self.base_dir / "cooccurrence_matrix.pkl"
            if cooc_matrix.exists():
                logger.info("Backing up co-occurrence matrix")
                shutil.copy2(cooc_matrix, backup_path / "cooccurrence_matrix.pkl")
            
            # Create metadata file
            metadata_path = backup_path / "backup_metadata.txt"
            with open(metadata_path, 'w') as f:
                f.write(f"Backup created: {datetime.now().isoformat()}\n")
                f.write(f"ChromaDB path: {chromadb_path}\n")
                f.write(f"Files backed up:\n")
                for item in backup_path.iterdir():
                    if item.name != "backup_metadata.txt":
                        f.write(f"  - {item.name}\n")
            
            if compress:
                # Create tarball
                tarball_path = self.backup_dir / f"{backup_name}.tar.gz"
                logger.info(f"Compressing backup to {tarball_path}")
                with tarfile.open(tarball_path, "w:gz") as tar:
                    tar.add(backup_path, arcname=backup_name)
                
                # Remove uncompressed directory
                shutil.rmtree(backup_path)
                backup_path = tarball_path
            
            logger.info(f"Backup created successfully: {backup_path}")
            
            # Cleanup old backups
            self._cleanup_old_backups()
            
            return backup_path
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            if backup_path.exists() and backup_path.is_dir():
                shutil.rmtree(backup_path)
            raise
    
    def _cleanup_old_backups(self):
        """Remove old backups keeping only the most recent max_backups"""
        backups = sorted([
            f for f in self.backup_dir.iterdir() 
            if f.name.startswith("chromadb_backup_") and (f.suffix == ".gz" or f.is_dir())
        ], key=lambda x: x.stat().st_mtime, reverse=True)
        
        if len(backups) > self.max_backups:
            for backup in backups[self.max_backups:]:
                logger.info(f"Removing old backup: {backup}")
                if backup.is_dir():
                    shutil.rmtree(backup)
                else:
                    backup.unlink()
    
    def list_backups(self):
        """List available backups"""
        backups = sorted([
            f for f in self.backup_dir.iterdir() 
            if f.name.startswith("chromadb_backup_") and (f.suffix == ".gz" or f.is_dir())
        ], key=lambda x: x.stat().st_mtime, reverse=True)
        
        if not backups:
            logger.info("No backups found")
            return []
        
        logger.info(f"Found {len(backups)} backup(s):")
        for i, backup in enumerate(backups):
            size = backup.stat().st_size / (1024 * 1024)  # MB
            mtime = datetime.fromtimestamp(backup.stat().st_mtime)
            logger.info(f"{i+1}. {backup.name} - {size:.2f} MB - {mtime.strftime('%Y-%m-%d %H:%M:%S')}")
        
        return backups

def main():
    parser = argparse.ArgumentParser(description="Backup ChromaDB and associated indices")
    parser.add_argument("--no-compress", action="store_true", help="Don't compress the backup")
    parser.add_argument("--max-backups", type=int, default=5, help="Maximum number of backups to keep")
    parser.add_argument("--list", action="store_true", help="List existing backups")
    
    args = parser.parse_args()
    
    backup_manager = ChromaDBBackup(max_backups=args.max_backups)
    
    if args.list:
        backup_manager.list_backups()
    else:
        try:
            backup_path = backup_manager.create_backup(compress=not args.no_compress)
            print(f"Backup created: {backup_path}")
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    main()