import './App.css'
import { useMemo, useState } from 'react'
import type {
  Chore,
  DayCapacityOverride,
  DueStatus,
  ScheduledTask,
  Weekday,
} from './types'
import { createSchedule } from './lib/scheduler'

const WEEKDAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

const today = new Date()
today.setHours(0, 0, 0, 0)

const daysFromNow = (days: number): string => {
  const result = new Date(today)
  result.setDate(result.getDate() + days)
  return result.toISOString().split('T')[0]
}

const initialChores: Chore[] = [
  {
    id: crypto.randomUUID(),
    name: 'Vacuum main floor',
    estimateMinutes: 30,
    recurrenceDays: 7,
    lastCompletedOn: daysFromNow(-5),
    createdAt: daysFromNow(-20),
    effort: 'medium',
  },
  {
    id: crypto.randomUUID(),
    name: 'Clean shower',
    estimateMinutes: 45,
    recurrenceDays: 28,
    lastCompletedOn: daysFromNow(-30),
    createdAt: daysFromNow(-60),
    effort: 'heavy',
  },
]

const initialChoreDays: Weekday[] = [
  'Monday',
  'Wednesday',
  'Friday',
  'Saturday',
]

const initialOverrides: DayCapacityOverride[] = [
  { date: daysFromNow(5), limitMinutes: 30, reason: 'Late shift' },
]

function App() {
  const [chores, setChores] = useState<Chore[]>(initialChores)
  const [choreDays, setChoreDays] = useState<Weekday[]>(initialChoreDays)
  const [overrides, setOverrides] = useState<DayCapacityOverride[]>(initialOverrides)
  const [newChoreName, setNewChoreName] = useState('')
  const [newChoreMinutes, setNewChoreMinutes] = useState(20)
  const [newChoreFrequency, setNewChoreFrequency] = useState(7)
  const [newCapacityDate, setNewCapacityDate] = useState(daysFromNow(7))
  const [newCapacityMinutes, setNewCapacityMinutes] = useState(30)

  const schedule = useMemo(
    () =>
      createSchedule({
        chores,
        choreDays,
        dayCapacityOverrides: overrides,
        horizonDays: 28,
        fromDate: daysFromNow(0),
      }),
    [chores, choreDays, overrides],
  )

  const scores = useMemo(() => {
    const base = chores.length * 120
    return {
      month1: base + 35,
      month3: base + 70,
      month6: base + 40,
    }
  }, [chores.length])

  const toggleChoreDay = (day: Weekday) => {
    setChoreDays((current) => {
      if (current.includes(day)) {
        return current.filter((entry) => entry !== day)
      }

      return [...current, day]
    })
  }

  const addChore = () => {
    if (!newChoreName.trim()) {
      return
    }

    const newChore: Chore = {
      id: crypto.randomUUID(),
      name: newChoreName.trim(),
      estimateMinutes: newChoreMinutes,
      recurrenceDays: newChoreFrequency,
      createdAt: daysFromNow(0),
      effort: 'medium',
    }

    setChores((current) => [...current, newChore])
    setNewChoreName('')
  }

  const addCapacityOverride = () => {
    if (!newCapacityDate) {
      return
    }

    setOverrides((current) => [
      ...current.filter((entry) => entry.date !== newCapacityDate),
      {
        date: newCapacityDate,
        limitMinutes: newCapacityMinutes,
      },
    ])
  }

  const removeOverride = (date: string) => {
    setOverrides((current) => current.filter((entry) => entry.date !== date))
  }

  const dueLabel = (status: DueStatus) => {
    if (status === 'overdue') return 'Overdue'
    if (status === 'due-soon') return 'Due soon'
    return 'Scheduled'
  }

  const dayLoad = (tasks: ScheduledTask[]) =>
    tasks.reduce((sum, entry) => sum + entry.estimateMinutes, 0)

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>HomeChores Planner</h1>
        <p>
          Balanced household schedule with overdue-first reshuffling and one-off
          date limits.
        </p>
      </header>

      <section className="panel">
        <h2>Chore Days</h2>
        <div className="weekday-grid">
          {WEEKDAYS.map((day) => (
            <label key={day} className="weekday-toggle">
              <input
                type="checkbox"
                checked={choreDays.includes(day)}
                onChange={() => toggleChoreDay(day)}
              />
              <span>{day}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel panel-columns">
        <div>
          <h2>Add Chore</h2>
          <div className="field">
            <label>Task name</label>
            <input
              value={newChoreName}
              onChange={(event) => setNewChoreName(event.target.value)}
              placeholder="e.g. Wipe kitchen surfaces"
            />
          </div>
          <div className="field">
            <label>Estimated minutes</label>
            <input
              type="number"
              min={5}
              value={newChoreMinutes}
              onChange={(event) => setNewChoreMinutes(Number(event.target.value))}
            />
          </div>
          <div className="field">
            <label>Repeat every (days)</label>
            <input
              type="number"
              min={1}
              value={newChoreFrequency}
              onChange={(event) => setNewChoreFrequency(Number(event.target.value))}
            />
          </div>
          <button onClick={addChore}>Add chore and reshuffle</button>
        </div>

        <div>
          <h2>One-Off Date Limit</h2>
          <div className="field">
            <label>Date</label>
            <input
              type="date"
              value={newCapacityDate}
              onChange={(event) => setNewCapacityDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label>Limit minutes</label>
            <input
              type="number"
              min={5}
              value={newCapacityMinutes}
              onChange={(event) => setNewCapacityMinutes(Number(event.target.value))}
            />
          </div>
          <button onClick={addCapacityOverride}>Set day limit</button>
          <ul className="simple-list">
            {overrides.map((entry) => (
              <li key={entry.date}>
                <strong>{entry.date}</strong> - {entry.limitMinutes} min
                <button onClick={() => removeOverride(entry.date)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>Schedule Preview (next 4 weeks)</h2>
        <div className="schedule-grid">
          {schedule.days.map((day) => (
            <article key={day.date} className="schedule-day">
              <header>
                <h3>{day.date}</h3>
                <p>
                  {dayLoad(day.tasks)} min planned
                  {day.capacityLimitMinutes !== null
                    ? ` / ${day.capacityLimitMinutes} min cap`
                    : ''}
                </p>
              </header>
              {day.tasks.length === 0 ? (
                <p className="empty-state">No chores assigned</p>
              ) : (
                <ul>
                  {day.tasks.map((task) => (
                    <li key={task.occurrenceId}>
                      <span>{task.name}</span>
                      <small>
                        {task.estimateMinutes} min - {dueLabel(task.dueStatus)}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Score Trend</h2>
        <div className="score-grid">
          <article>
            <h3>Last 1 month</h3>
            <p>{scores.month1} pts</p>
          </article>
          <article>
            <h3>Last 3 months</h3>
            <p>{scores.month3} pts</p>
          </article>
          <article>
            <h3>Last 6 months</h3>
            <p>{scores.month6} pts</p>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
