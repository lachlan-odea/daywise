import Reveal from '../components/Reveal'

const stats = [
  { n: '5+ hrs', l: 'saved per teacher, per week' },
  { n: '30 sec', l: 'to record a full lesson' },
  { n: '100%', l: 'of lessons documented' },
  { n: '1 click', l: 'from classroom to report' },
]

export default function Stats() {
  return (
    <section className="py-8">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 px-6 py-12 text-white sm:px-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(500px circle at 20% 20%, #17a085, transparent 55%), radial-gradient(500px circle at 80% 80%, #3491f0, transparent 55%)',
              }}
            />
            <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.l} className="text-center">
                  <p className="bg-gradient-to-r from-teal-300 to-sky-300 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl">
                    {s.n}
                  </p>
                  <p className="mt-2 text-sm font-medium text-navy-200">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
