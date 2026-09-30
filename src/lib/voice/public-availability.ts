// Build-time presentation switch; the server independently enforces FLOWW_VOICE_ENABLED.
export const voiceUiEnabled = process.env.NEXT_PUBLIC_FLOWW_VOICE_ENABLED === "true";
