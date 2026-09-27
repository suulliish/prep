export type Status = 'locked' | 'available' | 'learning' | 'learned' | 'mastered' | 'automatic';
// learned — «үйренді» (p ≥ 0,95), mastered — «меңгерді» (прошёл отложенную проверку),
// automatic — «автоматизм» (несколько успешных повторений).

export interface SkillState {
  p: number;
  status: Status;
  lessonDone: boolean;
  learnedAt?: string;        // дата «үйренді»
  due?: string;              // дата следующей проверки/повторения
  stage: number;             // ступень интервального повторения
  attempts: number;
  correct: number;
  misconceptions: Record<string, number>;
}

export interface Attempt {
  at: number;                // ms
  day: string;
  skill: string;
  source: string;            // template id или bank id
  correct: boolean;
  confidence?: 'sure' | 'maybe' | 'unsure';
  hintLevel: number;
  honest: boolean;
  timeMs: number;
  tag?: string;              // метка выбранной ошибки
  mode: 'lesson' | 'practice' | 'warmup' | 'mixed' | 'boss' | 'diagnostic' | 'extra' | 'mock';
}

export interface DayRecord {
  date: string;
  blocksDone: Record<string, boolean>;
  planShare: number;
  minutesToday: number;
  minutesWeekend: number;
  extraMissions: number;
  bonuses: { reason: string; minutes: number; mastery?: boolean }[];
  exception?: 'sick' | 'holiday' | 'vacation';
  spent?: number;            // сколько минут игры уже потрачено сегодня (таймер)
}

export interface Settings {
  extraMissionCap: number;          // сколько доп. миссий в день
  extraTo: 'today' | 'weekend';
  planMinutes: number;
  pin?: string;
}

export interface Save {
  version: 1;
  heroName: string;
  xp: number;
  skills: Record<string, SkillState>;
  attempts: Attempt[];
  days: Record<string, DayRecord>;
  settings: Settings;
  diagnosticDone: boolean;
  lastBackup?: string; // дата последней копии в файл
  repairShop: { source: string; skill: string; tag?: string; addedDay: string; fixed?: boolean }[];
  kzReview?: Record<string, 'ok' | 'fix'>;   // проверка казахских текстов носителем
  weekendSpent?: Record<string, number>;      // потрачено из копилки выходных (ключ — понедельник недели)
}
