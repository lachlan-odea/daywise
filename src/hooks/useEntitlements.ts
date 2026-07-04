import { useProfile } from './useProfile'
import { entitlementsFor } from '../lib/entitlements'
import type { Plan } from '../lib/profile'

/** Resolves the current user's plan and what it entitles them to. */
export function useEntitlements() {
  const { profile, loading } = useProfile()
  const plan = (profile?.plan ?? 'starter') as Plan
  return { plan, loading, ...entitlementsFor(plan) }
}
