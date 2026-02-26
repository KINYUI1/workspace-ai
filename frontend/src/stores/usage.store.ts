import { create } from 'zustand';

interface UsageState {
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionInputTokens: number;
  sessionOutputTokens: number;
  callCount: number;

  addUsage: (inputTokens: number, outputTokens: number) => void;
  resetSession: () => void;
  getEstimatedCost: () => number;
}

// Approximate pricing per million tokens (Claude Sonnet)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

export const useUsageStore = create<UsageState>((set, get) => ({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  sessionInputTokens: 0,
  sessionOutputTokens: 0,
  callCount: 0,

  addUsage: (inputTokens, outputTokens) => {
    const state = get();
    set({
      totalInputTokens: state.totalInputTokens + inputTokens,
      totalOutputTokens: state.totalOutputTokens + outputTokens,
      sessionInputTokens: state.sessionInputTokens + inputTokens,
      sessionOutputTokens: state.sessionOutputTokens + outputTokens,
      callCount: state.callCount + 1,
    });
  },

  resetSession: () => set({ sessionInputTokens: 0, sessionOutputTokens: 0 }),

  getEstimatedCost: () => {
    const { totalInputTokens, totalOutputTokens } = get();
    return (
      (totalInputTokens / 1_000_000) * INPUT_COST_PER_M +
      (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_M
    );
  },
}));
