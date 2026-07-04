import type { Plan } from './profile'

export const UNLIMITED = Infinity

export interface Entitlements {
  /** Max number of teaching programs. */
  maxPrograms: number
  /** Whether this plan is a paid/complimentary (non-Starter) plan. */
  paid: boolean
}

const ENTITLEMENTS: Record<Plan, Entitlements> = {
  starter: { maxPrograms: 1, paid: false },
  pro: { maxPrograms: UNLIMITED, paid: true },
  school: { maxPrograms: UNLIMITED, paid: true },
  perpetual: { maxPrograms: UNLIMITED, paid: true },
}

export function entitlementsFor(plan?: Plan): Entitlements {
  return ENTITLEMENTS[plan ?? 'starter']
}
