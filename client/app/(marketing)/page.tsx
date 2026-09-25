'use client';

import type { CSSProperties } from 'react';
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
import { ScrollToTop } from '~/components/marketing/scroll-to-top';
import { ShowcaseRow } from '~/components/marketing/showcase-row';
import {
  ApiMock,
  EditorMock,
  PreviewMock,
  VariablesMock,
} from '~/components/marketing/showcase-visuals';
import { Button } from '~/components/ui/button';
import { Badge, Card } from '~/components/ui/surfaces';
import { useParallax } from '~/hooks/use-parallax';
import { useReveal } from '~/hooks/use-reveal';
import { cn } from '~/lib/classname';
import { SALES_EMAIL, SITE_URL } from '~/lib/site';

// What a search engine is told this page is, in its own vocabulary: the
// company and the product, with the free trial and the per-user price named
// as such. A client component still renders on the server, so the script is
// in the HTML a crawler reads.
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: 'Temply', url: SITE_URL, logo: `${SITE_URL}/brand/logo.png` },
    {
      '@type': 'SoftwareApplication',
      name: 'Temply',
      url: SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'A block editor for transactional email. Build it without code, send it from your own app.',
      offers: [
        {
          '@type': 'Offer',
          name: 'Free trial',
          price: '0',
          priceCurrency: 'USD',
          description: `${TRIAL_DAYS} days for every new workspace, no card needed.`,
        },
        {
          '@type': 'Offer',
          name: 'Team',
          price: String(PRICES_USD.seat),
          priceCurrency: 'USD',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: String(PRICES_USD.seat),
            priceCurrency: 'USD',
            unitText: 'user per month',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
          },
        },
      ],
    },
  ],
};

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
const showcase = [
  {
    stage: 'Build',
    title: 'A block editor, not an HTML file',
    description:
      'Point and click your way down the canvas — logo, heading, copy, button, divider. Temply writes the table-based HTML underneath, so you never open it.',
    visual: <EditorMock />,
  },
  {
    stage: 'Check',
    title: 'See it the way the inbox will',
    description:
      'Preview a template as it renders across clients — including the ones that force dark mode on you — before you ship it.',
    visual: <PreviewMock />,
  },
  {
    stage: 'Ship',
    title: 'Pull it into your app with one request',
    description:
      'Every template sits behind a clean API. Authenticate with a key, fetch the HTML by template id, and render it wherever your product needs it.',
    visual: <ApiMock />,
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

export default function Home() {
  const artifactRef = useParallax(0.12, 36);
  const featuresRef = useReveal();
  const blocksRef = useReveal();
  const pricingRef = useReveal();
  const contactRef = useReveal();
  // Two speeds in the Blocks section so the palette and the chip column drift
  // relative to each other — one shared speed would just move the whole band.
  const paletteRef = useParallax(0.05, 16, { relative: true });
  const chipsRef = useParallax(0.09, 26, { relative: true });

  return (
    // No background class here on purpose: the body already paints bg-surface,
    // and an opaque wrapper would hide the fixed dot field below it.
    // overflow-x-clip: the showcase washes intentionally bleed past their
    // panels; clip keeps that bleed from becoming a horizontal scrollbar on
    // phones (clip, unlike hidden, creates no scroll container).
    <div className="overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
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
        <div className="relative z-10 mx-auto max-w-5xl px-5 pt-24 pb-28 sm:pt-32">
          <div className="mx-auto max-w-2xl text-center">
            <h1
              className="hero-enter font-display text-4xl font-semibold tracking-tight text-balance text-ink lg:text-5xl"
              style={enterAt(0)}
            >
              Write the email. We handle the HTML.
            </h1>
            <p
              className="hero-enter mx-auto mt-5 max-w-xl text-lg text-pretty text-muted"
              style={enterAt(100)}
            >
              Drag blocks into place and Temply turns them into email that holds
              together in any inbox — then pull it into your app with a clean API.
            </p>
            <div
              className="hero-enter mt-8 flex flex-wrap items-center justify-center gap-3"
              style={enterAt(200)}
            >
              <Button asChild variant="primary" size="lg">
                <Link href="/playground">Try the editor<ArrowRightIcon /></Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/docs">Documentation</Link>
              </Button>
            </div>
            <p className="hero-enter mt-3 text-sm text-muted" style={enterAt(280)}>
              No account needed to try it. Create one when you want to keep your work.
            </p>
          </div>

          {/* The entrance and the parallax both write `transform`, so they get
              one element each instead of fighting over the same one. */}
          <div className="hero-enter mt-16" style={enterAt(380)}>
            <div
              ref={artifactRef}
              className="will-change-transform"
              style={{ transform: 'translate3d(0, var(--parallax-y, 0), 0)' }}
            >
              <HeroShowreel />
            </div>
          </div>
        </div>
      </section>

      <section id="features" data-anchor className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
          <div ref={featuresRef} data-reveal className="max-w-2xl">
            <p className="font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">
              The workflow
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-ink">
              Everything you need to build emails
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
              A block editor that outputs table-based HTML, and an API that hands it
              to your app exactly as you built it.
            </p>
          </div>

          <div className="mt-20 flex flex-col gap-24 sm:gap-32">
            {showcase.map((row, index) => (
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
        <div ref={blocksRef} data-reveal className="relative mx-auto max-w-5xl px-5 py-24 sm:py-32">
          <div className="max-w-2xl">
            <p className="font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">
              The slash menu
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-ink">
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
            <div
              ref={paletteRef}
              className="will-change-transform"
              style={{ transform: 'translate3d(0, var(--parallax-y, 0), 0)' }}
            >
              <BlockPalette />
            </div>

            <div
              ref={chipsRef}
              className="will-change-transform"
              style={{ transform: 'translate3d(0, var(--parallax-y, 0), 0)' }}
            >
              <p className="font-mono text-2xs tracking-wide text-faint uppercase">
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
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" data-anchor className="border-t border-line">
        <div ref={pricingRef} data-reveal className="mx-auto max-w-5xl px-5 py-24 sm:py-32">
          <div className="max-w-2xl">
            <p className="font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">
              Pricing
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-ink">
              One price per person, after a free trial
            </h2>
            <p className="mt-4 max-w-xl text-lg text-pretty text-muted">
              Every workspace gets {TRIAL_DAYS} days free, no card needed. After
              that you pay for the people on the team, and the calls, templates
              and history most teams need come with them.
            </p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                inset={false}
                className={cn('flex min-w-0 flex-col p-6', tier.name === 'Team' && 'border-accent')}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-ink">{tier.name}</h3>
                  {tier.name === 'Team' ? <Badge tone="accent">After the trial</Badge> : null}
                </div>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-display text-4xl font-semibold tracking-tight tabular-nums text-ink">
                    {tier.price}
                  </span>
                  {tier.period ? <span className="text-sm text-muted">{tier.period}</span> : null}
                </p>
                <p className="mt-3 text-sm text-pretty text-muted">{tier.summary}</p>

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
            ))}
          </div>

          <Card inset={false} className="mt-4 flex flex-wrap items-center justify-between gap-x-10 gap-y-4 p-6">
            <div className="min-w-0 max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-ink">Template pack</h3>
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
              <span className="font-display text-3xl font-semibold tracking-tight tabular-nums text-ink">
                {formatUsd(PRICES_USD.templatePack)}
              </span>
              <span className="text-sm text-muted">per pack a month</span>
            </p>
          </Card>

          {/* Every call is billed, so how an integrator calls is part of the
              price. The advice sits beside the numbers, not only in the docs. */}
          <Card className="mt-4 flex gap-3">
            <RefreshCwIcon className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
            <p className="min-w-0 text-sm text-pretty text-muted">
              <strong className="font-medium text-ink">Every render counts as a call, repeats included.</strong>{' '}
              Render a broadcast once and send the same HTML to everyone, and cache
              on the template&apos;s{' '}
              <code className="rounded-xs border border-line bg-sunken px-1 py-0.5 font-mono text-xs text-ink">
                updatedAt
              </code>{' '}
              instead of rendering on every send.{' '}
              <Link href="/docs#caching" className="text-accent-ink underline-offset-4 hover:underline">
                How to cache
              </Link>
            </p>
          </Card>

          <p className="mt-6 text-sm text-muted">
            Prices are in US dollars, before tax. Payments are processed by Stripe.
          </p>
        </div>
      </section>

      <section id="contact" data-anchor className="relative overflow-hidden border-t border-line">
        {/* The page closes the way it opened: a soft indigo wash behind the
            final ask. The dot texture is the page-wide fixed field. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-[-30%] h-95 w-190 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse at center, color-mix(in oklab, var(--ds-accent) 32%, transparent), transparent 70%)',
            }}
          />
        </div>
        <div
          ref={contactRef}
          data-reveal
          className="relative mx-auto max-w-5xl px-5 py-24 text-center sm:py-32"
        >
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance text-ink lg:text-4xl">
            Let&apos;s build something
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-pretty text-muted">
            Questions, enterprise plans, or feedback — we&apos;d love to hear from you.
          </p>
          <div className="mt-10">
            <ContactForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
          <p>&copy; {new Date().getFullYear()} Temply</p>
          <nav aria-label="Legal" className="flex items-center gap-5">
            <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </Link>
            <Link href="/playground" className="text-accent-ink underline-offset-4 hover:underline">
              Try the editor
            </Link>
          </nav>
        </div>
      </footer>

      <ScrollToTop />
    </div>
  );
}
