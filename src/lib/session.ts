let currentUserId: string | null = null;

export function setCurrentUserId(id: string | null) {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function requireUserId(): string {
  if (!currentUserId) {
    throw new Error("Немає активного користувача — спочатку увійдіть у застосунок.");
  }
  return currentUserId;
}
