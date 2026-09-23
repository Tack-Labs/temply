/**
 * Preflight: the checks a test send or export runs against the editor state.
 *
 * Everything here is pure so both the panel and its tests can run the same
 * code. The editor JSON is the source of truth for links — the renderer
 * substitutes '#' for an empty href (engine.tsx), so by the time HTML exists
 * a deliberate '#' and a forgotten one look identical.
 */

import type { TemplateDataKeys } from './template-data';

export type PreflightIssue = {
  id: string;
  severity: 'error' | 'warn';
  message: string;
  detail?: string;
  /** The ProseMirror position of the block the finding sits in — where a
   *  selection has to land to reach it, which is what lets a caller select
   *  and scroll to it. A finding on something inline (a link mark, an
   *  inline image) reports its enclosing block rather than the run itself:
   *  a NodeSelection over an inline run highlights nothing and leaves the
   *  block actions operating inside a paragraph. Absent for findings with
   *  no single spot in the document (subject, preview text, unresolved
   *  variables, size, theme contrast). */
  pos?: number;
};

/** Gmail clips messages whose HTML exceeds ~102KB; warn while approaching. */
export const GMAIL_CLIP_BYTES = 102 * 1024;
export const SIZE_WARN_BYTES = 90 * 1024;

type Mark = {
  type?: string;
  attrs?: Record<string, unknown> | null;
};

/** Same document shape template-data.ts walks, plus text and marks. */
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  marks?: Mark[] | null;
  content?: Node[] | null;
};

/**
 * The subject gates the send route itself (it rejects an empty one), so an
 * empty subject is an error here rather than a surprise 400 there. Preview
 * text is only inbox polish — a warning.
 */
export function checkFields(subject: string, previewText: string): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  if (!subject.trim()) {
    issues.push({
      id: 'subject-empty',
      severity: 'error',
      message: 'The subject is empty — the send needs one.',
    });
  }
  if (!previewText.trim()) {
    issues.push({
      id: 'preview-text-empty',
      severity: 'warn',
      message: 'No preview text — inboxes will show the first line of the email instead.',
    });
  }
  return issues;
}

/**
 * mailto: and tel: are fine destinations the URL constructor also accepts;
 * they are named here so nobody "tightens" the check into rejecting them.
 * Everything else must parse as an absolute URL — 'example.com' without a
 * protocol throws, which is exactly the mistake worth catching before send.
 */
function urlProblem(url: string): 'empty' | 'invalid' | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return 'empty';
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return null;
  try {
    new URL(trimmed);
    return null;
  } catch {
    return 'invalid';
  }
}

/** Node types whose schema allows no content of their own — a document
 *  position walk has to know this to size them right, and the JSON walked
 *  here carries no schema to ask, so the names are listed by hand. */
const LEAF_NODE_TYPES = new Set([
  'button',
  'image',
  'inlineImage',
  'logo',
  'linkCard',
  'spacer',
  'variable',
  'hardBreak',
  'horizontalRule',
]);

/** Node types that live inside a textblock rather than beside it. Their
 *  findings are reported at the enclosing block's position — see `pos`. */
const INLINE_NODE_TYPES = new Set(['text', 'inlineImage', 'variable', 'hardBreak']);

/** A node's footprint in document positions, counted the way ProseMirror
 *  counts it: text by its length, a leaf as one slot, anything else
 *  bracketed by an open and a close token around its children's footprint. */
function nodeSize(node: Node | null | undefined): number {
  if (!node || typeof node !== 'object') return 0;
  if (node.type === 'text') return node.text?.length ?? 0;
  if (node.type && LEAF_NODE_TYPES.has(node.type)) return 1;
  const children = node.content ?? [];
  return 2 + children.reduce((sum, child) => sum + nodeSize(child), 0);
}

/**
 * One walk over the document for everything content-shaped: link
 * destinations and image alt text. Variable URLs ({{url}} pills) are exempt
 * everywhere — they resolve at render time from the payload.
 */
