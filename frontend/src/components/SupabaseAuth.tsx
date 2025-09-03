/**
 * Supabase Authentication Component
 * 
 * Provides login/signup interface for Supabase projects
 */

import React, { useState } from 'react'
import { useSupabase } from '../contexts/SupabaseContext'

interface SupabaseAuthProps {
  onAuthenticated?: () => void
  className?: string
}

export function SupabaseAuth({ onAuthenticated, className = '' }: SupabaseAuthProps) {
  const { user, signIn, signUp, signOut, loading } = useSupabase()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)

    try {
      let result
      if (isSignUp) {
        result = await signUp(email, password)
        if (!result.error) {
          setMessage('Check your email for a confirmation link!')
        }
      } else {
        result = await signIn(email, password)
        if (!result.error) {
          onAuthenticated?.()
        }
      }

      if (result.error) {
        setError(result.error.message)
      }
    } catch (err) {
      setError('Authentication error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (err) {
      setError('Sign out error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (user) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-green-800">
              👤 Authenticated
            </h3>
            <p className="text-sm text-green-600 mt-1">
              {user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-green-700 hover:text-green-800 underline"
          >
            Sign Out
          </button>
        </div>
        
        <div className="mt-3 p-3 bg-green-100 rounded">
          <p className="text-sm text-green-700">
            ✅ You can now access your Supabase project with full MCP integration!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          🔐 Authenticate with Supabase
        </h2>
        <p className="text-sm text-gray-600">
          Sign in to your Supabase project to enable full database access and MCP integration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded border border-blue-200">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !email || !password}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting 
            ? (isSignUp ? 'Creating Account...' : 'Signing In...') 
            : (isSignUp ? 'Create Account' : 'Sign In')
          }
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
              setMessage('')
            }}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {isSignUp 
              ? 'Already have an account? Sign In' 
              : "Don't have an account? Sign Up"
            }
          </button>
        </div>
      </form>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          🔒 Secure Authentication
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Your credentials are handled directly by Supabase</li>
          <li>• Authentication tokens are used for MCP server access</li>
          <li>• No credentials are stored in Claude Dev Studio</li>
          <li>• Full row-level security (RLS) support</li>
        </ul>
      </div>
    </div>
  )
}