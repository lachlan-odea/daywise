const items = [
  'Primary schools',
  'High schools',
  'Faculty leaders',
  'Casual & relief teachers',
  'Graduate teachers',
  'Accreditation evidence',
  'NESA & AITSL aligned',
  'Independent & public',
]

export default function TrustBar() {
  return (
    <section className="border-y border-navy-100 bg-cloud/60 py-8">
      <div className="container-page">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-navy-400">
          Built for the way real classrooms work
        </p>
        <div className="mask-fade-x relative mt-5 overflow-hidden">
          <div className="flex w-max animate-marquee gap-10">
            {[...items, ...items].map((item, i) => (
              <span key={i} className="whitespace-nowrap text-lg font-bold text-navy-300">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
