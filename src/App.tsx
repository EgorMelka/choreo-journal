import { useEffect, useMemo, useState } from 'react';
import { createDefaultData, loadData, saveData } from './storage';
import type { AppData, Group, Student, ViewName } from './types';
import {
  ageFromBirthDate,
  daysInMonth,
  firstWeekdayMondayStart,
  formatMoney,
  formatRuDate,
  incomeForLesson,
  isFutureDate,
  monthFromDate,
  nextMonth,
  prevMonth,
  shiftISODate,
  toISODate,
  weekdayLabel,
} from './utils';

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

function normalizeFio(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
}

function getMapIds(map: Record<string, Record<string, string[]>>, groupId: string, date: string): string[] {
  return map[groupId]?.[date] ?? [];
}

function monthOptions(data: AppData, fallbackMonth: string): string[] {
  const months = new Set<string>([fallbackMonth]);

  [data.attendance, data.extraAttendance, data.cancellations, data.conducted].forEach((bucket) => {
    Object.values(bucket).forEach((datesMap) => {
      Object.keys(datesMap).forEach((date) => months.add(monthFromDate(date)));
    });
  });

  return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
}

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<ViewName>('journal');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [activeGroupId, setActiveGroupId] = useState(() => loadData().groups[0]?.id ?? '');
  const [newStudentFio, setNewStudentFio] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDays, setNewGroupDays] = useState<number[]>([]);
  const [journalSearchOpen, setJournalSearchOpen] = useState(false);
  const [journalSearch, setJournalSearch] = useState('');
  const [studentsSearch, setStudentsSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => monthFromDate(toISODate(new Date())));
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentCardMonth, setStudentCardMonth] = useState(() => monthFromDate(toISODate(new Date())));

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (data.groups.length === 0) {
      setData(createDefaultData());
      return;
    }

    if (!data.groups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(data.groups[0].id);
    }
  }, [data, activeGroupId]);

  const activeGroup = useMemo(
    () => data.groups.find((group) => group.id === activeGroupId) ?? data.groups[0],
    [data.groups, activeGroupId]
  );

  const availableMonths = useMemo(() => monthOptions(data, reportMonth), [data, reportMonth]);

  const studentsInActiveGroup = useMemo(() => {
    const term = journalSearch.trim().toLowerCase();
    const raw = data.students.filter((student) => student.groupId === activeGroup?.id && !student.archived);
    const filtered = term ? raw.filter((student) => student.fio.toLowerCase().includes(term)) : raw;
    return filtered.sort((a, b) => a.fio.localeCompare(b.fio, 'ru'));
  }, [data.students, activeGroup?.id, journalSearch]);

  const attendeesForActiveGroup = useMemo(
    () => (activeGroup ? getMapIds(data.attendance, activeGroup.id, selectedDate) : []),
    [data.attendance, activeGroup, selectedDate]
  );

  const extraForActiveGroup = useMemo(
    () => (activeGroup ? getMapIds(data.extraAttendance, activeGroup.id, selectedDate) : []),
    [data.extraAttendance, activeGroup, selectedDate]
  );

  const isCancelledToday = activeGroup
    ? Boolean(data.cancellations[activeGroup.id]?.[selectedDate])
    : false;

  const isFutureLessonDate = isFutureDate(selectedDate);
  const isConductedToday =
    activeGroup && !isCancelledToday && !isFutureLessonDate
      ? Boolean(data.conducted[activeGroup.id]?.[selectedDate])
      : false;

  const activeGroupIncome = useMemo(() => {
    if (!isConductedToday || !activeGroup) return 0;
    const mainIncome = incomeForLesson(attendeesForActiveGroup.length);
    const extraIncome = extraForActiveGroup.length > 0 ? incomeForLesson(extraForActiveGroup.length) : 0;
    return mainIncome + extraIncome;
  }, [attendeesForActiveGroup.length, extraForActiveGroup.length, isConductedToday, activeGroup]);

  const reports = useMemo(() => {
    const todayIso = toISODate(new Date());

    const rows = data.groups.map((group) => {
      const conductedDatesMap = data.conducted[group.id] ?? {};
      const cancelledMap = data.cancellations[group.id] ?? {};

      const heldDates = Object.keys(conductedDatesMap)
        .filter((date) => date.startsWith(reportMonth) && date <= todayIso && !cancelledMap[date])
        .sort();

      let income = 0;
      let lessonsCount = 0;
      let attendeesTotal = 0;

      heldDates.forEach((date) => {
        const mainCount = data.attendance[group.id]?.[date]?.length ?? 0;
        const extraCount = data.extraAttendance[group.id]?.[date]?.length ?? 0;

        income += incomeForLesson(mainCount);
        lessonsCount += 1;
        attendeesTotal += mainCount;

        if (extraCount > 0) {
          income += incomeForLesson(extraCount);
          lessonsCount += 1;
          attendeesTotal += extraCount;
        }
      });

      const avgAttendees = lessonsCount > 0 ? attendeesTotal / lessonsCount : 0;

      return {
        group,
        income,
        lessonsCount,
        avgAttendees,
      };
    });

    const totalIncome = rows.reduce((sum, row) => sum + row.income, 0);
    const totalLessons = rows.reduce((sum, row) => sum + row.lessonsCount, 0);
    const totalAvg =
      totalLessons > 0
        ? rows.reduce((sum, row) => sum + row.avgAttendees * row.lessonsCount, 0) / totalLessons
        : 0;

    return { rows, totalIncome, totalLessons, totalAvg };
  }, [data.attendance, data.extraAttendance, data.cancellations, data.conducted, data.groups, reportMonth]);

  const studentsList = useMemo(() => {
    const term = studentsSearch.trim().toLowerCase();
    const base = data.students.filter((student) => showArchived || !student.archived);
    const filtered = term ? base.filter((student) => student.fio.toLowerCase().includes(term)) : base;
    return filtered.sort((a, b) => a.fio.localeCompare(b.fio, 'ru'));
  }, [data.students, studentsSearch, showArchived]);

  const selectedStudent = selectedStudentId
    ? data.students.find((student) => student.id === selectedStudentId) ?? null
    : null;

  const selectedStudentDates = useMemo(() => {
    if (!selectedStudent) return [];
    const groupDates = data.attendance[selectedStudent.groupId] ?? {};

    return Object.entries(groupDates)
      .filter(([, attendeeIds]) => attendeeIds.includes(selectedStudent.id))
      .map(([date]) => date)
      .sort((a, b) => (a < b ? 1 : -1));
  }, [data.attendance, selectedStudent]);

  const selectedStudentDateSet = useMemo(() => new Set(selectedStudentDates), [selectedStudentDates]);

  const calendarDays = useMemo(() => {
    const count = daysInMonth(studentCardMonth);
    const offset = firstWeekdayMondayStart(studentCardMonth);
    const days: Array<number | null> = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= count; day += 1) days.push(day);
    return days;
  }, [studentCardMonth]);

  function updateData(mutator: (prev: AppData) => AppData) {
    setData((prev) => mutator(prev));
  }

  function setBooleanMapValue(
    map: Record<string, Record<string, boolean>>,
    groupId: string,
    date: string,
    nextValue: boolean
  ) {
    const groupMap = map[groupId] ?? {};
    const nextGroupMap = { ...groupMap };
    if (nextValue) nextGroupMap[date] = true;
    else delete nextGroupMap[date];
    return { ...map, [groupId]: nextGroupMap };
  }

  function toggleLessonCancelled(groupId: string, cancelled: boolean) {
    updateData((prev) => ({
      ...prev,
      cancellations: setBooleanMapValue(prev.cancellations, groupId, selectedDate, cancelled),
      conducted: cancelled
        ? setBooleanMapValue(prev.conducted, groupId, selectedDate, false)
        : prev.conducted,
    }));
  }

  function toggleLessonConducted(groupId: string, conducted: boolean) {
    if (isFutureLessonDate) return;
    updateData((prev) => ({
      ...prev,
      conducted: setBooleanMapValue(prev.conducted, groupId, selectedDate, conducted),
      cancellations: conducted
        ? setBooleanMapValue(prev.cancellations, groupId, selectedDate, false)
        : prev.cancellations,
    }));
  }

  function updateIdsMap(
    map: Record<string, Record<string, string[]>>,
    groupId: string,
    date: string,
    id: string,
    checked: boolean
  ) {
    const groupRecords = map[groupId] ?? {};
    const current = groupRecords[date] ?? [];
    const nextSet = new Set(current);
    if (checked) nextSet.add(id);
    else nextSet.delete(id);

    return {
      ...map,
      [groupId]: {
        ...groupRecords,
        [date]: Array.from(nextSet),
      },
    };
  }

  function toggleAttendance(groupId: string, studentId: string, checked: boolean) {
    if (!isConductedToday) return;

    updateData((prev) => ({
      ...prev,
      attendance: updateIdsMap(prev.attendance, groupId, selectedDate, studentId, checked),
      extraAttendance: !checked
        ? updateIdsMap(prev.extraAttendance, groupId, selectedDate, studentId, false)
        : prev.extraAttendance,
    }));
  }

  function toggleExtraAttendance(groupId: string, studentId: string, checked: boolean) {
    if (!isConductedToday) return;

    updateData((prev) => {
      const wasPresent = (prev.attendance[groupId]?.[selectedDate] ?? []).includes(studentId);
      const attendance = wasPresent
        ? prev.attendance
        : updateIdsMap(prev.attendance, groupId, selectedDate, studentId, true);

      return {
        ...prev,
        attendance,
        extraAttendance: updateIdsMap(prev.extraAttendance, groupId, selectedDate, studentId, checked),
      };
    });
  }

  function addStudentToGroup() {
    if (!activeGroup) return;

    const fio = normalizeFio(newStudentFio);
    if (!fio) {
      alert('Введите ФИО ученика');
      return;
    }

    updateData((prev) => ({
      ...prev,
      students: [
        ...prev.students,
        {
          id: crypto.randomUUID(),
          fio,
          groupId: activeGroup.id,
          createdAt: new Date().toISOString(),
          birthDate: null,
          archived: false,
        },
      ],
    }));

    setNewStudentFio('');
  }

  function archiveStudent(student: Student) {
    updateData((prev) => ({
      ...prev,
      students: prev.students.map((item) =>
        item.id === student.id ? { ...item, archived: !item.archived } : item
      ),
    }));
  }

  function updateStudent(studentId: string, patch: Partial<Student>) {
    updateData((prev) => ({
      ...prev,
      students: prev.students.map((student) =>
        student.id === studentId ? { ...student, ...patch } : student
      ),
    }));
  }

  function addGroup() {
    const name = normalizeFio(newGroupName);
    if (!name) {
      alert('Введите название группы');
      return;
    }

    updateData((prev) => ({
      ...prev,
      groups: [
        ...prev.groups,
        {
          id: crypto.randomUUID(),
          name,
          scheduleWeekdays: [...newGroupDays].sort((a, b) => a - b),
        },
      ],
    }));

    setNewGroupName('');
    setNewGroupDays([]);
  }

  function toggleGroupWeekday(group: Group, day: number) {
    const set = new Set(group.scheduleWeekdays);
    if (set.has(day)) set.delete(day);
    else set.add(day);

    updateData((prev) => ({
      ...prev,
      groups: prev.groups.map((item) =>
        item.id === group.id ? { ...item, scheduleWeekdays: Array.from(set).sort((a, b) => a - b) } : item
      ),
    }));
  }

  function openStudentCard(studentId: string) {
    setSelectedStudentId(studentId);
    setStudentCardMonth(monthFromDate(selectedDate));
  }

  function totalVisitsForStudent(student: Student): number {
    const groupDates = data.attendance[student.groupId] ?? {};
    return Object.values(groupDates).reduce(
      (sum, ids) => (ids.includes(student.id) ? sum + 1 : sum),
      0
    );
  }

  return (
    <div className="layout">
      <header className="topbar">
        <button className="burger" onClick={() => setMenuOpen((prev) => !prev)} aria-label="Меню">
          ☰
        </button>
        <div>
          <h1>Журнал хореографа</h1>
          <p className="subtitle">{formatRuDate(selectedDate)}</p>
        </div>
      </header>

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        {(['journal', 'reports', 'students', 'groups'] as ViewName[]).map((item) => (
          <button
            key={item}
            className={view === item ? 'menu-item active' : 'menu-item'}
            onClick={() => {
              setView(item);
              setMenuOpen(false);
            }}
          >
            {item === 'journal' ? 'Журнал' : item === 'reports' ? 'Отчёты' : item === 'students' ? 'Ученики' : 'Группы'}
          </button>
        ))}
      </aside>

      {menuOpen ? <button className="overlay" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} /> : null}

      <main className="content">
        {view === 'journal' && activeGroup ? (
          <section className="panel compact">
            <div className="date-row">
              <button onClick={() => setSelectedDate((prev) => shiftISODate(prev, -1))}>←</button>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              <button onClick={() => setSelectedDate((prev) => shiftISODate(prev, 1))}>→</button>
              <button onClick={() => setSelectedDate(toISODate(new Date()))}>Сегодня</button>
              <button className="search-icon" onClick={() => setJournalSearchOpen((prev) => !prev)}>
                🔍
              </button>
            </div>

            {journalSearchOpen ? (
              <input
                className="journal-search"
                placeholder="Поиск ученика"
                value={journalSearch}
                onChange={(event) => setJournalSearch(event.target.value)}
              />
            ) : null}

            <div className="groups-tabs">
              {data.groups.map((group) => (
                <button
                  key={group.id}
                  className={group.id === activeGroup.id ? 'group-tab active' : 'group-tab'}
                  onClick={() => setActiveGroupId(group.id)}
                >
                  {group.name}
                </button>
              ))}
            </div>

            <div className="mini-switches">
              <span>Отменила</span>
              <label className="switch small state-switch">
                <input
                  type="checkbox"
                  checked={isCancelledToday}
                  onChange={(event) => toggleLessonCancelled(activeGroup.id, event.target.checked)}
                />
                <span />
              </label>
              <span>Провела</span>
              <label className="switch small state-switch">
                <input
                  type="checkbox"
                  checked={isConductedToday}
                  disabled={isFutureLessonDate}
                  onChange={(event) => toggleLessonConducted(activeGroup.id, event.target.checked)}
                />
                <span />
              </label>
            </div>

            <div className="add-student">
              <input
                placeholder="ФИО нового ученика"
                value={newStudentFio}
                onChange={(event) => setNewStudentFio(event.target.value)}
              />
              <button onClick={addStudentToGroup}>+ Ученик</button>
            </div>

            <div className="stats two">
              <div className="stat-card">
                <span>Пришло / Доп</span>
                <strong>
                  {attendeesForActiveGroup.length} / {extraForActiveGroup.length}
                </strong>
              </div>
              <div className="stat-card">
                <span>Доход за день</span>
                <strong>{formatMoney(activeGroupIncome)} ₽</strong>
              </div>
            </div>

            <div className="students-header">
              <span>№</span>
              <span>Ф.И.О.</span>
              <span>Б.О.</span>
              <span>Был</span>
              <span>Доп</span>
              <span>✕</span>
            </div>

            <ul className="students-list journal">
              {studentsInActiveGroup.length === 0 ? (
                <li className="empty">Нет учеников</li>
              ) : (
                studentsInActiveGroup.map((student, index) => {
                  const present = attendeesForActiveGroup.includes(student.id);
                  const extra = extraForActiveGroup.includes(student.id);
                  return (
                    <li key={student.id} className="student-row journal">
                      <span>{index + 1}</span>
                      <button className="fio-btn" onClick={() => openStudentCard(student.id)}>
                        {student.fio}
                      </button>
                      <span>{totalVisitsForStudent(student)}</span>

                      <label className="switch small">
                        <input
                          type="checkbox"
                          checked={present}
                          disabled={!isConductedToday}
                          onChange={(event) =>
                            toggleAttendance(activeGroup.id, student.id, event.target.checked)
                          }
                        />
                        <span />
                      </label>

                      <label className="switch small extra-switch">
                        <input
                          type="checkbox"
                          checked={extra}
                          disabled={!isConductedToday}
                          onChange={(event) =>
                            toggleExtraAttendance(activeGroup.id, student.id, event.target.checked)
                          }
                        />
                        <span />
                      </label>

                      <button className="icon-cross" onClick={() => archiveStudent(student)} title="В архив">
                        ✕
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ) : null}

        {view === 'reports' ? (
          <section className="panel">
            <div className="row row-wrap">
              <label>
                Месяц
                <select value={reportMonth} onChange={(event) => setReportMonth(event.target.value)}>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="stats">
              <div className="stat-card">
                <span>Общий доход</span>
                <strong>{formatMoney(reports.totalIncome)} ₽</strong>
              </div>
              <div className="stat-card">
                <span>Занятий</span>
                <strong>{reports.totalLessons}</strong>
              </div>
              <div className="stat-card">
                <span>Средняя посещаемость</span>
                <strong>{reports.totalAvg.toFixed(1)}</strong>
              </div>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Группа</th>
                    <th>Доход</th>
                    <th>Занятий</th>
                    <th>Средняя</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.rows.map((row) => (
                    <tr key={row.group.id}>
                      <td>{row.group.name}</td>
                      <td>{formatMoney(row.income)} ₽</td>
                      <td>{row.lessonsCount}</td>
                      <td>{row.avgAttendees.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {view === 'students' ? (
          <section className="panel">
            <div className="row row-wrap">
              <label>
                Поиск
                <input
                  placeholder="ФИО"
                  value={studentsSearch}
                  onChange={(event) => setStudentsSearch(event.target.value)}
                />
              </label>
              <label className="switch-line">
                <span>Показать архив</span>
                <label className="switch small">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                  />
                  <span />
                </label>
              </label>
            </div>

            <ul className="students-list all">
              {studentsList.length === 0 ? (
                <li className="empty">Пусто</li>
              ) : (
                studentsList.map((student) => {
                  const group = data.groups.find((item) => item.id === student.groupId);
                  return (
                    <li key={student.id} className="student-row all">
                      <button className="fio-btn" onClick={() => openStudentCard(student.id)}>
                        {student.fio}
                      </button>
                      <span className="group-badge">{group?.name ?? 'Без группы'}</span>
                      <button className="danger" onClick={() => archiveStudent(student)}>
                        {student.archived ? 'Вернуть' : 'В архив'}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ) : null}

        {view === 'groups' ? (
          <section className="panel">
            <div className="add-group">
              <input
                placeholder="Новая группа"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
              />
              <button onClick={addGroup}>+ Группа</button>
            </div>

            <div className="weekday-editor">
              {WEEKDAY_VALUES.map((day) => (
                <button
                  key={day}
                  className={newGroupDays.includes(day) ? 'day-chip active' : 'day-chip'}
                  onClick={() => {
                    setNewGroupDays((prev) =>
                      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day]
                    );
                  }}
                >
                  {weekdayLabel(day)}
                </button>
              ))}
            </div>

            <ul className="groups-list">
              {data.groups.map((group) => (
                <li key={group.id} className="group-row">
                  <input
                    value={group.name}
                    onChange={(event) => {
                      const nextName = normalizeFio(event.target.value);
                      updateData((prev) => ({
                        ...prev,
                        groups: prev.groups.map((item) =>
                          item.id === group.id ? { ...item, name: nextName || item.name } : item
                        ),
                      }));
                    }}
                  />

                  <div className="weekday-editor">
                    {WEEKDAY_VALUES.map((day) => (
                      <button
                        key={`${group.id}-${day}`}
                        className={group.scheduleWeekdays.includes(day) ? 'day-chip active' : 'day-chip'}
                        onClick={() => toggleGroupWeekday(group, day)}
                      >
                        {weekdayLabel(day)}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {selectedStudent ? (
        <div className="modal-backdrop" onClick={() => setSelectedStudentId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <h2>{selectedStudent.fio}</h2>
              <button onClick={() => setSelectedStudentId(null)}>✕</button>
            </div>

            <div className="row row-wrap">
              <label>
                ФИО
                <input
                  value={selectedStudent.fio}
                  onChange={(event) =>
                    updateStudent(selectedStudent.id, { fio: normalizeFio(event.target.value) || selectedStudent.fio })
                  }
                />
              </label>

              <label>
                Дата рождения
                <input
                  type="date"
                  value={selectedStudent.birthDate ?? ''}
                  onChange={(event) =>
                    updateStudent(selectedStudent.id, { birthDate: event.target.value || null })
                  }
                />
              </label>

              <label>
                Группа
                <select
                  value={selectedStudent.groupId}
                  onChange={(event) => updateStudent(selectedStudent.id, { groupId: event.target.value })}
                >
                  {data.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="age-line">
              Возраст: {ageFromBirthDate(selectedStudent.birthDate) ?? '—'}
            </p>

            <div className="month-switch">
              <button onClick={() => setStudentCardMonth((prev) => prevMonth(prev))}>←</button>
              <strong>{formatMonthLabel(studentCardMonth)}</strong>
              <button onClick={() => setStudentCardMonth((prev) => nextMonth(prev))}>→</button>
            </div>

            <div className="calendar-grid labels">
              {WEEK_DAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarDays.map((day, index) => {
                if (day === null) return <span key={`empty-${index}`} className="day empty" />;
                const date = `${studentCardMonth}-${String(day).padStart(2, '0')}`;
                const present = selectedStudentDateSet.has(date);
                return (
                  <span key={date} className={present ? 'day present' : 'day'}>
                    {day}
                  </span>
                );
              })}
            </div>

            <div className="dates-list">
              <strong>Даты посещений:</strong>
              {selectedStudentDates.length === 0 ? (
                <p>Нет отметок</p>
              ) : (
                <ul>
                  {selectedStudentDates.map((date) => (
                    <li key={date}>{formatRuDate(date)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
