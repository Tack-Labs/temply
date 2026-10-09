import type { CSSProperties, ReactNode } from 'react';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { formatBytes } from '@temply/shared/bytes';
import {
  formatUsd,
  INCLUDED,
  limitsFor,
  PRICES_USD,
  TEMPLATE_PACK,
  TRIAL_DAYS,
} from '@temply/shared/plans';
import { BlockPalette } from '~/components/marketing/block-palette';
import { ContactForm } from '~/components/marketing/contact-form';
import { container } from '~/components/marketing/container';
import { HeroBackdrop } from '~/components/marketing/hero-background';
import { HeroShowreel } from '~/components/marketing/hero-showreel';
import { Kicker } from '~/components/marketing/kicker';
import { ScrollToTop } from '~/components/marketing/scroll-to-top';
import { SeatStepper } from '~/components/marketing/seat-stepper';
import {
  ApiMock,
  EditorMock,
  PreviewMock,
  VariablesMock,
} from '~/components/marketing/showcase-visuals';
import { WorkflowCard, type WorkflowTone } from '~/components/marketing/workflow-card';
import { Button } from '~/components/ui/button';
import { Badge, Card } from '~/components/ui/surfaces';
import { Parallax, RevealSection } from '~/components/marketing/motion';
import { cn } from '~/lib/classname';
import { SALES_EMAIL } from '~/lib/site';

const calls = (n: number) => n.toLocaleString('en-US');

/** A pricing card's list: each line is a check in the card's own wash, so the
 *  tick is drawn on the card in a pair the contrast gate already holds. */
function Features({
  items,
  tone,
  className,
}: {
  items: readonly string[];
  tone: 'success' | 'accent';
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-3 text-lg text-ink', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'grid size-6.5 shrink-0 place-items-center rounded-full',
              tone === 'success' ? 'bg-success-wash text-success-ink' : 'bg-accent-wash text-accent-ink',
            )}
          >
            <CheckIcon className="size-4" />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Position in the hero's entrance sequence. The stagger is declared beside the
 *  element it belongs to rather than in a stack of numbered CSS classes. */
const enterAt = (ms: number) => ({ '--enter-delay': `${ms}ms` }) as CSSProperties;

