import type { Timetable } from './timetable'
import type { UserProfile } from './profile'

/**
 * New-user setup progress.
 *
 * Every step's done-state is DERIVED from the user's real data rather than stored
 * as a flag, so progress can never disagree with reality: existing users see an
 * accurate figure straight away, and a step un-ticks itself if the underlying data
 * is later removed. The only things persisted on the profile document are the two
 * pieces that aren't derivable — whether the welcome modal has been shown, and
 * whether the checklist has been dismissed.
 */
export interface OnboardingStep {
  id: string
  label: string
  /** Why the step is worth doing — shown under the label while incomplete. */
  detail: string
  done: boolean
  href: string
  cta: string
}

export interface OnboardingState {
  steps: OnboardingStep[]
  doneCount: number
  total: number
  percent: number
  complete: boolean
  /**
   * True when the account holds no data at all. Used to decide whether to greet
   * someone with the welcome modal — it means long-standing users (who predate the
   * onboardingWelcomeSeen flag entirely) are never shown a "welcome" they've
   * already outgrown.
   */
  isBrandNew: boolean
}

export function buildOnboarding(params: {
  profile: UserProfile | null
  timetable: Timetable | null
  programCount: number
  entryCount: number
}): OnboardingState {
  const { profile, timetable, programCount, entryCount } = params

  const hasSchool = !!profile?.school?.trim()
  const hasTimetable = !!timetable && Object.keys(timetable.cells ?? {}).length > 0
  const hasTerms = (timetable?.terms ?? []).some((t) => t?.start && t?.end)
  const hasProgram = programCount > 0
  const hasEntry = entryCount > 0

  const steps: OnboardingStep[] = [
    {
      id: 'school',
      label: 'Add your school and state',
      detail: 'Gives daywise the curriculum context for your outcomes.',
      done: hasSchool,
      href: '/app/settings#profile',
      cta: 'Add',
    },
    {
      id: 'timetable',
      label: 'Set up your timetable',
      detail: 'Import a PDF, Word or Excel file — or build it by hand.',
      done: hasTimetable,
      href: '/app/timetable',
      cta: 'Set up',
    },
    {
      id: 'terms',
      label: 'Add your term dates',
      detail: 'Powers Week A/B, your recording streak and term reports.',
      done: hasTerms,
      href: '/app/timetable',
      cta: 'Add',
    },
    {
      id: 'program',
      label: 'Upload a teaching program',
      detail: 'Lets daywise match each recording to a lesson automatically.',
      done: hasProgram,
      href: '/app/programs',
      cta: 'Upload',
    },
    {
      id: 'record',
      label: 'Record your first lesson',
      detail: 'Talk for a minute after class — daywise writes the evidence.',
      done: hasEntry,
      href: '/app/record',
      cta: 'Record',
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const total = steps.length

  return {
    steps,
    doneCount,
    total,
    percent: Math.round((doneCount / total) * 100),
    complete: doneCount === total,
    isBrandNew: !hasSchool && !hasTimetable && !hasProgram && !hasEntry,
  }
}
