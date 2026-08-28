const ACCESS_TOKEN_KEY = 'hotel_access_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}
