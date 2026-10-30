export const UNREACHABLE =
  "Can't reach the Copilot server. Check that the laptop running the app is on and that this device is on the same network.";

/** fetch() that turns a network failure into a message an operator can act on. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new Error(UNREACHABLE);
  }
}

type JsonBody = { error?: { message?: string } } & Record<string, unknown>;

/** Parses a JSON body, or returns null when a proxy answered with HTML or nothing. */
export async function readJson(response: Response): Promise<JsonBody | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readJson(response);
  if (!response.ok || !data) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data as T;
}

export async function upload<T>(url: string, form: FormData): Promise<T> {
  const response = await request(url, { method: "POST", body: form });
  const data = await readJson(response);
  if (!response.ok || !data) throw new Error(data?.error?.message ?? "Something went wrong.");
  return data as T;
}
