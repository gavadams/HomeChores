import './App.css'
import { useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type {
  Chore,
  DayCapacityOverride,
  DueStatus,
  ScheduledTask,
  Weekday,
} from './types'
import { createSchedule } from './lib/scheduler'
import { hasSupabaseEnv, supabase } from './lib/supabase'
import {
  deactivateChore,
  deleteDayOverride,
  fetchScoreWindows,
  loadUserData,
  persistSchedule,
  saveChore,
  saveChoreDaysPreference,
  saveDayOverride,
} from './lib/data'

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

const fallbackChoreDays: Weekday[] = [
  'Monday',
  'Wednesday',
  'Friday',
  'Saturday',
]

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState('Loading...')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [loadedFromDb, setLoadedFromDb] = useState(false)

  const [chores, setChores] = useState<Chore[]>([])
  const [choreDays, setChoreDays] = useState<Weekday[]>(fallbackChoreDays)
  const [overrides, setOverrides] = useState<DayCapacityOverride[]>([])
  const [newChoreName, setNewChoreName] = useState('')
  const [newChoreMinutes, setNewChoreMinutes] = useState(20)
  const [newChoreFrequency, setNewChoreFrequency] = useState(7)
  const [newCapacityDate, setNewCapacityDate] = useState(daysFromNow(7))
  const [newCapacityMinutes, setNewCapacityMinutes] = useState(30)
  const [scores, setScores] = useState({ month1: 0, month3: 0, month6: 0 })

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

  useEffect(() => {
    const loadAuth = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (!data.session?.user) {
        setStatus('Sign in to load your household data.')
      }
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setLoadedFromDb(false)
      if (!hasSupabaseEnv) {
        setStatus('Add Supabase env vars to enable auth and cloud persistence.')
      }
      return
    }

    const load = async () => {
      try {
        const payload = await loadUserData(user)
        setChores(payload.chores)
        setOverrides(payload.overrides)
        setChoreDays(payload.choreDays.length > 0 ? payload.choreDays : fallbackChoreDays)
        const scorePayload = await fetchScoreWindows(user)
        setScores(scorePayload)
        setStatus('Synced with Supabase.')
        setLoadedFromDb(true)
      } catch (error) {
        setStatus(`Failed to load data: ${(error as Error).message}`)
      }
    }

    void load()
  }, [user])

  useEffect(() => {
    if (!user || !loadedFromDb) return

    const persist = async () => {
      try {
        await saveChoreDaysPreference(user, choreDays)
        await persistSchedule(user, schedule, daysFromNow(0))
      } catch (error) {
        setStatus(`Failed to persist schedule: ${(error as Error).message}`)
      }
    }

    void persist()
  }, [user, choreDays, schedule, loadedFromDb])

  const signIn = async () => {
    if (!authEmail || !authPassword) {
      setStatus('Email and password are required.')
      return
    }

    setAuthBusy(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    })
    setAuthBusy(false)

    if (error) {
      setStatus(`Sign in failed: ${error.message}`)
      return
    }

    setStatus('Signed in.')
  }

  const signUp = async () => {
    if (!authEmail || !authPassword) {
      setStatus('Email and password are required.')
      return
    }

    setAuthBusy(true)
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    })
    setAuthBusy(false)

    if (error) {
      setStatus(`Sign up failed: ${error.message}`)
      return
    }

    setStatus('Account created. Check your email if confirmation is enabled.')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setStatus('Signed out.')
    setChores([])
    setOverrides([])
    setChoreDays(fallbackChoreDays)
    setScores({ month1: 0, month3: 0, month6: 0 })
  }

  const toggleChoreDay = (day: Weekday) => {
    const next = choreDays.includes(day)
      ? choreDays.filter((entry) => entry !== day)
      : [...choreDays, day]
    setChoreDays(next)
  }

  const addChore = async () => {
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
    if (user) {
      try {
        await saveChore(user, newChore)
        setStatus('Chore saved and schedule reshuffled.')
      } catch (error) {
        setStatus(`Failed saving chore: ${(error as Error).message}`)
      }
    }
    setNewChoreName('')
  }

  const addCapacityOverride = async () => {
    if (!newCapacityDate) {
      return
    }

    const newOverride: DayCapacityOverride = {
      date: newCapacityDate,
      limitMinutes: newCapacityMinutes,
    }

    setOverrides((current) => [
      ...current.filter((entry) => entry.date !== newCapacityDate),
      newOverride,
    ])

    if (user) {
      try {
        await saveDayOverride(user, newOverride)
        setStatus('Date limit saved.')
      } catch (error) {
        setStatus(`Failed saving date limit: ${(error as Error).message}`)
      }
    }
  }

  const removeOverride = async (date: string) => {
    setOverrides((current) => current.filter((entry) => entry.date !== date))
    if (user) {
      try {
        await deleteDayOverride(user, date)
        setStatus('Date limit removed.')
      } catch (error) {
        setStatus(`Failed removing limit: ${(error as Error).message}`)
      }
    }
  }

  const removeChore = async (choreId: string) => {
    setChores((current) => current.filter((entry) => entry.id !== choreId))
    if (user) {
      try {
        await deactivateChore(user, choreId)
        setStatus('Chore removed from active list.')
      } catch (error) {
        setStatus(`Failed removing chore: ${(error as Error).message}`)
      }
    }
  }

  const dueLabel = (status: DueStatus) => {
    if (status === 'overdue') return 'Overdue'
    if (status === 'due-soon') return 'Due soon'
    return 'Scheduled'
  }

  const dayLoad = (tasks: ScheduledTask[]) =>
    tasks.reduce((sum, entry) => sum + entry.estimateMinutes, 0)

  if (!hasSupabaseEnv) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <h1>HomeChores Planner</h1>
          <p>Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable cloud mode.</p>
        </header>
        <section className="panel">
          <h2>Local preview mode</h2>
          <p>
            Supabase environment variables are missing, so this session uses demo
            data only.
          </p>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="app-shell">
        <header className="app-header">
          <h1>HomeChores Planner</h1>
          <p>Sign in to load and persist your household schedule.</p>
        </header>
        <section className="panel panel-columns">
          <div>
            <h2>Auth</h2>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </div>
            <div className="button-row">
              <button onClick={() => void signIn()} disabled={authBusy}>
                Sign in
              </button>
              <button onClick={() => void signUp()} disabled={authBusy}>
                Create account
              </button>
            </div>
            <p className="status-line">{status}</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>HomeChores Planner</h1>
        <p>
          Balanced household schedule with overdue-first reshuffling and one-off
          date limits.
        </p>
        <p className="status-line">
          {status} Signed in as <strong>{session.user.email}</strong>.
        </p>
        <div className="button-row">
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
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
          <button onClick={() => void addChore()}>Add chore and reshuffle</button>
          <ul className="simple-list">
            {chores.map((chore) => (
              <li key={chore.id}>
                <strong>{chore.name}</strong> - {chore.estimateMinutes} min every{' '}
                {chore.recurrenceDays} days
                <button onClick={() => void removeChore(chore.id)}>Remove</button>
              </li>
            ))}
          </ul>
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
          <button onClick={() => void addCapacityOverride()}>Set day limit</button>
          <ul className="simple-list">
            {overrides.map((entry) => (
              <li key={entry.date}>
                <strong>{entry.date}</strong> - {entry.limitMinutes} min
                <button onClick={() => void removeOverride(entry.date)}>Remove</button>
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
