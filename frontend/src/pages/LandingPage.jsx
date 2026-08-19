import { ArrowRight, CheckCircle2, Clock3, Download, FileCheck2, LockKeyhole, ShieldCheck, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'

const features = [
  { icon: LockKeyhole, title: 'Encrypted transfer', text: 'Protect file sharing with secure access controls and encrypted handoff.' },
  { icon: ShieldCheck, title: 'Integrity verification', text: 'Verify file integrity to detect tampering before sharing or downloading.' },
  { icon: Clock3, title: 'Expiring links', text: 'Set share expiration windows to reduce risk and enforce time-based access.' },
  { icon: Download, title: 'Download limits', text: 'Control how often a shared file can be downloaded with built-in limits.' },
  { icon: FileCheck2, title: 'Access logs', text: 'Monitor key events like upload, access, revoke, and integrity checks.' },
  { icon: UploadCloud, title: 'Secure uploads', text: 'Upload files with validation and clear status updates across devices.' },
]

export default function LandingPage() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.25),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.2),_transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Trusted secure sharing
              </div>

              <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Secure file sharing for modern teams.
              </h1>

              <p className="mt-6 max-w-xl text-lg text-slate-300">
                Share sensitive files with confident protection, controlled access, and audit visibility designed for security-first teams.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/register">
                  <Button className="gap-2">
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary">Login to workspace</Button>
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-300">
                <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-cyan-300" /> End-to-end protection</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Integrity checking</span>
                <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-cyan-300" /> Expiring links</span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300">File security overview</p>
                    <p className="mt-2 text-2xl font-semibold text-white">Protected</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300 ring-1 ring-emerald-500/30">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {['Integrity verified', 'Encrypted transit', 'Access log enabled', 'Share expiry enforced'].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Security features</p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Built for secure collaboration</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
