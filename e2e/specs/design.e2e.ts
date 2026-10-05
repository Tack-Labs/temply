import { expect, test, type Locator, type Page } from '@playwright/test';
import { onPhone } from '../fixtures/project';

// next/font serves each family under the name Google gives it (`Figtree`,
// with a metrics-matched `Figtree Fallback` behind it), and a computed
// `font-family` also carries quotes and the rest of the stack. A face is
// recognised by its name, matched case-insensitively, never by the exact
// string.
const FIGTREE = /figtree/i;
const BRICOLAGE = /bricolage/i;
const JETBRAINS = /jetbrains/i;
const INTER = /inter/i;
// next/font also declares `Inter Fallback`, a local Arial face with Inter's
// metrics, and it counts as loaded as soon as anything paints in it while
// the real file is still on the way. Only the face that is not the fallback
// says Inter itself arrived.
const INTER_FACE = /inter(?!.*fallback)/i;

const familyOf = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).fontFamily);

/** The first family a computed `font-family` list names: the one that paints. */
const leading = (family: string) => family.split(',')[0].replace(/["']/g, '').trim();

/** The families the page has downloaded and parsed, as next/font named them. */
const loadedFaces = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    const loaded: string[] = [];
    document.fonts.forEach((face) => {
      if (face.status === 'loaded') loaded.push(face.family.replace(/["']/g, ''));
    });
    return loaded;
  });

/** Every family the page declares, loaded or not. */
const declaredFaces = (page: Page) =>
  page.evaluate(() => {
    const declared: string[] = [];
    document.fonts.forEach((face) => {
      declared.push(face.family.replace(/["']/g, ''));
    });
    return declared;
  });

// A computed `font-family` is the cascade's answer and says nothing about
// whether the file arrived, so each case that names a face also waits for it
// to be loaded.
const expectLoaded = (page: Page, face: RegExp) =>
  expect.poll(async () => (await loadedFaces(page)).some((name) => face.test(name)), { message: `${face} never loaded` }).toBe(true);

test.describe('fonts', () => {
  test('the home page sets body text in Figtree and its heading in Bricolage Grotesque', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    expect(leading(await familyOf(page.locator('body')))).toMatch(FIGTREE);
    expect(leading(await familyOf(h1))).toMatch(BRICOLAGE);
    await expectLoaded(page, FIGTREE);
    await expectLoaded(page, BRICOLAGE);
  });

  test('code is set in JetBrains Mono', async ({ page }) => {
    // The docs page is the public page with the most code on it. The face is
    // not preloaded, so it is fetched when the first mono text lays out: on
    // /docs that is the eyebrow at the top, ahead of any block. The block's
    // own computed family is what pins the code; the loaded check only says
    // the face arrived for something on the page.
    await page.goto('/docs');
    const block = page.locator('pre').first();
    await expect(block).toBeVisible();
    expect(leading(await familyOf(block))).toMatch(JETBRAINS);
    await expectLoaded(page, JETBRAINS);
  });

  // The canvas is the email, not the app: it is set in the renderer's Inter
  // whatever the shell is set in, the way it ignores app dark mode. Inter is
  // loaded by the editor and the playground only, so this is also where it is
  // pinned that the file arrives.
  test('the editor canvas keeps Inter, whatever the app is set in', async ({ browser }) => {
    // A fresh context with no storageState, as the playground spec uses: the
    // playground is the one editor a signed-out visitor reaches.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/playground');
    const canvas = page.locator('.ProseMirror');
    await expect(canvas).toContainText('Welcome to Temply');
    const family = await familyOf(canvas);
    expect(leading(family)).toMatch(INTER);
    expect(family).not.toMatch(/figtree|bricolage|jetbrains/i);
    await expectLoaded(page, INTER_FACE);
    await context.close();
  });

  test('a toast is set in Figtree, not in Sonner’s own system stack', async ({ browser }) => {
    test.skip(onPhone(), 'the phone playground is a read-only canvas with no HTML view to switch to');
    // The signed-out playground raises a toast when a render fails, and the
    // only other way to one is a blocked clipboard. The render is answered
    // here, so a toast is certain and the case does not depend on the API
    // behind the page.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.route('**/api/v1/emails/preview', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'The renderer is down.' }) }),
    );
    await page.goto('/playground');
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toBeVisible();
    expect(leading(await familyOf(toast))).toMatch(FIGTREE);
    await context.close();
  });

  test('the home page asks for no Geist or Space Grotesk', async ({ page }) => {
    const files: string[] = [];
    page.on('request', (request) => {
      if (/\.woff2?(\?|$)/.test(request.url())) files.push(request.url());
    });
    await page.goto('/');
    await expectLoaded(page, FIGTREE);
    // next/font serves its files under content-hashed names, so a URL never
    // says which family it holds. The page's declared faces carry the family
    // names, so they are what shows a Geist or Space Grotesk still being
    // asked for; the file count only proves fonts were requested at all.
    expect(files.length, 'the page loads at least one font file').toBeGreaterThan(0);
    expect((await declaredFaces(page)).filter((name) => /geist|space[ _]?grotesk/i.test(name))).toEqual([]);
  });
});

// The headline is two blocks, so the break falls after the full stop whatever
// the width: each block then wraps on its own below that. What it must never do
// is run past its column, into the gap and under the showreel beside it.
test.describe('the hero headline', () => {
  const HEADLINE_WIDTHS = [320, 390, 768, 1024, 1100, 1280, 1440, 1920] as const;

  /** Where each line of the headline is drawn, against the column it sits in. */
  const headline = (page: Page) =>
    page.evaluate(() => {
      const h1 = document.querySelector('h1')!;
      const column = h1.parentElement!.getBoundingClientRect();
      const lines = (span: Element) => {
        const range = document.createRange();
        range.selectNodeContents(span);
        const boxes = Array.from(range.getClientRects()).filter((box) => box.width > 0);
        return {
          count: new Set(boxes.map((box) => Math.round(box.top))).size,
          top: Math.min(...boxes.map((box) => box.top)),
          bottom: Math.max(...boxes.map((box) => box.bottom)),
          left: Math.min(...boxes.map((box) => box.left)),
          right: Math.max(...boxes.map((box) => box.right)),
        };
      };
      const spans = Array.from(h1.querySelectorAll('span'));
      const [first, second] = spans.map(lines);
      const [firstBox, secondBox] = spans.map((span) => span.getBoundingClientRect());
      return {
        column: { left: column.left, right: column.right },
        overflows: h1.scrollWidth > h1.clientWidth,
        // Each sentence is a block of its own, so the second starts where the
        // first one's box ends. The lines' glyph boxes overlap by a few pixels
        // and say nothing of that.
        stacked: secondBox.top >= firstBox.bottom - 1,
        first,
        second,
      };
    });

  async function expectInItsColumn(page: Page, { threeLines }: { threeLines: boolean }) {
    for (const width of HEADLINE_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const { column, overflows, stacked, first, second } = await headline(page);
      const at = `at ${width}px`;
      expect(overflows, `the heading overflows its own box ${at}`).toBe(false);
      for (const line of [first, second]) {
        expect(line.left, `a line starts left of the column ${at}`).toBeGreaterThanOrEqual(column.left - 1);
        expect(line.right, `a line runs past the column ${at}`).toBeLessThanOrEqual(column.right + 1);
      }
      expect(stacked, `the second sentence does not start on a new line ${at}`).toBe(true);
      // From `lg` the column is a fixed 31rem, and the headline is set to fill
      // it in three lines with the display face in place.
      if (threeLines && width >= 1024) expect(first.count + second.count, `the headline wraps ${at}`).toBe(3);
    }
  }

  test('stays inside its column from a phone to a wide screen, in three lines from lg up', async ({ page }) => {
    await page.goto('/');
    await expectLoaded(page, BRICOLAGE);
    await expectInItsColumn(page, { threeLines: true });
  });

  test('stays inside its column when no font file arrives', async ({ page }) => {
    // The metrics-matched fallback is set a little wider than the real face, so
    // the headline may take a line more here. It still may not leave the column.
    await page.route(/\.woff2?(\?|$)/, (route) => route.abort());
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // next/font's `* Fallback` faces are local() and count as loaded at once.
    expect((await loadedFaces(page)).filter((name) => !/fallback/i.test(name)), 'a font file loaded despite the block').toEqual([]);
    await expectInItsColumn(page, { threeLines: false });
  });
});

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

const WIDTHS = [320, 390, 1300] as const;

/**
 * What a reader can see of the page's content that sits past a side of the
 * screen. `scrollWidth` cannot say: the home page's wrapper clips sideways
 * (`overflow-x: clip`, so the page never scrolls), and a panel running off the
 * edge is then cut off, not scrolled to. So each box is read for where it is.
 * Left out: what no one sees (hidden or `aria-hidden`, which is where the
 * decorative washes that bleed past their panels live), and what scrolls on
 * its own, like a code block under `overflow-x: auto`.
 */
const offTheEdge = (page: Page) =>
  page.evaluate(() => {
    const width = window.innerWidth;
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      // An SVG's own box is the one that is laid out; a path inside it may be
      // drawn past the viewBox and is clipped there.
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      let scrolls = false;
      for (let node = el.parentElement; node && node.tagName !== 'MAIN'; node = node.parentElement) {
        const { overflowX } = getComputedStyle(node);
        if (overflowX === 'auto' || overflowX === 'scroll') scrolls = true;
      }
      if (scrolls) continue;
      const box = el.getBoundingClientRect();
      // Nothing to see in no area, and the visually hidden text a screen
      // reader reads is one pixel in a corner. A rule one pixel thick is seen.
      if (box.width === 0 || box.height === 0 || (box.width <= 1 && box.height <= 1)) continue;
      if (box.right <= width + 1 && box.left >= -1) continue;
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
      found.push(`<${el.tagName.toLowerCase()}> "${text}" spans ${Math.round(box.left)} to ${Math.round(box.right)} of ${width}`);
    }
    return found;
  });

/** Opens `path` with the theme chosen the way the blocking script in layout.tsx reads it. */
async function open(page: Page, path: string, theme: Theme) {
  await page.addInitScript((chosen) => localStorage.setItem('theme', chosen), theme);
  await page.goto(path);
  // The class set before paint is cleared when React hydrates `<html>` and
  // put back by the provider's effect, so the class alone can be read
  // mid-flicker. The toggle reports the provider's own state, which only
  // changes once that effect has run.
  await expect(page.getByRole('button', { name: 'Dark theme', exact: true })).toHaveAttribute(
    'aria-pressed',
    String(theme === 'dark'),
  );
}

// The public pages are the one place a signed-out visitor meets both themes,
// so they carry the palette's checks. A colour is never compared with a hex
// written here: the page's own `--ds-*` token is read through a probe
// element, so retuning the palette cannot break the case, and only a page
// that stops painting from the token can.
test.describe('themes', () => {
  // The header's primary button is the brand accent in the signed-out
  // header; a signed-in header swaps it for a neutral Dashboard button.
  test.use({ storageState: { cookies: [], origins: [] } });

  const PAGES = ['/', '/docs'] as const;

  test('the Dark theme toggle keeps its name and reports the selected theme', async ({ page }) => {
    // No init script here: it would reset localStorage on reload and mask
    // the preference the toggle itself saved.
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Dark theme', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  /** What the page paints, next to what its tokens say it should. */
  const painted = (page: Page) =>
    page.evaluate(() => {
      const probe = document.createElement('div');
      document.body.append(probe);
      const resolve = (property: 'background-color' | 'color', token: string) => {
        probe.style.cssText = `${property}: var(${token})`;
        return getComputedStyle(probe).getPropertyValue(property);
      };
      const surface = resolve('background-color', '--ds-surface');
      const ink = resolve('color', '--ds-ink');
      const accent = resolve('background-color', '--ds-accent');
      probe.remove();
      const h1 = document.querySelector('h1');
      const signIn = Array.from(document.querySelectorAll('header a')).find((a) => a.textContent?.trim() === 'Sign in');
      return {
        isDark: document.documentElement.classList.contains('dark'),
        body: getComputedStyle(document.body).backgroundColor,
        surface,
        h1: h1 ? getComputedStyle(h1).color : null,
        ink,
        button: signIn ? getComputedStyle(signIn).backgroundColor : null,
        accent,
      };
    });

  const channels = (rgb: string) => (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

  for (const path of PAGES) {
    for (const theme of THEMES) {
      test(`${path} paints from the ${theme} tokens`, async ({ page }) => {
        await open(page, path, theme);
        const seen = await painted(page);

        expect(seen.isDark).toBe(theme === 'dark');
        expect(seen.body).toBe(seen.surface);
        expect(seen.h1, 'the page has a heading').not.toBeNull();
        expect(seen.h1).toBe(seen.ink);
        expect(seen.button, 'the header has a Sign in button').not.toBeNull();
        expect(seen.button).toBe(seen.accent);

        // One violet accent with a strong blue channel in both themes.
        const [r, g, b] = channels(seen.accent);
        expect(b, `${seen.accent} is not blue`).toBeGreaterThan(r + 100);
        expect(b).toBeGreaterThan(g + 100);
      });

      test(`${path} keeps its content on screen at 320, 390 and 1300px in the ${theme} theme`, async ({ page }) => {
        // At rest: a scroll reveal parks a panel 28px to one side until it is
        // in view, which is the design and not a panel off the edge.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await open(page, path, theme);
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 844 });
          const { scroll, client } = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
          }));
          expect(scroll, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(client);
          expect(await offTheEdge(page), `${path} runs off the screen at ${width}px`).toEqual([]);
        }
      });
    }
  }

  test('the screen walk sees a panel that the page wrapper clips out of sight', async ({ page }) => {
    // A guard is only as good as what it can see. A box pushed past the edge
    // inside the home page's clipping wrapper leaves `scrollWidth` alone, and
    // that is the case the walk exists for.
    //
    // React deletes a node it did not render when it hydrates the parent, and
    // `open` returns on the server's HTML in the light theme, so on a slow
    // runner the panel is removed under the case. The reveal flag is raised in
    // the layout effect of the hydration commit, which makes it the sign the
    // page is done; reduced motion withholds it, so that is asked for after,
    // and the stylesheet lays a page that already raised it at rest.
    await open(page, '/', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-reveal-ready', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const wide = document.createElement('div');
      wide.textContent = 'Too wide';
      wide.style.cssText = 'width: 600px; height: 20px';
      document.querySelector('main > .overflow-x-clip')!.append(wide);
    });
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll, 'the wrapper no longer clips, so this no longer shows what the walk adds').toBeLessThanOrEqual(client);
    expect(await offTheEdge(page)).toEqual([expect.stringContaining('"Too wide"')]);
  });

  // "Paints from its tokens" holds for a page that never leaves one theme, so
  // each page is also read in both, side by side: the dark theme has to change
  // what the visitor sees, not only agree with its own variables.
  for (const path of PAGES) {
    test(`${path} looks different in the dark theme than in the light`, async ({ context }) => {
      const read = async (theme: Theme) => {
        const page = await context.newPage();
        await open(page, path, theme);
        const result = await painted(page);
        await page.close();
        return result;
      };
      const light = await read('light');
      const dark = await read('dark');
      expect(dark.body, 'the page background did not change').not.toBe(light.body);
      expect(dark.h1, 'the heading colour did not change').not.toBe(light.h1);
    });
  }

  test('the accent is the same violet in both themes', async ({ context }) => {
    // The editor canvas reads `--ds-accent` for its selection outline and
    // ignores dark mode, so a fill that changed with the theme would show up
    // there as two different fills.
    const accents: string[] = [];
    for (const theme of THEMES) {
      // A page of its own per theme: an init script stays on its page, and
      // two of them would race to set the one key.
      const page = await context.newPage();
      await open(page, '/', theme);
      accents.push((await painted(page)).accent);
      await page.close();
    }
    expect(accents[1]).toBe(accents[0]);
  });
});

