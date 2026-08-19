// Free, self-hosted "gamification" — points and badges stored directly on the
// User document. No external service; just simple thresholds checked on each
// completion/check-in.

const PRIORITY_POINTS = { low: 5, normal: 10, high: 15 };

const TASK_BADGES = [
  { key: 'first_task', threshold: 1, label: 'First Task Done' },
  { key: 'tasks_10', threshold: 10, label: '10 Tasks Done' },
  { key: 'tasks_50', threshold: 50, label: '50 Tasks Done' },
  { key: 'tasks_100', threshold: 100, label: '100 Tasks Done' },
];

const STREAK_BADGES = [
  { key: 'streak_7', threshold: 7, label: '7-Day Streak' },
  { key: 'streak_30', threshold: 30, label: '30-Day Streak' },
  { key: 'streak_100', threshold: 100, label: '100-Day Streak' },
];

export const BADGE_LABELS = Object.fromEntries(
  [...TASK_BADGES, ...STREAK_BADGES].map((b) => [b.key, b.label])
);

function newlyEarned(defs, value, existingBadges) {
  return defs.filter((b) => value >= b.threshold && !existingBadges.includes(b.key));
}

// Called when a reminder (task) is marked completed. totalCompleted is the
// user's all-time completed-task count, computed by the caller.
export async function awardTaskCompletion(user, { priority, totalCompleted }) {
  const pointsAdded = PRIORITY_POINTS[priority] || PRIORITY_POINTS.normal;
  const earned = newlyEarned(TASK_BADGES, totalCompleted, user.badges || []);
  user.points = (user.points || 0) + pointsAdded;
  if (earned.length > 0) {
    user.badges = [...(user.badges || []), ...earned.map((b) => b.key)];
  }
  await user.save();
  return { pointsAdded, newBadges: earned.map((b) => ({ key: b.key, label: b.label })) };
}

// Called on a habit check-in with the reminder's updated streak value.
export async function awardHabitStreak(user, streak) {
  const earned = newlyEarned(STREAK_BADGES, streak, user.badges || []);
  const pointsAdded = earned.length > 0 ? 20 * earned.length : 5;
  user.points = (user.points || 0) + pointsAdded;
  if (earned.length > 0) {
    user.badges = [...(user.badges || []), ...earned.map((b) => b.key)];
  }
  await user.save();
  return { pointsAdded, newBadges: earned.map((b) => ({ key: b.key, label: b.label })) };
}
