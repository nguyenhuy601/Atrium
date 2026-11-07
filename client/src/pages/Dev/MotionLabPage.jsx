import { useMemo, useState } from 'react';
import {
  BrandPageLoader,
  FetchBar,
  GradientButton,
  InlineBusy,
  Modal,
  MotionButton,
  MotionTextField,
  SkeletonBlock,
  TabIndicator,
  TabPanelMotion,
  Toast,
} from '../../components/Shared';
import useGsapReveal from '../../motion/useGsapReveal';
import useScrollReveal from '../../motion/useScrollReveal';
import { VH_MOTION_CARD, VH_MOTION_ROW } from '../../motion/classes';
import { MOTION_SURFACE_LIST } from '../../motion/catalog';
import {
  VH_MOTION_BASE_MS,
  VH_MOTION_FAST_MS,
  VH_MOTION_PRESS_MS,
  VH_MOTION_SLOW_MS,
} from '../../motion/tokens';

const LAB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fetch', label: 'Fetch' },
  { id: 'scroll', label: 'Scroll' },
  { id: 'overlay', label: 'Overlay' },
];


/**
 * Showcase Enterprise Motion SoT (CSS + Motion + GSAP).
 * Public route `/dev/motion-lab` — Playwright / QA visual.
 */
export default function MotionLabPage() {
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [tab, setTab] = useState('overview');
  const [fetching, setFetching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const revealRef = useGsapReveal({ deps: [] });
  const scrollRef = useScrollReveal({ deps: [tab] });
  const readyCount = useMemo(
    () => MOTION_SURFACE_LIST.filter((s) => s.status === 'ready').length,
    []
  );

  return (
    <div
      className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-8"
      data-testid="motion-lab-root"
    >
      <FetchBar active={fetching} />

      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-2" data-motion-reveal-item>
          <p className="text-sm font-medium text-muted-foreground">Atrium · Enterprise Motion</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Motion Lab
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Token {VH_MOTION_FAST_MS}/{VH_MOTION_BASE_MS}/{VH_MOTION_SLOW_MS}/{VH_MOTION_PRESS_MS}
            ms · {readyCount}/{MOTION_SURFACE_LIST.length} surfaces ready · không bounce.
          </p>
        </header>

        <div
          className="flex gap-2"
          role="tablist"
          aria-label="Motion lab sections"
          data-testid="motion-lab-tabs"
        >
          {LAB_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`motion-lab-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                className={[
                  'relative rounded-lg px-3 py-1.5 text-sm font-medium vh-motion-btn',
                  active ? 'text-primary-foreground' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {active ? <TabIndicator layoutId="motion-lab-tab-indicator" /> : null}
                <span className="relative z-[1]">{item.label}</span>
              </button>
            );
          })}
        </div>

        <TabPanelMotion activeKey={tab}>
          {tab === 'overview' ? (
            <section
              ref={revealRef}
              className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
              data-testid="motion-lab-primitives"
            >
              <div data-motion-reveal-item>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Buttons
                </h2>
                <div className="flex flex-wrap gap-3">
                  <MotionButton
                    data-testid="motion-lab-btn-primary"
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md"
                    onClick={() => setTapCount((n) => n + 1)}
                  >
                    MotionButton
                  </MotionButton>
                  <GradientButton
                    data-testid="motion-lab-btn-gradient"
                    variant="shell"
                    onClick={() => setTapCount((n) => n + 1)}
                  >
                    GradientButton
                  </GradientButton>
                  <MotionButton
                    data-testid="motion-lab-btn-busy"
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold"
                    disabled
                  >
                    <InlineBusy /> Busy
                  </MotionButton>
                </div>
                <p className="mt-2 text-xs text-muted-foreground" data-testid="motion-lab-tap-count">
                  Taps: {tapCount}
                </p>
              </div>

              <div data-motion-reveal-item>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Text field
                </h2>
                <label htmlFor="motion-lab-email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <MotionTextField
                  id="motion-lab-email"
                  data-testid="motion-lab-input"
                  type="email"
                  value={email}
                  invalid={invalid}
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-lg border border-border bg-[var(--input-background)] px-3 text-sm"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInvalid(false);
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <MotionButton
                    type="button"
                    data-testid="motion-lab-validate"
                    className="rounded-lg bg-muted px-4 py-2 text-sm font-medium"
                    onClick={() => setInvalid(!email.includes('@'))}
                  >
                    Validate
                  </MotionButton>
                  {invalid ? (
                    <span
                      role="alert"
                      className="self-center text-sm text-destructive"
                      data-testid="motion-lab-error"
                    >
                      Email không hợp lệ
                    </span>
                  ) : null}
                </div>
              </div>

              <div data-motion-reveal-item>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Row / Card
                </h2>
                <ul className="overflow-hidden rounded-xl border border-border">
                  {['Workspace', 'Projects', 'Communicate'].map((label) => (
                    <li key={label} className={`${VH_MOTION_ROW} cursor-default px-4 py-3 text-sm`}>
                      {label}
                    </li>
                  ))}
                </ul>
                <div
                  className={`${VH_MOTION_CARD} mt-4 rounded-xl border border-border bg-surface p-4`}
                  data-testid="motion-lab-card"
                >
                  <p className="text-sm font-medium">Card lift</p>
                  <p className="mt-1 text-xs text-muted-foreground">Hover: +2px Y + shadow</p>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'fetch' ? (
            <section
              className="space-y-4 rounded-2xl border border-border bg-card p-6"
              data-testid="motion-lab-fetch"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Loading / Fetch
              </h2>
              <MotionButton
                data-testid="motion-lab-toggle-fetch"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                onClick={() => setFetching((v) => !v)}
              >
                {fetching ? 'Stop FetchBar' : 'Start FetchBar'}
              </MotionButton>
              <div data-testid="motion-lab-skeleton">
                <SkeletonBlock lines={4} />
              </div>
              <p className="text-xs text-muted-foreground">
                QueryStateView dùng SkeletonBlock khi loading; FetchBar cho isFetching nền.
              </p>
              <div>
                <h3 className="mb-2 text-sm font-medium">BrandPageLoader (Suspense / HMR)</h3>
                <div
                  className="relative h-[22rem] overflow-hidden rounded-2xl border border-border"
                  data-testid="motion-lab-page-loader"
                >
                  <BrandPageLoader className="!min-h-full h-full" showFetchBar={false} />
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'scroll' ? (
            <section
              ref={scrollRef}
              className="space-y-4 rounded-2xl border border-border bg-card p-6"
              data-testid="motion-lab-scroll"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Scroll reveal
              </h2>
              <p className="text-sm text-muted-foreground">
                Các block dưới fade-up khi vào viewport (GSAP ScrollTrigger, once).
              </p>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`scroll-${i}`}
                  data-motion-scroll
                  className="rounded-xl border border-border bg-muted/40 px-4 py-6 text-sm"
                >
                  Scroll block {i + 1}
                </div>
              ))}
            </section>
          ) : null}

          {tab === 'overlay' ? (
            <section
              className="space-y-4 rounded-2xl border border-border bg-card p-6"
              data-testid="motion-lab-overlay"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Overlay (Motion)
              </h2>
              <div className="flex flex-wrap gap-2">
                <MotionButton
                  data-testid="motion-lab-open-modal"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  onClick={() => setModalOpen(true)}
                >
                  Open Modal
                </MotionButton>
                <MotionButton
                  data-testid="motion-lab-show-toast"
                  className="rounded-lg bg-muted px-4 py-2 text-sm font-medium"
                  onClick={() => setToastVisible(true)}
                >
                  Show Toast
                </MotionButton>
              </div>
              <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Motion Modal"
                size="sm"
              >
                <p className="text-sm text-muted-foreground">
                  Enter/exit qua MotionPresence + motionModalPanel (220ms).
                </p>
              </Modal>
              {toastVisible ? (
                <Toast
                  message="Toast Motion SoT"
                  type="success"
                  onClose={() => setToastVisible(false)}
                />
              ) : null}
            </section>
          ) : null}
        </TabPanelMotion>

        <section className="rounded-2xl border border-border bg-card/60 p-4" data-testid="motion-lab-catalog">
          <h2 className="mb-2 text-sm font-semibold">Catalog surfaces</h2>
          <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {MOTION_SURFACE_LIST.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-foreground">{s.id}</span> · {s.status} · {s.engine}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
