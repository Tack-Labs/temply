/**
 * Guards the email defaults the way check-contrast.ts guards the app tokens.
 *
 * We declare `color-scheme: light` so clients that respect it leave our output
 * alone. Clients that ignore it force an inversion instead, and this asserts
 * the defaults stay readable when that happens.
 *
 * The maths lives in @temply/shared/contrast, shared with the warnings the
 * Brand panel shows while someone is picking colours — so a template that
 * passes here and a template the editor calls readable are judged the same way.
 *
 * Run: bun run check:email-dark
 */
import { DEFAULT_RENDERER_THEME } from '@temply/shared/theme';
import { AA_TEXT, contrast, forceDark, toHex, toRgb } from '@temply/shared/contrast';

const theme = DEFAULT_RENDERER_THEME;
const container = theme.container?.backgroundColor ?? '#FFFFFF';

// Text colours the renderer applies over the container. These live in
// engine.tsx's default theme rather than in the shared object.
const CONTENT = {
  heading: '#111827',
  paragraph: '#374151',
  footer: '#64748B',
};

const CHECKS: Array<[string, string, string, string]> = [
  ['heading', CONTENT.heading, container, 'headings on the container'],
  ['paragraph', CONTENT.paragraph, container, 'body copy on the container'],
  ['footer', CONTENT.footer, container, 'footer copy on the container'],
  ['link', theme.link?.color ?? '#346FE4', container, 'links on the container'],
  [
    'button label',
    theme.button?.color ?? '#FFFFFF',
    theme.button?.backgroundColor ?? '#000000',
    'the button label on its fill',
  ],
];

let failures = 0;

console.log('Email defaults, as sent and after a forced inversion\n');
console.log('  pair                     as sent            forced dark');

for (const [name, fg, bg, use] of CHECKS) {
  const asSent = contrast(fg, bg);
  const dark = contrast(forceDark(fg), forceDark(bg));
  const mark = (r: number) => (r >= AA_TEXT ? 'ok  ' : 'FAIL');
  if (asSent < AA_TEXT || dark < AA_TEXT) failures++;
  console.log(
    `  ${name.padEnd(22)} ${String(asSent).padStart(6)}:1 ${mark(asSent)}  ${String(dark).padStart(6)}:1 ${mark(dark)}   ${use}`,
  );
}

console.log('\n  how the surfaces move');
for (const [label, hex] of [
  ['body', theme.body?.backgroundColor ?? '#F4F4F5'],
  ['container', container],
  ['button fill', theme.button?.backgroundColor ?? '#000000'],
] as const) {
  console.log(`  ${label.padEnd(22)} ${toHex(toRgb(hex))}  ->  ${toHex(forceDark(hex))}`);
}

if (failures > 0) {
  console.error(`\n${failures} default(s) stop being readable under a forced inversion.`);
  process.exit(1);
}
console.log('\nEvery default stays readable in both states.');
