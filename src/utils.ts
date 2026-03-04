import type { Group } from './types';

export const BASE_RATE = 600;
export const EXTRA_AFTER_FIVE = 110;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftISODate(iso: string, deltaDays: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return toISODate(date);
}

export function formatRuDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

export function monthFromDate(iso: string): string {
  return iso.slice(0, 7);
}

export function incomeForLesson(attendees: number): number {
  return attendees <= 5 ? BASE_RATE : BASE_RATE + (attendees - 5) * EXTRA_AFTER_FIVE;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function firstWeekdayMondayStart(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function prevMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function nextMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function isGroupScheduledOnDate(group: Group, dateIso: string): boolean {
  const [y, m, d] = dateIso.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return group.scheduleWeekdays.includes(day);
}

export function isFutureDate(iso: string): boolean {
  return iso > toISODate(new Date());
}

export function weekdayLabel(day: number): string {
  const map: Record<number, string> = {
    1: 'Пн',
    2: 'Вт',
    3: 'Ср',
    4: 'Чт',
    5: 'Пт',
    6: 'Сб',
    0: 'Вс',
  };
  return map[day] ?? '';
}

export function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  const now = new Date();
  let age = now.getFullYear() - year;
  const notPassed =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (notPassed) age -= 1;
  return age >= 0 ? age : null;
}
