/**
 * src/context/AppContext.jsx
 *
 * Global state management for SnowDesk with Supabase Auth integration.
 * Conforms to SPEC.md section 10 — state shape and localStorage keys.
 */

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import resortsData from '../data/resorts.json'
import { supabase } from '../lib/supabase.js'

// ── localStorage keys (fallback for logged-out users) ───────────────────────
const LS_SAVED_RESORTS = 'snowdesk_saved_slugs'
const LS_SETTINGS      = 'snowdesk_settings'
const LS_ALERT_LOG     = 'snowdesk_alert_log'

// ── Sensible defaults ────────────────────────────────────────────────────────
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

// ── Initial state ────────────────────────────────────────────────────────────
function buildInitialState() {
  return {
    resorts: resortsData,
    savedSlugs: [], // Will be loaded after auth check
    forecasts: {},
    summaries: {},
    loadingStates: {},
    settings: readLS(LS_SETTINGS, DEFAULT_SETTINGS),
    alertLog: readLS(LS_ALERT_LOG, {}),
    user: null,
    profile: null,
    authInitialized: false,
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload }
    
    case 'SET_PROFILE':
      return { ...state, profile: action.payload }
    
    case 'SET_AUTH_INITIALIZED':
      return { ...state, authInitialized: true }

    case 'SET_SAVED_SLUGS':
      return { ...state, savedSlugs: action.payload }

    case 'TOGGLE_SAVED_RESORT': {
      const slug = action.payload
      const already = state.savedSlugs.includes(slug)
      const newSlugs = already
        ? state.savedSlugs.filter((s) => s !== slug)
        : [...state.savedSlugs, slug]
      return { ...state, savedSlugs: newSlugs }
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

// ── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null)
const AppDispatchContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, null, buildInitialState)

  // ── Auth State Management ────────────────────────────────────────────────
  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        dispatch({ type: 'SET_USER', payload: session.user })
        loadUserProfile(session.user.id)
        loadSavedResortsFromSupabase(session.user.id)
      } else {
        // Load from localStorage if no session
        const savedSlugs = readLS(LS_SAVED_RESORTS, [])
        dispatch({ type: 'SET_SAVED_SLUGS', payload: savedSlugs })
      }
      dispatch({ type: 'SET_AUTH_INITIALIZED' })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      dispatch({ type: 'SET_USER', payload: user })
      
      if (user) {
        loadUserProfile(user.id)
        loadSavedResortsFromSupabase(user.id)
      } else {
        dispatch({ type: 'SET_PROFILE', payload: null })
        // Load from localStorage when logged out
        const savedSlugs = readLS(LS_SAVED_RESORTS, [])
        dispatch({ type: 'SET_SAVED_SLUGS', payload: savedSlugs })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Load user profile ────────────────────────────────────────────────────
  async function loadUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) throw error
      
      dispatch({ type: 'SET_PROFILE', payload: data })
      
      // Update settings from profile if units specified
      if (data?.units) {
        dispatch({ type: 'UPDATE_SETTINGS', payload: { units: data.units } })
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }

  // ── Load saved resorts from Supabase ─────────────────────────────────────
  async function loadSavedResortsFromSupabase(userId) {
    try {
      const { data, error } = await supabase
        .from('saved_resorts')
        .select('resort_slug')
        .eq('user_id', userId)
      
      if (error) throw error
      
      const slugs = data.map(r => r.resort_slug)
      dispatch({ type: 'SET_SAVED_SLUGS', payload: slugs })
    } catch (err) {
      console.error('Error loading saved resorts:', err)
      // Fallback to localStorage
      const savedSlugs = readLS(LS_SAVED_RESORTS, [])
      dispatch({ type: 'SET_SAVED_SLUGS', payload: savedSlugs })
    }
  }

  // ── Persist to localStorage (for logged-out users or fallback) ────────────
  useEffect(() => {
    if (!state.authInitialized) return
    
    // Only save to localStorage if user is NOT logged in
    // (When logged in, we sync to Supabase instead)
    if (!state.user && state.savedSlugs) {
      localStorage.setItem(LS_SAVED_RESORTS, JSON.stringify(state.savedSlugs))
    }
  }, [state.savedSlugs, state.user, state.authInitialized])

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings))
  }, [state.settings])

  useEffect(() => {
    localStorage.setItem(LS_ALERT_LOG, JSON.stringify(state.alertLog))
  }, [state.alertLog])

  // ── Save/Unsave Resort with Supabase sync ────────────────────────────────
  const saveResort = useCallback(async (slug) => {
    // Optimistic update
    dispatch({ type: 'TOGGLE_SAVED_RESORT', payload: slug })
    
    // Sync to Supabase if logged in
    if (state.user) {
      const isCurrentlySaved = state.savedSlugs.includes(slug)
      
      try {
        if (isCurrentlySaved) {
          // Remove from Supabase
          await supabase
            .from('saved_resorts')
            .delete()
            .eq('user_id', state.user.id)
            .eq('resort_slug', slug)
        } else {
          // Add to Supabase
          await supabase
            .from('saved_resorts')
            .insert([{ user_id: state.user.id, resort_slug: slug }])
        }
      } catch (err) {
        console.error('Error syncing saved resort:', err)
        // Revert optimistic update on error
        dispatch({ type: 'TOGGLE_SAVED_RESORT', payload: slug })
      }
    }
  }, [state.user, state.savedSlugs])

  const unsaveResort = useCallback(async (slug) => {
    if (state.savedSlugs.includes(slug)) {
      await saveResort(slug) // Toggle off
    }
  }, [state.savedSlugs, saveResort])

  // ── Context value ────────────────────────────────────────────────────────
  const contextValue = {
    ...state,
    saveResort,
    unsaveResort,
  }

  return (
    <AppContext.Provider value={contextValue}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppContext.Provider>
  )
}

// ── Primary hook ─────────────────────────────────────────────────────────────
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

// ── Action dispatcher hooks ─────────────────────────────────────────────────

export function useSetForecast() {
  const dispatch = useDispatch()
  return (resortId, data) => dispatch({ type: 'SET_FORECAST', payload: { resortId, data } })
}

export function useSetSummary() {
  const dispatch = useDispatch()
  return (resortId, text) => dispatch({ type: 'SET_SUMMARY', payload: { resortId, text } })
}

export function useSetLoadingState() {
  const dispatch = useDispatch()
  return (resortId, status) => dispatch({ type: 'SET_LOADING_STATE', payload: { resortId, status } })
}

export function useUpdateSettings() {
  const dispatch = useDispatch()
  return (partial) => dispatch({ type: 'UPDATE_SETTINGS', payload: partial })
}

export function useUpdateAlertLog() {
  const dispatch = useDispatch()
  return (resortId, timestamp) => dispatch({ type: 'UPDATE_ALERT_LOG', payload: { resortId, timestamp } })
}
