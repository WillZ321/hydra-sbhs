export interface Bell {
  bell: string;
  bellDisplay?: string;
  time: string;
  period?: string;
  startTime?: string;
  endTime?: string;
  hexColour?: string;
  hexTextColour?: string;
  changed?: boolean;
  changedReason?: string;
}

export interface BellsResponse {
  date: string;
  bellsAltered: boolean;
  bellsAlteredReason: string;
  day: string;
  dayNumber: string;
  weekType: 'A' | 'B' | string;
  term: string;
  week: string;
  bells: Bell[];
}

export interface Period {
  title: string;
  teacher: string;
  fullTeacher?: string;
  room: string;
  year?: string;
}

export interface RoomVariation {
  roomTo: string;
  roomFrom?: string;
  period: string;
  year?: string;
  title?: string;
}

export interface ClassVariation {
  type: 'nocover' | 'replacement' | 'novariation' | string;
  period: string;
  year?: string;
  title?: string;
  teacher?: string;
  casualSurname?: string;
  casual?: string;
}

export interface DayTimetable {
  bells: Bell[];
  timetable: {
    timetable: {
      dayname: string;
      routine: string;
      rollcall?: { title: string; teacher: string; room: string };
      periods: Record<string, Period>;
      subjects: Record<string, { title: string; fullTeacher: string; colour?: string }>;
    };
    date: string;
    student?: { studentId: string; firstName?: string; surname?: string };
  };
  roomVariations: Record<string, RoomVariation> | RoomVariation[];
  classVariations: Record<string, ClassVariation> | ClassVariation[];
  shouldDisplayVariations: boolean;
}

export interface FullTimetable {
  student: {
    studentId: string;
    firstName?: string;
    surname?: string;
    yearGroup?: string;
    rollClass?: string;
  };
  days: Record<string, {
    dayname: string;
    routine: string;
    rollcall?: { title: string; teacher: string; room: string };
    periods: Record<string, Period>;
  }>;
  subjects: Record<string, { title: string; fullTeacher: string; colour?: string; year?: string }>;
}
