import { parseStamp } from '~/lib/stamp';
import {
  TEMPLATE_STATUS_BADGE,
  templateStatus,
  type TemplateStatus,
} from '~/lib/template-search';

/**
 * Where the open template stands against what the public API serves. The
 * words and tones are the templates list's own (`TEMPLATE_STATUS_BADGE`), so
 * a row and the editor it opens never name the same state two ways; the
 * editor only decides which state it is in from what it holds locally, since
 * its draft moves faster than any row it was loaded from.
 */
export function publishStatus(publishedAt: string | null, unpublished: boolean): TemplateStatus {
  return templateStatus({ published_at: publishedAt, has_unpublished_changes: unpublished });
}

type StampOptions = { locale?: string; timeZone?: string };

/** A calendar day in the given zone, as a string that compares for equality. */
function dayKey(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * The publish time at the length a toolbar can carry: the time alone for
 * today, the day for this year, the year as well beyond that. "Today" is the
 * reader's, so the day is compared in their zone — which the server cannot
 * know, so this is only called after mount.
 */
export function formatPublishStamp(iso: string, now: Date, options: StampOptions = {}): string {
  const at = parseStamp(iso);
  if (Number.isNaN(at.getTime())) return '';
  const { locale, timeZone } = options;
  if (dayKey(at, timeZone) === dayKey(now, timeZone)) {
    return at.toLocaleTimeString(locale, { timeStyle: 'short', timeZone });
  }
  const sameYear = dayKey(at, timeZone).slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
  return at.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  });
}

export type PublishBadge = { label: string; tone: 'success' | 'warn' | 'neutral' };

/**
 * What the status badge says. A template in sync reads "Published" followed
 * by when, and never the bare word: the toast that confirms a publish is the
 * one exact "Published" on the page, and the specs tell the two apart by it.
 * With no stamp yet (before mount, or a timestamp that will not parse) there
 * is nothing honest to show for it, so no badge rather than a wrong one.
 */
export function publishBadge(status: TemplateStatus, stamp: string | null): PublishBadge | null {
  const base = TEMPLATE_STATUS_BADGE[status];
  if (status !== 'published') return { label: base.label, tone: base.tone };
  return stamp ? { label: `${base.label} ${stamp}`, tone: base.tone } : null;
}

export type PublishView = {
  status: TemplateStatus;
  /** What the status badge shows; null where there is nothing honest to show. */
  badge: PublishBadge | null;
  /** The Publish button's tooltip, with the full time of the last publish.
   *  Null until the reader's clock is known. */
  label: string | null;
};

/**
 * Everything the chrome shows about publication, worked out in one step from
 * the same inputs. The status and the stamp are never held apart: kept in
 * separate state, a publish commits one a frame before the other, and for
 * that frame a published template has no badge at all — "Draft" vanishes and
 * the time fades in a beat later. `now` is null on the server and while
 * hydrating, where the reader's locale and zone are unknown: the status is
 * still right, and a published template shows no badge rather than a stamp the
 * client would then disagree with.
 */
export function publishView(
  publishedAt: string | null,
  unpublished: boolean,
  now: Date | null,
  options: StampOptions = {},
): PublishView {
  const status = publishStatus(publishedAt, unpublished);
  if (now === null) return { status, badge: publishBadge(status, null), label: null };
  const { locale, timeZone } = options;
  return {
    status,
    badge: publishBadge(status, publishedAt ? formatPublishStamp(publishedAt, now, options) : null),
    label: publishedAt
      ? `Published ${parseStamp(publishedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone })}`
      : 'Not published yet',
  };
}
