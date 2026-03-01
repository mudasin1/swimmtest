/**
 * src/views/Auth.jsx
 *
 * Login / Signup page with email/password authentication
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUpWithEmail, signInWithEmail } from '../lib/supabase.js'

export default function Auth() {
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName)
      } else {
        await signInWithEmail(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg-dark)' }}>
      <div className="w-full max-w-md p-8 rounded-lg" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--color-text-primary)' }}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          {isSignUp ? 'Join SnowBro to save your favorite resorts' : 'Sign in to access your saved resorts'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required={isSignUp}
                className="w-full px-3 py-2 rounded border outline-none focus:ring-2 focus:ring-blue-500"
                style={{ 
                  backgroundColor: 'var(--color-bg-dark)',
                  borderColor: 'var(--color-bg-card-hover)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="Mike"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                backgroundColor: 'var(--color-bg-dark)',
                borderColor: 'var(--color-bg-card-hover)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="mike@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 rounded border outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                backgroundColor: 'var(--color-bg-dark)',
                borderColor: 'var(--color-bg-card-hover)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="••••••••"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {isSignUp && 'Minimum 6 characters'}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded font-semibold transition-opacity disabled:opacity-50"
            style={{ 
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-bg-dark)'
            }}
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            className="text-sm hover:underline"
            style={{ color: 'var(--color-accent)' }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        {!isSignUp && (
          <div className="mt-4 text-center">
            <Link 
              to="/" 
              className="text-sm hover:underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Continue without signing in
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
