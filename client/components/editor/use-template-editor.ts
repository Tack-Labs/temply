'use client';

import { useMutation } from '@tanstack/react-query';
import type { CSSProperties, Dispatch, RefObject, SetStateAction } from 'react';
import type { Editor, FocusPosition, JSONContent } from '@tiptap/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { errorMessage, httpPost } from '~/lib/http';
import { createAutosave, type AutosaveStatus } from '~/lib/autosave';
import { captureThenFlush, captureThenLeave, createExitBeacon } from './exit-save';
import { hasUnpublishedChanges } from '@temply/shared/publish';
import { clearDraft, PLAYGROUND_DRAFT_ID } from '~/lib/drafts';
import { createEditorUploader } from '~/lib/assets';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import type { Mail } from '@temply/shared/schema';
import type { ContentMode } from '../content-mode-switch';
import {
  initialPreviewData,
  hasPreviewKeys,
  toPayload,
  type PreviewData,
} from '../preview-data-panel';
import { collectDataKeys, type TemplateDataKeys } from '@temply/shared/template-data';
import type { Transaction } from '@tiptap/pm/state';
import { repeatPreviewKey, setRepeatPreviewCounts } from '~/core/editor/extensions/repeat-preview';
import { storedDocument } from '~/core/editor/utils/replace-deprecated';
import {
  assessSize,
  checkFields,
  collectContentFindings,
  unresolvedVariables,
  type PreflightIssue,
} from '@temply/shared/preflight';
import { themeIssues, worstPerSubject } from '../theme-warnings';
import defaultEmailJSON from '~/lib/default-editor-json.json';
import { DEFAULT_RENDERER_THEME, type RendererThemeOptions } from '@temply/shared/theme';

type SaveTemplateResponse = {
  template: Mail;
};

/** What the draft autosave posts, with the fingerprint it was taken from so
 *  a settled save can become the new baseline, and the theme as an object
 *  so the row's theme can be kept without parsing the body back. */
type DraftSnapshot = {
  body: { title: string; previewText: string; content: string; theme: string };
  fingerprint: string;
  theme: RendererThemeOptions;
};

export type EmailEditorSandboxProps = {
  template?: Mail;
  /** False on the signed-out playground: no upload, no library, URL only. */
  imageUploads?: boolean;
  autofocus?: FocusPosition;
  /**
   * Starting values for the "Email details" fields when there is no row to
   * read them from. A saved template always takes subject and preview text
   * from its row instead — this only fills the gap for a caller that has
   * none, which today is the playground only.
   */
  seedFields?: {
    subject: string;
    previewText: string;
    fromName: string;
    to: string;
    replyTo: string;
  };
};

/** Which render a view needs. Preview and the two source views differ only in
 *  what they ask the renderer for. */
type RenderVariant = 'preview' | 'html' | 'text';

const variantFor = (mode: ContentMode): RenderVariant =>
  mode === 'html' ? 'html' : mode === 'text' ? 'text' : 'preview';

const hasKeys = hasPreviewKeys;

/** Same keys, same numbers — the test both directions of the preview-count
 *  wire make before sending, so a round trip settles. */
const sameCounts = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
};

export type TemplateEditorModel = {
  template?: Mail;
  // fields
  subject: string; setSubject: (v: string) => void;
  previewText: string; setPreviewText: (v: string) => void;
  fromName: string; setFromName: (v: string) => void;
  to: string; setTo: (v: string) => void;
  replyTo: string; setReplyTo: (v: string) => void;
  // theme
  theme: RendererThemeOptions; setTheme: (t: RendererThemeOptions) => void;
  pageStyle: CSSProperties; cardStyle: CSSProperties;
  // editor
  editor: Editor | null; setEditor: (e: Editor) => void;
  // A document, not the row's string: `storedDocument` parses and migrates it
  // once here, so nothing downstream has to know it was ever stored text.
  editorContent: JSONContent;
  /** Pulls the live document into `editorContent` at once. */
  flushContent: () => void;
  editorPaneRef: RefObject<HTMLDivElement | null>;
  paneClass: string | undefined; paneHeight: number | undefined;
  imageUploader: (file: Blob) => Promise<string>;
  pickFromLibrary: () => Promise<string | null>;
  pickerOpen: boolean; settlePick: (url: string | null) => void;
  // modes
  mode: ContentMode; changeMode: (next: ContentMode) => void; pendingMode: ContentMode | null;
  forceDark: boolean; setForceDark: Dispatch<SetStateAction<boolean>>;
  previewKeys: TemplateDataKeys; previewData: PreviewData; setPreviewData: (d: PreviewData) => void;
  refreshPreviewKeys: () => void;
  hasPreviewData: boolean;
  previewHtml: string; isPreviewPending: boolean; htmlSource: string; textSource: string;
  /** Why the last render failed, or null. The desktop stays on the edit pane
   *  and lets the toast carry it; the phone's sheet has to say it in place. */
  previewError: string | null;
  // preflight
  preflight: { issues: PreflightIssue[]; bytes: number | null };
  preflightExpanded: boolean; setPreflightExpanded: Dispatch<SetStateAction<boolean>>;
  // save / publish / send
  saveStatus: AutosaveStatus; autosave: ReturnType<typeof createAutosave> | null;
  unpublished: boolean; publishedAt: string | null; publishedLabel: string | null;
  isPublishing: boolean; publishArmed: boolean; handlePublish: () => Promise<void>;
  sendArmed: boolean; handleSend: () => Promise<void>;
  handleDiscarded: (row: Mail) => void;
  handleRestored: (row: Mail) => void;
  // short code
  shortCodeCopied: boolean; copyShortCode: () => Promise<void>;
};

