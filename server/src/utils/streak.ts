import { IUser } from '../models/User.js';

/**
 * Update user's lastActiveDate and streak based on calendar-day logic.
 * Same day → no change. Yesterday → +1. Older or null → reset to 1.
 * Call when user completes a lesson or performs a learning action.
 */
export function updateStreakAndLastActive(user: IUser): void {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let lastActive: Date | null = null;
  if (user.lastActiveDate) {
    lastActive = new Date(user.lastActiveDate);
    lastActive.setHours(0, 0, 0, 0);
  }

  if (!lastActive) {
    user.streak = 1;
    user.currentStreakStart = today;
  } else {
    const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 0) {
      // Same day: do not change streak
    } else if (daysDiff === 1) {
      user.streak = (user.streak || 0) + 1;
    } else {
      user.streak = 1;
      user.currentStreakStart = today;
    }
  }
  user.lastActiveDate = now;
}
