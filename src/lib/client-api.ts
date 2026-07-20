export async function postJson<TResponse>(
  url: string,
  body: unknown,
  init?: RequestInit
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; [key: string]: unknown }
    | null;

  if (!response.ok) {
    const error = new Error(payload?.message ?? "La requête a échoué.") as Error & {
      status?: number;
      payload?: typeof payload;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as TResponse;
}
