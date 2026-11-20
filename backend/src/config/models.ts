/**
 * Central registry of Groq model IDs.
 *
 * Kept in one place (with env overrides) so a provider deprecation is a
 * one-line change instead of a hunt across the codebase.
 *
 * As of July 2026 Groq flagged `llama-3.3-70b-versatile` for deprecation on the
 * free/developer tier and recommends `openai/gpt-oss-120b`, which is also far
 * more reliable at structured JSON output (fixes `json_validate_failed`).
 */
export const MODELS = {
  // High-quality reasoning: extraction, Q&A, memory/drift analysis.
  chat: process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b',
  // Fast/cheap: translation and lightweight tasks.
  fast: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
  // Speech-to-text.
  transcription: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3',
};
