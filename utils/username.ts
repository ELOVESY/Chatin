export function getUsername(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('chat.username');
}

export function setUsername(u: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('chat.username', u);
}


