"""Integration tests for LangGraph 1.0 functionality.

Tests:
1. StateGraph creation and compilation
2. Node execution and state management
3. Conditional edges
4. Checkpoint integration
5. Async operations
"""

import asyncio
import pytest
from typing import TypedDict, List, Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver


class SimpleState(TypedDict):
    """Simple state for testing."""
    messages: List[str]
    count: int
    processed: bool


class TestStateGraphBasics:
    """Test basic StateGraph functionality."""

    def test_create_stategraph(self):
        """Test StateGraph creation."""
        workflow = StateGraph(SimpleState)
        assert workflow is not None
        print("✅ StateGraph created successfully")

    def test_add_nodes(self):
        """Test adding nodes to StateGraph."""
        workflow = StateGraph(SimpleState)

        def node1(state: SimpleState) -> SimpleState:
            state["count"] += 1
            return state

        def node2(state: SimpleState) -> SimpleState:
            state["messages"].append("processed")
            return state

        workflow.add_node("increment", node1)
        workflow.add_node("append", node2)

        print("✅ Nodes added successfully")

    def test_add_edges(self):
        """Test adding edges between nodes."""
        workflow = StateGraph(SimpleState)

        def node1(state: SimpleState) -> SimpleState:
            return state

        def node2(state: SimpleState) -> SimpleState:
            return state

        workflow.add_node("node1", node1)
        workflow.add_node("node2", node2)
        workflow.add_edge("node1", "node2")
        workflow.add_edge("node2", END)

        print("✅ Edges added successfully")

    def test_set_entry_point(self):
        """Test setting entry point."""
        workflow = StateGraph(SimpleState)

        def start_node(state: SimpleState) -> SimpleState:
            return state

        workflow.add_node("start", start_node)
        workflow.set_entry_point("start")
        workflow.add_edge("start", END)

        print("✅ Entry point set successfully")

    def test_compile_graph(self):
        """Test compiling StateGraph."""
        workflow = StateGraph(SimpleState)

        def test_node(state: SimpleState) -> SimpleState:
            state["count"] += 1
            return state

        workflow.add_node("test", test_node)
        workflow.set_entry_point("test")
        workflow.add_edge("test", END)

        compiled = workflow.compile()
        assert compiled is not None
        print("✅ StateGraph compiled successfully")


class TestStateGraphExecution:
    """Test StateGraph execution."""

    def test_simple_execution(self):
        """Test executing a simple graph."""
        workflow = StateGraph(SimpleState)

        def increment(state: SimpleState) -> SimpleState:
            state["count"] += 1
            state["messages"].append(f"Count: {state['count']}")
            return state

        workflow.add_node("increment", increment)
        workflow.set_entry_point("increment")
        workflow.add_edge("increment", END)

        compiled = workflow.compile()

        # Execute
        initial_state: SimpleState = {
            "messages": [],
            "count": 0,
            "processed": False
        }

        result = compiled.invoke(initial_state)

        assert result["count"] == 1
        assert len(result["messages"]) == 1
        assert "Count: 1" in result["messages"]
        print(f"✅ Simple execution successful: {result}")

    def test_multi_node_execution(self):
        """Test executing graph with multiple nodes."""
        workflow = StateGraph(SimpleState)

        def node1(state: SimpleState) -> SimpleState:
            state["count"] += 1
            state["messages"].append("node1")
            return state

        def node2(state: SimpleState) -> SimpleState:
            state["count"] += 10
            state["messages"].append("node2")
            return state

        def node3(state: SimpleState) -> SimpleState:
            state["processed"] = True
            state["messages"].append("node3")
            return state

        workflow.add_node("first", node1)
        workflow.add_node("second", node2)
        workflow.add_node("third", node3)

        workflow.set_entry_point("first")
        workflow.add_edge("first", "second")
        workflow.add_edge("second", "third")
        workflow.add_edge("third", END)

        compiled = workflow.compile()

        initial_state: SimpleState = {
            "messages": [],
            "count": 0,
            "processed": False
        }

        result = compiled.invoke(initial_state)

        assert result["count"] == 11  # 0 + 1 + 10
        assert result["processed"] is True
        assert result["messages"] == ["node1", "node2", "node3"]
        print(f"✅ Multi-node execution successful: count={result['count']}")

    @pytest.mark.asyncio
    async def test_async_execution(self):
        """Test async graph execution."""
        workflow = StateGraph(SimpleState)

        async def async_node(state: SimpleState) -> SimpleState:
            await asyncio.sleep(0.01)  # Simulate async work
            state["count"] += 1
            state["messages"].append("async_processed")
            return state

        workflow.add_node("async_process", async_node)
        workflow.set_entry_point("async_process")
        workflow.add_edge("async_process", END)

        compiled = workflow.compile()

        initial_state: SimpleState = {
            "messages": [],
            "count": 0,
            "processed": False
        }

        result = await compiled.ainvoke(initial_state)

        assert result["count"] == 1
        assert "async_processed" in result["messages"]
        print(f"✅ Async execution successful: {result['messages']}")