/** A row's stored theme as the editor works on it. */
function themeOfRow(raw: string | null | undefined): RendererThemeOptions {
  if (raw) {
    try {
      return JSON.parse(raw) as RendererThemeOptions;
    } catch {
      // A malformed stored theme should not stop the editor opening.
    }
  }
  return structuredClone(DEFAULT_RENDERER_THEME);
}

export function useTemplateEditor(props: EmailEditorSandboxProps): TemplateEditorModel {
  const { template, seedFields } = props;

  const router = useRouter();

  const [subject, setSubject] = useState(template?.title || seedFields?.subject || '');
  const [previewText, setPreviewText] = useState(template?.preview_text || seedFields?.previewText || '');
  const [fromName, setFromName] = useState(seedFields?.fromName || '');
  const [to, setTo] = useState(seedFields?.to || '');

  const [replyTo, setReplyTo] = useState(seedFields?.replyTo || '');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [theme, setTheme] = useState<RendererThemeOptions>(() => themeOfRow(template?.theme));
  /** The theme as the row holds it — what the editor opened on, or was put
   *  back to by a discard. The baseline below measures the theme against
   *  this rather than against live state: the Brand panel adopts the default
   *  brand as soon as the brands arrive, which on a quick connection is
   *  before the editor exists to be read, and a baseline taken from live
   *  state then would count the adoption as already saved and never send
   *  it.
   *
   *  A row made through the API cannot reach that adoption: the server
   *  writes the workspace's default brand at creation (covered by
   *  `server/src/routes/templates.test.ts`), so the editor opens on a theme
   *  that already matches a brand and adopts nothing. The path stays for
   *  the playground, which has no row, and for templates from before that
   *  rule, which still hold null. */
  const rowTheme = useRef(theme);
  /** Subject and preview text as the row holds them, kept for the same
   *  reason `rowTheme` is. Crossing 640px swaps the shell and remounts the
   *  editor, and the baseline below is re-read when it does; taken from live
   *  state it would swallow a keystroke still sitting in the debounce —
   *  counted as already saved, and so never sent. */
  const savedFields = useRef({ subject, previewText });

  // --- Draft and published copy ---------------------------------------------
  // A saved template has two copies on the server: the draft this editor
  // works on, autosaved as it changes, and the copy the API renders, which
  // only Publish touches. The playground has neither and keeps its work in
  // localStorage further down.
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('idle');
  const [publishedAt, setPublishedAt] = useState<string | null>(template?.published_at ?? null);
  const [unpublished, setUnpublished] = useState<boolean>(() =>
    template ? hasUnpublishedChanges(template) : false,
  );
  /** The newest snapshot handed to the autosave — what a closing tab beacons. */
  const latestSnapshot = useRef<DraftSnapshot | null>(null);
  // The publish time is shown in the reader's locale and zone, which the
  // server cannot know; rendering it only after mount keeps hydration clean.
  const [publishedLabel, setPublishedLabel] = useState<string | null>(null);
  useEffect(() => {
    setPublishedLabel(
      publishedAt
        ? `Published ${new Date(publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
        : 'Not published yet',
    );
  }, [publishedAt]);
  /** The state as last saved. Null until the editor exists to be read. */
  const savedFingerprint = useRef<string | null>(null);

  const autosave = useMemo(() => {
    if (!template?.id) return null;
    const id = template.id;
    return createAutosave<DraftSnapshot>({
      delayMs: 500,
      save: async (snapshot) => {
        await httpPost(`/api/v1/templates/${id}`, snapshot.body);
        // The row now holds this snapshot, so it is the baseline the next
        // edit is measured against — and reverting to it needs no save. The
        // row's theme moves with it: a shell swap re-reads the baseline from
        // rowTheme, and one left at the opening theme would make the swap
        // save what is already saved.
        savedFingerprint.current = snapshot.fingerprint;
        rowTheme.current = snapshot.theme;
        savedFields.current = { subject: snapshot.body.title, previewText: snapshot.body.previewText };
      },
      onStatus: setSaveStatus,
    });
  }, [template?.id]);

  // Leaving the page (a Link, a route change) saves whatever is waiting —
  // including the capture still sitting in its own timer, which the effect
  // that owns it is about to clear. The autosave only holds what a capture
  // handed it, so the capture is taken here first or the last run of typing
  // leaves with the component. The request outlives it.
  useEffect(() => {
    if (!autosave) return;
    return () => captureThenLeave(() => captureRef.current(), autosave);
  }, [autosave]);

  const { mutateAsync: publishTemplate, isPending: isPublishing } = useMutation({
    mutationFn: () =>
      httpPost(`/api/v1/templates/${template?.id}/publish`, {}) as Promise<SaveTemplateResponse>,
    onSuccess: (data) => {
      toast.success('Published');
      setPublishedAt(data.template.published_at ?? null);
      setUnpublished(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not publish.');
    },
  });

  const imageUploader = useMemo(() => createEditorUploader(), []);

  // The picker resolves a promise the editor core awaits; the resolver lives
  // in a ref so the dialog's close/cancel path can settle it with null.
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickResolver = useRef<((url: string | null) => void) | null>(null);
  const pickFromLibrary = useCallback(
    () =>
      new Promise<string | null>((resolve) => {
        pickResolver.current = resolve;
        setPickerOpen(true);
      }),
    [],
  );
  const settlePick = (url: string | null) => {
    pickResolver.current?.(url);
    pickResolver.current = null;
    setPickerOpen(false);
  };

  // --- Content section: edit / preview -------------------------------------
  const [mode, setMode] = useState<ContentMode>('edit');
  const [forceDark, setForceDark] = useState(false);
  const [previewKeys, setPreviewKeys] = useState<TemplateDataKeys>({
    conditions: [],
    variables: [],
    placeholders: {},
    where: {},
    urlVariables: [],
    lists: [],
    inList: {},
  });
  const [previewData, setPreviewData] = useState<PreviewData>({
    conditions: {},
    variables: {},
    lists: {},
  });
  const [previewHtml, setPreviewHtml] = useState('');
  // The source view gets its own, indented render; the email in the frame stays
  // byte-for-byte what would be sent.
  const [htmlSource, setHtmlSource] = useState('');
  // The text alternative — what a client that cannot show markup would print.
  const [textSource, setTextSource] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Drives the one-shot enter animation. The editor is hidden rather than
  // unmounted, so showing it again fires no transition of its own.
  const [switching, setSwitching] = useState(false);
  const paneClass = switching ? 'content-pane-in' : undefined;
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const [paneHeight, setPaneHeight] = useState<number>();

  const [pendingMode, setPendingMode] = useState<ContentMode | null>(null);

  const showPane = (next: ContentMode) => {
    setPendingMode(null);
    // A pane that shows is a pane that rendered — cached or fresh — so a
    // failure left by another view must not sit over it with a Retry that
    // finds the cache and does nothing.
    setPreviewError(null);
    setMode(next);
    setSwitching(true);
  };

  const changeMode = (next: ContentMode) => {
    if (next === 'edit') showPane('edit');
    else enterRendered(next);
  };

  useEffect(() => {
    if (!switching) return;
    const timer = setTimeout(() => setSwitching(false), 220);
    return () => clearTimeout(timer);
  }, [switching, mode]);
  // What the current HTML was rendered from. Re-entering preview without
  // touching anything should not cost a round trip.
  const renderedSignature = useRef('');
  const sourceSignature = useRef('');
  const textSignature = useRef('');
  const hasPreviewData = hasPreviewKeys(previewKeys);

  /** Values for the keys the document has now, keeping anything already typed:
   *  only keys new to the document are seeded, and a key it has lost drops out.
   *  Empty is a value here, not a gap — a variable cleared on purpose is
   *  omitted from the payload so the pill passes through — so it survives too. */
  const mergePreviewData = (keys: TemplateDataKeys, current: PreviewData): PreviewData => {
    const seeded = initialPreviewData(keys);
    return {
      conditions: Object.fromEntries(
        Object.entries(seeded.conditions).map(([key, value]) => [key, current.conditions[key] ?? value]),
      ),
      variables: Object.fromEntries(
        Object.entries(seeded.variables).map(([key, value]) => [key, current.variables[key] ?? value]),
      ),
      lists: Object.fromEntries(
        Object.entries(seeded.lists).map(([key, value]) => [key, current.lists[key] ?? value]),
      ),
    };
  };

  // The canvas previews each Repeat with as many rows as the sample data
  // says, and a Repeat's own menu can set that number too. The editor's
  // plugin is the wire between the two: the sample data is sent down as a
  // transaction (not a document change, so nothing is saved or undone), and
  // a count set from the menu comes back up through the same transaction.
  // Both directions compare first, so neither answers the other forever.
  useEffect(() => {
    if (!editor) return;
    const current = repeatPreviewKey.getState(editor.state)?.counts ?? {};
    if (!sameCounts(current, previewData.lists)) setRepeatPreviewCounts(editor, previewData.lists);
  }, [editor, previewData.lists]);
  useEffect(() => {
    if (!editor) return;
    const hear = ({ transaction }: { transaction: Transaction }) => {
      const counts = transaction.getMeta(repeatPreviewKey) as Record<string, number> | undefined;
      if (!counts) return;
      setPreviewData((current) => (sameCounts(current.lists, counts) ? current : { ...current, lists: { ...current.lists, ...counts } }));
    };
    editor.on('transaction', hear);
    return () => {
      editor.off('transaction', hear);
    };
  }, [editor]);

  /** Re-read the document's data keys. Entering a rendered view does this on
   *  the way in, which is the only route the desktop offers; the phone reaches
   *  the sample-data sheet straight from the bar, so it asks for itself. */
  const refreshPreviewKeys = () => {
    if (!editor) return;
    const keys = collectDataKeys(editor.getJSON());
    setPreviewKeys(keys);
    setPreviewData((current) => mergePreviewData(keys, current));
  };

  const { mutate: renderPreview, isPending: isPreviewPending } = useMutation({
    // Clearing on the way in, not on success: a retry has to drop the last
    // failure before the request lands, or the sheet keeps showing the error
    // over a pane that is already loading.
    onMutate: () => setPreviewError(null),
    mutationFn: async ({ signature, payload, variant }: { signature: string; payload?: Record<string, unknown>; enter?: ContentMode; variant: RenderVariant }) => {
      const res = await httpPost<{ html: string }>('/api/v1/emails/preview', {
        content: JSON.stringify(editor?.getJSON()),
        previewText,
        theme,
        payload,
        // The three views are the same render asked for three ways.
        pretty: variant === 'html',
        plainText: variant === 'text',
      });
      return { output: res?.html ?? '', signature };
    },
    onSuccess: ({ output, signature }, variables) => {
      if (variables.variant === 'html') {
        setHtmlSource(output);
        sourceSignature.current = signature;
      } else if (variables.variant === 'text') {
        setTextSource(output);
        textSignature.current = signature;
      } else {
        setPreviewHtml(output);
        renderedSignature.current = signature;
      }
      // Swapping panes before the HTML exists shows an empty frame for as long
      // as the round trip takes, then pops the email in. Wait, then swap once.
      if (variables.enter) showPane(variables.enter);
    },
    onError: (error) => {
      setPendingMode(null);
      const message = error.message || 'Failed to render the preview';
      setPreviewError(message);
      toast.error(message);
    },
  });

  /** Everything the rendered HTML depends on, so we can tell when it is stale. */
  const previewSignature = (payload?: Record<string, unknown>) =>
    JSON.stringify([editor?.getJSON(), theme, previewText, payload ?? null]);

  /** Preview and HTML both show the same render, so both go through here. */
  const enterRendered = (next: Exclude<ContentMode, 'edit'>) => {
    if (!editor) return;
    // Hold the section at the height it already has, so swapping panes does not
    // shove everything below it up or down.
    if (mode === 'edit') setPaneHeight(editorPaneRef.current?.offsetHeight);

    const keys = collectDataKeys(editor.getJSON());
    setPreviewKeys(keys);
    // Merged, not seeded fresh: the phone types its sample values in a sheet
    // reached before the preview, and re-seeding here would throw them away.
    const data = mergePreviewData(keys, previewData);
    setPreviewData(data);

    const payload = hasKeys(keys) ? toPayload(data) : undefined;
    const signature = previewSignature(payload);
    const variant = variantFor(next);
    const cached =
      variant === 'html'
        ? signature === sourceSignature.current && htmlSource
        : variant === 'text'
          ? signature === textSignature.current && textSource
          : signature === renderedSignature.current && previewHtml;
    if (cached) {
      showPane(next);
      return;
    }
    setPendingMode(next);
    renderPreview({ signature, payload, variant, enter: next });
  };

  // Re-render as the data panel is used, debounced so typing a variable value
  // does not fire a request per keystroke.
  useEffect(() => {
    if (mode === 'edit' || !hasPreviewData) return;
    const timer = setTimeout(() => {
      const payload = toPayload(previewData);
      const signature = previewSignature(payload);
      const variant = variantFor(mode);
      const current =
        variant === 'html'
          ? sourceSignature.current
          : variant === 'text'
            ? textSignature.current
            : renderedSignature.current;
      if (signature === current) return;
      renderPreview({ signature, payload, variant });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewData, mode, hasPreviewData]);

  // --- Preflight ------------------------------------------------------------
  // The checks a send or export should survive, computed from editor state.
  // Findings and the measured byte size travel together: the size is only
  // meaningful for the document the findings describe.
  const [preflight, setPreflight] = useState<{ issues: PreflightIssue[]; bytes: number | null }>({
    issues: [],
    bytes: null,
  });
  const [preflightExpanded, setPreflightExpanded] = useState(false);
  // Two-step send: armedFor holds the serialized error set the first click
  // acknowledged. The second click only goes through while the errors still
  // match, so a confirmation never carries over to a different mistake.
  // Publish arms separately — acknowledging a finding for a test send says
  // nothing about being ready to put it live.
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const [publishArmedFor, setPublishArmedFor] = useState<string | null>(null);
  const preflightSerialized = useRef('');

  const hasPreflightErrors = preflight.issues.some((issue) => issue.severity === 'error');
  const sendArmed = armedFor !== null && hasPreflightErrors;
  const publishArmed = publishArmedFor !== null && hasPreflightErrors;

  const errorKey = (issues: PreflightIssue[]) =>
    JSON.stringify(issues.filter((issue) => issue.severity === 'error'));

  /** Contrast findings folded to the worse of the light/forced-dark pair per
   *  subject, the way issuesForField presents them beside the colour fields. */
  const themeWarnings = (): PreflightIssue[] =>
    worstPerSubject(themeIssues(theme)).map((issue) => ({
      id: `contrast-${issue.subject}`,
      severity: 'warn' as const,
      message: `${issue.subject} may be hard to read: ${issue.ratio}:1 against the background${
        issue.where === 'forced dark' ? ' once a client forces dark mode' : ''
      } — aim for ${issue.required}:1.`,
    }));

  /** One pass over the live document. Both the debounced effect and Send call
   *  this — Send must not trust state that can be half a second stale. */
  const computePreflight = (): { issues: PreflightIssue[]; bytes: number | null } => {
    if (!editor) return { issues: [], bytes: null };
    const json = editor.getJSON();
    // Fresh keys, not the previewKeys state — that only updates on entering
    // a rendered view, and the document may have changed since.
    const keys = collectDataKeys(json);
    const issues: PreflightIssue[] = [
      ...checkFields(subject, previewText),
      ...collectContentFindings(json),
      ...unresolvedVariables(keys, previewData.variables).map((key) => {
        // Say where the pill is, or the author is left hunting through the
        // document for a name that may appear nowhere in the copy.
        const at = keys.where[key];
        const place = at ? (at.kind === 'button' ? 'in a button' : `in a ${at.kind}`) : '';
        return {
          id: `variable-${key}`,
          severity: 'warn' as const,
          message: `{{${key}}} ${place} has no placeholder and no preview value — a test send needs one.`.replace('  ', ' '),
          detail: at?.text || undefined,
        };
      }),
      ...themeWarnings(),
    ];

    // Size is read off the as-sent preview render — never the pretty HTML
    // source, which indentation inflates — and only while that render still
    // matches the document; stale bytes would grade an old email.
    const payload = hasKeys(keys) ? toPayload(previewData) : undefined;
    const fresh = previewHtml && previewSignature(payload) === renderedSignature.current;
    const bytes = fresh ? new TextEncoder().encode(previewHtml).length : null;
    if (bytes != null) {
      const sizeIssue = assessSize(bytes);
      if (sizeIssue) issues.push(sizeIssue);
    }
    return { issues, bytes };
  };

  /** Store only when the findings changed, so keystrokes don't re-render the
   *  sandbox for identical results. */
  const publishPreflight = (next: { issues: PreflightIssue[]; bytes: number | null }) => {
    const serialized = JSON.stringify([next.issues, next.bytes]);
    if (serialized === preflightSerialized.current) return;
    preflightSerialized.current = serialized;
    setPreflight(next);
    // A confirmation only covers the error set it was given.
    setArmedFor((current) =>
      current !== null && current !== errorKey(next.issues) ? null : current,
    );
    setPublishArmedFor((current) =>
      current !== null && current !== errorKey(next.issues) ? null : current,
    );
  };

  /** The as-sent render the size check measures. Fires a render only when the
   *  HTML on hand no longer matches the current document. */
  const ensureSizeMeasured = () => {
    if (!editor) return;
    const keys = collectDataKeys(editor.getJSON());
    const payload = hasKeys(keys) ? toPayload(previewData) : undefined;
    const signature = previewSignature(payload);
    if (signature === renderedSignature.current && previewHtml) return;
    // No `enter`: the HTML refreshes without switching panes.
    renderPreview({ signature, payload, variant: 'preview' });
  };

  useEffect(() => {
    if (!editor) return;

    const compute = () => {
      const next = computePreflight();
      // No current measurement means the size check cannot run — an oversized
      // email with nothing else wrong would sail through. Ask for the render;
      // the debounce bounds the cost and the fresh HTML re-runs this effect.
      if (next.bytes == null) ensureSizeMeasured();
      publishPreflight(next);
    };

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(compute, 500);
    };

    // Same shape as autosave below: typing is heard through the editor's own
    // event so a keystroke does not re-render the component to be noticed.
    editor.on('update', schedule);
    schedule();

    return () => {
      editor.off('update', schedule);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, previewText, theme, previewData, editor, previewHtml]);

  // --- Unsaved work ---------------------------------------------------------
  // Kept in the browser rather than on the row: the public render API serves
  // that row, so autosaving into it would ship a half-finished email to
  // whoever asked for one next. A saved template never touches localStorage:
  // its draft lives on the server, so it follows the author to the next
  // machine.
  //
  // The playground has no row and keeps nothing at all: a demo that greets a
  // visitor with someone else's half-finished email is worse than one that
  // loses their own experiment on reload, so every visit starts from the same
  // seeded document. A version before this one offered a saved draft back —
  // any leftover from that is purged once below, so a returning visitor is
  // never shown it.
  const lastWritten = useRef('');
  /** Bumped when the screen is reset to the row — a discard or a restore —
   *  so the baseline is re-read once the new state has rendered. */
  const [baselineKey, setBaselineKey] = useState(0);

  /**
   * Only what Save persists counts as work worth warning about. From name and
   * Reply To belong to a test send, not to the template — they ride along in
   * the draft so restoring feels complete, but a template is not "unsaved"
   * because you typed a sender address into it.
   */
  const persistedFingerprint = (
    json?: JSONContent,
    themeAs: RendererThemeOptions = theme,
    fieldsAs: { subject: string; previewText: string } = { subject, previewText },
  ) =>
    JSON.stringify([fieldsAs.subject, fieldsAs.previewText, json ?? editor?.getJSON() ?? null, themeAs]);

  // The baseline: whatever the row held when this editor opened, or was put
  // back to. Subject, preview text and theme come from what was saved rather
  // than from what is on screen — a shell swap re-runs this while a
  // keystroke may still be waiting in the debounce, and live state would
  // make that keystroke part of the baseline it is measured against. The
  // document needs no such copy: `flushContent` hands it over before the new
  // shell mounts, so the editor read here is already holding it.
  useEffect(() => {
    if (!editor) return;
    savedFingerprint.current = persistedFingerprint(undefined, rowTheme.current, savedFields.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, baselineKey]);

  useEffect(() => {
    if (!template?.id) clearDraft(PLAYGROUND_DRAFT_ID);
  }, [template?.id]);

  /** The document editorContent was last set from, so an unchanged one costs
   *  no render. */
  const capturedContent = useRef<string | null>(null);
  /** The autosave's capture, reachable from outside its effect. The shell
   *  swap has to take the live document before the new tree mounts, which is
   *  a render-phase call rather than an event — see `flushContent`. */
  const captureRef = useRef<() => void>(() => {});
  const [editorContent, setEditorContent] = useState(() =>
    storedDocument(template?.content || (defaultEmailJSON as JSONContent))
  );

  /** The row is on screen again: reset state, then re-baseline. */
  const showRow = (row: Mail) => {
    setSubject(row.title ?? '');
    setPreviewText(row.preview_text ?? '');
    // The baseline and the state are two objects on purpose: one shared
    // between them would let an edit made in place through state move the
    // baseline with it, and the change would never read as unsaved.
    rowTheme.current = themeOfRow(row.theme);
    setTheme(structuredClone(rowTheme.current));
    savedFields.current = { subject: row.title ?? '', previewText: row.preview_text ?? '' };
    try {
      editor?.commands.setContent(storedDocument(row.content));
    } catch {
      // A corrupt row is the server's problem to report; the screen keeps
      // what it has.
    }
    setPublishedAt(row.published_at ?? null);
    lastWritten.current = '';
    setBaselineKey((k) => k + 1);
  };

  /** The published copy is on screen again: it is the draft now, so nothing
   *  is unpublished. */
  const handleDiscarded = (row: Mail) => {
    showRow(row);
    setUnpublished(false);
  };

  /** A version was written into the draft. The canvas is holding the
   *  document that restore just replaced, so it is put back from the row the
   *  server sends with it rather than being left to a reload. */
  const handleRestored = (row: Mail) => {
    showRow(row);
    setUnpublished(hasUnpublishedChanges(row));
  };

  // Autosave: debounced and silent. It fires when something actually
  // changed, so an idle tab does nothing. Only a saved template has anywhere
  // to send it — the playground has no row, so this effect keeps
  // editorContent current for it and stops there. Neither snapshots a
  // version — that is what Publish is for.
  useEffect(() => {
    if (!editor) return;

    const capture = () => {
      // One read of the document per tick: the fingerprint and the shell's
      // copy both describe the same moment, so they come from this one
      // serialisation.
      const json = editor.getJSON();
      const serializedContent = JSON.stringify(json);

      // Crossing 640px swaps the shell, which remounts the editor from
      // editorContent — so that has to be the document as it stands, not the
      // one the page loaded with. Only a changed document is stored: a state
      // bump per tick would re-render the whole shell while someone is only
      // typing a subject line.
      if (serializedContent !== capturedContent.current) {
        capturedContent.current = serializedContent;
        setEditorContent(json);
      }

      if (!autosave) return;

      const fingerprint = persistedFingerprint(json);
      if (fingerprint === savedFingerprint.current) {
        lastWritten.current = '';
        return;
      }
      if (fingerprint === lastWritten.current) return;
      lastWritten.current = fingerprint;
      const snapshot: DraftSnapshot = {
        body: {
          title: subject,
          previewText,
          content: serializedContent,
          theme: JSON.stringify(theme),
        },
        fingerprint,
        theme,
      };
      latestSnapshot.current = snapshot;
      autosave.change(snapshot);
      setUnpublished(true);
    };

    captureRef.current = capture;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(capture, 1000);
    };

    // Typing is heard through the editor's own event rather than React state:
    // a state bump per keystroke would re-render this whole component for
    // nothing. Field edits re-run the effect, which schedules the same write.
    editor.on('update', schedule);
    schedule();

    return () => {
      editor.off('update', schedule);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, previewText, theme, editor, autosave]);

  /** Takes the live document now instead of waiting for the debounce. The
   *  640px shell swap remounts the editor from `editorContent`, so anything
   *  typed inside the last second would be dropped by the new tree with no
   *  history to undo it back. The caller runs this during render, before the
   *  new shell mounts — a layout effect is already too late. */
  const flushContent = () => captureRef.current();

  // The page going away is the one exit the autosave cannot await, so a
  // template's pending draft is beaconed instead — the browser posts it once
  // the page is gone. `beforeunload` alone would only cover the desktop:
  // mobile Safari does not fire it for the ways a phone leaves a page — an
  // app switch, a discarded tab, the home gesture — which is every exit the
  // phone shell has. `pagehide` and a hidden `visibilitychange` cover those,
  // and both can fire for one exit, which the beacon absorbs. What
  // `beforeunload` keeps to itself is the prompt: only it can question a
  // leave, and only a failed save is worth questioning, since nothing else
  // is then holding the work. The playground has no draft to lose, so it
  // registers nothing at all.
  const saveStatusRef = useRef(saveStatus);
  saveStatusRef.current = saveStatus;
  const templateId = template?.id;
  useEffect(() => {
    if (!autosave || !templateId) return;
    const beacon = createExitBeacon<DraftSnapshot>({
      // Same rule as every other exit: what the debounce is still holding is
      // the newest work there is, and only a capture hands it over.
      capture: () => captureRef.current(),
      pending: () => autosave.pending(),
      snapshot: () => latestSnapshot.current,
      send: (snapshot) => {
        navigator.sendBeacon(
          `/api/v1/templates/${templateId}`,
          new Blob([JSON.stringify(snapshot.body)], { type: 'application/json' }),
        );
      },
    });
    const warn = (event: BeforeUnloadEvent) => {
      beacon();
      if (saveStatusRef.current !== 'error') return;
      event.preventDefault();
      event.returnValue = '';
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') beacon();
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pagehide', beacon);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pagehide', beacon);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [autosave, templateId]);

  const handlePublish = async () => {
    if (!autosave) return;
    // The gate reads the document directly, not the debounced findings — a
    // URL cleared half a second before the click must still count.
    const current = computePreflight();
    publishPreflight(current);
    const errors = errorKey(current.issues);
    if (errors !== '[]' && publishArmedFor !== errors) {
      setPublishArmedFor(errors);
      setPreflightExpanded(true);
      ensureSizeMeasured();
      return;
    }
    // What is on screen is what gets published, so the draft goes first —
    // captured, then flushed. A flush on its own posts whatever the last
    // capture left, so a block or a subject edited inside the debounce would
    // publish the previous draft and then autosave the newer one on top,
    // hanging "Unpublished changes" off the back of a "Published" toast.
    await captureThenFlush(() => captureRef.current(), autosave);
    if (autosave.pending()) {
      toast.error('The draft could not be saved, so it was not published.');
      return;
    }
    await publishTemplate();
    setPublishArmedFor(null);
  };

  const handleSend = async () => {
    if (!to) {
      toast.error('Add a To address before sending.');
      return;
    }
    // The gate reads the document directly, not the debounced findings — a
    // URL cleared half a second before the click must still count.
    const current = computePreflight();
    publishPreflight(current);
    const errors = errorKey(current.issues);
    // Never hard-blocked: with error-level findings the first click opens the
    // preflight panel and relabels the button; the second click sends anyway.
    if (errors !== '[]' && armedFor !== errors) {
      setArmedFor(errors);
      setPreflightExpanded(true);
      ensureSizeMeasured();
      return;
    }
    const json = editor?.getJSON();
    const keys = json ? collectDataKeys(json) : { conditions: [], variables: [], placeholders: {}, where: {}, urlVariables: [], lists: [], inList: {} };
    const content = JSON.stringify(json);
    try {
      await httpPost('/api/v1/emails/send', {
        theme,
        previewText,
        subject,
        fromName,
        replyTo,
        to,
        content,
        // The typed preview data rides along, so a test send resolves
        // variables the way a real render would instead of showing {{name}}.
        payload: hasKeys(keys) ? toPayload(previewData) : undefined,
      });
      toast.success('Email sent.');
      setArmedFor(null);
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not send the email.');
    }
  };

  const [shortCodeCopied, setShortCodeCopied] = useState(false);
  const [, copyText] = useCopyToClipboard();

  // The editor canvas only consumes --mly-* variables for buttons and links;
  // everything else (page background, card width, paddings, corners) is
  // painted by the renderer at send time and would otherwise never show here.
  // So the sandbox draws the page and the card itself from the live theme —
  // outer div = the email body, inner div = the container card — and hands
  // the button/link variables down. A brand or colour change is now visible
  // in the content the moment it happens.
  const { pageStyle, cardStyle } = useMemo(() => {
    const d = DEFAULT_RENDERER_THEME;
    const pick = <K extends 'body' | 'container' | 'button' | 'link'>(part: K) =>
      ({ ...(d[part] ?? {}), ...(theme[part] ?? {}) }) as NonNullable<RendererThemeOptions[K]>;

    const body = pick('body');
    const container = pick('container');
    const button = pick('button');
    const link = pick('link');

    const pageStyle: React.CSSProperties = {
      backgroundColor: body.backgroundColor,
      paddingTop: body.paddingTop ?? '0px',
      paddingRight: body.paddingRight ?? '16px',
      paddingBottom: body.paddingBottom ?? body.paddingTop ?? '0px',
      paddingLeft: body.paddingLeft ?? '16px',
      // Button and link colours are read inside the canvas via these vars.
      ['--mly-button-background-color' as string]: button.backgroundColor,
      ['--mly-button-text-color' as string]: button.color,
      ['--mly-button-border-radius' as string]: button.borderRadius,
      ['--mly-link-color' as string]: link.color,
    };

    const cardStyle: React.CSSProperties = {
      maxWidth: container.maxWidth ?? '600px',
      margin: '0 auto',
      backgroundColor: container.backgroundColor,
      borderRadius: container.borderRadius,
      borderStyle: container.borderWidth ? 'solid' : undefined,
      borderWidth: container.borderWidth,
      borderColor: container.borderColor,
      paddingTop: container.paddingTop,
      paddingRight: container.paddingRight,
      paddingBottom: container.paddingBottom,
      paddingLeft: container.paddingLeft,
    };

    return { pageStyle, cardStyle };
  }, [theme]);

  const copyShortCode = async () => {
    if (!template?.short_code) return;
    // The ⋯ menu is reached from a phone on a plain-http LAN origin, where
    // navigator.clipboard is undefined; the hook answers false there rather
    // than rejecting into a tick that never appears.
    if (!(await copyText(template.short_code))) {
      toast.error('Could not copy — this browser blocks the clipboard here.');
      return;
    }
    setShortCodeCopied(true);
    setTimeout(() => setShortCodeCopied(false), 2000);
  };

  return {
    template,
    subject, setSubject, previewText, setPreviewText, fromName, setFromName, to, setTo, replyTo, setReplyTo,
    theme, setTheme, pageStyle, cardStyle,
    editor, setEditor, editorContent, flushContent, editorPaneRef, paneClass, paneHeight,
    imageUploader, pickFromLibrary, pickerOpen, settlePick,
    mode, changeMode, pendingMode, forceDark, setForceDark,
    previewKeys, previewData, setPreviewData, hasPreviewData, refreshPreviewKeys,
    previewHtml, isPreviewPending, htmlSource, textSource, previewError,
    preflight, preflightExpanded, setPreflightExpanded,
    saveStatus, autosave, unpublished, publishedAt, publishedLabel,
    isPublishing, publishArmed, handlePublish, sendArmed, handleSend, handleDiscarded, handleRestored,
    shortCodeCopied, copyShortCode,
  };
}
