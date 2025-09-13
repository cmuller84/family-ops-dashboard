// src/lib/migrations/migrateTasklogs.ts
// Move legacy per-task entries from routine_logs with id 'tasklog_{rid}_{idx}_{YYYY-MM-DD}'
// into routine_task_logs (routine_id, task_index, date, checked).

import blink from '@/blink/client'

const TASKLOG_PREFIX = "tasklog_";

// Parse helper
function parseTasklogId(id: string) {
  // tasklog_{routineId}_{taskIndex}_{YYYY-MM-DD}
  const parts = id.split("_");
  if (parts.length < 4) return null;
  const routineId = parts[1];
  const taskIndex = Number(parts[2]);
  const date = parts.slice(3).join("_"); // in case date had underscores (unlikely)
  if (!routineId || Number.isNaN(taskIndex)) return null;
  return { routineId, taskIndex, date };
}

export const migratePerTaskLogs = async () => {
  // 1) Find legacy routine_logs with id starting tasklog_
  const legacy = await blink.db.routineLogs.list({
    where: { 
      id: { startsWith: TASKLOG_PREFIX } 
    }
  });

  let created = 0, updated = 0, deleted = 0;
  for (const row of legacy) {
    const parsed = parseTasklogId(row.id);
    if (!parsed) continue;

    const { routineId, taskIndex, date } = parsed;

    // 2) Upsert into routine_task_logs
    const destId = `tasklog_${routineId}_${taskIndex}_${date}`;
    try {
      const existing = await blink.db.routineTaskLogs.list({
        where: { id: destId }
      });

      if (existing.length === 0) {
        await blink.db.routineTaskLogs.create({
          id: destId,
          routineId: routineId,
          taskIndex: taskIndex,
          date,
          // legacy didn't store per-task checked consistently; best-effort:
          checked: (row as any).checked ? "1" : "0"
        });
        created++;
      } else {
        // optional: bring legacy 'checked' if present
        const existingLog = existing[0];
        if ((row as any).checked !== undefined &&
            existingLog.checked !== ((row as any).checked ? "1" : "0")) {
          await blink.db.routineTaskLogs.update(destId, {
            checked: (row as any).checked ? "1" : "0"
          });
          updated++;
        }
      }

      // 3) Delete legacy record (safe to keep if you prefer)
      await blink.db.routineLogs.delete(row.id);
      deleted++;
    } catch (error) {
      console.error(`Failed to migrate tasklog ${row.id}:`, error);
    }
  }

  return { ok: true, created, updated, deleted };
};