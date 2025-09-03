/**
 * Supabase client configuration and auth utilities
 */

import { createClient } from '@supabase/supabase-js'

// These would normally come from environment variables
// For demo purposes, we'll make them configurable in the UI
export interface SupabaseConfig {
  url: string
  anonKey: string
}

let supabaseClient: ReturnType<typeof createClient> | null = null
let currentConfig: SupabaseConfig | null = null

/**
 * Create or get the Supabase client with the current configuration
 */
export function getSupabaseClient(config?: SupabaseConfig) {
  if (config && (config.url !== currentConfig?.url || config.anonKey !== currentConfig?.anonKey)) {
    // Configuration changed, create new client
    currentConfig = config
    supabaseClient = createClient(config.url, config.anonKey)
  } else if (!supabaseClient && config) {
    // First time setup
    currentConfig = config
    supabaseClient = createClient(config.url, config.anonKey)
  }

  if (!supabaseClient) {
    throw new Error('Supabase client not configured. Please provide URL and anon key.')
  }

  return supabaseClient
}

/**
 * Clear the current Supabase client (used when switching projects)
 */
export function clearSupabaseClient() {
  supabaseClient = null
  currentConfig = null
}

/**
 * Get the current Supabase configuration
 */
export function getCurrentConfig(): SupabaseConfig | null {
  return currentConfig
}

/**
 * Extract project ref from Supabase URL
 */
export function extractProjectRef(url: string): string {
  try {
    const match = url.match(/https:\/\/([a-zA-Z0-9]+)\.supabase\.co/)
    return match ? match[1] : ''
  } catch {
    return ''
  }
}

/**
 * Validate Supabase URL format
 */
export function isValidSupabaseUrl(url: string): boolean {
  try {
    return /^https:\/\/[a-zA-Z0-9]+\.supabase\.co\/?$/.test(url)
  } catch {
    return false
  }
}

/**
 * Validate Supabase anon key format (basic check)
 */
export function isValidAnonKey(key: string): boolean {
  return key.length > 50 && key.startsWith('eyJ')
}