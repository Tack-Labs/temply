import { expect, test, type Page } from '@playwright/test';

// What the browser makes of the button and input primitives, on the one public
// page that carries both: a button's size and weight, its resting border and
// its focus ring, and a field's height. Which classes produce them is the unit
// tests' business; these cases hold what is drawn.
// Chromium floors a border to whole CSS pixels unless the screen itself has the
// density to draw the fraction, and the density a context emulates is not one:
// `deviceScaleFactor` still computes a 1.5px border to 1px. A real density of 2
// draws it, so the browser is launched with one. Launch options belong to the
// worker, which is why this is stated for the file and not the describe.
test.use({
  storageState: { cookies: [], origins: [] },
  launchOptions: { args: ['--force-device-scale-factor=2'] },
});

test.describe('redesign primitives', () => {
  const open = async (page: Page) => {
    await page.goto('/');
    // Faces that arrive late reflow the hero, and a measure taken before they
    // do is of a layout that is about to change.
    await page.evaluate(() => document.fonts.ready);
    const row = page.locator('div.hero-enter').filter({ has: page.getByRole('link', { name: /^Start your free trial/ }) });
    return {
      primary: row.getByRole('link', { name: /^Start your free trial/ }),
      secondary: row.getByRole('link', { name: 'Try the editor, no account' }),
    };
  };

  test('a primary button is at least 48px tall and carries a shadow', async ({ page }) => {
    const { primary } = await open(page);
    const box = await primary.boundingBox();
    expect(box?.height, 'the button has a box').toBeGreaterThanOrEqual(48);
    expect(await primary.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  });

  test('a secondary button rests in a 1.5px border', async ({ page }) => {
    const { secondary } = await open(page);
    const width = await secondary.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(width).toBe('1.5px');
  });

  test('a focused control is drawn with a 3px outline', async ({ page }) => {
    const { secondary } = await open(page);
    // Real Tab presses, not focus(): the outline is :focus-visible, which a
    // keyboard arrival always matches and a script's focus may not.
    for (let presses = 0; presses < 40; presses++) {
      await page.keyboard.press('Tab');
      if (await secondary.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(secondary).toBeFocused();
    const ring = await secondary.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring).toEqual({ style: 'solid', width: '3px' });
  });

  // The contact form is the one public page with a field, and it takes the
  // primitive's border and height as they are.
  const field = async (page: Page) => {
    await open(page);
    const name = page.locator('#contact-name');
    await name.scrollIntoViewIfNeeded();
    return name;
  };

  test('a field rests in a 1.5px border', async ({ page }) => {
    const name = await field(page);
    expect(await name.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1.5px');
  });

  test('a field is 48px tall', async ({ page }) => {
    const name = await field(page);
    const box = await name.boundingBox();
    expect(box?.height).toBe(48);
  });

  test('a text box wears the field\'s border and corners on a taller box', async ({ page }) => {
    const name = await field(page);
    const message = page.locator('#contact-message');
    await message.scrollIntoViewIfNeeded();
    const look = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return { width: style.borderTopWidth, colour: style.borderTopColor, radius: style.borderTopLeftRadius };
    };
    expect(await message.evaluate(look)).toEqual(await name.evaluate(look));
    expect((await message.boundingBox())?.height, 'a text box is taller than a one-line field').toBeGreaterThan(48);
  });

  // outline-style cannot animate and outline-color can, so a ring fades only
  // if it already exists, transparent, before focus: the browser then has a
  // colour to move from. Computed style is what is asserted, because a class
  // that is present but loses the cascade draws nothing.
  test('a focused field fades its ring in from a transparent one', async ({ page }) => {
    const name = await field(page);
    const ringOf = (el: HTMLElement) => {
      const style = getComputedStyle(el);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
        transition: style.transitionProperty.split(',').map((property) => property.trim()),
      };
    };

    const resting = await name.evaluate(ringOf);
    expect(resting.style, 'a ring that is not solid at rest has nothing to fade from').toBe('solid');
    expect(resting.width).toBe('3px');
    expect(resting.color, 'the resting ring is transparent').toBe('rgba(0, 0, 0, 0)');
    expect(resting.transition, 'the colour is eased, not switched').toContain('outline-color');

    await name.focus();
    await expect(name).toBeFocused();
    // The ring's colour is the focus token, read from a probe that resolves the
    // custom property to the same rgb() the outline reports.
    const token = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--ds-focus)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    expect(token, 'the probe resolved the token').not.toBe('rgba(0, 0, 0, 0)');
    await expect.poll(() => name.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(token);
    const focused = await name.evaluate(ringOf);
    expect(focused.style).toBe('solid');
    expect(focused.width).toBe('3px');
  });
});
