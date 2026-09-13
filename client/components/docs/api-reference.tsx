import { API_BURST_PER_MINUTE, PLAN_LIMITS, TEST_API_CALLS_PER_MONTH } from '@temply/shared/plans';
import { CodeTabs } from '~/components/docs/code-tabs';
import { Block, Code, H2, H3, P } from '~/components/docs/docs-content';
import { API_ORIGIN, errorSnippets, metaSnippet, renderSnippets, sendSnippets, SNIPPET_LANGUAGES } from '~/lib/api-snippets';

const EXAMPLE = 'tpl_AbCd1234';

/** A definition list for fields and codes: term, then what it means. */
function Fields({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-5 max-w-2xl divide-y divide-line rounded-md border border-line bg-raised">
      {rows.map(([term, meaning]) => (
        <div key={term} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="font-mono text-sm text-ink">{term}</dt>
          <dd className="text-sm text-muted">{meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

const number = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-GB') : 'Unlimited');

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
        Your app never holds HTML — it asks for the finished email with the data
        for that one recipient, and hands the answer to your mail provider.
      </P>

      <div className="mt-10">
        <H3 id="api-keys">Keys</H3>
        <P>
          Every request carries a key as a bearer token:{' '}
          <Code>Authorization: Bearer tply_live_…</Code>. Create keys under
          Settings → API keys. A <strong className="font-medium text-ink">live</strong>{' '}
          key renders what you last published and counts toward your plan. A{' '}
          <strong className="font-medium text-ink">test</strong> key (
          <Code>tply_test_…</Code>) renders your current draft, published or not, so
          staging always shows what you are working on; it is free on every plan and
          stops at {TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} calls a month.
          Revoking a key takes effect on the next request.
        </P>
      </div>

      <div className="mt-10">
        <H3 id="api-template">Get a template</H3>
        <P>
          <Code>GET /templates/:id</Code> — the id is the <Code>tpl_…</Code> code
          shown at the top of the editor. It returns what your app needs to decide
          whether to re-render: nothing about the content itself.
        </P>
        <Block>{metaSnippet(EXAMPLE)}</Block>
        <Fields
          rows={[
            ['id', 'The internal id. Use shortCode for requests.'],
            ['shortCode', 'The tpl_… id this template answers to.'],
            ['title', 'The template’s name, which is also its subject line.'],
            ['previewText', 'The line inboxes show under the subject.'],
            ['publishedAt', 'When it was last published; null if never.'],
            ['updatedAt', 'When the copy this key serves last changed. Cache on this.'],
            ['mode', '"live" or "test" — which copy the key is reading.'],
          ]}
        />
      </div>

      <div className="mt-10">
        <H3 id="api-render">Render a template</H3>
        <P>
          <Code>POST /templates/:id/render</Code> with a JSON body carrying the data
          for this send. You get back the email as HTML and as plain text, with your
          data already in it.
        </P>
        <CodeTabs languages={SNIPPET_LANGUAGES} snippets={renderSnippets(EXAMPLE)} />
        <Fields
          rows={[
            ['html', 'The full email document, ready to hand to your provider.'],
            ['text', 'The same email with the markup stripped, for the multipart alternative.'],
            ['shortCode', 'Echoed back.'],
            ['updatedAt', 'As on GET — when the served copy last changed.'],
            ['mode', '"live" or "test".'],
          ]}
        />
      </div>

      <div className="mt-10">
        <H3 id="api-data">The data object</H3>
        <P>
          Each key in <Code>data</Code> matches a variable in the template:{' '}
          <Code>{'{{firstName}}'}</Code> reads <Code>data.firstName</Code>. Every
          variable in the template needs a value: a missing one is a 422 that lists
          what to add, never a silent stand-in — the placeholder set in the editor
          is for previews only. A pill marked optional renders as nothing when its
          value is missing. Booleans drive “Show if”: a block gated
          on <Code>isMember</Code> is dropped when <Code>data.isMember</Code> is false
          and kept when it is true or absent. Omit <Code>data</Code> entirely and you
          get the email with every placeholder intact and every block showing — the
          same thing the editor’s composing view shows.
        </P>
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
        <H3 id="api-send">Send it</H3>
        <P>
          Temply stops at the finished email; your provider delivers it. The
          subject is the template’s <Code>title</Code>, from the metadata call, and
          the render’s <Code>html</Code> and <Code>text</Code> are the two parts of
          one multipart message — send both, so inboxes that prefer plain text get
          the same email. Resend is shown because it is what Temply itself sends
          through; any provider takes the same three things.
        </P>
        <CodeTabs languages={SNIPPET_LANGUAGES} snippets={sendSnippets(EXAMPLE)} />
        <P>
          Cache on <Code>updatedAt</Code> rather than fetching metadata before every
          send: it moves only when the copy your key serves changes — on publish
          for a live key, on save for a test key.
        </P>
      </div>

      <div className="mt-10">
        <H3 id="api-errors">Errors and limits</H3>
        <P>
          Every error is JSON with a <Code>status</Code>, a <Code>message</Code> you
          can show, and an <Code>errors</Code> list. The codes:
        </P>
        <Fields
          rows={[
            ['401', 'No key, an unknown key, or a revoked one.'],
            ['404', 'No template with that id on this account — or, with a live key, one that has never been published.'],
            ['422', 'Data was sent but a variable has no value — the body lists them under missing — or a Repeat’s key holds something other than a list.'],
            ['429', 'Either the month’s calls are used up, or the key went past its per-minute burst. The message says which; a burst answer carries a Retry-After header in seconds.'],
            ['500', 'The stored template could not be read. Open it in the editor and save.'],
          ]}
        />
        <P>
          Calls with a live key count toward a monthly total that resets on the first
          of each month, UK time. Test keys have their own{' '}
          {TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} a month on every plan. On top of
          the month, one key may make {API_BURST_PER_MINUTE.live} calls a minute
          ({API_BURST_PER_MINUTE.test} for a test key); past that the call is refused
          without counting, and Retry-After says how long to wait.
        </P>
        <P>
          Two answers deserve code of their own. A 422 lists the values to add
          under <Code>missing</Code>, so the fix is in your data, not a retry. A 429
          carries <Code>Retry-After</Code> in seconds, and the refused call was not
          counted, so waiting that long and trying again costs nothing.
        </P>
        <CodeTabs languages={SNIPPET_LANGUAGES} snippets={errorSnippets(EXAMPLE)} />
        <Fields
          rows={[
            ['Free', `No live keys — a test key with ${TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} calls a month.`],
            ['Pro', `${number(PLAN_LIMITS.pro.maxApiCalls)} live calls a month, ${PLAN_LIMITS.pro.maxApiKeys} live keys.`],
            ['Enterprise', `${number(PLAN_LIMITS.enterprise.maxApiCalls)} live calls.`],
          ]}
        />
      </div>
    </section>
  );
}
