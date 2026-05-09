/**
 * The three agent modes — Hungry / Diet / Budget.
 * Names + dot colors match the design system prototype.
 */
import type { ChatMode } from "@/types/domain";

export interface ChatModeMeta {
  id: ChatMode;
  label: string;
  short: "H" | "D" | "B";
  dotClass: string;          // background-color utility for the picker dot
  tagClass: string;          // background + text for sidebar mode tag
  hint: string;              // text shown beneath composer
  suggestions: string[];     // suggestion pills above composer
}

export const CHAT_MODES: Record<ChatMode, ChatModeMeta> = {
  hungry: {
    id: "hungry",
    label: "Hungry",
    short: "H",
    dotClass: "bg-hh-orange",
    tagClass: "bg-hh-orange-light text-hh-orange-dark",
    hint: "I remember your taste, allergies and orders",
    suggestions: [
      "🍛 Late-night biryani under ₹400",
      "🔄 Reorder my Sunday breakfast",
      "🌧️ Rainy-day comfort food",
      "📍 Try something new near me",
    ],
  },
  diet: {
    id: "diet",
    label: "Diet",
    short: "D",
    dotClass: "bg-hh-success",
    tagClass: "bg-emerald-50 text-emerald-700",
    hint: "Allergens flagged on every reply, macros surfaced where I can",
    suggestions: [
      "🥗 Post-workout high-protein lunch",
      "🥑 Keto-friendly takeout",
      "🚫 Something light, no dairy",
      "⚖️ Macro-balanced dinner",
    ],
  },
  budget: {
    id: "budget",
    label: "Budget",
    short: "B",
    dotClass: "bg-hh-info",
    tagClass: "bg-blue-50 text-blue-700",
    hint: "Every reply leads with spend impact and cheaper swaps",
    suggestions: [
      "💸 Cap dinner spend at ₹250",
      "📉 Why did Nov spend jump?",
      "🎯 Cheapest dinner today",
      "📊 Show this week's spend",
    ],
  },
};

export const CHAT_MODE_LIST: ChatModeMeta[] = [
  CHAT_MODES.hungry,
  CHAT_MODES.diet,
  CHAT_MODES.budget,
];

export function isChatMode(v: string): v is ChatMode {
  return v === "hungry" || v === "diet" || v === "budget";
}
