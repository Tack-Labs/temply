import { describe, expect, it } from 'bun:test';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { themeIssues } from './theme-warnings';

/**
 * The presets are the looks we recommend, so each has to pass the readability
 * check the editor runs on any theme — Warm shipped at 4.02:1 and opened
 * every template with three warnings the user had done nothing to earn.
 */
describe('brand presets', () => {
  for (const preset of BRAND_PRESETS) {
    it(`${preset.name} raises no readability warning`, () => {
      const issues = themeIssues(preset.theme).map(
        (issue) => `${issue.subject}: ${issue.ratio}:1 (${issue.where})`,
      );
      expect(issues).toEqual([]);
    });
  }
});