// Four cards, in the order the work actually happens: build it, check it, ship
// it, reuse it. That sequence is why each carries a stage label instead of
// decorative numbering, and why each stage has a wash of its own.
const workflow: Array<{
  stage: string;
  tone: WorkflowTone;
  title: string;
  description: string;
  visual: ReactNode;
}> = [
  {
    stage: 'Build',
    tone: 'lavender',
    title: 'Build emails with blocks',
    description:
      'Add your logo, headings, text, and buttons. Arrange them on the canvas, and Temply generates the email HTML.',
    visual: <EditorMock />,
  },
  {
    stage: 'Check',
    tone: 'mint',
    title: 'See it the way the inbox will',
    description:
      'Check your email before sending, including how it looks when an inbox forces dark mode.',
    visual: <PreviewMock />,
  },
  {
    stage: 'Ship',
    tone: 'peach',
    title: 'Pull it into your app with one request',
    description:
      'Send a template ID and your data to the API. Get back HTML and plain text, ready for your email provider.',
    visual: <ApiMock />,
  },
  {
    stage: 'Reuse',
    tone: 'sky',
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
  // Read at render, not at import, so the page states the plan rules as they
  // stand: it cannot promise a limit the server does not keep.
  const trial = limitsFor('trial');
  const team = limitsFor('team');
  const enterprise = limitsFor('enterprise');

  return (
    // No background class here on purpose: the body already paints bg-surface.
    // overflow-x-clip: the hero's peach disc and the parallax shifts can reach
    // past the column; clip keeps that from becoming a horizontal scrollbar on
    // phones (clip, unlike hidden, creates no scroll container).
    <div className="overflow-x-clip">
      <section>
        <div className={cn(container, 'pt-10 pb-16 md:pt-12 md:pb-20')}>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-6 md:gap-7">
              <p
                className="hero-enter inline-flex items-center gap-2.5 self-start rounded-full bg-success-wash p-1.5 pr-4 text-base font-semibold text-success-ink sm:text-ui"
                style={enterAt(0)}
              >
                <span className="rounded-full bg-raised px-3 py-0.5">Free trial</span>
                {TRIAL_DAYS} days, no card needed
              </p>
              {/* Each sentence starts on its own line, so the break falls after
                  the full stop. Each sentence can wrap at smaller widths. The space
                  after the first is real, so the heading still reads, and
                  indexes, as one sentence. The accent is the fill's violet in
                light, where it clears 5:1 and is the brand's own colour; in dark
                that same violet is 2.9:1 on the page, under the 3:1 a heading
                needs, so the lifted `accent-ink` takes over there. */}
              <h1
                className="hero-enter font-display text-4xl font-bold tracking-display text-ink md:text-68"
                style={enterAt(70)}
              >
                <span className="block text-balance">Emails that feel like you. </span>
                <span className="block text-balance text-accent dark:text-accent-ink">Ready for your app.</span>
              </h1>
              <p
                className="hero-enter max-w-125 text-18 text-pretty text-ink-soft md:text-xl"
                style={enterAt(150)}
              >
                Build receipts, welcome emails and password resets from simple blocks. Your team edits the words, and your app fills in each customer’s details and sends the finished email.
              </p>
              <div
                className="hero-enter flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3"
                style={enterAt(230)}
              >
                <Button asChild variant="primary" size="lg">
                  <Link href="/sign-up">Start your free trial<ArrowRightIcon /></Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/playground">Try the editor, no account</Link>
                </Button>
              </div>
              <p className="hero-enter max-w-md text-base text-pretty text-muted sm:text-ui" style={enterAt(310)}>
                {TRIAL_DAYS} days free, then {formatUsd(PRICES_USD.seat)} per person a month. Your app keeps the email provider you already use.
              </p>
            </div>

            {/* The entrance and the parallax both write `transform`, so they get
                one element each instead of fighting over the same one. */}
            <div className="hero-enter min-w-0" style={enterAt(390)}>
              <Parallax
                speed={0.12} max={36}
                className="will-change-transform"
              >
                <HeroBackdrop>
                  <HeroShowreel />
                </HeroBackdrop>
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      <section id="features" data-anchor>
        <div className={cn(container, 'pt-8 pb-20 md:pt-12 md:pb-28')}>
          <RevealSection className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Kicker>The workflow</Kicker>
            <h2 className="mt-4 max-w-160 font-display text-38 font-bold tracking-display text-balance text-ink md:text-48">
              A clear path from idea to inbox
            </h2>
            <p className="mt-4 max-w-155 text-lg text-pretty text-ink-soft md:text-18">
              Build the email, try it with example details, then publish a version your app can use. Changes stay in your draft until you’re ready to share them.
            </p>
          </RevealSection>

          {/* An explicit one-column track is `minmax(0, 1fr)`; the implicit one
              grows to the widest picture's minimum width and pushes every card
              past the gutter. */}
          <ol className="mt-10 grid grid-cols-1 gap-5 md:mt-14 md:grid-cols-2">
            {workflow.map((card) => (
              <WorkflowCard key={card.stage} {...card} />
            ))}
          </ol>
        </div>
      </section>

      <section id="blocks" data-anchor>
        <RevealSection className={cn(container, 'pb-20 md:pb-28')}>
          <div className="rounded-panel bg-sunken px-5 py-10 sm:p-10 md:p-14">
            <div className="max-w-2xl">
              <Kicker>The slash menu</Kicker>
              <h2 className="mt-4 font-display text-38 font-bold tracking-display text-balance text-ink md:text-48">
                Blocks in the box
              </h2>
              <p className="mt-4 max-w-xl text-lg text-pretty text-ink-soft">
                Press{' '}
                <kbd className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-base text-ink shadow-xs">
                  /
                </kbd>{' '}
                anywhere on the canvas and the whole set is one keystroke away.
              </p>
            </div>

            <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-[minmax(0,25rem)_1fr] lg:items-start lg:gap-16">
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
                <p className="text-xs font-bold tracking-wider text-muted uppercase">
                  All sixteen blocks
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {components.map((component) => (
                    <li
                      key={component}
                      className="rounded-full bg-raised px-3.5 py-1.5 text-ui font-medium text-ink-soft"
                    >
                      {component}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 max-w-sm text-base leading-relaxed text-ink-soft">
                  Nest sections and columns, repeat a block over a list, or show one
                  only when a condition holds.
                </p>
              </Parallax>
            </div>
          </div>
        </RevealSection>
      </section>

      <section id="pricing" data-anchor className="bg-sunken">
        <RevealSection className={cn(container, 'py-16 md:py-22')}>
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Kicker className="bg-raised">Pricing</Kicker>
            <h2 className="mt-4 max-w-160 font-display text-38 font-bold tracking-display text-balance text-ink md:text-48">
              One price per person, after a free trial
            </h2>
            <p className="mt-4 max-w-155 text-lg text-pretty text-ink-soft md:text-18">
              Every workspace gets {TRIAL_DAYS} days free. No card needed. After
              that you pay for the people on the team, and the calls, templates
              and history most teams need come with them.
            </p>
          </div>

          {/* The order a workspace meets the plans in, which is the order they
              stack in and a screen reader reads: the trial, then Team, then
              Enterprise. The trial is a lighter card than Team so Team stays the
              one the section is built around, and it spans the row above the
              pair rather than sharing it, which would take width from the
              stepper. From lg Team and Enterprise sit side by side, Team the
              wider (3:2). Their explicit one-column track is `minmax(0, 1fr)`,
              where the implicit one would grow to the widest word and push the
              card past the gutter. */}
          <div className="mt-10 flex flex-col gap-5 md:mt-14">
            <Card
              inset={false}
              role="group"
              aria-labelledby="tier-free-trial"
              className="grid min-w-0 grid-cols-1 gap-x-12 gap-y-5.5 rounded-card border-[1.5px] p-6 shadow-none sm:p-9 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            >
              <div className="flex min-w-0 flex-col gap-5.5 lg:row-span-2">
                <h3 id="tier-free-trial" className="font-display text-26 font-bold tracking-display text-ink">
                  Free trial
                </h3>
                <p className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className="font-display text-48 font-bold tracking-display tabular-nums text-ink">
                    {formatUsd(0)}
                  </span>
                  <span className="text-lg text-muted md:text-18">for {TRIAL_DAYS} days</span>
                </p>
                <p className="text-lg text-pretty text-ink-soft">
                  Every new workspace starts here. No card needed.
                </p>
              </div>
              <Features
                tone="success"
                className="sm:grid sm:grid-cols-2 sm:gap-x-8"
                items={[
                  `${calls(trial.maxApiCalls)} live API calls`,
                  `${trial.maxTemplates} templates, ${trial.maxVersions} versions of each`,
                  `${formatBytes(trial.maxStorageBytes)} of storage`,
                  `${trial.maxApiKeys} live keys and ${trial.maxBrands} brands`,
                ]}
              />
              <p className="text-base text-pretty text-muted">
                When it ends, the workspace turns read-only until someone
                subscribes. Nothing is deleted.
              </p>
            </Card>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card
                inset={false}
                role="group"
                aria-labelledby="tier-team"
                className="flex min-w-0 flex-col gap-5.5 rounded-card border-transparent p-6 shadow-md sm:p-9"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 id="tier-team" className="font-display text-26 font-bold tracking-display text-ink">
                    Team
                  </h3>
                  <Badge tone="accent">After the trial</Badge>
                </div>
                <p className="flex flex-wrap items-baseline gap-x-2.5">
                  <span className="font-display text-68 font-bold tracking-display tabular-nums text-ink">
                    {formatUsd(PRICES_USD.seat)}
                  </span>
                  <span className="text-lg text-muted md:text-18">per user a month</span>
                </p>
                <SeatStepper />
                <Features
                  tone="success"
                  items={[
                    `${calls(INCLUDED.apiCalls)} live API calls a month`,
                    `Then ${formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000 calls, pro rata, on the next invoice`,
                    `${INCLUDED.templates} templates, ${INCLUDED.versionsPerTemplate} versions of each`,
                    `${formatBytes(team.maxStorageBytes)} of storage`,
                    `${team.maxApiKeys} live keys and ${team.maxBrands} brands`,
                  ]}
                />
                {/* The footers sit on the card's floor, so the two buttons line
                    up whatever the lists above them run to. */}
                <div className="mt-auto flex flex-col gap-3.5">
                  <Button asChild variant="primary" size="lg" className="w-full">
                    <Link href="/sign-up">Start your free trial</Link>
                  </Button>
                  <p className="text-center text-base text-pretty text-muted">
                    Subscribe from the Plan page, during the trial or after it.
                    Cancel whenever you like; the plan runs to the end of the month.
                  </p>
                </div>
              </Card>

              <Card
                inset={false}
                role="group"
                aria-labelledby="tier-enterprise"
                className="flex min-w-0 flex-col gap-5.5 rounded-card border-[1.5px] p-6 shadow-none sm:p-9"
              >
                <h3 id="tier-enterprise" className="font-display text-26 font-bold tracking-display text-ink">
                  Enterprise
                </h3>
                <p className="font-display text-48 font-bold tracking-display text-ink">Custom</p>
                <p className="text-lg text-pretty text-ink-soft">
                  For high volume, longer history, or a contract of your own.
                </p>
                <Features
                  tone="accent"
                  items={[
                    'Unlimited templates',
                    `${enterprise.maxVersions} versions of each`,
                    'API volume agreed with you',
                    'Unlimited keys, brands and storage',
                  ]}
                />
                <Button asChild variant="secondary" size="lg" className="mt-auto w-full">
                  <a href={`mailto:${SALES_EMAIL}?subject=Temply%20Enterprise`}>Contact sales</a>
                </Button>
              </Card>
            </div>
          </div>

          <Card
            inset={false}
            role="group"
            aria-labelledby="tier-template-pack"
            className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-card border-transparent bg-warn-wash px-5 py-5 shadow-none sm:px-7"
          >
            <div className="flex max-w-160 min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <h3 id="tier-template-pack" className="text-lg font-bold text-ink">
                  Template pack
                </h3>
                <Badge tone="butter" className="bg-raised">
                  Add to Team
                </Badge>
              </div>
              <p className="text-lg text-pretty text-ink-soft">
                +{TEMPLATE_PACK.templates} templates for each pack, and with any
                pack every template keeps its last {TEMPLATE_PACK.versionsPerTemplate}{' '}
                versions instead of {INCLUDED.versionsPerTemplate}.
              </p>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold tracking-display tabular-nums text-ink">
                {formatUsd(PRICES_USD.templatePack)}
              </span>
              <span className="text-ui text-ink-soft">per pack a month</span>
            </p>
          </Card>

          {/* Every call is billed, so how an integrator calls is part of the
              price. The advice sits beside the numbers, not only in the docs. */}
          <p className="mx-auto mt-5 max-w-180 text-center text-base text-pretty text-muted">
            <strong className="font-semibold text-ink">Every render counts as a call, repeats included.</strong>{' '}
            Render a broadcast once and send the same HTML to everyone, and cache
            on the template&apos;s{' '}
            <code className="rounded-sm bg-raised px-1.5 py-0.5 font-mono text-sm text-ink shadow-xs">
              updatedAt
            </code>{' '}
            instead of rendering on every send.{' '}
            <Link
              href="/docs#caching"
              className="font-medium text-accent-ink underline decoration-accent-ink/40 underline-offset-4 transition-colors duration-fast ease-out hover:decoration-accent-ink motion-reduce:transition-none"
            >
              How to cache
            </Link>
            . Prices are in US dollars, before tax. Payments are processed by Stripe.
          </p>
        </RevealSection>
      </section>

      {/* The band's two shapes are decoration, so a screen reader skips them,
          and the box clips them: they are drawn past its corners on purpose,
          and unclipped they would be the horizontal scrollbar on a phone. They
          are static, so there is nothing for reduced motion to withhold. */}
      <section aria-labelledby="closing-heading">
        <RevealSection className={cn(container, 'pt-16 pb-12 md:pt-22 md:pb-18')}>
          <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-panel bg-accent-wash px-6 py-14 text-center sm:px-10 md:py-18">
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-9 -left-9 size-24 rounded-full bg-peach-wash sm:-bottom-10 sm:-left-8 sm:size-32 md:-bottom-15 md:-left-10 md:size-50"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -top-8 -right-8 size-24 rotate-14 rounded-card bg-success-wash sm:-right-6 sm:size-28 md:-top-10 md:-right-10 md:size-32 lg:-right-7.5 lg:size-45"
            />
            <h2
              id="closing-heading"
              className="relative max-w-155 font-display text-38 font-bold tracking-display text-balance text-ink md:text-5xl"
            >
              Ready when you are
            </h2>
            <p className="relative max-w-130 text-lg text-pretty text-ink-soft md:text-18">
              {TRIAL_DAYS} days free, no card needed. Start from a receipt, welcome
              email or password reset and make it yours.
            </p>
            <Button asChild variant="primary" size="lg" className="relative w-full sm:w-auto">
              <Link href="/sign-up">
                Start your free trial
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
        </RevealSection>
      </section>

      <section id="contact" data-anchor className="border-t border-line bg-sunken">
        <RevealSection
          className={cn(
            container,
            'grid grid-cols-1 gap-10 py-16 md:py-22 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16',
          )}
        >
          <div>
            <Kicker>Contact</Kicker>
            <h2 className="mt-4 font-display text-38 font-bold tracking-display text-balance text-ink md:text-48">
              Let&apos;s build something
            </h2>
            <p className="mt-4 max-w-md text-lg text-pretty text-ink-soft md:text-18">
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
