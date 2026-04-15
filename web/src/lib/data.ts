import type { User } from '@supabase/supabase-js'
import type {
  Chore,
  DayCapacityOverride,
  DueStatus,
  ScheduleResult,
  ScheduledTask,
  ScoreSummary,
  TaskActionType,
  Weekday,
} from '../types'
import { hasSupabaseEnv, supabase } from './supabase'

const weekdayToNumber: Record<Weekday, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
}

const numberToWeekday: Record<number, Weekday> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

const pressureFromLoad = (minutes: number): 'light' | 'medium' | 'heavy' => {
  if (minutes >= 120) return 'heavy'
  if (minutes >= 60) return 'medium'
  return 'light'
}

export const loadUserData = async (user: User): Promise<{
  chores: Chore[]
  overrides: DayCapacityOverride[]
  choreDays: Weekday[]
}> => {
  if (!hasSupabaseEnv) {
    return { chores: [], overrides: [], choreDays: ['Monday', 'Wednesday', 'Friday'] }
  }

  const [choresResult, overridesResult, preferencesResult] = await Promise.all([
    supabase
      .from('chores')
      .select(
        'id,name,estimate_minutes,recurrence_days,created_at,last_completed_on,must_do_by_date,effort',
      )
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('day_capacity_overrides')
      .select('override_date,limit_minutes,reason')
      .eq('user_id', user.id)
      .order('override_date', { ascending: true }),
    supabase
      .from('user_preferences')
      .select('chore_days')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (choresResult.error) throw choresResult.error
  if (overridesResult.error) throw overridesResult.error
  if (preferencesResult.error) throw preferencesResult.error

  const chores: Chore[] = (choresResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    estimateMinutes: row.estimate_minutes,
    recurrenceDays: row.recurrence_days,
    createdAt: row.created_at.slice(0, 10),
    lastCompletedOn: row.last_completed_on ?? undefined,
    mustDoByDate: row.must_do_by_date ?? undefined,
    effort: row.effort,
  }))

  const overrides: DayCapacityOverride[] = (overridesResult.data ?? []).map((row) => ({
    date: row.override_date,
    limitMinutes: row.limit_minutes,
    reason: row.reason ?? undefined,
  }))

  const rawDays: number[] =
    (preferencesResult.data?.chore_days as number[] | null) ?? [1, 3, 5]
  const choreDays = rawDays
    .map((value: number) => numberToWeekday[value])
    .filter((value): value is Weekday => Boolean(value))

  return { chores, overrides, choreDays }
}

export const saveChore = async (user: User, chore: Chore): Promise<void> => {
  if (!hasSupabaseEnv) return

  const { error } = await supabase.from('chores').upsert(
    {
      id: chore.id,
      user_id: user.id,
      name: chore.name,
      estimate_minutes: chore.estimateMinutes,
      recurrence_days: chore.recurrenceDays,
      effort: chore.effort,
      last_completed_on: chore.lastCompletedOn ?? null,
      must_do_by_date: chore.mustDoByDate ?? null,
      created_at: chore.createdAt,
      active: true,
    },
    { onConflict: 'id' },
  )

  if (error) throw error
}

export const deactivateChore = async (user: User, choreId: string): Promise<void> => {
  if (!hasSupabaseEnv) return

  const { error } = await supabase
    .from('chores')
    .update({ active: false })
    .eq('id', choreId)
    .eq('user_id', user.id)

  if (error) throw error
}

export const saveDayOverride = async (
  user: User,
  override: DayCapacityOverride,
): Promise<void> => {
  if (!hasSupabaseEnv) return

  const { error } = await supabase.from('day_capacity_overrides').upsert(
    {
      user_id: user.id,
      override_date: override.date,
      limit_minutes: override.limitMinutes,
      reason: override.reason ?? null,
    },
    { onConflict: 'user_id,override_date' },
  )

  if (error) throw error
}

export const deleteDayOverride = async (user: User, date: string): Promise<void> => {
  if (!hasSupabaseEnv) return

  const { error } = await supabase
    .from('day_capacity_overrides')
    .delete()
    .eq('user_id', user.id)
    .eq('override_date', date)

  if (error) throw error
}

export const saveChoreDaysPreference = async (
  user: User,
  choreDays: Weekday[],
): Promise<void> => {
  if (!hasSupabaseEnv) return

  const dayNumbers = choreDays.map((day) => weekdayToNumber[day]).sort((a, b) => a - b)
  const { error } = await supabase.from('user_preferences').upsert(
    {
      user_id: user.id,
      chore_days: dayNumbers,
    },
    { onConflict: 'user_id' },
  )

  if (error) throw error
}

const scheduleRowKey = (choreId: string, plannedFor: string, dueDate: string) =>
  `${choreId}|${plannedFor}|${dueDate}`

