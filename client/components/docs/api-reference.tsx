import {
  API_BURST_PER_MINUTE,
  formatUsd,
  INCLUDED,
  limitsFor,
  PINNED_VERSION_KEPT_DAYS,
  PLAN_LABELS,
  PRICES_USD,
  TEMPLATE_PACK,
  TEST_API_CALLS_PER_MONTH,
  TRIAL_DAYS,
} from '@temply/shared/plans';
import type { ReactNode } from 'react';
import { CodeTabs } from '~/components/docs/code-tabs';
import { FigureDataMap } from '~/components/docs/figure-data-map';
import { FigureKeys } from '~/components/docs/figure-keys';
import { Block, Caching, Code, H2, H3, P } from '~/components/docs/docs-content';
import { API_ORIGIN, errorSnippets, listSnippet, metaSnippet, renderSnippets, sendSnippets, SNIPPET_LANGUAGES } from '~/lib/api-snippets';
import { docsPanelRows } from '~/components/docs/panel';
import { cn } from '~/lib/classname';

const EXAMPLE = 'tpl_AbCd1234';

/** A definition list for fields and codes: term, then what it means. */
function Fields({ rows }: { rows: [string, string][] }) {
  return (
    <dl className={cn(docsPanelRows, 'mt-5 max-w-2xl divide-y divide-line')}>
      {rows.map(([term, meaning]) => (
        <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="font-mono text-ui text-ink">{term}</dt>
          <dd className="text-ui text-muted">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

const number = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-GB') : 'Unlimited');

const trial = limitsFor('trial');
const team = limitsFor('team');
const enterprise = limitsFor('enterprise');

function Anchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-accent-ink underline-offset-4 transition-colors duration-fast ease-out hover:underline motion-reduce:transition-none">
      {children}
    </a>
  );
}

/**
 * The reference for the two public endpoints. Everything a light integration
 * needs on one screen, in the reader's own language: the paths come from the
 * same module the server routes on, and the limits from the same table
 * billing enforces, so this page cannot quietly go stale.
 */
export function ApiReference() {
  return (
    <section>
      <H2 id="api">The API</H2>
      <P>
        Two endpoints, both under <Code>{API_ORIGIN}/api/public/v1</Code>. One
        tells you about a template; the other turns it into the email you send.
        Your app requests the rendered email with data for the recipient,
        then sends the result through your email provider.
      </P>

      <div className="mt-10">
        <H3 id="api-keys">Keys</H3>
        <P>
          Every request carries a key as a bearer token:{' '}
          <Code>Authorization: Bearer tply_live_…</Code>. Create keys under
          Settings → API keys. A <strong className="font-medium text-ink">live</strong>{' '}
          key renders what you last published and counts toward your plan; live
          keys work on every plan, the free trial included. A{' '}
          <strong className="font-medium text-ink">test</strong> key (
          <Code>tply_test_…</Code>) renders your current draft, published or not, so
          staging always shows what you are working on; it is free on every plan and
          stops at {TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} calls a month.
          Revoking a key takes effect on the next request.
        </P>
        <FigureKeys />
      </div>

      <div className="mt-10">
        <H3 id="api-templates">List templates</H3>
        <P>
          <Code>GET /templates</Code> returns the templates this key can access,
          sorted by most recently changed. A live key lists published templates; a
          test key also lists drafts.
        </P>
        <Block>{listSnippet()}</Block>
        <Fields
          rows={[
            ['templates', 'One entry per template: id, shortCode, title, previewText, publishedAt, version, updatedAt. These match the fields returned for a single template.'],
            ['mode', '"live" for published templates or "test" for drafts.'],
          ]}
        />
      </div>

      <div className="mt-10">
        <H3 id="api-template">Get a template</H3>
        <P>
          <Code>GET /templates/:id</Code> returns template metadata. Use the{' '}
          <Code>tpl_…</Code> ID shown at the top of the editor. Check the timestamp
          to decide whether to render again.
        </P>
        <Block>{metaSnippet(EXAMPLE)}</Block>
        <Fields
          rows={[
            ['id', 'The internal id. Use shortCode for requests.'],
            ['shortCode', 'The tpl_… id this template answers to.'],
            ['title', 'The template’s name, which is also its subject line.'],
            ['previewText', 'The line inboxes show under the subject.'],
            ['publishedAt', 'When it was last published; null if never.'],
            ['version', 'The number the live copy went live as, the one to pin. null when this key serves the draft.'],
            ['updatedAt', 'When the copy this key serves last changed. Cache on this.'],
            ['mode', '"live" for the published version or "test" for the draft.'],
          ]}
        />
      </div>

      <div className="mt-10">
        <H3 id="api-render">Render a template</H3>
        <P>
          <Code>POST /templates/:id/render</Code> with a JSON body carrying the data
          for this send. You get back the email as HTML and as plain text, with your
          data already in it. It renders the live copy; add a{' '}
          <Code>version</Code> to render an earlier one (<Anchor href="#api-versions">Pin a version</Anchor>).
        </P>
        <CodeTabs languages={SNIPPET_LANGUAGES} snippets={renderSnippets(EXAMPLE)} />
        <Fields
          rows={[
            ['html', 'The full email document, ready to hand to your provider.'],
            ['text', 'The same email with the markup stripped, for the multipart alternative.'],
            ['shortCode', 'Echoed back.'],
            ['version', 'The version rendered: the one you pinned, or the live one. null for a test key that did not pin, which renders the draft.'],
            ['updatedAt', 'When the rendered copy last changed, as returned by GET. For a pinned version, when it went live.'],
            ['mode', '"live" or "test".'],
          ]}
        />
      </div>

      <div className="mt-10">
        <H3 id="api-data">The data object</H3>
        <P>
          Each key in <Code>data</Code> matches a variable in the template:{' '}
          <Code>{'{{firstName}}'}</Code> reads <Code>data.firstName</Code>. Every
          required variable needs a value. A missing value returns 422 with a
          list of missing keys. Placeholders set in the editor are for previews only.
          A pill marked optional renders as nothing when its
          value is missing. Booleans drive “Show if”: a block gated
          on <Code>isMember</Code> is dropped when <Code>data.isMember</Code> is false
          and kept when it is true or absent. Omit <Code>data</Code> entirely and you
          get the email with placeholders intact and all conditional blocks
          showing, as in the editor.
        </P>
        <FigureDataMap />
        <Block>{JSON.stringify({ data: { firstName: 'Ada', isMember: true } }, null, 2)}</Block>
        <P>
          A <strong className="font-medium text-ink">Repeat</strong> block reads a list.
          Its “Repeat over” key names an array in <Code>data</Code>, and the blocks
          inside come out once per item: a variable inside the block reads the
          current item first (<Code>{'{{name}}'}</Code> is <Code>items[0].name</Code>,
          then <Code>items[1].name</Code>…), and falls back to the top level of{' '}
          <Code>data</Code> when the item has no such field. An empty list, or no
          key at all, renders the block zero times. A value that is not a list is a
          422 naming the key.
        </P>
        <Block>
          {JSON.stringify(
            {
              data: {
                firstName: 'Ada',
                items: [
                  { name: 'Notebook', price: '£12' },
                  { name: 'Pen', price: '£3' },
                ],
              },
            },
            null,
            2,
          )}
        </Block>
      </div>

      <div className="mt-10">
        <H3 id="api-versions">Pin a version</H3>
        <P>
          A render serves the live copy, so whatever you publish reaches every app on
          its next call. To move on your own schedule, send the number of the version
          you built against as <Code>version</Code>. It comes back as it was when it
          went live, filled with the data you send. The number is{' '}
          <Code>version</Code> on the metadata call and on every render.
        </P>
        <Block>{JSON.stringify({ data: { firstName: 'Ada' }, version: 2 }, null, 2)}</Block>
        <P>
          Say a shared template gains a required variable in version 3. Apps pinned to
          version 2 keep rendering with the data they send today. Each app adds the new
          value to its data, checks it against version 3 (a test key can pin too), then
          pins 3 or drops the pin to follow the live copy.
        </P>
        <P>
          Temply keeps the latest {INCLUDED.versionsPerTemplate} versions of a template
          ({TEMPLATE_PACK.versionsPerTemplate} with a template pack) and removes older
          ones as you publish. An older version an app pins stays while it is in use:
          each pinned call refreshes it, and it can be removed {PINNED_VERSION_KEPT_DAYS}{' '}
          days after the last one. The first pinned call starts that, so pin before the
          version drops out of the latest {INCLUDED.versionsPerTemplate}. A removed
          version answers 410, and a number that was never made answers 404. A pinned
          call counts toward your calls like any other.
        </P>
      </div>

      <div className="mt-10">
        <H3 id="api-send">Send it</H3>
        <P>
          Temply stops at the finished email; your provider delivers it. The
          subject is the template’s <Code>title</Code>, from the metadata call, and
          the render’s <Code>html</Code> and <Code>text</Code> are the two parts of
          one multipart message. Send both to support inboxes that prefer
          plain text. Resend is shown because it is what Temply itself sends
          through; any provider takes the same three things.
        </P>
        <CodeTabs languages={SNIPPET_LANGUAGES} snippets={sendSnippets(EXAMPLE)} />
        <P>
          Every call counts, so render once per email, not once per recipient,
          and cache on <Code>updatedAt</Code> rather than fetching metadata before
          every send. The timestamp changes on publish for live keys and on
          save for test keys.{' '}
          <Anchor href="#caching">Caching</Anchor> shows the pattern.
        </P>
      </div>

      <Caching />

      <div className="mt-10">
        <H3 id="api-errors">Errors and limits</H3>
        <P>
          Every error is JSON with a <Code>status</Code>, a <Code>message</Code> you
          can show, and an <Code>errors</Code> list. The codes:
        </P>
        <Fields
          rows={[
            ['401', 'No key, an unknown key, or a revoked one.'],
            ['404', 'The template does not exist in this account, it has not been published and you are using a live key, or the version you pinned was never made.'],
            ['410', 'The version you pinned was removed to make room for newer ones. Pin a newer version, or leave version out for the live copy.'],
            ['422', 'A required variable is missing from data, or a Repeat value is not a list. Missing variables are listed under missing in the response.'],
            ['402', 'The workspace’s trial or plan has ended, so its live keys are paused. Nothing is deleted, and the key works again once someone subscribes on the Plan page. Test keys are not affected.'],
            ['429', `The key exceeded its per-minute rate limit, or the trial workspace used its ${number(trial.maxApiCalls)} monthly live calls. Rate-limit responses include Retry-After in seconds. Trial limits reset next month or when someone subscribes. The message identifies the limit.`],
            ['500', 'The stored template could not be read. Open it in the editor and save.'],
          ]}
        />
        <P>
          Calls with a live key count toward a monthly total that resets on the first
          of each month, UK time. Lists, metadata, and renders all count,
          including repeated requests. <Anchor href="#caching">Cache</Anchor> results
          where you can.
          Test keys have their own{' '}
          {TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} a month on every plan. On top of
          the month, one key may make {API_BURST_PER_MINUTE.live} calls a minute
          ({API_BURST_PER_MINUTE.test} for a test key); past that the call is refused
          without counting, and Retry-After says how long to wait.
        </P>
        <P>
          Two answers deserve code of their own. A 422 lists the values to add
          under <Code>missing</Code>, so the fix is in your data, not a retry. A 429
          with <Code>Retry-After</Code> is the burst: the refused call was not
          counted, so waiting that long and trying again costs nothing. A 429
          without that header means the trial’s monthly allowance is used up.
          Stop automatic retries for this response or a 402 and ask a workspace
          admin to subscribe.
        </P>
        <CodeTabs languages={SNIPPET_LANGUAGES} snippets={errorSnippets(EXAMPLE)} />
        <Fields
          rows={[
            [PLAN_LABELS.trial, `${TRIAL_DAYS} days, no card. ${number(trial.maxApiCalls)} live calls a month, then a 429 until the month turns or someone subscribes. ${trial.maxApiKeys} live keys.`],
            [PLAN_LABELS.team, `${formatUsd(PRICES_USD.seat)} per user a month. ${number(INCLUDED.apiCalls)} live calls a month included, then ${formatUsd(PRICES_USD.overagePer1000Calls)} per 1,000 on the next invoice, with no monthly cap. ${team.maxApiKeys} live keys.`],
            [PLAN_LABELS.enterprise, `Volume agreed with you. ${number(enterprise.maxApiKeys)} live keys.`],
            [PLAN_LABELS.lapsed, `A trial or plan that ended unpaid. Live keys answer 402; test keys keep their ${TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} calls a month.`],
          ]}
        />
      </div>
    </section>
  );
}
