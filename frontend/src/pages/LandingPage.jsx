import { ArrowRight, CheckCircle2, Clock3, Download, FileCheck2, LockKeyhole, ShieldCheck, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'

const features = [
  { icon: LockKeyhole, title: 'Encrypted Transfer', text: 'Protect file sharing with secure access controls and encrypted handoff.' },
  { icon: ShieldCheck, title: 'Integrity Verification', text: 'Verify file integrity to detect tampering before sharing or downloading.' },
  { icon: Clock3, title: 'Expiring Links', text: 'Set share expiration windows to reduce risk and enforce time-based access.' },
  { icon: Download, title: 'Download Limits', text: 'Control how often a shared file can be downloaded with built-in limits.' },
  { icon: FileCheck2, title: 'Access Logs', text: 'Monitor key events like upload, access, revoke, and integrity checks.' },
  { icon: UploadCloud, title: 'Secure Uploads', text: 'Upload files with validation and clear status updates across devices.' },
]

export default function LandingPage() {
  return (
    <div className="bg-bg text-ink">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-primary/15 bg-primary-soft px-3 py-1 text-[12px] font-medium text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Trusted secure sharing
              </span>

              <h1 className="mt-8 max-w-xl text-[40px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[48px]">
                Secure file sharing for modern teams.
              </h1>

              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
                Share sensitive files with confident protection, controlled access, and audit visibility designed for security-first teams.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register">
                  <Button className="gap-2">
                    Create account <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="secondary">Login to workspace</Button>
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap gap-6 text-[13px] text-muted">
                <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /> End-to-end protection</span>
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Integrity checking</span>
                <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" /> Expiring links</span>
              </div>
            </div>

            {/* Hero Card */}
            <div className="rounded-[14px] border border-border bg-surface p-6 shadow-[0_2px_8px_rgba(16,24,40,0.08)]">
              <div className="rounded-[12px] border border-border bg-bg p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-muted">File security overview</p>
                    <p className="mt-1.5 text-[22px] font-semibold text-ink">Protected</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-success-bg text-success">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  {['Integrity verified', 'Encrypted transit', 'Access log enabled', 'Share expiry enforced'].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface p-3 text-[13px] text-ink">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">Security Features</p>
          <h2 className="mt-3 text-[32px] font-semibold text-ink tracking-tight">Built for secure collaboration</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-[12px] border border-border bg-surface p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow duration-150 hover:shadow-[0_2px_6px_rgba(16,24,40,0.08)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
