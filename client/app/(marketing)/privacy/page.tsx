import type { Metadata } from 'next';
import { LegalPage, List, P, Section, Strong } from '~/components/legal/legal-page';
import { LEGAL, PROCESSORS } from '~/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What Temply collects, why, who else touches it, and how to get it back or deleted.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={`What ${LEGAL.product} collects about you, why, who else handles it, and how to see it, take it or delete it.`}
      sibling={{ href: '/terms', label: 'Terms of service' }}
    >
      <Section id="who" title="1. Who is responsible">
        <P>
          {LEGAL.operator} runs {LEGAL.product} and is the controller of the personal data described here. Reach us
          at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent-ink underline-offset-4 hover:underline">
            {LEGAL.contactEmail}
          </a>
          .
        </P>
      </Section>

      <Section id="what" title="2. What we collect">
        <List
          items={[
            <>
              <Strong>Account.</Strong> Your name, email address and profile picture from the sign-in provider you
              choose, and the workspaces you belong to. Held by Clerk on our behalf.
            </>,
            <>
              <Strong>What you build.</Strong> Templates, brands, uploaded images, the sample data you type into the
              preview, and the version history of each template.
            </>,
            <>
              <Strong>Billing.</Strong> Your plan, and a reference to your Stripe customer. Card numbers go to Stripe
              and never reach us.
            </>,
            <>
              <Strong>API use.</Strong> Which key was used, when, and a monthly count per workspace — enough to
              enforce the plan, not the content of your calls. The data you pass to render a template is used for that
              render and not stored.
            </>,
            <>
              <Strong>Test sends.</Strong> When you send a test email from the editor, the address you send it to
              and the rendered email pass through Resend.
            </>,
            <>
              <Strong>Contact form.</Strong> The name, email and message you submit, kept so we can answer.
            </>,
            <>
              <Strong>Errors.</Strong> When something breaks, the error, the page it happened on and the browser
              version go to Sentry. Not the contents of your editor.
            </>,
          ]}
        />
        <P>
          We do not run advertising or analytics trackers. There is no cookie banner because the only cookies are the
          ones that keep you signed in; your theme choice lives in your own browser’s storage.
        </P>
      </Section>

      <Section id="why" title="3. Why, and on what basis">
        <List
          items={[
            'To run the service you signed up for — storing your work, rendering it, serving your API calls, billing your plan. This is performance of our contract with you.',
            'To keep the service safe — rate limits, abuse prevention, error monitoring. This is our legitimate interest in running a working product, balanced against yours.',
            'To answer when you write to us. Legitimate interest, and yours too.',
            'To meet legal obligations such as tax records for payments.',
          ]}
        />
        <P>
          We send email about your account (receipts, a change to these terms, a security notice). We do not send
          marketing email.
        </P>
      </Section>

      <Section id="who-else" title="4. Who else handles it">
        <P>These services process data for us, each for one job:</P>
        <List
          items={PROCESSORS.map((p) => (
            <>
              <a href={p.site} className="text-accent-ink underline-offset-4 hover:underline" rel="noreferrer">
                {p.name}
              </a>{' '}
              — {p.purpose}.
            </>
          ))}
        />
        <P>
          Plus the hosting provider the application and its database run on. Some of these are outside the UK and
          EU; where they are, transfers rest on standard contractual clauses or an adequacy decision. We do not sell
          personal data and do not share it with anyone else, except where the law requires.
        </P>
      </Section>

      <Section id="how-long" title="5. How long we keep it">
        <List
          items={[
            'Your work: for as long as your workspace exists. Deleting a template deletes it and its history; deleting the workspace deletes everything in it, cancels the subscription, and removes the images from the image host.',
            'Account data: until you delete your account, which you can do from Settings.',
            'Billing records: as long as tax law requires, typically six years.',
            'Error reports: 90 days.',
            'Contact messages: until answered and no longer needed, at most a year.',
          ]}
        />
      </Section>

      <Section id="rights" title="6. Your rights">
        <P>
          You can see and change your account details in Settings, and take your templates out at any time — the
          HTML view of every template has a download. You can delete templates, brands, images, keys, workspaces
          and your account yourself.
        </P>
        <P>
          Where the law gives you rights to access, correct, erase, restrict or port your data, or to object to
          processing, write to {LEGAL.contactEmail} and we will act within a month. If you think we have handled your
          data wrongly you can complain to your data-protection authority.
        </P>
      </Section>

      <Section id="security" title="7. Security">
        <P>
          Everything travels over HTTPS. API keys are stored as hashes and shown once. Sessions are managed by Clerk.
          The database is backed up off the host. No system is perfectly secure; if we learn of a breach affecting
          you, we will tell you without undue delay.
        </P>
      </Section>

      <Section id="changes" title="8. Changes">
        <P>
          We will update this policy when the product or the law changes. The date at the top is the date of the
          current version; for a change that materially affects you we will say so by email or in the product.
        </P>
      </Section>
    </LegalPage>
  );
}
