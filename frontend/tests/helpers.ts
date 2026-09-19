import { vi } from "vitest";

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
export const noContent = () => new Response(null, { status: 204 });

type Handler = (init?: RequestInit) => Response | Promise<Response>;

/**
 * Stub fetch with handlers keyed by "METHOD /path" (the path may be a prefix, e.g. "GET /api/drafts/").
 * The longest matching key wins; anything unmatched fails the test loudly.
 */
export function routeFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const match = Object.keys(routes)
      .filter((key) => {
        const [m, path] = key.split(" ");
        return m === method && url.startsWith(path);
      })
      .sort((a, b) => b.length - a.length)[0];
    if (!match) throw new Error(`unexpected fetch ${method} ${url}`);
    return routes[match](init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The JSON body of the n-th fetch call (0-based) that used the given method and URL prefix. */
export function bodyOf(fetchMock: ReturnType<typeof routeFetch>, method: string, prefix: string, n = 0) {
  const calls = fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? "GET") === method && String(url).startsWith(prefix),
  );
  return JSON.parse(String(calls[n][1]?.body));
}
