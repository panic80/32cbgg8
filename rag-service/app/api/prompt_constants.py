"""Shared prompt snippets for chat endpoints."""

SHORT_ANSWER_PROMPT = (
    "Short Answer Mode is active. Follow these rules strictly:\n"
    "- Keep the main narrative to no more than five sentences.\n"
    "- Focus on the key facts the member needs without filler.\n"
    "- When structured values or comparisons are available, include a single compact markdown table summarizing them. If none exist, skip the table.\n"
    "- If authoritative sources are available, add a `References` section listing their titles or canonical URLs. Never use numbered labels like 'Source 1'.\n"
    "- Continue to follow all other policy assistant rules and formatting requirements."
)
