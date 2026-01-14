# RAG Evaluation Framework

A comprehensive evaluation suite for testing RAG embedding and retrieval accuracy, precision, and hallucination detection.

## Overview

This framework provides:

- **Retrieval Quality Metrics**: Precision@k, Recall@k, MRR, NDCG, Hit Rate
- **Synthetic Test Data Generation**: Auto-generate Q&A pairs from your documents
- **Generation Quality Assessment**: LLM-as-judge for relevance, completeness, grounding
- **Hallucination Detection**: NLI-based verification that answers are grounded in sources

## Quick Start

### 1. Generate Evaluation Dataset

First, generate a synthetic test dataset from your ingested documents.

**Note:** The `generate` command requires the RAG service to have documents ingested. It fetches chunks via the search API and uses an LLM to generate Q&A pairs.

```bash
docker compose exec rag-service python3 -m evaluation.cli.main generate \
    --rag-url http://localhost:8000 \
    --output /app/data/eval_dataset.json \
    --num-questions 50
```

This creates Q&A pairs in three categories:

- **Factual**: Questions about specific facts, numbers, dates, rates
- **Procedural**: Questions about processes and step-by-step instructions
- **Comparison**: Questions comparing different options or scenarios

### 2. Run Full Evaluation

Run a complete evaluation including retrieval metrics, generation quality, and hallucination detection:

```bash
docker compose exec rag-service python3 -m evaluation.cli.main eval \
    --dataset /app/data/eval_dataset.json \
    --output /app/data/eval_results.json \
    --verbose
```

### 3. View Results

Results are saved as JSON. You can also get Markdown or CSV output:

```bash
# Markdown report
docker compose exec rag-service python3 -m evaluation.cli.main eval \
    --dataset /app/data/eval_dataset.json \
    --output /app/data/eval_report.md \
    --output-format markdown

# CSV files (creates separate files for retrieval, generation, hallucination)
docker compose exec rag-service python3 -m evaluation.cli.main eval \
    --dataset /app/data/eval_dataset.json \
    --output /app/data/eval_results \
    --output-format csv
```

## CLI Commands

### `generate` - Create Test Dataset

```bash
python3 -m evaluation.cli.main generate [OPTIONS]
```

| Option             | Default                       | Description                                        |
| ------------------ | ----------------------------- | -------------------------------------------------- |
| `--rag-url`        | http://localhost:8000         | RAG service URL                                    |
| `--admin-token`    | ""                            | Admin API token                                    |
| `--output`         | (required)                    | Output dataset file path                           |
| `--num-questions`  | 50                            | Questions per type (factual/procedural/comparison) |
| `--question-types` | factual procedural comparison | Types to generate                                  |
| `--model`          | gpt-4.1-mini                  | LLM for question generation                        |
| `--verbose`        | false                         | Show progress                                      |

### `eval` - Run Evaluation

```bash
python3 -m evaluation.cli.main eval [OPTIONS]
```

| Option                 | Default               | Description                              |
| ---------------------- | --------------------- | ---------------------------------------- |
| `--dataset`            | (required)            | Path to evaluation dataset JSON          |
| `--rag-url`            | http://localhost:8000 | RAG service URL                          |
| `--admin-token`        | ""                    | Admin API token                          |
| `--output`             | results.json          | Output file path                         |
| `--output-format`      | json                  | Output format: json, csv, markdown       |
| `--retrieval-only`     | false                 | Skip generation and hallucination checks |
| `--skip-hallucination` | false                 | Skip hallucination detection only        |
| `--k-values`           | 1 3 5 10              | K values for @k metrics                  |
| `--verbose`            | false                 | Show progress                            |

### `compare` - Compare Configurations

Compare different retrieval configurations (e.g., chunk sizes):

```bash
python3 -m evaluation.cli.main compare \
    --dataset /app/data/eval_dataset.json \
    --configs /app/data/configs.json \
    --output /app/data/comparison.json
```

Example `configs.json`:

```json
{
  "baseline": {
    "chunk_size": 1024,
    "chunk_overlap": 250
  },
  "smaller_chunks": {
    "chunk_size": 512,
    "chunk_overlap": 100
  },
  "larger_overlap": {
    "chunk_size": 1024,
    "chunk_overlap": 400
  }
}
```

## Metrics Explained

### Retrieval Metrics

| Metric          | Description                                      | Range  |
| --------------- | ------------------------------------------------ | ------ |
| **Precision@k** | % of top-k retrieved docs that are relevant      | 0-1    |
| **Recall@k**    | % of all relevant docs found in top-k            | 0-1    |
| **MRR**         | Reciprocal rank of first relevant doc (1/rank)   | 0-1    |
| **NDCG@k**      | Normalized ranking quality with graded relevance | 0-1    |
| **Hit Rate@k**  | Did we find ANY relevant doc in top-k?           | 0 or 1 |

### Generation Quality Metrics

| Metric           | Description                                     | Range |
| ---------------- | ----------------------------------------------- | ----- |
| **Relevance**    | Does the answer address the question?           | 0-1   |
| **Completeness** | Does the answer cover all expected information? | 0-1   |
| **Grounding**    | Are statements supported by the sources?        | 0-1   |

### Hallucination Detection

