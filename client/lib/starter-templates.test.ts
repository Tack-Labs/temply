import { describe, expect, it } from 'bun:test';
import { checkFields, collectContentFindings, unresolvedVariables } from '@temply/shared/preflight';
import { collectDataKeys } from '@temply/shared/template-data';
import { personaliseStarter, SAMPLE_COMPANY, STARTER_TEMPLATES } from './starter-templates';

/**
 * A starter is the product's first impression. One that opens with a
 * preflight finding — a button with no destination, an empty subject — says
 * "rushed" before the user has typed a word.
 */
describe('personaliseStarter', () => {
  const welcome = STARTER_TEMPLATES.find((s) => s.id === 'welcome')!;

  it('puts the workspace name where the sample company was, everywhere text lives', () => {
    const mine = personaliseStarter(welcome, { name: 'Acme Corp' });
    expect(mine.subject).toBe('Welcome to Acme Corp');
    expect(JSON.stringify(mine.content)).not.toContain(SAMPLE_COMPANY);
    expect(JSON.stringify(mine.content)).toContain('Acme Corp');
    // The original is untouched.
    expect(welcome.subject).toBe(`Welcome to ${SAMPLE_COMPANY}`);
  });

  it('leaves the starter alone with nothing to use', () => {
    expect(personaliseStarter(welcome, { name: '' })).toBe(welcome);
    expect(personaliseStarter(welcome, null)).toBe(welcome);
  });

  it('puts the workspace logo in the logo slot, and keeps the mark without one', () => {
    const logo = (s: typeof welcome) => JSON.stringify(s.content).match(/"src":"([^"]+)"/)?.[1];
    expect(logo(personaliseStarter(welcome, { name: 'Acme', logoUrl: 'https://img.clerk.com/acme.png' }))).toBe('https://img.clerk.com/acme.png');
    expect(logo(personaliseStarter(welcome, { name: 'Acme' }))).toBe('/brand/mark.png');
  });
});

describe('starter templates', () => {
  it('have unique ids', () => {
    const ids = STARTER_TEMPLATES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const starter of STARTER_TEMPLATES) {
    it(`${starter.name} opens clean`, () => {
      const findings = [
        ...checkFields(starter.subject, starter.previewText),
        ...collectContentFindings(starter.content),
      ].map((f) => f.message);
      expect(findings).toEqual([]);
      // Every pill carries a placeholder and every destination is stood in
      // for, so an untouched starter raises no "no preview value" finding.
      expect(unresolvedVariables(collectDataKeys(starter.content), {})).toEqual([]);
    });
  }
});
