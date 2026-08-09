const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export type Role = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
export type Session = { token: string; user: { name: string; email: string; role: Role } };

function handleUnauthorized(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem('stockflow-session');
    window.dispatchEvent(new Event('stockflow-auth-expired'));
  }
}

export async function api<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  handleUnauthorized(response);
  if (!response.ok) throw new Error((await response.json().catch(() => ({ message: 'Request failed.' }))).message);
  return response.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, token: string, method: 'POST' | 'PATCH' | 'PUT', body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  handleUnauthorized(response);
  const payload = await response.json().catch(() => ({ message: 'Request failed.' }));
  if (!response.ok) throw new Error(payload.message ?? 'Request failed.');
  return payload as T;
}

export async function downloadFile(path: string, token: string, filename: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  handleUnauthorized(response);
  if (!response.ok) throw new Error((await response.json().catch(() => ({ message: 'Download failed.' }))).message);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Unable to sign in.');
  return payload as Session;
}
