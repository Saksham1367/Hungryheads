/**
 * Swiggy MCP client. Brief §9.1–9.3.
 *
 * Phase-1 Step 8 fills this in. For now we expose typed stubs so other modules
 * can import them without compile errors.
 */
import type { SwiggyServer } from "@/types/swiggy";

export function getMcpMode(): "mock" | "live" {
  const mode = process.env.MCP_MODE?.toLowerCase();
  return mode === "live" ? "live" : "mock";
}

export async function getSwiggyClient(_userId: string, _server: SwiggyServer) {
  // Wired in Step 8.
  throw new Error("getSwiggyClient: not implemented yet (Phase-1 Step 8).");
}
