/**
 * The prose, one named export per section, so the page file reads as a table
 * of contents rather than a wall of copy.
 */
import {
  INCLUDED,
  limitsFor,
  TEMPLATE_PACK,
  TEST_API_CALLS_PER_MONTH,
} from '@temply/shared/plans';
import { PUBLIC_API_URL } from '~/lib/site';
import {
  ArrowUpRightSquare,
  CodeXmlIcon,
  ColumnsIcon,
  FootprintsIcon,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  PanelTopIcon,
  List,
  ListOrdered,
  Minus,
  MousePointer,
  MoveVertical,
  RectangleHorizontal,
  Repeat2,
  Text,
  TextQuote,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { BlockList, type BlockRow } from '~/components/docs/block-list';
import { DemoBrands } from '~/components/docs/demo-brands';
import { DemoEditor } from '~/components/docs/demo-editor';
import { DemoShowIf } from '~/components/docs/demo-show-if';
import { FigureRepeat } from '~/components/docs/figure-repeat';
import { FigureVariable } from '~/components/docs/figure-variable';
import { FigureAnatomy } from '~/components/docs/figure-anatomy';
import { FigureFlow } from '~/components/docs/figure-flow';
import { ShortcutTable } from '~/components/docs/shortcut-table';

/* --------------------------------------------------------------- primitives */

/** A section heading. Its scroll margin is the sticky header's height plus a
 *  little air, so the table of contents lands it clear of the bar. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-[calc(var(--header-h)+1.5rem)] font-display text-2xl font-semibold tracking-display text-balance text-ink lg:text-3xl"
    >
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="scroll-mt-[calc(var(--header-h)+1.5rem)] font-display text-lg font-semibold tracking-display text-ink"
    >
      {children}
    </h3>
  );
}

/** A group of blocks inside The editor. The title is a real heading with an
 *  id, so the table of contents can carry the groups and a link can land on
 *  one. */
function BlockGroup({ id, title, blocks }: { id: string; title: string; blocks: BlockRow[] }) {
  return (
    <div className="mt-10">
      <h3
        id={id}
        className="scroll-mt-[calc(var(--header-h)+1.5rem)] font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase"
      >
        {title}
      </h3>
      <BlockList blocks={blocks} />
    </div>
  );
}

/** Body copy. `max-w-xl` is the measure the landing page reads at — the block
 *  rows below run wider on purpose, because each is two short sentences. */
export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-xl text-lg leading-relaxed text-pretty text-muted">{children}</p>
  );
}

/** Inline code and key names. */
/** A request or response shape, shown as it is sent or arrives. */
export function Block({ children }: { children: string }) {
  return (
    <pre className="mt-5 max-w-2xl overflow-x-auto rounded-md border border-line bg-raised p-4 font-mono text-sm leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-xs border border-line bg-raised px-1.5 py-0.5 font-mono text-sm text-ink">
      {children}
    </code>
  );
}

/* ------------------------------------------------------------- introduction */

export function Introduction() {
  return (
    <section>
      <H2 id="introduction">Introduction</H2>
      <P>
        Temply helps you build transactional emails with blocks for text,
        images, headings, and buttons. It generates HTML using tables and
        inline styles for compatibility with Outlook and other email clients.
      </P>
      <P>
        Developers can connect templates to their app, while designers and
        marketers edit the content visually. Temply generates the email;
        your app sends it through your email provider.
      </P>
      <FigureAnatomy />
      <P>
        There are three things you work with.
      </P>
      <P>
        <strong className="font-medium text-ink">Templates</strong> are the
        emails you build. Each template has content, a subject line, and its
        own appearance settings. You can edit and save it from your dashboard.
      </P>
      <P>
        <strong className="font-medium text-ink">Brands</strong> are saved
        looks: page and card colours, button and link colours, corner radius
        and spacing. Applying a brand copies those settings onto the template,
        so several templates can share one visual identity without you setting
        the colours again each time.
      </P>
      <P>
        The <strong className="font-medium text-ink">API</strong> is how the
        finished email reaches your app. You request a template by id with an
        API key, send the data you want dropped into it, and get back rendered
        HTML ready to hand to your mail provider. The API serves what you last
        published. Edits stay in your draft until you press Publish.
      </P>
    </section>
  );
}

