export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday'

export type EffortLevel = 'easy' | 'medium' | 'heavy'

export type DueStatus = 'overdue' | 'due-soon' | 'scheduled'
export type TaskActionType = 'completed' | 'skipped' | 'snoozed'

export interface Chore {
  id: string
  name: string
  estimateMinutes: number
  recurrenceDays: number
  createdAt: string
  lastCompletedOn?: string
  mustDoByDate?: string
  effort: EffortLevel
}

export interface DayCapacityOverride {
  date: string
  limitMinutes: number | null
  reason?: string
}

export interface ScheduledTask {
  occurrenceId: string
  choreId: string
  name: string
  date: string
  estimateMinutes: number
  dueDate: string
  dueStatus: DueStatus
}

export interface ScoreWindowSummary {
  current: number
  previous: number
  delta: number
}

export interface ScoreSummary {
  month1: ScoreWindowSummary
  month3: ScoreWindowSummary
  month6: ScoreWindowSummary
}

export interface ScheduleDay {
  date: string
  weekday: Weekday
  capacityLimitMinutes: number | null
  tasks: ScheduledTask[]
}

export interface ScheduleResult {
  days: ScheduleDay[]
  unscheduled: ScheduledTask[]
}
