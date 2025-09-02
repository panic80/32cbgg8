"""Source management API endpoints."""

from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional, Dict, Any

from app.core.logging import get_logger
from app.models.documents import (
    DocumentSearchRequest, DocumentSearchResult,
    DocumentListResponse
)

logger = get_logger(__name__)

router = APIRouter()


@router.post("/sources/search")
async def search_sources(
    request: Request,
    search_request: DocumentSearchRequest
) -> list[DocumentSearchResult]:
    """Search for document sources."""
    try:
        # Get document store
        app = request.app
        document_store = app.state.document_store
        
        # Perform search
        results = await document_store.search(search_request)
        
        return results
        
    except Exception as e:
        logger.error(f"Source search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources")
async def list_sources(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_type: Optional[str] = None,
    source: Optional[str] = None
) -> DocumentListResponse:
    """List all indexed sources with pagination."""
    try:
        # Get document store
        app = request.app
        document_store = app.state.document_store
        
        # Build filters
        filters = {}
        if document_type:
            filters["type"] = document_type
        if source:
            filters["source"] = source
            
        # Get documents
        response = await document_store.list_documents(
            page=page,
            page_size=page_size,
            filters=filters
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Source listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources/stats")
async def get_source_stats(request: Request) -> Dict[str, Any]:
    """Get statistics about indexed sources."""
    try:
        # Get vector store
        app = request.app
        vector_store_manager = app.state.vector_store_manager
        
        # Get basic stats from vector store
        collection_stats = await vector_store_manager.get_collection_stats()
        
        # Get document count
        total_documents = collection_stats.get("document_count", 0)
        
        # For ChromaDB, we need to get more detailed stats
        sources = []
        total_chunks = 0
        unique_documents = set()
        
        if hasattr(vector_store_manager.vector_store, "_collection"):
            try:
                # Get all documents to count by source
                # Note: In production, this should be optimized with proper queries
                results = vector_store_manager.vector_store._collection.get(
                    limit=10000,  # Increased limit to get accurate counts
                    include=["metadatas"]
                )
                
                # Group by source and count unique documents
                source_counts = {}
                if results and "metadatas" in results:
                    for metadata in results["metadatas"]:
                        if metadata:
                            # Count total chunks
                            total_chunks += 1
                            
                            # Track unique documents by parent_id
                            parent_id = metadata.get("parent_id", metadata.get("id", ""))
                            if parent_id:
                                unique_documents.add(parent_id)
                            
                            # Group by source
                            source = metadata.get("source", "Unknown")
                            if source not in source_counts:
                                source_counts[source] = {
                                    "source": source,
                                    "document_count": 0,
                                    "chunk_count": 0,
                                    "last_updated": metadata.get("created_at", ""),
                                    "unique_docs": set()
                                }
                            source_counts[source]["chunk_count"] += 1
                            
                            # Track unique documents per source
                            if parent_id:
                                source_counts[source]["unique_docs"].add(parent_id)
                            
                            # Update last_updated if this one is newer
                            if metadata.get("created_at", "") > source_counts[source]["last_updated"]:
                                source_counts[source]["last_updated"] = metadata.get("created_at", "")
                
                # Convert to list and calculate document counts
                sources = []
                for source_info in source_counts.values():
                    # Use actual unique document count if available, otherwise estimate
                    doc_count = len(source_info["unique_docs"]) if source_info["unique_docs"] else max(1, source_info["chunk_count"] // 10)
                    sources.append({
                        "source": source_info["source"],
                        "document_count": doc_count,
                        "chunk_count": source_info["chunk_count"],
                        "last_updated": source_info["last_updated"]
                    })
                
                # Use actual unique document count if available
                if unique_documents:
                    total_documents = len(unique_documents)
                    
            except Exception as e:
                logger.warning(f"Could not get detailed source stats: {e}")
                # Fall back to ChromaDB's count
                total_chunks = total_documents
        
        return {
            "total_documents": total_documents,
            "total_chunks": total_chunks,
            "sources": sources,
            "collection_name": collection_stats.get("collection", "travel_instructions"),
            "vector_store_type": collection_stats.get("type", "chroma")
        }
        
    except Exception as e:
        logger.error(f"Stats retrieval failed: {e}")
        # Return a minimal response instead of erroring
        return {
            "total_documents": 0,
            "total_chunks": 0,
            "sources": [],
            "error": str(e)
        }


@router.get("/sources/count")
async def get_source_count(request: Request) -> Dict[str, Any]:
    """Get simple document count."""
    try:
        app = request.app
        vector_store_manager = app.state.vector_store_manager
        
        # Get collection stats
        stats = await vector_store_manager.get_collection_stats()
        
        return {
            "count": stats.get("document_count", 0),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Count retrieval failed: {e}")
        return {"count": 0, "status": "error", "message": str(e)}


@router.get("/sources/{document_id}")
async def get_source(
    request: Request,
    document_id: str
) -> Dict[str, Any]:
    """Get a specific source document."""
    try:
        # Get document store
        app = request.app
        document_store = app.state.document_store
        
        # Get document
        document = await document_store.get_by_id(document_id)
        
        if not document:
            raise HTTPException(
                status_code=404,
                detail=f"Document {document_id} not found"
            )
            
        return document.model_dump()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Source retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
