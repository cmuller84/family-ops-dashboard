import { afterAll, beforeAll, expect, test } from 'vitest';
import { seedFamilyWeek, cleanupFamily } from './helpers';
import { generateWeek } from '../src/lib/generateWeek';
import blink from '../src/blink/client';

let familyId: string;
let listId: string;

beforeAll(async () => {
  const seeded = await seedFamilyWeek();
  familyId = seeded.familyId;
  const res = await generateWeek(familyId, { weekStart: seeded.weekStart, dietPrefs: { diet:null, allergies:[], budget:null, timePerMeal:null } });
  listId = res.listId;
});

afterAll(async () => {
  await cleanupFamily(familyId);
});

test('grocery list item toggles on/off and persists', async () => {
  const items = await blink.db.listItems.list({ where: { listId } });
  expect(items.length).toBeGreaterThan(0);

  const first = items[0];
  // Toggle on
  await blink.db.listItems.update(first.id, { checked: "1" });
  const a = await blink.db.listItems.list({ where: { id: first.id } });
  expect(a[0]?.checked).toBe("1");

  // Toggle off
  await blink.db.listItems.update(first.id, { checked: "0" });
  const b = await blink.db.listItems.list({ where: { id: first.id } });
  expect(b[0]?.checked).toBe("0");
}, 20_000);