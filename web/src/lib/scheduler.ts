import type {
  Chore,
  DayCapacityOverride,
  DueStatus,
  ScheduleDay,
  ScheduleResult,
  ScheduledTask,
  Weekday,
} from '../types'

interface CreateScheduleInput {
  chores: Chore[]
  choreDays: Weekday[]
  dayCapacityOverrides: DayCapacityOverride[]
  horizonDays: number
  fromDate: string
}

const WEEKDAY_LOOKUP: Record<number, Weekday> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

const parseDate = (value: string): Date => {
  const parsed = new Date(value)
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

const toIsoDate = (value: Date): string => value.toISOString().split('T')[0]

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

const daysBetween = (start: Date, end: Date): number =>
  Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

const dueStatusForDate = (dueDate: Date, plannedDate: Date): DueStatus => {
  const diff = daysBetween(plannedDate, dueDate)

  if (diff < 0) return 'overdue'
  if (diff <= 2) return 'due-soon'
  return 'scheduled'
}

const createDays = ({
  fromDate,
  horizonDays,
  choreDays,
  dayCapacityOverrides,
}: Omit<CreateScheduleInput, 'chores'>): ScheduleDay[] => {
  const start = parseDate(fromDate)
  const overridesByDate = new Map(
    dayCapacityOverrides.map((entry) => [entry.date, entry.limitMinutes]),
  )

  const results: ScheduleDay[] = []

  for (let index = 0; index < horizonDays; index += 1) {
    const currentDate = addDays(start, index)
    const isoDate = toIsoDate(currentDate)
    const weekday = WEEKDAY_LOOKUP[currentDate.getDay()]

    if (!choreDays.includes(weekday)) {
      continue
    }

    results.push({
      date: isoDate,
      weekday,
      capacityLimitMinutes: overridesByDate.get(isoDate) ?? null,
      tasks: [],
    })
  }

  return results
}

interface PendingOccurrence {
  occurrenceId: string
  choreId: string
  name: string
  estimateMinutes: number
  dueDate: Date
  dueDateText: string
  mustDoByDate?: string
  createdAt: string
}

const expandOccurrences = (
  chores: Chore[],
  fromDate: string,
  horizonDays: number,
): PendingOccurrence[] => {
  const horizonEnd = addDays(parseDate(fromDate), horizonDays - 1)

  return chores
    .map<PendingOccurrence>((chore) => {
      const anchor = chore.lastCompletedOn ?? chore.createdAt
      const firstDue = addDays(parseDate(anchor), chore.recurrenceDays)
      const dueDate = firstDue <= horizonEnd ? firstDue : horizonEnd

      return {
        occurrenceId: `${chore.id}:${toIsoDate(dueDate)}`,
        choreId: chore.id,
        name: chore.name,
        estimateMinutes: chore.estimateMinutes,
        dueDate,
        dueDateText: toIsoDate(dueDate),
        mustDoByDate: chore.mustDoByDate,
        createdAt: chore.createdAt,
      }
    })
    .sort((left, right) => {
      const dueDiff = left.dueDate.getTime() - right.dueDate.getTime()
      if (dueDiff !== 0) return dueDiff

      const mustDoByLeft = left.mustDoByDate ?? '9999-12-31'
      const mustDoByRight = right.mustDoByDate ?? '9999-12-31'
      const mustDiff = mustDoByLeft.localeCompare(mustDoByRight)
      if (mustDiff !== 0) return mustDiff

      return left.createdAt.localeCompare(right.createdAt)
    })
}

const canFitCapacity = (
  day: ScheduleDay,
  additionalMinutes: number,
  currentDayLoad: number,
): boolean => {
  if (day.capacityLimitMinutes === null) {
    return true
  }

  return currentDayLoad + additionalMinutes <= day.capacityLimitMinutes
}

export const createSchedule = ({
  chores,
  choreDays,
  dayCapacityOverrides,
  horizonDays,
  fromDate,
}: CreateScheduleInput): ScheduleResult => {
  const days = createDays({
    fromDate,
    horizonDays,
    choreDays,
    dayCapacityOverrides,
  })
  const pending = expandOccurrences(chores, fromDate, horizonDays)
  const unscheduled: ScheduledTask[] = []
  const startDate = parseDate(fromDate)

  for (const occurrence of pending) {
    const preferredDays = days
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => parseDate(day.date) >= startDate)
      .sort((left, right) => {
        const leftDate = parseDate(left.day.date)
        const rightDate = parseDate(right.day.date)
        const leftDueDelta = Math.abs(daysBetween(leftDate, occurrence.dueDate))
        const rightDueDelta = Math.abs(daysBetween(rightDate, occurrence.dueDate))
        if (leftDueDelta !== rightDueDelta) {
          return leftDueDelta - rightDueDelta
        }

        const leftLoad = left.day.tasks.reduce(
          (sum, task) => sum + task.estimateMinutes,
          0,
        )
        const rightLoad = right.day.tasks.reduce(
          (sum, task) => sum + task.estimateMinutes,
          0,
        )
        return leftLoad - rightLoad
      })

    let placed = false

    for (const { day, index } of preferredDays) {
      const load = day.tasks.reduce((sum, task) => sum + task.estimateMinutes, 0)
      const isOverdueChore = occurrence.dueDate < startDate

      if (!canFitCapacity(day, occurrence.estimateMinutes, load) && !isOverdueChore) {
        continue
      }

      const plannedDate = parseDate(day.date)
      const scheduledTask: ScheduledTask = {
        occurrenceId: occurrence.occurrenceId,
        choreId: occurrence.choreId,
        name: occurrence.name,
        date: day.date,
        estimateMinutes: occurrence.estimateMinutes,
        dueDate: occurrence.dueDateText,
        dueStatus: dueStatusForDate(occurrence.dueDate, plannedDate),
      }

      days[index].tasks.push(scheduledTask)
      placed = true
      break
    }

    if (!placed) {
      unscheduled.push({
        occurrenceId: occurrence.occurrenceId,
        choreId: occurrence.choreId,
        name: occurrence.name,
        date: '',
        estimateMinutes: occurrence.estimateMinutes,
        dueDate: occurrence.dueDateText,
        dueStatus: 'overdue',
      })
    }
  }

  for (const day of days) {
    day.tasks.sort((left, right) => {
      const statusRank: Record<DueStatus, number> = {
        overdue: 0,
        'due-soon': 1,
        scheduled: 2,
      }

      const rankDiff = statusRank[left.dueStatus] - statusRank[right.dueStatus]
      if (rankDiff !== 0) {
        return rankDiff
      }

      return left.dueDate.localeCompare(right.dueDate)
    })
  }

  return { days, unscheduled }
}