| Metric                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| **Entailed Claims**     | Claims supported by source documents        |
| **Neutral Claims**      | Claims neither supported nor contradicted   |
| **Contradicted Claims** | Claims that contradict source documents     |
| **Hallucination Score** | (contradicted + 0.5×neutral) / total claims |

## Example Output

### Console Summary

```
============================================================
           RAG EVALUATION SUMMARY
============================================================

Total Queries: 150

📊 Retrieval Metrics:
   MRR: 0.8234
   Precision@5: 0.6800
   Avg Latency: 245.3ms

📝 Generation Quality:
   Relevance: 0.8456
   Completeness: 0.7823
   Grounding: 0.8912

🔍 Hallucination Detection:
   Mean Score: 0.1234
   Total Claims: 892
   Claim Support Rate: 78.45%
   Queries w/ Hallucination: 12

============================================================
```

### JSON Output Structure

```json
{
  "timestamp": "2024-01-15T10:30:00",
  "config_name": "evaluation",
  "aggregate": {
    "mean_mrr": 0.8234,
    "mean_precision_at_k": {"1": 0.72, "3": 0.68, "5": 0.65, "10": 0.58},
    "mean_recall_at_k": {"1": 0.24, "3": 0.45, "5": 0.62, "10": 0.78},
    "mean_relevance_score": 0.8456,
    "mean_hallucination_score": 0.1234,
    "total_claims": 892,
    "total_entailed": 700,
    "total_contradicted": 45
  },
  "retrieval_metrics": [...],
  "generation_metrics": [...],
  "hallucination_results": [...]
}
```

## Programmatic Usage

You can also use the evaluation framework programmatically:

```python
import asyncio
from evaluation.core.config import EvaluationConfig
from evaluation.core.runner import EvaluationRunner
from evaluation.client.rag_client import RAGClient
from evaluation.datagen.dataset import EvaluationDataset
from evaluation.output.formatters import print_summary

async def run_eval():
    # Load dataset
    dataset = EvaluationDataset.load("/app/data/eval_dataset.json")

    # Configure
    config = EvaluationConfig(
        rag_url="http://localhost:8000",
        k_values=[1, 3, 5, 10],
    )

    # Run evaluation
    client = RAGClient(base_url=config.rag_url)
    runner = EvaluationRunner(config, client, dataset)

    async with runner:
        result = await runner.run_full_evaluation()

    # Print summary
    print_summary(result)

    return result

result = asyncio.run(run_eval())
```

### Retrieval-Only Evaluation

```python
from evaluation.metrics.retrieval import RetrievalEvaluator

evaluator = RetrievalEvaluator(k_values=[1, 3, 5, 10])

# Evaluate a single query
metrics = evaluator.evaluate_query(
    query="What is the meal rate?",
    retrieved_docs=[{"id": "doc1"}, {"id": "doc2"}, ...],
    relevant_ids={"doc1", "doc3"},  # Ground truth
)

print(f"Precision@5: {metrics.precision_at_k[5]}")
print(f"MRR: {metrics.mrr}")
```

### Hallucination Detection Only

```python
from evaluation.hallucination.detector import HallucinationDetector

detector = HallucinationDetector(
    nli_model="cross-encoder/nli-deberta-v3-small",
    nli_device="cpu",  # or "cuda" for GPU
)

result = await detector.detect(
    query="What is the breakfast rate?",
    answer="The breakfast rate is $15.00 in Canada.",
    sources=["Breakfast allowance: $15.00 CAD for domestic travel..."]
)

print(f"Hallucination Score: {result.hallucination_score}")
print(f"Entailed: {result.entailed_count}")
print(f"Contradicted: {result.contradicted_count}")
for claim in result.flagged_claims:
    print(f"  Flagged: {claim.text}")
```

## Module Structure

```
rag-service/evaluation/
├── __init__.py
├── core/
│   ├── config.py          # EvaluationConfig dataclass
│   ├── results.py         # Result data models
│   └── runner.py          # Main orchestrator
├── metrics/
│   ├── retrieval.py       # Precision@k, Recall@k, MRR, NDCG
│   ├── generation.py      # LLM-as-judge evaluation
│   └── aggregator.py      # Aggregate metrics
├── datagen/
│   ├── dataset.py         # EvaluationDataset class
│   ├── question_types.py  # Prompt templates
│   └── question_generator.py  # Q&A generation
├── hallucination/
│   ├── claim_extractor.py # Extract claims from answers
│   ├── nli_checker.py     # NLI model wrapper
│   └── detector.py        # Complete detection pipeline
├── client/
│   └── rag_client.py      # HTTP client for RAG API
├── cli/
│   └── main.py            # CLI entry point
└── output/
    └── formatters.py      # JSON/CSV/Markdown output
```

## Dependencies

The evaluation framework requires these additional dependencies (already in requirements.txt):

```
transformers>=4.35.0  # For NLI hallucination detection (DeBERTa)
torch>=2.0.0          # For transformer model inference
```

## Tips

1. **Start small**: Generate 10-20 questions first to validate your setup
2. **Use retrieval-only**: For quick iteration, skip generation/hallucination checks
3. **Check flagged claims**: Review the `flagged_claims` in hallucination results to understand what's being hallucinated
4. **Compare configs**: Use the `compare` command to find optimal chunk sizes
5. **GPU acceleration**: Set `nli_device="cuda"` in config for faster hallucination detection
