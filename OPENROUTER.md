# OpenRouter API Reference

OpenRouter provides a unified API to access 200+ LLMs from various providers. It's **OpenAI-compatible**, meaning you can use the OpenAI SDK with a different base URL.

---

## Chat Completions API

**POST** `https://openrouter.ai/api/v1/chat/completions`

### Authentication

Requires an API key in the `Authorization` header:

```bash
Authorization: Bearer sk-or-v1-xxxxx
```

Get your API key at: https://openrouter.ai/keys

### Required Headers

| Header          | Required    | Description                                              |
| --------------- | ----------- | -------------------------------------------------------- |
| `Authorization` | Yes         | Bearer token with API key                                |
| `HTTP-Referer`  | Recommended | Your app URL (for attribution on openrouter.ai/activity) |
| `X-Title`       | Recommended | Your app name (shows in OpenRouter dashboard)            |

### Example Request

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "HTTP-Referer: https://your-app.com" \
  -H "X-Title: Your App Name" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Using with OpenAI SDK (Node.js)

```javascript
import OpenAI from 'openai';

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://your-app.com',
    'X-Title': 'Your App Name',
  },
});

const response = await openrouter.chat.completions.create({
  model: 'meta-llama/llama-3.1-70b-instruct',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

---

## Using with LangChain (Python)

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    model="meta-llama/llama-3.1-70b-instruct",
    default_headers={
        "HTTP-Referer": "https://your-app.com",
        "X-Title": "Your App Name"
    }
)

response = await llm.ainvoke([HumanMessage(content="Hello!")])
```

---

## Model List API

**GET** `https://openrouter.ai/api/v1/models`

No authentication required for this endpoint.

### Example Request

```bash
curl https://openrouter.ai/api/v1/models
```

## Response Schema

Each model object contains:

| Field                  | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| `id`                   | Model identifier (e.g., `openai/gpt-4`, `meta-llama/llama-3-70b`)                 |
| `name`                 | Human-readable name                                                               |
| `description`          | Model description                                                                 |
| `context_length`       | Maximum context window                                                            |
| `hugging_face_id`      | HuggingFace model ID (empty for proprietary models)                               |
| `architecture`         | Object with `modality`, `input_modalities`, `output_modalities`, `tokenizer`      |
| `pricing`              | Cost per token (`prompt`, `completion`, `request`, `image`)                       |
| `top_provider`         | Provider info including `context_length`, `max_completion_tokens`, `is_moderated` |
| `supported_parameters` | List of supported API parameters                                                  |

## Filtering Open Source vs Proprietary Models

OpenRouter does not provide a direct API parameter to filter by license type. However, the `hugging_face_id` field can be used as a reliable proxy:

- **Open-source models**: Have a populated `hugging_face_id` (weights hosted on HuggingFace)
- **Proprietary models**: Have an empty `hugging_face_id` (`""`)

### Get Open Source Models Only

```bash
curl -s "https://openrouter.ai/api/v1/models" | \
  jq '[.data[] | select(.hugging_face_id != "") | {id, name, hugging_face_id}]'
```

### Get Proprietary Models Only

```bash
curl -s "https://openrouter.ai/api/v1/models" | \
  jq '[.data[] | select(.hugging_face_id == "") | {id, name}]'
```

### Count Models by Type

```bash
curl -s "https://openrouter.ai/api/v1/models" | \
  jq '{
    open_source: [.data[] | select(.hugging_face_id != "")] | length,
    proprietary: [.data[] | select(.hugging_face_id == "")] | length
  }'
```

## Model Variants

Models can have special suffixes that modify behavior:

| Variant     | Description                                    |
| ----------- | ---------------------------------------------- |
| `:free`     | Free tier with low rate limits                 |
| `:extended` | Extended context length                        |
| `:exacto`   | OpenRouter-curated high-quality endpoints only |
| `:thinking` | Model supports reasoning by default            |
| `:nitro`    | Providers sorted by throughput (faster)        |
| `:floor`    | Providers sorted by price (cheapest)           |

---

## Recommended Models for RAG

### Fast Models (Cost-efficient, quick responses)

| Model ID                           | Context | Notes                           |
| ---------------------------------- | ------- | ------------------------------- |
| `meta-llama/llama-3.1-8b-instruct` | 128k    | Great for query expansion, HyDE |
| `mistralai/mistral-7b-instruct`    | 32k     | Fast, reliable                  |
| `qwen/qwen-2.5-7b-instruct`        | 128k    | Strong multilingual             |
| `google/gemma-2-9b-it`             | 8k      | Google's efficient model        |

### Smart Models (Higher accuracy, complex reasoning)

| Model ID                            | Context | Notes                       |
| ----------------------------------- | ------- | --------------------------- |
| `meta-llama/llama-3.1-70b-instruct` | 128k    | Excellent for RAG responses |
| `meta-llama/llama-3.3-70b-instruct` | 128k    | Latest Llama, best quality  |
| `qwen/qwen-2.5-72b-instruct`        | 128k    | Strong reasoning            |
| `mistralai/mixtral-8x22b-instruct`  | 64k     | MoE architecture            |
| `deepseek/deepseek-chat`            | 64k     | Strong coding/reasoning     |

### Free Tier Models (`:free` suffix)

These have rate limits but no cost:

- `meta-llama/llama-3.1-8b-instruct:free`
- `qwen/qwen-2.5-7b-instruct:free`
- `google/gemma-2-9b-it:free`

---

## Streaming Support

OpenRouter supports SSE streaming like OpenAI:

```javascript
const stream = await openrouter.chat.completions.create({
  model: 'meta-llama/llama-3.1-70b-instruct',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

---

## Error Handling

| Status | Meaning                             |
| ------ | ----------------------------------- |
| 400    | Bad request (invalid model, params) |
| 401    | Invalid API key                     |
| 402    | Insufficient credits                |
| 429    | Rate limited                        |
| 502    | Model provider error (retry)        |

---

## References

- [OpenRouter Models Browser](https://openrouter.ai/models)
- [OpenRouter API Reference](https://openrouter.ai/docs/api-reference)
- [OpenRouter Pricing](https://openrouter.ai/models?order=pricing-low-to-high)
