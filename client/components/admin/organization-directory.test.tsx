import { afterEach, expect, test } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import type { AdminOrganizations } from '@temply/shared/admin';
import { OrganizationDirectory } from './organization-directory';

afterEach(cleanup);
const data: AdminOrganizations = {
  page: 2, pageSize: 25, totalCount: 60, period: '2026-10',
  organizations: [{
    id: 'org_acme', name: 'Acme', createdAt: Date.parse('2026-09-01T12:00:00Z'), members: 3,
    usage: { liveCalls: 1200, testCalls: 25, templates: 2, storageBytes: 4096 },
    subscription: {
      plan: 'team', status: 'past_due', seats: 4, templatePacks: 2,
      trialEndsAt: null, currentPeriodEnd: '2026-11-01T00:00:00Z', cancelAt: '2026-11-01T00:00:00Z',
    },
  }],
};

test('shows member counts, usage, plan, recorded payment status and scheduled cancellation', () => {
  const view = render(<OrganizationDirectory data={data} query="Acme & Co" />);
  expect(view.getByRole('heading', { name: 'Acme' })).toBeTruthy();
  for (const text of ['1,200', '25', '4 KB', '4 subscription seats', 'Team', 'past due', 'Cancellation 1 Nov 2026']) {
    expect(view.getByText(text)).toBeTruthy();
  }
  expect(view.getByText(/API usage for October 2026/)).toBeTruthy();
  expect(view.getByText('26–26 of 60')).toBeTruthy();
  expect(view.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe('/dashboard/admin?page=1&q=Acme+%26+Co');
  expect(view.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe('/dashboard/admin?page=3&q=Acme+%26+Co');
});

test('keeps an unavailable member count distinct from zero and never offers pagination beyond the result', () => {
  const view = render(<OrganizationDirectory data={{ ...data, page: 1, totalCount: 1, organizations: [{ ...data.organizations[0], members: null }] }} query="" />);
  expect(view.getByText('Unavailable')).toBeTruthy();
  expect(view.queryByRole('link', { name: 'Next' })).toBeNull();
  expect(view.queryByRole('link', { name: 'Previous' })).toBeNull();
});

test('designs the empty search state separately from a failed request', () => {
  const view = render(<OrganizationDirectory data={{ ...data, organizations: [], totalCount: 0, page: 1 }} query="Missing" />);
  expect(view.getByText('No organisations found')).toBeTruthy();
  expect(view.getByText('Try a different name or organisation ID.')).toBeTruthy();
  expect(view.queryByRole('link')).toBeNull();
});
