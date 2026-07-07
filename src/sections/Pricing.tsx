import { Link } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'
import Reveal from '../components/Reveal'

const plans = [
  {
    name: 'Starter',
    tagline: 'For the individual teacher getting started.',
    monthly: 0,
    yearly: 0,
    priceLabel: 'Free',
    cta: 'Start free',
    highlight: false,
    features: [
      '1 teaching program',
      'Record by voice or text',
      'AI evidence generation',
      'Searchable history',
      '30-day evidence retention',
    ],
  },
 /* {
    name: 'Teacher Pro',
    tagline: 'Everything a working teacher needs, all year.',
    monthly: 12,
    yearly: 9,
    priceLabel: null,
    cta: 'Start free trial',
    highlight: true,
    features: [
      'Unlimited programs & classes',
      'Full Curriculum Intelligence',
      'Timetable-based lesson matching',
      'Assessment & differentiation evidence',
      'Instant reports & PDF export',
      'Unlimited history & retention',
      'Priority support',
    ],
  },
  {
    name: 'Faculty & School',
    tagline: 'For faculties, executives and whole schools.',
    monthly: null,
    yearly: null,
    priceLabel: 'Custom',
    cta: 'Talk to us',
    highlight: false,
    features: [
      'Everything in Teacher Pro',
      'Whole-school reporting & dashboards',
      'Shared programs across staff',
      'Accreditation evidence exports',
      'Admin controls & SSO',
      'Onboarding & training',
    ],
  },*/
]

export default function Pricing() {
  const yearly = true

  return (
    <section id="pricing" className="scroll-mt-24 py-20 lg:py-28">
      <div className="container-page">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">
            Simple pricing. <span className="text-gradient-teal">Serious time saved.</span>
          </h2>
          <p className="mt-4 text-lg text-navy-600">
            Start free, upgrade when you're ready. Pro costs less than a couple of coffees a month — for hours back every
            week.
          </p>

           {/*<div className="mt-8 inline-flex items-center gap-1 rounded-full border border-navy-100 bg-white p-1 shadow-soft">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                !yearly ? 'bg-navy-800 text-white' : 'text-navy-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                yearly ? 'bg-navy-800 text-white' : 'text-navy-600'
              }`}
            >
              Yearly
              <span className="rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-navy-950">-25%</span>
            </button>
          </div>*/}
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.08} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-3xl border p-7 ${
                  plan.highlight
                    ? 'border-teal-300 bg-navy-950 text-white shadow-glow'
                    : 'border-navy-100 bg-white'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-teal-400 px-3 py-1 text-[11px] font-bold text-navy-950">
                    <Sparkles size={12} /> Most popular
                  </span>
                )}
                <h3 className={`text-lg font-bold ${plan.highlight ? 'text-white' : 'text-navy-900'}`}>{plan.name}</h3>
                <p className={`mt-1 text-sm ${plan.highlight ? 'text-navy-200' : 'text-navy-500'}`}>{plan.tagline}</p>

                <div className="mt-6 flex items-end gap-1">
                  {plan.priceLabel ? (
                    <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-navy-900'}`}>
                      {plan.priceLabel}
                    </span>
                  ) : (
                    <>
                      <span className={`text-4xl font-extrabold ${plan.highlight ? 'text-white' : 'text-navy-900'}`}>
                        ${yearly ? plan.yearly : plan.monthly}
                      </span>
                      <span className={`mb-1 text-sm ${plan.highlight ? 'text-navy-300' : 'text-navy-500'}`}>
                        /month{yearly ? ', billed yearly' : ''}
                      </span>
                    </>
                  )}
                </div>

                {plan.name === 'Faculty & School' ? (
                  <a href="#cta" className={`mt-6 w-full ${plan.highlight ? 'btn-primary' : 'btn-navy'}`}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link to="/signup" className={`mt-6 w-full ${plan.highlight ? 'btn-primary' : 'btn-navy'}`}>
                    {plan.cta}
                  </Link>
                )}

                <ul className="mt-7 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          plan.highlight ? 'bg-teal-400/20 text-teal-300' : 'bg-teal-100 text-teal-600'
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className={plan.highlight ? 'text-navy-100' : 'text-navy-700'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        {/*<p className="mt-8 text-center text-sm text-navy-500">
          Special pricing available for graduate teachers, casual/relief staff and whole schools.
        </p>*/}
      </div>
    </section>
  )
}
