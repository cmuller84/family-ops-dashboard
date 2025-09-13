import { meals } from './serverActions';

// Normalize weekStart to ensure it's always a Monday
function normalizeWeekStart(s: string): string {
  const [Y, M, D] = s.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export const generateWeek = async (familyId: string, params: any) => {
  const normalizedParams = {
    ...params,
    weekStart: normalizeWeekStart(typeof params.weekStart === 'string' ? params.weekStart : params.weekStart.toISOString().slice(0, 10))
  };
  return meals.generateWeek(familyId, normalizedParams);
};

export default generateWeek;