export function collectContentFindings(content: unknown): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  // A link mark spanning styled and plain text splits into several text
  // nodes carrying the same mark; a contiguous run is one link and reports
  // once. The run ends at the first node without the mark, so three separate
  // "#" anchors in a paragraph are three findings, not one.
  let runHref: string | null = null;
  let counter = 0;

  const linkIssue = (
    kind: string,
    problem: 'empty' | 'invalid',
    url: string,
    subject: string,
    emptyMessage: string,
    detail?: string,
    pos?: number,
  ) => {
    issues.push({
      id: `${kind}-${counter++}`,
      severity: 'error',
      message:
        problem === 'empty' ? emptyMessage : `${subject} URL doesn't parse: "${url.trim()}"`,
      detail,
      pos,
    });
  };

  // `pos` is this node's own document position; `parentPos` is the position
  // of the node holding it. The doc's own children start at 0; every other
  // node's children start one slot in, past its own open token. A finding on
  // an inline node is reported at `at` — the enclosing block — because that
  // is the position a selection can actually land on.
  const walk = (node: Node | null | undefined, pos: number, parentPos: number, isRoot = false) => {
    if (!node || typeof node !== 'object') return;
    const attrs = node.attrs ?? {};
    const at = node.type && INLINE_NODE_TYPES.has(node.type) ? parentPos : pos;

    const linkMark = (node.marks ?? []).find((mark) => mark.type === 'link');
    if (linkMark) {
      const href = typeof linkMark.attrs?.href === 'string' ? linkMark.attrs.href : '';
      if (href !== runHref) {
        runHref = href;
        if (!linkMark.attrs?.isUrlVariable) {
          const problem = urlProblem(href);
          if (problem) {
            linkIssue(
              'link',
              problem,
              href,
              "A link's",
              'A link in the text has no destination yet.',
              node.text,
              at,
            );
          }
        }
      }
    } else {
      runHref = null;
    }

    if (node.type === 'button' && !attrs.isUrlVariable) {
      const url = typeof attrs.url === 'string' ? attrs.url : '';
      const problem = urlProblem(url);
      if (problem) {
        linkIssue(
          'button',
          problem,
          url,
          "A button's",
          'A button has no URL yet.',
          typeof attrs.text === 'string' ? attrs.text : undefined,
          at,
        );
      }
    }

    if (node.type === 'linkCard') {
      const link = typeof attrs.link === 'string' ? attrs.link : '';
      const problem = urlProblem(link);
      if (problem) {
        linkIssue(
          'link-card',
          problem,
          link,
          "A link card's",
          'A link card has no URL yet.',
          typeof attrs.title === 'string' ? attrs.title : undefined,
          at,
        );
      }
    }

    if (node.type === 'image' || node.type === 'inlineImage') {
      // An empty externalLink is a plain, unlinked image — only a non-empty
      // one that fails to parse is a mistake.
      const externalLink = typeof attrs.externalLink === 'string' ? attrs.externalLink : '';
      if (externalLink.trim() && !attrs.isExternalLinkVariable && urlProblem(externalLink) === 'invalid') {
        linkIssue('image-link', 'invalid', externalLink, "An image link's", '', undefined, at);
      }

      // The renderer falls back alt || title, so either one covers screen
      // readers and image-blocking clients; the logo node supplies its own.
      const alt = typeof attrs.alt === 'string' ? attrs.alt.trim() : '';
      const title = typeof attrs.title === 'string' ? attrs.title.trim() : '';
      if (!alt && !title) {
        issues.push({
          id: `image-alt-${counter++}`,
          severity: 'warn',
          message: 'An image has no alt text — clients that block images show nothing in its place.',
          pos: at,
        });
      }
    }

    const children = node.content ?? [];
    let childPos = isRoot ? 0 : pos + 1;
    for (const child of children) {
      walk(child, childPos, pos);
      childPos += nodeSize(child);
    }
  };

  walk(content as Node, 0, 0, true);
  return issues;
}

/**
 * Variable pills a test send would have no value for: nothing typed in the
 * preview data, and no placeholder on the pill to seed it. A pill with a
 * placeholder is covered — the preview data starts from it — so it is not
 * a finding; a template full of warnings the author cannot act on teaches
 * them to ignore the panel.
 */
export function unresolvedVariables(
  keys: TemplateDataKeys,
  values: Record<string, string>,
): string[] {
  // A destination has no placeholder field, but previews stand a URL in
  // for it, so it is covered the same way.
  const covered = new Set([...Object.keys(keys.placeholders ?? {}), ...(keys.urlVariables ?? [])]);
  return keys.variables.filter((key) => !values[key] && !covered.has(key));
}

/**
 * The as-sent HTML measured in bytes. Copy stays on the right side of
 * certainty: near the mark is "approaching", past it states where Gmail's
 * documented limit sits — clipping is the client's call, not ours.
 */
export function assessSize(bytes: number): PreflightIssue | null {
  const kb = Math.round(bytes / 1024);
  if (bytes >= GMAIL_CLIP_BYTES) {
    return {
      id: 'size-over',
      severity: 'error',
      message: `The email is ~${kb} KB — past the 102 KB mark where Gmail clips messages.`,
    };
  }
  if (bytes >= SIZE_WARN_BYTES) {
    return {
      id: 'size-near',
      severity: 'warn',
      message: `The email is ~${kb} KB — approaching the 102 KB mark where Gmail clips messages.`,
    };
  }
  return null;
}
