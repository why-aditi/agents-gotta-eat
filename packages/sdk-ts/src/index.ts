import { HealthResponse } from "@gottaeat/schemas";

export function createClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  return {
    async health(): Promise<HealthResponse> {
      const res = await fetchImpl(`${baseUrl}/health`);
      if (!res.ok) throw new Error(`GET /health failed: ${res.status}`);
      return HealthResponse.parse(await res.json());
    },
  };
}
