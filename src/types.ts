export type ViewName = 'journal' | 'reports' | 'students' | 'groups';

export interface Group {
  id: string;
  name: string;
  scheduleWeekdays: number[];
}

export interface Student {
  id: string;
  fio: string;
  groupId: string;
  createdAt: string;
  birthDate: string | null;
  archived: boolean;
}

export type AttendanceByGroup = Record<string, Record<string, string[]>>;
export type CancellationsByGroup = Record<string, Record<string, boolean>>;
export type ConductedByGroup = Record<string, Record<string, boolean>>;
export type ExtraByGroup = Record<string, Record<string, string[]>>;

export interface AppData {
  groups: Group[];
  students: Student[];
  attendance: AttendanceByGroup;
  extraAttendance: ExtraByGroup;
  cancellations: CancellationsByGroup;
  conducted: ConductedByGroup;
}
