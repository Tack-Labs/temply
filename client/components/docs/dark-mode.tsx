import { Code, H2, P } from '~/components/docs/docs-content';
import { FigureDarkMode } from '~/components/docs/figure-dark-mode';

/**
 * What a dark inbox does to an email, and which part of that Temply can
 * speak to. Written around the three kinds of client rather than named
 * apps, because the apps change their minds between versions and the three
 * behaviours do not.
 */
const KINDS: Array<{ kind: string; does: string; examples: string }> = [
  {
    kind: 'Reads the declaration',
    does: 'Shows the email exactly as designed, in light or dark mode alike. Without a declaration it would decide for itself, and often invert a text-heavy email.',
    examples: 'Apple Mail on iPhone, iPad and Mac',
  },
  {
    kind: 'Ignores it and recolours',
    does: 'Applies its own dark treatment whatever the email says: some invert everything, some only lighten dark text and darken light backgrounds.',
    examples: 'The Gmail app, Outlook on Windows and on phones',
  },
  {
    kind: 'Leaves email alone',
    does: 'Darkens its own chrome and shows the email as designed.',
    examples: 'Gmail in a browser, most webmail',
  },
];

export function DarkMode() {
  return (
    <section>
      <H2 id="dark-mode">Dark mode</H2>
      <P>
        An email has no dark mode of its own. It has the colours you gave it, and
        a dark inbox is the reader’s setting, not the template’s. A template built
        on a dark background is a{' '}
        <strong className="font-medium text-ink">dark theme</strong>: still one set
        of colours, and a client that recolours email will recolour it too, just
        with a different result. The two are worth keeping apart, because a dark
        theme is no protection from dark mode.
      </P>
      <P>
        Temply declares every email as designed for light,{' '}
        <Code>color-scheme: light</Code> in the document’s head. What that does
        depends on which of three kinds of client opens it.
      </P>

      <div className="mt-5 max-w-2xl overflow-x-auto rounded-md border border-line bg-raised">
        {/* Wider than a phone on purpose: three columns squeezed to 390px read
            as a list of syllables. The wrapper scrolls it instead. */}
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-2xs font-medium tracking-wide text-faint uppercase">
              <th className="px-4 py-2.5 font-medium">The client</th>
              <th className="px-4 py-2.5 font-medium">In dark mode</th>
              <th className="px-4 py-2.5 font-medium">For example</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {KINDS.map((row) => (
              <tr key={row.kind} className="align-top">
                <td className="px-4 py-2.5 font-medium whitespace-nowrap text-ink">{row.kind}</td>
                <td className="px-4 py-2.5 text-muted">{row.does}</td>
                <td className="px-4 py-2.5 text-muted">{row.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FigureDarkMode />

      <P>
        The declaration only reaches the first kind, and that is the point of
        it. Those clients open a large share of most lists, and with it they show
        the email you saw in the editor; without it they would guess from the
        content, and the guess changes as the content does. Leaving the
        declaration out would not make the other clients behave the same — each
        recolours in its own way — it would only give up the one case that can
        be exact.
      </P>
      <P>
        For the clients that recolour anyway, Temply helps you see it coming.{' '}
        <strong className="font-medium text-ink">Forced dark</strong> in the Preview
        view redraws the email the way a client that inverts everything would,
        with images kept the right way round. The Brand panel warns when a colour
        pair would lose its contrast under that inversion, using the same maths
        the preview draws with, and the Checks list carries the same findings so
        they are on the page while you write. One honest limit: the preview
        shows the full inversion, the harshest case. A client that only lightens
        dark text and darkens light backgrounds lands somewhere in between, and
        a template that reads well under the full inversion reads well there
        too.
      </P>
      <P>
        Temply does not produce a second set of colours for dark mode — the{' '}
        <Code>prefers-color-scheme</Code> styles some clients honour. One set of
        colours, declared light, is what every recipient gets; what a dark inbox
        makes of it is the table above. Two things help in every case: a logo
        saved as a transparent PNG with a little padding, so it survives a dark
        background, and colours a comfortable distance from pure black and pure
        white, which inversion sends to their extremes.
      </P>
    </section>
  );
}