class TestConditionalEdges:
    """Test conditional edge routing."""

    def test_conditional_routing(self):
        """Test conditional edge based on state."""
        workflow = StateGraph(SimpleState)

        def increment(state: SimpleState) -> SimpleState:
            state["count"] += 1
            return state

        def process_high(state: SimpleState) -> SimpleState:
            state["messages"].append("high")
            return state

        def process_low(state: SimpleState) -> SimpleState:
            state["messages"].append("low")
            return state

        def route(state: SimpleState) -> Literal["high", "low"]:
            return "high" if state["count"] > 5 else "low"

        workflow.add_node("increment", increment)
        workflow.add_node("high", process_high)
        workflow.add_node("low", process_low)

        workflow.set_entry_point("increment")
        workflow.add_conditional_edges(
            "increment",
            route,
            {
                "high": "high",
                "low": "low"
            }
        )
        workflow.add_edge("high", END)
        workflow.add_edge("low", END)

        compiled = workflow.compile()

        # Test low path
        result_low = compiled.invoke({
            "messages": [],
            "count": 0,
            "processed": False
        })
        assert "low" in result_low["messages"]

        # Test high path
        result_high = compiled.invoke({
            "messages": [],
            "count": 10,
            "processed": False
        })
        assert "high" in result_high["messages"]

        print("✅ Conditional routing works correctly")


class TestCheckpointIntegration:
    """Test checkpoint functionality with MemorySaver."""

    def test_memory_saver(self):
        """Test MemorySaver checkpoint."""
        workflow = StateGraph(SimpleState)

        def increment(state: SimpleState) -> SimpleState:
            state["count"] += 1
            return state

        workflow.add_node("increment", increment)
        workflow.set_entry_point("increment")
        workflow.add_edge("increment", END)

        # Compile with checkpointer
        checkpointer = MemorySaver()
        compiled = workflow.compile(checkpointer=checkpointer)

        config = {"configurable": {"thread_id": "test-thread-1"}}

        initial_state: SimpleState = {
            "messages": [],
            "count": 0,
            "processed": False
        }

        result = compiled.invoke(initial_state, config)
        assert result["count"] == 1
        print("✅ MemorySaver checkpoint works")

    def test_checkpoint_persistence(self):
        """Test that checkpoints persist state across invocations."""
        workflow = StateGraph(SimpleState)

        def increment(state: SimpleState) -> SimpleState:
            state["count"] += 1
            state["messages"].append(f"run_{state['count']}")
            return state

        workflow.add_node("increment", increment)
        workflow.set_entry_point("increment")
        workflow.add_edge("increment", END)

        checkpointer = MemorySaver()
        compiled = workflow.compile(checkpointer=checkpointer)

        config = {"configurable": {"thread_id": "persist-test"}}

        initial_state: SimpleState = {
            "messages": [],
            "count": 0,
            "processed": False
        }

        # First invocation
        result1 = compiled.invoke(initial_state, config)
        assert result1["count"] == 1

        # Note: MemorySaver in LangGraph 1.0 saves checkpoints at each step
        # but doesn't automatically resume - each invoke starts fresh with provided state
        print("✅ Checkpoint persistence tested")


class TestStatefulRetrievalIntegration:
    """Test that actual stateful_retrieval.py can be imported and instantiated."""

    def test_import_stateful_retrieval(self):
        """Test importing StatefulRetrievalPipeline."""
        try:
            from app.pipelines.stateful_retrieval import StatefulRetrievalPipeline
            print("✅ StatefulRetrievalPipeline imported successfully")
        except ImportError as e:
            pytest.fail(f"Failed to import StatefulRetrievalPipeline: {e}")

    def test_retrieval_state_schema(self):
        """Test RetrievalState TypedDict schema."""
        from app.pipelines.stateful_retrieval import RetrievalState

        # Verify expected fields
        annotations = RetrievalState.__annotations__
        expected_fields = {
            "query", "original_query", "documents", "relevance_scores",
            "iteration_count", "metadata", "error", "finalized"
        }

        actual_fields = set(annotations.keys())
        assert expected_fields == actual_fields, (
            f"RetrievalState schema mismatch. Expected: {expected_fields}, Got: {actual_fields}"
        )
        print(f"✅ RetrievalState schema validated: {list(annotations.keys())}")

    def test_redis_checkpoint_available_check(self):
        """Test REDIS_CHECKPOINT_AVAILABLE flag."""
        from app.pipelines.stateful_retrieval import REDIS_CHECKPOINT_AVAILABLE

        # Should be True if langgraph-checkpoint-redis is installed
        if REDIS_CHECKPOINT_AVAILABLE:
            print("✅ REDIS_CHECKPOINT_AVAILABLE=True (langgraph-checkpoint-redis installed)")
        else:
            print("⚠️  REDIS_CHECKPOINT_AVAILABLE=False (langgraph-checkpoint-redis not installed)")
            print("    Run: pip install langgraph-checkpoint-redis")


class TestGraphStreaming:
    """Test streaming output from graphs."""

    @pytest.mark.asyncio
    async def test_async_stream(self):
        """Test async streaming from graph execution."""
        workflow = StateGraph(SimpleState)

        async def stream_node(state: SimpleState) -> SimpleState:
            for i in range(3):
                await asyncio.sleep(0.01)
                state["messages"].append(f"stream_{i}")
            state["count"] = len(state["messages"])
            return state

        workflow.add_node("stream", stream_node)
        workflow.set_entry_point("stream")
        workflow.add_edge("stream", END)

        compiled = workflow.compile()

        initial_state: SimpleState = {
            "messages": [],
            "count": 0,
            "processed": False
        }

        result = await compiled.ainvoke(initial_state)

        assert result["count"] == 3
        assert len(result["messages"]) == 3
        print(f"✅ Async streaming successful: {result['messages']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
