/**
 * The prose, one named export per section, so the page file reads as a table
 * of contents rather than a wall of copy.
 */
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

/** A section heading. `scroll-mt-20` clears the sticky h-12 header when the
 *  table of contents jumps here. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-20 font-display text-2xl font-semibold tracking-tight text-balance text-ink lg:text-3xl"
    >
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="scroll-mt-20 font-display text-lg font-semibold tracking-tight text-ink"
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
        className="scroll-mt-20 font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase"
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
        Temply is a template builder for transactional email. You compose an
        email out of blocks — a logo, a heading, some copy, a button — and
        Temply writes the HTML underneath. That HTML is built from tables and
        inline styles rather than divs and a stylesheet, because that is what
        it takes to hold its shape in Outlook and the other clients that still
        parse mail the way a browser did in 2005.
      </P>
      <P>
        It is built for people who send email from their own product: a
        developer wiring up a welcome mail or a receipt, and the designer or
        marketer who wants to change the wording without opening a code editor.
        You do not write HTML, and you do not hand your sending over to anyone
        — Temply gives you the markup, your own system sends it.
      </P>
      <FigureAnatomy />
      <P>
        There are three things you work with.
      </P>
      <P>
        <strong className="font-medium text-ink">Templates</strong> are the
        emails themselves. A template holds its content — the blocks in order —
        along with a name, a subject line, and its own copy of a look. You edit
        one in the block editor and save it; it stays in your dashboard until
        you change it again.
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
        published — edits stay in your draft until you press Publish.
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
    when: 'The default — start typing and you are already in one.',
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
    when: 'For a label above a short run of text, when Heading 2 is too loud.',
  },
  {
    icon: List,
    name: 'Bullet List',
    what: 'An unordered list.',
    when: 'For items where the order does not matter — features, links, notes.',
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
    what: 'Three designed openings: a logo with text stacked or side by side, or a logo over a cover image.',
    when: 'To start an email the way most do, then change the words and the picture.',
  },
  {
    icon: FootprintsIcon,
    name: 'Footers',
    what: 'Three designed closings, in the smaller footer style: a copyright line, a feedback call to action, a company signature.',
    when: 'For the address, the unsubscribe line and the legal small print — pick the nearest and edit it down.',
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
    when: 'At the top of the email, where your mark belongs.',
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
    when: 'To point at one thing — an article, a doc, a release — with more weight than a link.',
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
    when: 'To band off part of the email — a highlighted note, a coloured panel.',
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
    when: 'To mark the seam between two parts of the email — usually before the footer.',
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
    when: 'Only when no block does what you need. Temply does not fix this markup for you, so it is on you to keep it email-safe.',
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
        the settings that belong to that block — alignment and colour for text,
        the URL and label for a button, the source and width for an image.
        Nothing is buried in a side panel that applies to everything.
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
          The editor answers to more than its menus. Everything below works
          while the cursor is in the canvas; the same list is a click away in
          the editor itself, under the question mark beside the view switch.
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
          <strong className="font-medium text-ink">Placeholder</strong> — the
          words previews, thumbnails and test sends show in its place. A real
          render never uses it: your data has to carry every value. Button
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
          The key is a free-text name, not a value chosen from a fixed list. It
          means whatever the template and the backend doing the sending agree it
          means, so pick something your own code can answer —{' '}
          <Code>isMember</Code>, <Code>hasUnpaidInvoice</Code>. One template
          then covers several cases instead of splitting into near-identical
          copies. Keys already used elsewhere in the template are offered as
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
          the same request with <Code>false</Code> — or without the key — drops it:
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
          a row of columns. On render the block comes out once per item, and a
          variable pill inside it reads the current item first — so{' '}
          <Code>{'{{name}}'}</Code> is each item’s own name — and the top level of
          your data when the item has no such field. Anything typed in plainly
          repeats as written, so a Repeat is only as useful as the pills in it.
        </P>
        <FigureRepeat />
        <P>
          In the editor you edit one item, and the rows the list would add are
          drawn faded beneath it — as many as the sample data says, two unless
          you change it in the Data panel — so the rhythm of the repetition is
          on the canvas while you write. The copies follow every keystroke and
          take no typing of their own: click one and you are back in the row.
          The marker in the margin carries the count. A Show if on a block
          inside the repeat is answered by the item too, so one item can hide a
          line the next one shows.
        </P>
        <P>
          With <Code>Repeat over</Code> set to <Code>items</Code> and a line inside
          reading <Code>{'{{name}} — {{price}}'}</Code>, this request renders two
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
        <strong className="font-medium text-ink">New template</strong>. There is
        no dialog to fill in — a starter template called Untitled Template is
        created and the editor opens on it, already holding a logo, a heading, a
        few paragraphs and a button. Edit it into your own email, or delete the
        blocks you do not want.
      </P>
      <FigureFlow />
      <P>
        Name it in the{' '}
        <strong className="font-medium text-ink">Email details</strong> section.
        The <strong className="font-medium text-ink">Subject</strong> field is
        both the subject line the recipient reads and the name the template
        goes by in your dashboard, so give it something you will recognise in a
        list. The rest of that section — From name, To, Reply To, and Preview
        Text — is the envelope around the email.
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
        the subject and preview text the way a client lists them. Two controls
        sit with it — the{' '}
        <strong className="font-medium text-ink">Preview data</strong> panel,
        which fills your variables and lets you switch conditions on and off,
        and <strong className="font-medium text-ink">Forced dark</strong>, which
        redraws the preview the way a client that inverts every email would show
        it. Neither is saved; both exist so you find the problem before a
        recipient does.
      </P>
      <P>
        Press <strong className="font-medium text-ink">Save</strong> when it
        looks right. On Pro, each save also keeps a version — the last ten — so
        an edit you regret is recoverable from{' '}
        <strong className="font-medium text-ink">History</strong>. On Free,
        saving overwrites.
      </P>
      <P>
        From there the email leaves Temply one of two ways. The{' '}
        <strong className="font-medium text-ink">HTML</strong> view shows the
        finished source with a{' '}
        <strong className="font-medium text-ink">Copy HTML</strong> button and a{' '}
        <strong className="font-medium text-ink">Download</strong> button beside it —
        take the file, drop it into whatever sends your mail, and fill the{' '}
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
        toward your plan; live keys are a Pro feature. A{' '}
        <strong className="font-medium text-ink">test</strong> key
        (<Code>tply_test_…</Code>) renders your current draft — published or
        not — so staging always shows what you are working on. Test keys are
        free on every plan and stop at 1,000 calls a month.
      </P>
    </section>
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
        colour. It holds no content — a brand never knows what your email says.
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
        <strong className="font-medium text-ink">Set as default</strong> — a
        preset works here as well as one of your own. A new template starts
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
        no longer matches anything, so the selector reads Custom — the look now
        belongs to that template alone. Custom is a state, not something you
        can pick; it appears in the list only when it is already what you have.
        Save it as a brand if you want it anywhere else.
      </P>
      <P>
        Three knobs cover most of the work.{' '}
        <strong className="font-medium text-ink">Brand color</strong> sets the
        button and link colour together, and picks black or white for the
        button label depending on which is more readable on it.{' '}
        <strong className="font-medium text-ink">Corner</strong> — Sharp, Soft,
        or Round — sets the radius on the card and the buttons.{' '}
        <strong className="font-medium text-ink">Density</strong> — Compact or
        Comfortable — sets the padding inside the card and above and below the
        email.
      </P>
      <P>
        <strong className="font-medium text-ink">Advanced</strong> opens the
        fields underneath, grouped as Page, Card, and Buttons &amp; links. Here
        you set each colour, padding, and radius on its own — a page background
        that differs from the card, a button corner that differs from the card
        corner. Temply flags a colour that would be hard to read against the
        text it sits behind, including in the forced dark mode some clients
        apply.
      </P>
    </section>
  );
}
