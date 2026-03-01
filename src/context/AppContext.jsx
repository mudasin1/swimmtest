/**
 * src/context/AppContext.jsx
 *
 * Global state management for SnowDesk.
 * Conforms to SPEC.md section 10 — state shape and localStorage keys.
 */

import { createContext, useContext, useReducer, useEffect } from 'react'
import resortsData from '../data/resorts.json'

// ── localStorage keys (SPEC.md section 10) ─────────────────────────────────-
const LS_SAVED_RESORTS = 'snowdesk_saved_slugs'  // Changed: now stores slugs not IDs
const LS_SETTINGS      = 'snowdesk_settings'
const LS_ALERT_LOG     = 'snowdesk_alert_log'

// ── Sensible defaults (SPEC.md section 10) ─────────────────────────────────-
const DEFAULT_SETTINGS = {
  defaultThreshold: 15.24, // 6 inches in cm
  thresholds: {},
  units: 'imperial',
  darkMode: true,
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// ── Initial state ───────────────────────────────────────────────────────────-
function buildInitialState() {
  return {
    resorts: resortsData,                           // loaded synchronously from local import
    savedSlugs: readLS(LS_SAVED_RESORTS, []),       // Changed: slugs instead of IDs
    forecasts: {},                                   // in-memory only
    summaries: {},                                   // in-memory only
    loadingStates: {},                               // in-memory only
    settings: readLS(LS_SETTINGS, DEFAULT_SETTINGS),
    alertLog: readLS(LS_ALERT_LOG, {}),
  }
}

// ── Reducer ─────────────────────────────────────────────────────────────────-
function appReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SAVED_RESORT': {
      const slug = action.payload  // Changed: now passing slug instead of id
      const already = state.savedSlugs.includes(slug)
      return {
        ...state,
        savedSlugs: already
          ? state.savedSlugs.filter((s) => s !== slug)
          : [...state.savedSlugs, slug],
      }
    }

    case 'SET_FORECAST':
      return {
        ...state,
        forecasts: { ...state.forecasts, [action.payload.resortId]: action.payload.data },
      }

    case 'SET_SUMMARY':
      return {
        ...state,
        summaries: { ...state.summaries, [action.payload.resortId]: action.payload.text },
      }

    case 'SET_LOADING_STATE':
      return {
        ...state,
        loadingStates: { ...state.loadingStates, [action.payload.resortId]: action.payload.status },
      }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    case 'UPDATE_ALERT_LOG':
      return {
        ...state,
        alertLog: { ...state.alertLog, [action.payload.resortId]: action.payload.timestamp },
      }

    default:
      return state
  }
}

// ── Context ─────────────────────────────────────────────────────────────────-
const AppContext = createContext(null)
const AppDispatchContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, null, buildInitialState)

  // Persist savedSlugs to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LS_SAVED_RESORTS, JSON.stringify(state.savedSlugs))
  }, [state.savedSlugs])

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings))
  }, [state.settings])

  // Persist alertLog to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LS_ALERT_LOG, JSON.stringify(state.alertLog))
  }, [state.alertLog])

  return (
    <AppContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppContext.Provider>
  )
}

// ── Primary hook ─────────────────────────────────────────────────────────────

/** Returns the full global state object (SPEC.md section 10). */
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

function useDispatch() {
  const dispatch = useContext(AppDispatchContext)
  if (!dispatch) throw new Error('useDispatch must be used within AppProvider')
  return dispatch
}

// ── Action dispatcher hooks (SPEC.md section 10) ─────────────────────────----

/** Toggles a resort slug in savedSlugs. */
export function useSaveResort() {
  const dispatch = useDispatch()
  return (slug) => dispatch({ type: 'TOGGLE_SAVED_RESORT', payload: slug })
}

/** Sets forecast data for a resortId (in-memory only). */
export function useSetForecast() {
  const dispatch = useDispatch()
  return (resortId, data) => dispatch({ type: 'SET_FORECAST', payload: { resortId, data } })
}

/** Sets AI summary text for a resortId (in-memory only). */
export function useSetSummary() {
  const dispatch = useDispatch()
  return (resortId, text) => dispatch({ type: 'SET_SUMMARY', payload: { resortId, text } })
}

/** Sets loading state for a resortId: 'idle' | 'loading' | 'done' | 'error' */
export function useSetLoadingState() {
  const dispatch = useDispatch()
  return (resortId, status) => dispatch({ type: 'SET_LOADING_STATE', payload: { resortId, status } })
}

/** Merges a partial settings update into settings (persisted). */
export function useUpdateSettings() {
  const dispatch = useDispatch()
  return (partial) => dispatch({ type: 'UPDATE_SETTINGS', payload: partial })
}

/** Updates the alert log timestamp for a resortId (persisted). */
export function useUpdateAlertLog() {
  const dispatch = useDispatch()
  return (resortId, timestamp) => dispatch({ type: 'UPDATE_ALERT_LOG', payload: { resortId, timestamp } })
}
