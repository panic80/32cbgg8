"""Checkpoint service for resumable document ingestion."""

import json
import pickle
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
from enum import Enum

from app.core.logging import get_logger
from app.services.cache import CacheService

logger = get_logger(__name__)


class CheckpointState(str, Enum):
    """Ingestion checkpoint states."""
    LOADING = "loading"
    SPLITTING = "splitting"
    EMBEDDING = "embedding"
    STORING = "storing"
    INDEXING = "indexing"
    COMPLETED = "completed"
    FAILED = "failed"


class IngestionCheckpoint:
    """Represents an ingestion checkpoint."""
    
    def __init__(
        self,
        operation_id: str,
        document_source: str,
        total_documents: int = 0,
        current_state: CheckpointState = CheckpointState.LOADING
    ):
        self.operation_id = operation_id
        self.document_source = document_source
        self.total_documents = total_documents
        self.current_state = current_state
        self.processed_chunks: List[str] = []
        self.failed_chunks: List[str] = []
        self.metadata: Dict[str, Any] = {}
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)
        self.error_message: Optional[str] = None
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert checkpoint to dictionary."""
        return {
            "operation_id": self.operation_id,
            "document_source": self.document_source,
            "total_documents": self.total_documents,
            "current_state": self.current_state.value,
            "processed_chunks": self.processed_chunks,
            "failed_chunks": self.failed_chunks,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "error_message": self.error_message,
            "progress_percentage": self.get_progress_percentage()
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IngestionCheckpoint":
        """Create checkpoint from dictionary."""
        checkpoint = cls(
            operation_id=data["operation_id"],
            document_source=data["document_source"],
            total_documents=data["total_documents"],
            current_state=CheckpointState(data["current_state"])
        )
        checkpoint.processed_chunks = data.get("processed_chunks", [])
        checkpoint.failed_chunks = data.get("failed_chunks", [])
        checkpoint.metadata = data.get("metadata", {})
        checkpoint.created_at = datetime.fromisoformat(data["created_at"])
        checkpoint.updated_at = datetime.fromisoformat(data["updated_at"])
        checkpoint.error_message = data.get("error_message")
        return checkpoint
        
    def get_progress_percentage(self) -> float:
        """Calculate progress percentage."""
        if self.total_documents == 0:
            return 0.0
        return (len(self.processed_chunks) / self.total_documents) * 100
        
    def update_state(self, new_state: CheckpointState, error_message: Optional[str] = None):
        """Update checkpoint state."""
        self.current_state = new_state
        self.error_message = error_message
        self.updated_at = datetime.now(timezone.utc)


class IngestionCheckpointService:
    """Service for managing ingestion checkpoints."""
    
    def __init__(self, cache_service: CacheService, ttl_hours: int = 24):
        """Initialize checkpoint service.
        
        Args:
            cache_service: Redis cache service instance
            ttl_hours: Time to live for checkpoints in hours
        """
        self.cache_service = cache_service
        self.ttl = ttl_hours * 3600  # Convert to seconds
        
    def _get_checkpoint_key(self, operation_id: str) -> str:
        """Generate cache key for checkpoint."""
        return f"checkpoint:ingestion:{operation_id}"
        
    async def create_checkpoint(
        self,
        operation_id: str,
        document_source: str,
        total_documents: int = 0
    ) -> IngestionCheckpoint:
        """Create a new checkpoint."""
        checkpoint = IngestionCheckpoint(
            operation_id=operation_id,
            document_source=document_source,
            total_documents=total_documents
        )
        
        await self.save_checkpoint(checkpoint)
        logger.info(f"Created checkpoint for operation {operation_id}")
        return checkpoint
        
    async def save_checkpoint(self, checkpoint: IngestionCheckpoint) -> bool:
        """Save checkpoint to cache."""
        try:
            key = self._get_checkpoint_key(checkpoint.operation_id)
            data = json.dumps(checkpoint.to_dict())
            
            success = await self.cache_service.set(key, data, ttl=self.ttl)
            if success:
                logger.debug(f"Saved checkpoint for operation {checkpoint.operation_id}")
            return success
            
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            return False
            
    async def get_checkpoint(self, operation_id: str) -> Optional[IngestionCheckpoint]:
        """Get checkpoint from cache."""
        try:
            key = self._get_checkpoint_key(operation_id)
            data = await self.cache_service.get(key)
            
            if data:
                checkpoint_dict = json.loads(data)
                return IngestionCheckpoint.from_dict(checkpoint_dict)
            return None
            
        except Exception as e:
            logger.error(f"Failed to get checkpoint: {e}")
            return None
            
    async def update_progress(
        self,
        operation_id: str,
        processed_chunk_id: Optional[str] = None,
        failed_chunk_id: Optional[str] = None,
        new_state: Optional[CheckpointState] = None,
        metadata_update: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update checkpoint progress."""
        checkpoint = await self.get_checkpoint(operation_id)
        if not checkpoint:
            logger.warning(f"Checkpoint not found for operation {operation_id}")
            return False
            
        # Update processed/failed chunks
        if processed_chunk_id:
            checkpoint.processed_chunks.append(processed_chunk_id)
        if failed_chunk_id:
            checkpoint.failed_chunks.append(failed_chunk_id)
            
        # Update state if provided
        if new_state:
            checkpoint.update_state(new_state)
            
        # Update metadata
        if metadata_update:
            checkpoint.metadata.update(metadata_update)
            
        checkpoint.updated_at = datetime.now(timezone.utc)
        
        return await self.save_checkpoint(checkpoint)
        
    async def mark_completed(self, operation_id: str) -> bool:
        """Mark checkpoint as completed."""
        key = self._get_checkpoint_key(operation_id)
        updated = await self.update_progress(
            operation_id,
            new_state=CheckpointState.COMPLETED,
            metadata_update={}
        )
        if updated:
            await self.cache_service.delete(key)
        return updated
        
    async def mark_failed(self, operation_id: str, error_message: str) -> bool:
        """Mark checkpoint as failed."""
        checkpoint = await self.get_checkpoint(operation_id)
        if not checkpoint:
            return False
        
        checkpoint.update_state(CheckpointState.FAILED, error_message)
        saved = await self.save_checkpoint(checkpoint)
        if saved:
            await self.cache_service.delete(self._get_checkpoint_key(operation_id))
        return saved
        
    async def can_resume(self, operation_id: str) -> bool:
        """Check if an operation can be resumed."""
        checkpoint = await self.get_checkpoint(operation_id)
        if not checkpoint:
            return False
            
        # Can resume if not completed and not too old
        if checkpoint.current_state == CheckpointState.COMPLETED:
            return False
            
        # Check if checkpoint is not too old (e.g., 24 hours)
        age = datetime.now(timezone.utc) - checkpoint.updated_at
        if age > timedelta(hours=24):
            logger.warning(f"Checkpoint {operation_id} is too old to resume")
            return False
            
        return True
        
    async def get_resume_info(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """Get information needed to resume an operation."""
        checkpoint = await self.get_checkpoint(operation_id)
        if not checkpoint:
            return None
            
        return {
            "operation_id": checkpoint.operation_id,
            "document_source": checkpoint.document_source,
            "current_state": checkpoint.current_state,
            "processed_chunks": checkpoint.processed_chunks,
            "failed_chunks": checkpoint.failed_chunks,
            "progress_percentage": checkpoint.get_progress_percentage(),
            "can_resume": await self.can_resume(operation_id)
        }
        
    async def cleanup_old_checkpoints(self, max_age_hours: int = 48) -> int:
        """Clean up old checkpoints."""
        # This would require scanning all checkpoint keys
        # For now, we rely on Redis TTL for cleanup
        logger.info("Checkpoint cleanup relies on Redis TTL")
        return 0
        
    async def list_active_checkpoints(self) -> List[Dict[str, Any]]:
        """List all active checkpoints."""
        # This would require maintaining a separate index of checkpoints
        # For now, return empty list
        logger.info("Checkpoint listing not implemented - would require checkpoint index")
        return []