export const persistSchedule = async (
  user: User,
  schedule: ScheduleResult,
  fromDate: string,
): Promise<void> => {
  if (!hasSupabaseEnv) return

  const { data: existing, error: fetchError } = await supabase
    .from('scheduled_chores')
    .select('chore_id, planned_for, due_date, status')
    .eq('user_id', user.id)
    .gte('planned_for', fromDate)

  if (fetchError) throw fetchError

  const finalizedKeys = new Set<string>()
  for (const row of existing ?? []) {
    if (row.status !== 'planned') {
      finalizedKeys.add(
        scheduleRowKey(row.chore_id, row.planned_for, row.due_date),
      )
    }
  }

  const { error: deleteError } = await supabase
    .from('scheduled_chores')
    .delete()
    .eq('user_id', user.id)
    .gte('planned_for', fromDate)
    .eq('status', 'planned')

  if (deleteError) throw deleteError

  const rows = schedule.days.flatMap((day) => {
    const totalMinutes = day.tasks.reduce((sum, task) => sum + task.estimateMinutes, 0)
    const pressure = pressureFromLoad(totalMinutes)

    return day.tasks
      .map((task) => {
        const key = scheduleRowKey(task.choreId, day.date, task.dueDate)
        if (finalizedKeys.has(key)) {
          return null
        }

        return {
          user_id: user.id,
          chore_id: task.choreId,
          planned_for: day.date,
          due_date: task.dueDate,
          estimate_minutes: task.estimateMinutes,
          pressure,
          status: 'planned' as const,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
  })

  if (rows.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from('scheduled_chores').insert(rows)
  if (insertError) throw insertError
}

const addMonths = (date: Date, amount: number): Date => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + amount)
  return next
}

const toIsoDateTime = (date: Date): string => date.toISOString()

const getRange = (months: number) => {
  const now = new Date()
  const currentStart = addMonths(now, -months)
  const previousStart = addMonths(currentStart, -months)
  return {
    currentStart: toIsoDateTime(currentStart),
    currentEnd: toIsoDateTime(now),
    previousStart: toIsoDateTime(previousStart),
    previousEnd: toIsoDateTime(currentStart),
  }
}

const sumPoints = (rows: Array<{ points: number }> | null) =>
  (rows ?? []).reduce((sum, entry) => sum + entry.points, 0)

const queryRangePoints = async (
  userId: string,
  start: string,
  end: string,
): Promise<number> => {
  const { data, error } = await supabase
    .from('score_events')
    .select('points')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lt('created_at', end)

  if (error) throw error
  return sumPoints(data)
}

const fetchWindow = async (userId: string, months: number) => {
  const range = getRange(months)
  const [current, previous] = await Promise.all([
    queryRangePoints(userId, range.currentStart, range.currentEnd),
    queryRangePoints(userId, range.previousStart, range.previousEnd),
  ])

  return {
    current,
    previous,
    delta: current - previous,
  }
}

export const fetchScoreWindows = async (user: User): Promise<ScoreSummary> => {
  if (!hasSupabaseEnv) {
    return {
      month1: { current: 0, previous: 0, delta: 0 },
      month3: { current: 0, previous: 0, delta: 0 },
      month6: { current: 0, previous: 0, delta: 0 },
    }
  }

  return {
    month1: await fetchWindow(user.id, 1),
    month3: await fetchWindow(user.id, 3),
    month6: await fetchWindow(user.id, 6),
  }
}

const scoreForCompletion = (dueStatus: DueStatus) => {
  if (dueStatus === 'overdue') {
    return { points: 6, reason: 'completed_late' as const }
  }

  return { points: 10, reason: 'completed_on_time' as const }
}

export const fetchScheduleStatuses = async (
  user: User,
  fromDate: string,
): Promise<Record<string, TaskActionType | 'planned'>> => {
  if (!hasSupabaseEnv) {
    return {}
  }

  const { data, error } = await supabase
    .from('scheduled_chores')
    .select('chore_id, due_date, status')
    .eq('user_id', user.id)
    .gte('planned_for', fromDate)

  if (error) throw error

  const statusPriority: Record<string, number> = {
    planned: 0,
    snoozed: 1,
    skipped: 2,
    completed: 3,
  }

  const rank = (value: TaskActionType | 'planned') => statusPriority[value] ?? 0

  const map: Record<string, TaskActionType | 'planned'> = {}
  for (const row of data ?? []) {
    const key = `${row.chore_id}:${row.due_date}`
    const status = row.status as TaskActionType | 'planned'
    const prev = map[key]
    if (prev === undefined || rank(status) > rank(prev)) {
      map[key] = status
    }
  }

  return map
}

export const applyTaskAction = async (
  user: User,
  task: ScheduledTask,
  actionType: TaskActionType,
): Promise<void> => {
  if (!hasSupabaseEnv) return

  const { data: rows, error: scheduledError } = await supabase
    .from('scheduled_chores')
    .select('id,status')
    .eq('user_id', user.id)
    .eq('chore_id', task.choreId)
    .eq('planned_for', task.date)
    .eq('due_date', task.dueDate)

  if (scheduledError) throw scheduledError
  if (!rows?.length) {
    throw new Error('Scheduled chore row not found. Try refreshing.')
  }

  if (rows.every((row) => row.status === actionType)) {
    return
  }

  const ids = rows.map((row) => row.id)

  const { error: scoreDeleteError } = await supabase
    .from('score_events')
    .delete()
    .eq('user_id', user.id)
    .in('scheduled_chore_id', ids)

  if (scoreDeleteError) throw scoreDeleteError

  const { error: updateError } = await supabase
    .from('scheduled_chores')
    .update({ status: actionType })
    .in('id', ids)
    .eq('user_id', user.id)

  if (updateError) throw updateError

  const logRows = ids.map((id) => ({
    user_id: user.id,
    scheduled_chore_id: id,
    action_type: actionType,
  }))
  const { error: actionLogError } = await supabase.from('schedule_action_log').insert(logRows)
  if (actionLogError) throw actionLogError

  const primaryScheduledId = ids[0]

  if (actionType === 'completed') {
    const scoring = scoreForCompletion(task.dueStatus)
    const { error: scoreError } = await supabase.from('score_events').insert({
      user_id: user.id,
      scheduled_chore_id: primaryScheduledId,
      points: scoring.points,
      reason: scoring.reason,
    })
    if (scoreError) throw scoreError
  }

  if (actionType === 'skipped') {
    const { error: scoreError } = await supabase.from('score_events').insert({
      user_id: user.id,
      scheduled_chore_id: primaryScheduledId,
      points: 0,
      reason: 'skipped',
    })
    if (scoreError) throw scoreError
  }
}
