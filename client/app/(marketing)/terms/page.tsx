import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, List, P, Section, Strong } from '~/components/legal/legal-page';
import { LEGAL } from '~/lib/legal';
import { formatUsd, INCLUDED, PRICES_USD, TEST_API_CALLS_PER_MONTH, TRIAL_DAYS } from '@temply/shared/plans';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The agreement between you and Temply when you use the product.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro={`These terms are the agreement between you and ${LEGAL.operator} when you use ${LEGAL.product}. They are written to be read; if anything is unclear, ask.`}
      sibling={{ href: '/privacy', label: 'Privacy policy' }}
    >
      <Section id="agreement" title="1. The agreement">
        <P>
          By creating an account or using {LEGAL.product} you agree to these terms. If you are using it on behalf of a
          company or another organization, you confirm you may bind them to these terms, and “you” means that
          organization.
        </P>
        <P>
          You must be at least 16 to hold an account. {LEGAL.product} is a tool for building and delivering
          transactional email; it is not a mailing-list or marketing-blast service.
        </P>
      </Section>

      <Section id="service" title="2. What the service is">
        <P>
          {LEGAL.product} is a block editor that produces email HTML, a place to keep the templates and brands you
          build, and an API that returns the rendered email to your own application. Your application sends the
          email; we hand you the markup.
        </P>
        <P>
          The editor can be tried without an account. Saving, publishing, the API and team features need one.
        </P>
      </Section>

      <Section id="account" title="3. Your account and workspace">
        <List
          items={[
            'Every account belongs to a workspace. The person who creates a workspace is its admin and can invite others, set the plan and delete the workspace.',
            'Keep your sign-in and your API keys secret. Anything done with them is done by you. Revoke a key the moment you think it has leaked; a revoked key stops working at once.',
            'Deleting a workspace deletes its templates, brands, images and keys, and cancels its subscription. This cannot be undone.',
          ]}
        />
      </Section>

      <Section id="content" title="4. Your content">
        <P>
          The templates, text, images and data you put into {LEGAL.product} are yours. We claim no rights in them
          beyond what is needed to store them, render them, show them to the people you share them with, and return
          them through the API — that is, to run the service for you.
        </P>
        <P>You are responsible for what you build and send with it. You agree not to use {LEGAL.product} to:</P>
        <List
          items={[
            'send unsolicited email, or email that breaks the law where you or the recipient are',
            'impersonate another person or organization, or copy their branding to mislead',
            'host or distribute malware, phishing, or content that is illegal to publish',
            'probe, overload or interfere with the service, or use it to attack anyone else',
          ]}
        />
        <P>
          We may remove content or suspend an account that breaks these rules. Where it is reasonable we will tell
          you first.
        </P>
      </Section>

      <Section id="plans" title="5. Plans, limits and billing">
        <P>
          Every new workspace starts with a {TRIAL_DAYS}-day free trial. It needs no card and comes with limits,
          including {INCLUDED.apiCalls.toLocaleString('en-GB')} live API calls a month. The current limits and prices
          are on our <Link href="/#pricing" className="text-accent-ink underline-offset-4 hover:underline">pricing</Link>{' '}
          and on the <Link href="/dashboard/settings/plan" className="text-accent-ink underline-offset-4 hover:underline">plan page</Link>.
        </P>
        <List
          items={[
            <>
              <Strong>When the trial ends.</Strong> Without a subscription the workspace becomes read-only: you can
              still sign in and see everything you built, and test keys keep their{' '}
              {TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} calls a month, but editing, publishing, uploading
              and creating keys stop, and live API keys are refused, until someone subscribes. Nothing is deleted.
            </>,
            <>
              <Strong>The Team plan.</Strong> {formatUsd(PRICES_USD.seat)} a month for each member of the workspace,
              billed monthly in advance. When someone joins or leaves, the charge is prorated for the rest of the
              period. Template packs are optional, at {formatUsd(PRICES_USD.templatePack)} a month each, billed the
              same way. Your subscription renews automatically until you cancel.
            </>,
            <>
              <Strong>API usage.</Strong> The Team plan includes {INCLUDED.apiCalls.toLocaleString('en-GB')} live API
              calls a month. Calls past that are billed at {formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000, pro
              rata, in arrears on the next invoice. Every call counts, including repeats. During the trial, calls past
              its allowance are refused, not billed. On every plan each key also has a per-minute rate, and calls
              past it are refused, not billed.
            </>,
            <>
              <Strong>Payments.</Strong> We sell the plan to you; Stripe processes the payment. Stripe is our
              payment processor, not the merchant of record, and your card details go to Stripe and never reach us.
            </>,
            <>
              <Strong>Prices.</Strong> Prices are in US dollars, before tax. Any tax due where you are is added to
              the invoice.
            </>,
            <>
              <Strong>Cancelling.</Strong> Cancel any time from the billing portal on the plan page. Your plan stays
              active until the end of the period you have paid for, and calls past the allowance in that period are
              still billed. After that the workspace becomes read-only, as at the end of a trial, and nothing is
              deleted.
            </>,
            <>
              <Strong>Refunds.</Strong> If the service was unavailable for a substantial part of a billing period, or
              you were charged in error, tell us within 30 days and we will refund that period. We do not otherwise
              refund partial periods.
            </>,
            <>
              <Strong>Price changes.</Strong> We will give at least 30 days’ notice by email before a price change
              applies to you.
            </>,
          ]}
        />
      </Section>

      <Section id="availability" title="6. Availability and changes">
        <P>
          We aim to keep {LEGAL.product} running and will tell you about planned maintenance where we can, but we do
          not promise uninterrupted service. We may change or retire features; where a change removes something you
          rely on, we will give notice and, where we reasonably can, a way to export what you built.
        </P>
        <P>
          Rendered email is tested against the common clients, but every client renders HTML its own way. Preview
          before you ship; we cannot promise a given inbox shows a template exactly as the editor does.
        </P>
      </Section>

      <Section id="liability" title="7. Liability">
        <P>
          {LEGAL.product} is provided as is. To the extent the law allows, {LEGAL.operator} is not liable for indirect
          or consequential loss, lost profits, or lost data, and our total liability to you in any twelve-month
          period is limited to what you paid us in that period. Nothing in these terms limits liability that cannot
          be limited by law.
        </P>
      </Section>

      <Section id="ending" title="8. Ending the agreement">
        <P>
          You can end it by deleting your workspace and account. We can end it by giving you 30 days’ notice, or at
          once if you break these terms. When it ends, your right to use the service stops; sections 4, 7 and 9
          continue to apply.
        </P>
      </Section>

      <Section id="general" title="9. General">
        <List
          items={[
            `These terms are governed by the law of ${LEGAL.governingLaw}, and its courts have jurisdiction, without taking away protections you have as a consumer where you live.`,
            'If part of these terms is found unenforceable, the rest still applies.',
            'We may update these terms. The date at the top says when. For a change that materially affects you we will give notice by email or in the product before it takes effect; using the service after that is acceptance.',
            <>
              Questions go to{' '}
              <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent-ink underline-offset-4 hover:underline">
                {LEGAL.contactEmail}
              </a>
              .
            </>,
          ]}
        />
      </Section>
    </LegalPage>
  );
}
