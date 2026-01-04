/**
 * Centralized service to manage automatic website synchronization.
 * In a professional B2B environment, ensuring the UI is 100% in sync with the 
 * database after a write operation is critical.
 */

export const triggerAutoRefresh = (delayMs: number = 1000) => {
  // Use a slight delay so the user can see the "Success" state/message
  setTimeout(() => {
    window.location.reload();
  }, delayMs);
};

export const syncAndNotify = (message: string) => {
  // Can be expanded to use a global Toast system in the future
  console.log(`[Sparezy Sync]: ${message}`);
  triggerAutoRefresh();
};
