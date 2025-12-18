I've updated the configuration to include the latest Gemini models.

**Changes made:**

1.  **Updated Model List (`src/constants/models.ts`):**
    *   Added **Gemini 3 Pro** (Multimodal, Agentic)
    *   Added **Gemini 3 Flash Preview** (Frontier performance, low cost)
    *   Added **Gemini 2.5 Flash** (Stable release)
    *   Added **Gemini 2.5 Flash Lite** (Cost-effective)
    *   Kept **Gemini 2.5 Pro** (Stable)
    *   Removed deprecated preview versions.

2.  **Backend Logic (`server/controllers/chatController.js`):**
    *   Fixed the legacy `/api/gemini/generateContent` endpoint to respect the `model` parameter sent from the client instead of using a hardcoded value.
    *   Updated the validation schema (`server/routes/schemas/chatSchemas.js`) to allow the `model` field.

3.  **Client API (`src/api/gemini.ts`):**
    *   Updated the default model to the stable `gemini-2.5-flash`.

4.  **Linting:**
    *   Fixed `eslint.config.js` to properly ignore the Python virtual environment in `rag-service/.venv`.

You can now select these new Gemini models from the **Config > LLM Model** tab.
