/**
 * Live POS API only — no mock room catalogs.
 * Mock mode only when explicitly enabled.
 */
const apiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:3000';
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

export function isMockMode() {
  return useMock;
}

export function getApiBase() {
  return apiBase;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (useMock) {
    throw new Error('Mock mode is enabled; live POS API calls are disabled.');
  }
  if (!apiBase) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  }
  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
    // Always revalidate unit lists so POS changes show up
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail = `API error ${response.status} for ${path}`;
    try {
      const body = (await response.json()) as {
        message?: string | string[];
      };
      if (Array.isArray(body.message)) detail = body.message.join(', ');
      else if (body.message) detail = body.message;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}