/* -------------------------------------------------------------- the blocks */

const textBlocks: BlockRow[] = [
  {
    icon: Text,
    name: 'Text',
    what: 'A plain paragraph.',
    when: 'Start typing to add a paragraph.',
  },
  {
    icon: Heading1,
    name: 'Heading 1',
    what: 'The largest heading.',
    when: 'Use it once, for the line that says what the email is about.',
  },
  {
    icon: Heading2,
    name: 'Heading 2',
    what: 'A medium heading.',
    when: 'Breaks a longer email into sections.',
  },
  {
    icon: Heading3,
    name: 'Heading 3',
    what: 'A small heading.',
    when: 'For a label or subheading above a short section.',
  },
  {
    icon: List,
    name: 'Bullet List',
    what: 'An unordered list.',
    when: 'For features, links, or notes where order does not matter.',
  },
  {
    icon: ListOrdered,
    name: 'Numbered List',
    what: 'An ordered list.',
    when: 'For steps someone has to follow in sequence.',
  },
  {
    icon: TextQuote,
    name: 'Blockquote',
    what: 'Indented text with a rule down its left edge.',
    when: 'To set a quote or a pulled-out remark apart from the body copy.',
  },
];

const componentBlocks: BlockRow[] = [
  {
    icon: PanelTopIcon,
    name: 'Headers',
    what: 'Three header layouts: stacked logo and text, logo beside text, or logo above a cover image.',
    when: 'Choose a layout, then replace the text and image.',
  },
  {
    icon: FootprintsIcon,
    name: 'Footers',
    what: 'Three footer layouts: copyright, feedback, or company signature.',
    when: 'For an address, unsubscribe link, or legal text. Choose a layout and edit it.',
  },
];

const mediaBlocks: BlockRow[] = [
  {
    icon: ImageIcon,
    name: 'Image',
    what: 'A full-width image with its own alignment and link.',
    when: 'For a hero image or a screenshot that should span the card.',
  },
  {
    icon: ImageIcon,
    name: 'Logo',
    what: 'An image sized and aligned as a logo rather than as content.',
    when: 'For your company logo at the top of the email.',
  },
  {
    icon: ImageIcon,
    name: 'Inline Image',
    what: 'A small image that sits in the flow of a line of text.',
    when: 'For an icon or a badge next to words, not on a line of its own.',
  },
  {
    icon: ArrowUpRightSquare,
    name: 'Link Card',
    what: 'A bordered card with a title, description, image, and link.',
    when: 'To highlight an article, document, or release with a card.',
  },
];

const layoutBlocks: BlockRow[] = [
  {
    icon: ColumnsIcon,
    name: 'Columns',
    what: 'Splits the width into columns, each holding its own blocks.',
    when: 'For side-by-side content. Many clients collapse them on narrow screens, so keep each column able to stand alone.',
  },
  {
    icon: RectangleHorizontal,
    name: 'Section',
    what: 'A container with its own background, padding, and border around the blocks inside it.',
    when: 'To highlight a note or group content in a coloured panel.',
  },
  {
    icon: MoveVertical,
    name: 'Spacer',
    what: 'Vertical empty space of a set height.',
    when: 'To open up a gap where the default block spacing is too tight.',
  },
  {
    icon: Minus,
    name: 'Divider',
    what: 'A horizontal rule.',
    when: 'To separate parts of the email, such as the body and footer.',
  },
];

