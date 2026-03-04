import type { AppData, Group, Student } from './types';

const STORAGE_KEY = 'choreo_journal_v4';
const LEGACY_KEYS = ['choreo_journal_v3', 'choreo_journal_v2', 'choreo_journal_v1', 'trainer_journal_v1'];

const DEFAULT_GROUPS: Group[] = [
  { id: 'group-1', name: 'Хип хоп начинающие', scheduleWeekdays: [2, 4] },
  { id: 'group-2', name: 'Хип хоп продолжающие', scheduleWeekdays: [2, 4] },
  { id: 'group-3', name: 'Инфенси команда', scheduleWeekdays: [1, 5] },
  { id: 'group-4', name: 'Хип хоп малыши', scheduleWeekdays: [3, 5] },
  { id: 'group-5', name: 'Денс микс 9-13 лет', scheduleWeekdays: [2, 4] },
];

function mergeGroups(input: Group[] | undefined): Group[] {
  if (!input || input.length === 0) return DEFAULT_GROUPS;

  const known = DEFAULT_GROUPS.map((base, index) => {
    const sameId = input.find((item) => item.id === base.id);
    const byIndex = input[index];
    const source = sameId ?? byIndex;

    if (!source) return base;

    return {
      ...base,
      name: source.name?.trim() ? source.name : base.name,
      scheduleWeekdays:
        Array.isArray(source.scheduleWeekdays) && source.scheduleWeekdays.length > 0
          ? source.scheduleWeekdays
          : base.scheduleWeekdays,
    };
  });

  const custom = input.filter((group) => !DEFAULT_GROUPS.some((base) => base.id === group.id));
  return [...known, ...custom];
}

function normalizeStudents(input: unknown): Student[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((student) => student && typeof student === 'object')
    .map((student) => {
      const value = student as Partial<Student>;
      return {
        id: String(value.id ?? crypto.randomUUID()),
        fio: String(value.fio ?? '').trim(),
        groupId: String(value.groupId ?? ''),
        createdAt: String(value.createdAt ?? new Date().toISOString()),
        birthDate: value.birthDate ?? null,
        archived: Boolean(value.archived),
      };
    })
    .filter((student) => student.fio.length > 0);
}

function createFromParsed(parsed: Partial<AppData>): AppData {
  return {
    groups: mergeGroups(parsed.groups),
    students: normalizeStudents(parsed.students),
    attendance: parsed.attendance ?? {},
    extraAttendance: parsed.extraAttendance ?? {},
    cancellations: parsed.cancellations ?? {},
    conducted: parsed.conducted ?? {},
  };
}

function readRawByKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function createDefaultData(): AppData {
  return {
    groups: DEFAULT_GROUPS,
    students: [],
    attendance: {},
    extraAttendance: {},
    cancellations: {},
    conducted: {},
  };
}

export function loadData(): AppData {
  try {
    const rawCurrent = readRawByKey(STORAGE_KEY);

    if (rawCurrent) {
      const parsed = JSON.parse(rawCurrent) as Partial<AppData>;
      return createFromParsed(parsed);
    }

    for (const legacyKey of LEGACY_KEYS) {
      const rawLegacy = readRawByKey(legacyKey);
      if (!rawLegacy) continue;

      const parsedLegacy = JSON.parse(rawLegacy) as Partial<AppData>;
      const migrated = createFromParsed(parsedLegacy);

      // Persist migration so the app stops depending on legacy keys.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
