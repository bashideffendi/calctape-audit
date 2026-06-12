/**
 * Registry model AI — dipakai server (route) & client (selector UI).
 * 2 provider × 2 tier = 4 pilihan.
 */

export type AiProvider = "gemini" | "claude";
export type AiTier = "fast" | "pro";

export interface AiModelInfo {
  id: string; // model id yang dikirim ke API
  provider: AiProvider;
  tier: AiTier;
  label: string; // tampil di UI
  note: string; // deskripsi singkat
  envKey: string; // nama env var key-nya
}

export const AI_MODELS: AiModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    tier: "fast",
    label: "Gemini 2.5 Flash",
    note: "Cepat & murah · default",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    tier: "pro",
    label: "Gemini 2.5 Pro",
    note: "Lebih teliti, agak lambat",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "claude-sonnet-4-6",
    provider: "claude",
    tier: "fast",
    label: "Claude Sonnet 4.6",
    note: "Seimbang, disiplin format",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "claude-opus-4-8",
    provider: "claude",
    tier: "pro",
    label: "Claude Opus 4.8",
    note: "Paling pinter, paling mahal",
    envKey: "ANTHROPIC_API_KEY",
  },
];

export const DEFAULT_MODEL_ID = "gemini-2.5-flash";

export function getModel(id: string): AiModelInfo | undefined {
  return AI_MODELS.find((m) => m.id === id);
}
