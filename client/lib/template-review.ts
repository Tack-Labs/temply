import { assessSize, checkFields, collectContentFindings, type PreflightIssue } from '@temply/shared/preflight';
import { DEFAULT_RENDERER_THEME } from '@temply/shared/theme';
import { collectDataKeys } from '@temply/shared/template-data';
import { themeIssues, worstPerSubject } from '~/components/theme-warnings';
import { copyOf, type WorkflowTemplate } from './template-stage';
import { storedDocument } from '~/core/editor/utils/replace-deprecated';

/** Review the snapshot, never the draft the author may still be editing. */
export function candidateFindings(row: WorkflowTemplate, html?: string): PreflightIssue[] {
  const candidate = copyOf(row, 'staged');
  if (!candidate) return [];
  const issues = checkFields(row.title, candidate.preview_text ?? '');
  try {
    const doc = storedDocument(candidate.content);
    if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) throw new Error('Invalid document');
    issues.push(...collectContentFindings(doc));
    const keys = collectDataKeys(doc);
    for (const key of keys.variables) {
      issues.push({ id: `variable-${key}`, severity: 'warn', message: `Check the value supplied for {{${key}}} before going live.` });
    }
  } catch {
    issues.push({ id: 'unreadable-content', severity: 'error', message: 'The staged content could not be read. Send it back and stage a valid copy.' });
  }
  try {
    const theme = candidate.theme ? JSON.parse(candidate.theme) : DEFAULT_RENDERER_THEME;
    issues.push(...worstPerSubject(themeIssues(theme)).map((issue) => ({ id: `contrast-${issue.subject}`, severity: 'warn' as const,
      message: `${issue.subject} may be hard to read (${issue.ratio}:1). Aim for ${issue.required}:1.` })));
  } catch {
    issues.push({ id: 'unreadable-theme', severity: 'error', message: 'The staged brand settings could not be read. Send this copy back for changes.' });
  }
  if (html !== undefined) {
    const size = assessSize(new TextEncoder().encode(html).length);
    if (size) issues.push(size);
  }
  return issues;
}

export function changesForReview(row: WorkflowTemplate) {
  return [
    { label: 'Email content', changed: row.published_content !== row.staged_content },
    { label: 'Brand settings', changed: row.published_theme !== row.staged_theme },
    { label: 'Preview text', changed: row.published_preview_text !== row.staged_preview_text,
      live: row.published_preview_text || 'No preview text', proposed: row.staged_preview_text || 'No preview text' },
  ];
}
