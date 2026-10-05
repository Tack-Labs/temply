import type { CSSProperties, ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import {
  formatUsd,
  INCLUDED,
  limitsFor,
  MAX_TEMPLATE_PACKS,
  PRICES_USD,
  TEMPLATE_PACK,
  TRIAL_DAYS,
} from '@temply/shared/plans';
import { BlockPalette } from '~/components/marketing/block-palette';
import { ContactForm } from '~/components/marketing/contact-form';
import { HeroBackground } from '~/components/marketing/hero-background';
import { HeroShowreel } from '~/components/marketing/hero-showreel';
import { Kicker } from '~/components/marketing/kicker';
import { ScrollToTop } from '~/components/marketing/scroll-to-top';
import { SeatStepper } from '~/components/marketing/seat-stepper';
import { ShowcaseRow } from '~/components/marketing/showcase-row';
import {
  ApiMock,
  EditorMock,
  PreviewMock,
  VariablesMock,
} from '~/components/marketing/showcase-visuals';
import { Button } from '~/components/ui/button';
import { Badge, Card } from '~/components/ui/surfaces';
import { Parallax, RevealSection } from '~/components/marketing/motion';
import { cn } from '~/lib/classname';
import { SALES_EMAIL } from '~/lib/site';

const calls = (n: number) => n.toLocaleString('en-US');

const storage = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${bytes / 1024 ** 3} GB` : `${bytes / 1024 ** 2} MB`;

const trial = limitsFor('trial');
const team = limitsFor('team');
const enterprise = limitsFor('enterprise');

// Every figure comes from the plan rules the API enforces, so the page cannot
// promise a limit the server does not keep.
const tiers = [
  {
    name: 'Free trial',
    price: formatUsd(0),
    period: `for ${TRIAL_DAYS} days`,
    summary: 'Every new workspace starts here. No card needed.',
    features: [
      `${calls(trial.maxApiCalls)} live API calls`,
      `${INCLUDED.templates} templates, ${INCLUDED.versionsPerTemplate} versions of each`,
      `${storage(trial.maxStorageBytes)} of storage`,
      `${trial.maxApiKeys} live keys and ${trial.maxBrands} brands`,
    ],
  },
  {
    name: 'Team',
    price: formatUsd(PRICES_USD.seat),
    period: 'per user a month',
    summary: 'Each member of your organisation is a seat, prorated when someone joins or leaves.',
    features: [
      `${calls(INCLUDED.apiCalls)} live API calls a month`,
      `Then ${formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000 calls, pro rata, on the next invoice`,
      `${INCLUDED.templates} templates, ${INCLUDED.versionsPerTemplate} versions of each`,
      `${storage(team.maxStorageBytes)} of storage`,
      `${team.maxApiKeys} live keys and ${team.maxBrands} brands`,
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    summary: 'For high volume, longer history, or a contract of your own.',
    features: [
      'Unlimited templates',
      `${enterprise.maxVersions} versions of each`,
      'API volume agreed with you',
      'Unlimited keys, brands and storage',
    ],
  },
] as const;

/** Position in the hero's entrance sequence. The stagger is declared beside the
 *  element it belongs to rather than in a stack of numbered CSS classes. */
const enterAt = (ms: number) => ({ '--enter-delay': `${ms}ms` }) as CSSProperties;

// Four rows, in the order the work actually happens: build it, check it, ship
// it, reuse it. That sequence is why the rows carry stage labels instead of
// decorative numbering.
const showcase: Array<{
  stage: string;
  title: string;
  description: string;
  visual: ReactNode;
  band?: boolean;
  action?: ReactNode;
}> = [
  {
    stage: 'Build',
    title: 'Build emails with blocks',
    description:
      'Add your logo, headings, text, and buttons. Arrange them on the canvas, and Temply generates the email HTML.',
    visual: <EditorMock />,
  },
  {
    stage: 'Check',
    title: 'See it the way the inbox will',
    description:
      'Check your email before sending, including how it looks when an inbox forces dark mode.',
    visual: <PreviewMock />,
  },
  {
    stage: 'Ship',
    title: 'Pull it into your app with one request',
    description:
      'Send a template ID and your data to the API. Get back HTML and plain text, ready for your email provider.',
    visual: <ApiMock />,
    // The one row on the accent fill, so the page has a single loud moment and
    // it is the moment the product reaches the reader's own code.
    band: true,
    action: (
      <Button
        asChild
        variant="secondary"
        size="lg"
        className="border-transparent bg-canvas text-accent hover:border-transparent hover:bg-canvas-accent-wash focus-visible:outline-canvas"
      >
        <Link href="/docs">Read the API docs</Link>
      </Button>
    ),
  },
  {
    stage: 'Reuse',
    title: 'Placeholders in, brand on top',
    description:
      'Drop dynamic placeholders anywhere and fill them at request time. Save a brand once and reuse the same look across every template you build.',
    visual: <VariablesMock />,
  },
];

// Only components that exist. "Social Links" used to be listed here; the block
// it referred to shipped a stranger's personal profiles into users' mail and
// has been removed, so the claim went with it.
const components = [
  'Logo', 'Buttons', 'Variables', 'Text formatting', 'Images',
  'Alignment', 'Dividers', 'Spacers', 'Headers & footers',
  'Lists', 'Quotes', 'Custom HTML', 'Sections', 'Columns',
  'Repeat blocks', 'Show-if conditions',
];

export default function HomeContent() {
  return (
    // No background class here on purpose: the body already paints bg-surface,
    // and an opaque wrapper would hide the fixed dot field below it.
    // overflow-x-clip: the showcase washes intentionally bleed past their
    // panels; clip keeps that bleed from becoming a horizontal scrollbar on
    // phones (clip, unlike hidden, creates no scroll container).
    <div className="overflow-x-clip">
      {/* One dot field for the whole page, fixed so the content scrolls over
          it like a workbench — this is what keeps the mid-page from going
          flat. Sections with their own opaque band (Blocks) carry their own
          texture instead. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklab, var(--ds-ink) 6%, transparent) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <section className="relative overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-20 pb-24 sm:pt-28">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,31rem)_minmax(0,1fr)] lg:gap-10">
            <div>
              <p
                className="hero-enter inline-flex items-center gap-2.5 rounded-full border border-line bg-raised p-1 pr-4 text-base text-muted shadow-xs"
                style={enterAt(0)}
              >
                <Badge tone="accent" className="px-3 py-0.5 text-base font-semibold">
                  Free trial
                </Badge>
                {TRIAL_DAYS} days, no card needed
              </p>
              {/* Each sentence starts on its own line, so the break falls after
                  the full stop. Each sentence can wrap at smaller widths. The space
                  after the first is real, so the heading still reads, and
                  indexes, as one sentence. */}
              <h1
                className="hero-enter mt-6 font-display text-4xl font-semibold tracking-display text-ink lg:text-5xl"
                style={enterAt(70)}
              >
                <span className="block text-balance">Emails that feel like you. </span>
                <span className="block text-balance">Ready for your app.</span>
              </h1>
              <p
                className="hero-enter mt-6 max-w-md text-xl text-pretty text-muted"
                style={enterAt(150)}
              >
                Create receipts, welcome emails and password resets with simple building blocks. Your team can update the words, and your app fills in each customer’s details and sends the finished email.
              </p>
              <div
                className="hero-enter mt-9 flex flex-wrap items-center gap-3"
                style={enterAt(230)}
              >
                <Button asChild variant="primary" size="lg">
                  <Link href="/sign-up">Start your free trial<ArrowRightIcon /></Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/playground">Try the editor, no account</Link>
                </Button>
              </div>
              <p className="hero-enter mt-4 max-w-md text-base text-balance text-muted" style={enterAt(310)}>
                14 days free, then $5 per person a month. Your app keeps the email provider you already use.
              </p>
            </div>

            {/* The entrance and the parallax both write `transform`, so they get
                one element each instead of fighting over the same one. */}
            <div className="hero-enter min-w-0" style={enterAt(390)}>
              <Parallax
                speed={0.12} max={36}
                className="will-change-transform"
              >
                <HeroShowreel />
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      <section id="features" data-anchor className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 pt-24 sm:pt-32">
          <RevealSection className="max-w-2xl">
            <Kicker>The workflow</Kicker>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-display text-balance text-ink lg:text-4xl">
              A clear path from idea to inbox
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
              Build the email, try it with example details, then publish a version your app can use. Changes stay in your draft until you’re ready to share them.
            </p>
          </RevealSection>

          <div className="mt-20 flex flex-col gap-24 sm:gap-32">
            {showcase.slice(0, 2).map((row, index) => (
              <ShowcaseRow
                key={row.stage}
                stage={row.stage}
                title={row.title}
                description={row.description}
                visual={row.visual}
                flipped={index % 2 === 1}
              />
            ))}
          </div>
        </div>

        {/* A section of its own so the accent runs edge to edge. The row's
            title stays an h3 under the one h2 above, so the outline still
            reads Build, Check, Ship, Reuse in order. */}
        <section id="ship" data-anchor className="mt-24 bg-accent sm:mt-32">
          <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
            <ShowcaseRow
              stage={showcase[2].stage}
              title={showcase[2].title}
              description={showcase[2].description}
              visual={showcase[2].visual}
              action={showcase[2].action}
              band={showcase[2].band}
            />
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
          <ShowcaseRow
            stage={showcase[3].stage}
            title={showcase[3].title}
            description={showcase[3].description}
            visual={showcase[3].visual}
            flipped
          />
        </div>
      </section>

      <section id="blocks" data-anchor className="relative overflow-hidden border-t border-line bg-sunken">
        {/* The hero's dot texture, quieter, so the sunken band reads as part of
            the same room rather than a flat cut. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in oklab, var(--ds-ink) 7%, transparent) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
          }}
        />
        <RevealSection className="relative mx-auto max-w-5xl px-5 py-24 sm:py-32">
          <div className="max-w-2xl">
            <Kicker>The slash menu</Kicker>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-display text-balance text-ink lg:text-4xl">
              Blocks in the box
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
              Press{' '}
              <kbd className="rounded-xs border border-line bg-raised px-1.5 py-0.5 font-mono text-sm">
                /
              </kbd>{' '}
              anywhere on the canvas and the whole set is one keystroke away.
            </p>
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,25rem)_1fr] lg:items-start lg:gap-16">
            <Parallax
              speed={0.05}
              max={16}
              relative
              className="will-change-transform"
            >
              <BlockPalette />
            </Parallax>

            <Parallax
              speed={0.09}
              max={26}
              relative
              className="will-change-transform"
            >
              <p className="font-mono text-2xs tracking-wide text-muted uppercase">
                All sixteen blocks
              </p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {components.map((component) => (
                  <li
                    key={component}
                    className="rounded-sm border border-line bg-raised px-2.5 py-1 text-sm text-muted"
                  >
                    {component}
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-sm text-base leading-relaxed text-muted">
                Nest sections and columns, repeat a block over a list, or show one
                only when a condition holds.
              </p>
            </Parallax>
          </div>
        </RevealSection>
      </section>

      <section id="pricing" data-anchor className="border-t border-line">
        <RevealSection className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
          <div className="max-w-2xl">
            <Kicker>Pricing</Kicker>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-display text-balance text-ink lg:text-4xl">
              One price per person, after a free trial
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
              Every workspace gets {TRIAL_DAYS} days free, no card needed. After
              that you pay for the people on the team, and the calls, templates
              and history most teams need come with them.
            </p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {tiers.map((tier) => {
              const headingId = `tier-${tier.name.toLowerCase().replace(/\s+/g, '-')}`;
              return (
                <Card
                  key={tier.name}
                  inset={false}
                  role="group"
                  aria-labelledby={headingId}
                  className={cn(
                    'flex min-w-0 flex-col rounded-2xl p-6 sm:p-7',
                    tier.name === 'Team' && 'border-accent ring-1 ring-accent',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={headingId} className="text-lg font-semibold text-ink">
                      {tier.name}
                    </h3>
                    {tier.name === 'Team' ? <Badge tone="accent">After the trial</Badge> : null}
                  </div>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-display text-4xl font-semibold tracking-display tabular-nums text-ink">
                      {tier.price}
                    </span>
                    {tier.period ? <span className="text-sm text-muted">{tier.period}</span> : null}
                  </p>
                  <p className="mt-3 text-sm text-pretty text-muted">{tier.summary}</p>

                  {tier.name === 'Team' ? <SeatStepper /> : null}

                  <ul className="mt-6 space-y-2.5 border-t border-line pt-6">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm text-ink">
                        <CheckIcon className="mt-0.5 size-4 shrink-0 text-success-ink" aria-hidden />
                        <span className="min-w-0">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* The footers sit on the card's floor so the three line up
                      whatever the lists above them run to. */}
                  <div className="mt-auto pt-8">
                    {tier.name === 'Free trial' ? (
                      <>
                        <Button asChild variant="primary" className="w-full">
                          <Link href="/sign-up">Start your free trial</Link>
                        </Button>
                        <p className="mt-3 text-xs text-pretty text-muted">
                          When it ends, the workspace turns read-only until someone
                          subscribes. Nothing is deleted.
                        </p>
                      </>
                    ) : tier.name === 'Team' ? (
                      <p className="text-xs text-pretty text-muted">
                        Subscribe from the Plan page, during the trial or after it.
                        Cancel whenever you like; the plan runs to the end of the month.
                      </p>
                    ) : (
                      <Button asChild variant="secondary" className="w-full">
                        <a href={`mailto:${SALES_EMAIL}?subject=Temply%20Enterprise`}>Contact sales</a>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card
            inset={false}
            role="group"
            aria-labelledby="tier-template-pack"
            className="mt-4 flex flex-wrap items-center justify-between gap-x-10 gap-y-4 rounded-2xl p-6 sm:p-7"
          >
            <div className="min-w-0 max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="tier-template-pack" className="text-lg font-semibold text-ink">Template pack</h3>
                <Badge>Add to Team</Badge>
              </div>
              <p className="mt-2 text-sm text-pretty text-muted">
                +{TEMPLATE_PACK.templates} templates for each pack, and with any
                pack every template keeps its last {TEMPLATE_PACK.versionsPerTemplate}{' '}
                versions instead of {INCLUDED.versionsPerTemplate}. Add up to{' '}
                {MAX_TEMPLATE_PACKS} from the Plan page.
              </p>
            </div>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-display text-3xl font-semibold tracking-display tabular-nums text-ink">
                {formatUsd(PRICES_USD.templatePack)}
              </span>
              <span className="text-sm text-muted">per pack a month</span>
            </p>
          </Card>

          {/* Every call is billed, so how an integrator calls is part of the
              price. The advice sits beside the numbers, not only in the docs. */}
          <Card className="mt-4 flex gap-3 rounded-2xl border-accent-ink/25 bg-accent-wash p-5 shadow-none sm:p-6">
            <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
            <p className="min-w-0 text-sm text-pretty text-muted">
              <strong className="font-semibold text-ink">Every render counts as a call, repeats included.</strong>{' '}
              Render a broadcast once and send the same HTML to everyone, and cache
              on the template&apos;s{' '}
              <code className="rounded-xs border border-line bg-raised px-1 py-0.5 font-mono text-xs text-ink">
                updatedAt
              </code>{' '}
              instead of rendering on every send.{' '}
              <Link href="/docs#caching" className="font-medium text-accent-ink underline-offset-4 hover:underline">
                How to cache
              </Link>
            </p>
          </Card>

          <p className="mt-6 text-sm text-muted">
            Prices are in US dollars, before tax. Payments are processed by Stripe.
          </p>
        </RevealSection>
      </section>

      <section id="contact" data-anchor className="border-t border-line bg-sunken">
        <RevealSection


          className="mx-auto grid max-w-5xl gap-12 px-5 py-24 sm:py-32 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16"
        >
          <div>
            <Kicker>Contact</Kicker>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-display text-balance text-ink lg:text-4xl">
              Let&apos;s build something
            </h2>
            <p className="mt-4 max-w-md text-lg text-pretty text-muted">
              Get in touch with questions, feedback, or to discuss an enterprise plan.
            </p>
          </div>
          <div className="min-w-0 max-w-xl">
            <ContactForm />
          </div>
        </RevealSection>
      </section>


      <ScrollToTop />
    </div>
  );
}
