const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL is not set. Add it to frontend/.env');
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class PendingApprovalError extends ApiError {
  readonly pendingApproval = true as const;

  constructor(message: string) {
    super(message, 202);
    this.name = 'PendingApprovalError';
  }
}

export function isPendingApprovalError(
  err: unknown,
): err is PendingApprovalError {
  return err instanceof PendingApprovalError;
}

function isPendingApprovalResponse(
  value: unknown,
): value is { pendingApproval: true; message?: string } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as { pendingApproval?: unknown }).pendingApproval === true
  );
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

type ErrorBody = {
  message?: string | string[];
};

function resolveErrorMessage(status: number, body?: ErrorBody): string {
  const backendMessage = Array.isArray(body?.message)
    ? body.message.join(', ')
    : typeof body?.message === 'string'
      ? body.message
      : undefined;

  if (backendMessage) return backendMessage;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'The requested record was not found.';
  return 'The request could not be completed.';
}

export function toQueryString(
  params: Record<string, string | number | boolean | null | undefined> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  const parsed = raw
    ? (JSON.parse(raw) as T | ErrorBody)
    : undefined;

  if (!response.ok) {
    throw new ApiError(
      resolveErrorMessage(response.status, parsed as ErrorBody | undefined),
      response.status,
    );
  }

  if (isPendingApprovalResponse(parsed)) {
    throw new PendingApprovalError(
      parsed.message?.trim() ||
        'Change submitted for Super Admin approval. The record was not modified.',
    );
  }

  return parsed as T;
}