const advancedBlocks: BlockRow[] = [
  {
    icon: MousePointer,
    name: 'Button',
    what: 'A call-to-action button built from a table cell, so it renders as a solid block rather than a styled link.',
    when: 'For the one action you want the reader to take.',
  },
  {
    icon: Repeat2,
    name: 'Repeat',
    what: 'Loops the blocks inside it over an array from your data, once per item.',
    when: 'For order lines, digest items, or anything whose length you do not know when you build the template.',
  },
  {
    icon: CodeXmlIcon,
    name: 'Custom HTML',
    what: 'Raw HTML dropped into the email as written.',
    when: 'For content the other blocks cannot provide. Check that your HTML works in email clients.',
  },
];

export function Editor() {
  return (
    <section>
      <H2 id="editor">The editor</H2>
      <P>
        The canvas in the middle is the email at its real width, on the white
        background a mail client will paint. You type into it directly. Every
        paragraph, image, and button is a block, and each one has a drag handle
        in the gutter for moving it up or down the email.
      </P>
      <P>
        Press <Code>/</Code> where the next block should go and the slash menu
        opens. It lists every block; keep typing to filter it, and press Enter
        to insert the one you want. Select a block and a bubble menu appears with
        its settings: alignment and colour for text, URL and label for a
        button, or source and width for an image.
      </P>

      <DemoEditor />

      <BlockGroup id="blocks-text" title="Text" blocks={textBlocks} />
      <BlockGroup id="blocks-media" title="Media" blocks={mediaBlocks} />
      <BlockGroup id="blocks-layout" title="Layout" blocks={layoutBlocks} />
      <BlockGroup id="blocks-advanced" title="Advanced" blocks={advancedBlocks} />
      <BlockGroup id="blocks-components" title="Components" blocks={componentBlocks} />

      <P>
        The slash menu also carries a Components group with pre-built headers
        and footers. Each one inserts a small arrangement of the blocks above,
        which you then edit like anything else.
      </P>

      <div className="mt-12">
        <H3 id="shortcuts">Shortcuts</H3>
        <P>
          These shortcuts work while the cursor is in the canvas. You can also
          find them under the question mark beside the editor’s view switch.
        </P>
        <ShortcutTable />
      </div>

      <div className="mt-12">
        <H3 id="variables">Variables</H3>
        <P>
          Type <Code>@</Code> where the text should change per recipient. A
          list of the variables already in the template appears; pick one, or
          type a new name to create it. The variable sits in the copy as a pill
          you can click, which is also where you set a{' '}
          <strong className="font-medium text-ink">Placeholder</strong> for
          previews, thumbnails, and test sends. API renders use the values
          supplied in your data. Button
          labels and link URLs can be variables too.
        </P>
        <FigureVariable />
        <P>
          In the rendered HTML a variable is a{' '}
          <Code>{'{{name}}'}</Code> placeholder. When you send no data with your
          request they pass through exactly like that, so you can take the
          markup and fill it with your own templating instead of Temply&apos;s.
          Send data and each one is replaced by the matching key.
        </P>
        <P>
          The <strong className="font-medium text-ink">Preview data</strong>{' '}
          panel in the Preview view is where you check the filled version. It
          lists every variable the template uses; type a value and the preview
          redraws with real text, so you can see whether a long name breaks a
          line. Leave one empty and it stays a placeholder. Nothing you type
          here is saved with the template.
        </P>
      </div>

      <div className="mt-12">
        <H3 id="show-if">Show if</H3>
        <P>
          Select a block, open the eye button in its bubble menu, and put a key
          under <strong className="font-medium text-ink">Show if</strong>. The
          block then renders only when that key is true in the data you send.
          Leave it empty and the block always shows.
        </P>

        <DemoShowIf />

        <P>
          Choose a key your app can supply as a boolean, such as{' '}
          <Code>isMember</Code> or <Code>hasUnpaidInvoice</Code>. This lets one
          template show different content for different recipients. Keys already used elsewhere in the template are offered as
          suggestions, and hovering one outlines every block that uses it.
        </P>
        <P>
          One rule worth knowing: a request that sends no data at all shows
          every conditional block, because there is nothing to test against.
          Once you do send data, a key that is missing from it counts as false
          and the block is dropped. So send the key, even when it is false.
        </P>
        <P>
          With a block gated on <Code>isMember</Code>, this request keeps it, and
          the same request with <Code>false</Code> or without the key drops it:
        </P>
        <Block>{JSON.stringify({ data: { firstName: 'Ada', isMember: true } }, null, 2)}</Block>
      </div>

      <div className="mt-12">
        <H3 id="repeat">Repeat</H3>
        <P>
          A <strong className="font-medium text-ink">Repeat</strong> block turns a
          list in your data into a run of blocks. Insert one from the slash menu,
          set <strong className="font-medium text-ink">Repeat over</strong> to the
          key that holds the list, and build one item inside it: a line, a card,
          a row of columns. The block renders once per item. Variables read
          the current item first, so <Code>{'{{name}}'}</Code> uses that item’s
          name. If the field is missing, it reads from the top level of your
          data. Plain text repeats unchanged.
        </P>
        <FigureRepeat />
        <P>
          Edit the first item in the editor. Faded copies below it show how
          the repeat will look and update as you type. The count comes from
          your sample data, or defaults to two; change it in the Data panel.
          Clicking a copy selects the editable item. Show if conditions inside
          a Repeat also read from the current item.
        </P>
        <P>
          With <Code>Repeat over</Code> set to <Code>items</Code> and a line inside
          reading <Code>{'{{name}}: {{price}}'}</Code>, this request renders two
          lines:
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
        <P>
          An empty list, or no <Code>items</Code> key at all, renders the block
          zero times. A value that is not a list is refused with a 422 that names
          the key.
        </P>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- creating a template */

export function CreatingATemplate() {
  return (
    <section>
      <H2 id="creating-a-template">Creating a template</H2>
      <P>
        Open <strong className="font-medium text-ink">Templates</strong> in the
        dashboard and press{' '}
        <strong className="font-medium text-ink">New template</strong>. The editor
        opens with a starter called Untitled Template, containing a logo,
        heading, paragraphs, and a button. Edit these blocks or delete any
        you do not need.
      </P>
      <FigureFlow />
      <P>
        Name it in the{' '}
        <strong className="font-medium text-ink">Email details</strong> section.
        The <strong className="font-medium text-ink">Subject</strong> field is
        both the subject line the recipient reads and the name the template
        goes by in your dashboard, so give it something you will recognise in a
        list. Use From name, To, Reply To, and Preview Text to set the other
        email details.
      </P>
      <P>
        Pick a look in the{' '}
        <strong className="font-medium text-ink">Brand</strong> section above
        the content. A new template starts on whichever brand you set as your
        default; change it here, or adjust the knobs to take the template its
        own way.
      </P>
      <P>
        Compose the email in{' '}
        <strong className="font-medium text-ink">Content</strong>. Type into the
        canvas, press <Code>/</Code> for a block, drag blocks by the handle in
        the gutter until the order is right.
      </P>
      <P>
        The three buttons at the top of the Content section switch what that
        pane shows: Edit, Preview, and HTML.{' '}
        <strong className="font-medium text-ink">Preview</strong> renders the
        email exactly as it will be sent, under a mock inbox row so you can see
        the subject and preview text as they appear in an inbox. Use the{' '}
        <strong className="font-medium text-ink">Preview data</strong> panel,
        which fills your variables and lets you switch conditions on and off,
        and <strong className="font-medium text-ink">Forced dark</strong>, which
        redraws the preview the way a client that inverts every email would show
        it. These preview settings are not saved with the template.
      </P>
      <P>
        Edits save as you go, into a draft. Press{' '}
        <strong className="font-medium text-ink">Publish</strong> when it looks
        right. Every publish saves a version. You can restore previous
        versions from <strong className="font-medium text-ink">History</strong>.
        Temply keeps the last {INCLUDED.versionsPerTemplate} versions, or{' '}
        {TEMPLATE_PACK.versionsPerTemplate} with a template pack
        ({limitsFor('enterprise').maxVersions} on Enterprise).
      </P>
      <P>
        From there the email leaves Temply one of two ways. The{' '}
        <strong className="font-medium text-ink">HTML</strong> view shows the
        finished source with a{' '}
        <strong className="font-medium text-ink">Copy HTML</strong> button and a{' '}
        <strong className="font-medium text-ink">Download</strong> button.
        Use the HTML with your email provider and fill the{' '}
        <Code>{'{{placeholders}}'}</Code> yourself. The Text view saves the
        plain-text alternative the same way.
      </P>
      <P>
        Need a second pair of eyes first?{' '}
        <strong className="font-medium text-ink">Share</strong> makes a link
        anyone can open without signing in. It shows the draft as it stands,
        and you can turn it off whenever you like.
      </P>
      <P>
        Or let your app fetch it. Every template has an id shown at the top of
        the editor, in the form <Code>tpl_XXXXXXXX</Code>. Create a key under
        Settings → API keys, then post to the render endpoint with the data for
        this particular send. You get the published version: keep editing and
        nothing changes for your app until you publish again.
      </P>
      {/* The snippet is the one shipped in the editor's own help popover, so
          the docs and the product cannot drift apart. overflow-x-auto keeps a
          long URL inside the block instead of widening the page. */}
      <Block>
        {`curl -X POST \\
  -H "Authorization: Bearer tply_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"firstName":"Ada","isMember":true}}' \\
  ${PUBLIC_API_URL}/templates/tpl_XXXXXXXX/render`}
      </Block>
      <P>
        The response carries the rendered <Code>html</Code>, with your data
        already in it, ready to hand to your mail provider. Omit the{' '}
        <Code>data</Code> object and you get the same email with its
        placeholders intact.
      </P>
      <P>
        Keys come in two kinds. A <strong className="font-medium text-ink">live</strong>{' '}
        key (<Code>tply_live_…</Code>) renders what you published and counts
        toward your plan. Live keys work on every plan, the free trial
        included. When a trial or plan ends unpaid the workspace turns
        read-only, and its live keys answer <Code>402</Code> until someone
        subscribes. A <strong className="font-medium text-ink">test</strong> key
        (<Code>tply_test_…</Code>) renders your current draft, whether or not
        it has been published. Use it to test your latest edits in staging. Test
        keys are free on every plan, keep working when a workspace is read-only, and
        stop at {TEST_API_CALLS_PER_MONTH.toLocaleString('en-GB')} calls a month.
      </P>
      <P>
        Every call counts, repeats included, so render once and reuse the
        result where the email is the same.{' '}
        <a href="#caching" className="text-accent-ink underline-offset-4 hover:underline">
          Caching
        </a>{' '}
        shows how.
      </P>
    </section>
  );
}

/* ------------------------------------------------------------------ caching */

/**
 * How to call less. Every call is billed, so this is pricing advice as much
 * as engineering advice. The example is a plain block rather than CodeTabs:
 * the reference carries exactly three tabbed snippets, and a JavaScript tab
 * here would put a `fetch(` on a page that is checked for having none until
 * a reader picks one.
 */
export function Caching() {
  return (
    <div className="mt-10">
      <H3 id="caching">Caching</H3>
      <P>
        List, metadata, and render requests all count toward your monthly
        usage, including repeated requests. Cache results to reduce calls
        when an email has not changed.
      </P>
      <P>
        <strong className="font-medium text-ink">Render a broadcast once.</strong>{' '}
        When many people get the same email, render it once and hand the same{' '}
        <Code>html</Code> and <Code>text</Code> to every send: one call, not one
        per recipient. Render per recipient only where the content differs per
        recipient.
      </P>
      <P>
        <strong className="font-medium text-ink">Cache on updatedAt.</strong>{' '}
        Keep each render under the template, the data you sent and the{' '}
        <Code>updatedAt</Code> that came back with it. <Code>updatedAt</Code>{' '}
        changes on publish for live keys and on save for test keys. You can
        reuse the cached render while it stays the same. Check timestamps with
        a list call on a schedule or when you deploy.
      </P>
      <Block>
        {`# 1. On a schedule, or when you deploy: one call dates every template
curl -H "Authorization: Bearer tply_live_…" \\
  ${PUBLIC_API_URL}/templates
# → { "templates": [{ "shortCode": "tpl_AbCd1234", "updatedAt": "2026-09-01T09:30:00.000Z", … }] }

# 2. Only where updatedAt moved since you cached it: render once
curl -X POST \\
  -H "Authorization: Bearer tply_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"campaign":"autumn"}}' \\
  ${PUBLIC_API_URL}/templates/tpl_AbCd1234/render
# → keep { html, text } with that updatedAt, and send the same html to everyone`}
      </Block>
      <P>
        Never render on a page view, or on any request a visitor can repeat: a
        reload or a crawler then spends your calls. Render when you send, from
        your own server, and reuse what you rendered.
      </P>
    </div>
  );
}

/* ------------------------------------------------------------- using brands */

export function UsingBrands() {
  return (
    <section>
      <H2 id="brands">Using brands</H2>
      <P>
        A brand is a saved look. It holds the page background behind the email,
        the card background the content sits on, the padding around both, the
        corner radius, the button background and label colour, and the link
        colour. Email content is stored in the template.
      </P>

      <DemoBrands />

      <P>
        Temply ships five presets: Classic, Minimal, Corporate, Warm, and
        Slate. They are fixed, so you cannot edit or delete one, and they do not
        count against the brand limit on your plan. Your own brands live beside
        them on the Brands page. You make one by starting from a preset,
        changing what you want, and giving it a name.
      </P>
      <P>
        One brand can be marked as your default, with{' '}
        <strong className="font-medium text-ink">Set as default</strong>.
        You can choose a preset or one of your own brands. A new template starts
        from it: as long as you have not touched the look yet, opening the
        editor applies your default brand. Delete the brand that is currently
        the default and it moves to another of your brands, or back to Classic
        if you have none left.
      </P>
      <P>
        Applying a brand copies its settings onto the template. There is no
        live link afterwards. Change a brand later and the templates already
        using it keep the look they were saved with; you re-apply the brand to
        pull the change through.
      </P>
      <P>
        That copy is also what <strong className="font-medium text-ink">Custom</strong>{' '}
        means. The brand selector shows the preset or brand whose settings the
        template exactly matches. Change any colour, corner, or spacing and it
        no longer matches a saved brand, so the selector shows Custom.
        This label appears automatically. Save the settings as a brand to
        reuse them on other templates.
      </P>
      <P>
        Three knobs cover most of the work.{' '}
        <strong className="font-medium text-ink">Brand color</strong> sets the
        button and link colour together, and picks black or white for the
        button label depending on which is more readable on it.{' '}
        <strong className="font-medium text-ink">Corner</strong> sets the card
        and button corners to Sharp, Soft, or Round.{' '}
        <strong className="font-medium text-ink">Density</strong> sets Compact
        or Comfortable padding inside the card and around the email.
      </P>
      <P>
        <strong className="font-medium text-ink">Advanced</strong> opens the
        fields underneath, grouped as Page, Card, and Buttons &amp; links. Here
        you can set each colour, padding, and radius separately, including
        different backgrounds for the page and card or different corners for
        the card and buttons. Temply flags colour combinations that may be hard
        to read, including in forced dark mode.
      </P>
    </section>
  );
}
