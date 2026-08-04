import {
  BookOpen,
  Calculator,
  Drama,
  FlaskConical,
  Globe,
  GraduationCap,
  HeartPulse,
  Landmark,
  Languages,
  Music,
  Palette,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { CLASS_COLORS, type ClassColor } from '../lib/timetable'

/** The icons a class can use. Keys are stored on the class doc (`ClassInfo.icon`). */
export const CLASS_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  science: { icon: FlaskConical, label: 'Science' },
  maths: { icon: Calculator, label: 'Maths' },
  english: { icon: BookOpen, label: 'English' },
  humanities: { icon: Globe, label: 'Humanities' },
  health: { icon: HeartPulse, label: 'Health & PE' },
  music: { icon: Music, label: 'Music' },
  art: { icon: Palette, label: 'Art' },
  drama: { icon: Drama, label: 'Drama' },
  technology: { icon: Wrench, label: 'Technology' },
  languages: { icon: Languages, label: 'Languages' },
  business: { icon: Landmark, label: 'Business' },
  general: { icon: GraduationCap, label: 'General' },
}

const SUBJECT_MATCHERS: [RegExp, string][] = [
  [/scien|physic|chem|biolog/i, 'science'],
  [/math|numerac/i, 'maths'],
  [/english|literac/i, 'english'],
  [/hsie|histor|geograph|societ|commerce|civic/i, 'humanities'],
  [/pdhpe|health|sport|physical educ/i, 'health'],
  [/music/i, 'music'],
  [/\bart|visual/i, 'art'],
  [/drama|dance|perform/i, 'drama'],
  [/tech|design|engineer|comput|software|stem/i, 'technology'],
  [/languag|french|japanese|german|italian|spanish|chinese|mandarin/i, 'languages'],
  [/legal|econom|business/i, 'business'],
]

/** The icon key automatically picked for a subject. */
export function subjectIconKey(subject?: string): string {
  for (const [re, key] of SUBJECT_MATCHERS) if (re.test(subject ?? '')) return key
  return 'general'
}

/** Resolves a class's icon: its chosen icon if set (and valid), else auto from the subject. */
export function classIcon(icon?: string, subject?: string): LucideIcon {
  const key = icon && icon in CLASS_ICONS ? icon : subjectIconKey(subject)
  return CLASS_ICONS[key].icon
}

/** The coloured tile with the class's icon, used on class cards and headers. */
export default function ClassIconTile({
  subject,
  icon,
  color,
  size = 44,
  iconSize = 20,
}: {
  subject?: string
  /** Explicit icon key chosen for the class; falls back to the subject's icon. */
  icon?: string
  color?: ClassColor
  size?: number
  iconSize?: number
}) {
  const Icon = classIcon(icon, subject)
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl text-white ${CLASS_COLORS[color ?? 'teal'].dot}`}
      style={{ width: size, height: size }}
    >
      <Icon size={iconSize} />
    </span>
  )
}