// The shared controls, read where a visitor meets them: the home page. What a
// component's classes say is the unit tests' business; these cases hold what
// the browser makes of them — a pill that is round, an outline that is
// drawn, a target that is as tall as a thumb. The SegmentedControl and the
// Skeleton have no public page to stand on yet, so their cases arrive with
// the templates screen that uses them.
test.describe('primitives', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  /** Relative luminance of a computed `rgb(...)`, as WCAG defines it. */
  const luminance = (rgb: string) => {
    const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
      const c = Number(value) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const heroButtons = (page: Page) => {
    const row = page.locator('div.hero-enter').filter({ has: page.getByRole('link', { name: /^Start your free trial/ }) });
    return { primary: row.getByRole('link', { name: /^Start your free trial/ }), other: row.getByRole('link', { name: 'Try the editor, no account' }) };
  };

  test('the "After the trial" badge is a pill', async ({ page }) => {
    await page.goto('/');
    const badge = page.getByText('After the trial', { exact: true });
    await badge.scrollIntoViewIfNeeded();
    const { radius, height } = await badge.evaluate((el) => ({
      radius: parseFloat(getComputedStyle(el).borderTopLeftRadius),
      height: el.getBoundingClientRect().height,
    }));
    expect(height, 'the badge has a box').toBeGreaterThan(0);
    // `rounded-full` computes to an enormous radius; a pill only needs half its height.
    expect(radius).toBeGreaterThanOrEqual(height / 2);
  });

  for (const theme of THEMES) {
    // What this proves is what a keyboard user sees, not which rule draws it:
    // the global :focus-visible rule in globals.css and the Button's own
    // classes paint the same outline, so deleting either leaves this green.
    // button.test.tsx pins the Button's side.
    test(`a keyboard-focused primary button shows a 2px accent-ink outline, 3:1 against the page, in the ${theme} theme`, async ({ page }) => {
      await open(page, '/', theme);
      const { primary } = heroButtons(page);
      // Real Tab presses, not focus(): the outline is :focus-visible, which a
      // keyboard arrival always matches and a script's focus may not.
      for (let presses = 0; presses < 40; presses++) {
        await page.keyboard.press('Tab');
        if (await primary.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(primary).toBeFocused();

      const read = () =>
        primary.evaluate((el) => {
          const probe = document.createElement('div');
          document.body.append(probe);
          const token = (name: string) => {
            probe.style.cssText = `color: var(${name})`;
            return getComputedStyle(probe).color;
          };
          const style = getComputedStyle(el);
          const result = {
            style: style.outlineStyle,
            width: parseFloat(style.outlineWidth),
            offset: parseFloat(style.outlineOffset),
            color: style.outlineColor,
            accentInk: token('--ds-accent-ink'),
            surface: token('--ds-surface'),
          };
          probe.remove();
          return result;
        });

      // The outline's colour fades in over the fast beat, so wait for it.
      await expect.poll(async () => (await read()).color).toBe((await read()).accentInk);
      const ring = await read();
      expect(ring.style).toBe('solid');
      expect(ring.width).toBeGreaterThanOrEqual(2);
      expect(ring.offset, 'held off the edge, so it is drawn on the surface and not on the fill').toBeGreaterThanOrEqual(2);
      expect(contrast(ring.color, ring.surface), 'the outline against the page behind it').toBeGreaterThanOrEqual(3);
    });
  }

  test('a phone gets 44px hero buttons', async ({ page }) => {
    test.skip(!onPhone(), 'a coarse pointer is the phone project’s');
    await page.goto('/');
    const { primary, other } = heroButtons(page);
    for (const button of [primary, other]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('a mouse keeps the dense hero buttons', async ({ page }) => {
    test.skip(onPhone(), 'a fine pointer is the desktop project’s');
    await page.goto('/');
    const { primary, other } = heroButtons(page);
    for (const button of [primary, other]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeLessThan(44);
    }
  });
});
