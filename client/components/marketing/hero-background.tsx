/** The hero's glow, drawn from the accent token so it retunes with it. Purely
 *  decorative, so it is aria-hidden and sits behind the content. It pools
 *  behind the showreel and stays off the copy: the muted lines only clear 4.5:1
 *  on a near-white ground, and a blue wash anywhere under them takes them below
 *  it. Where the layout stacks, the copy sits above the showreel and the glow is
 *  held to the section's foot; from lg the showreel is beside the copy and the
 *  glow follows it, anchored to the content column's edge rather than the
 *  screen's so it does not drift off on a wide one. The light is all it
 *  carries: the page-wide fixed field in page.tsx already lays down the dot
 *  texture, and a second layer of dots here would move against that one on
 *  scroll and moiré. */
export function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="relative mx-auto h-full max-w-5xl">
        <div
          className="absolute bottom-10 left-1/2 h-[340px] w-[760px] -translate-x-1/2 rounded-full opacity-60 blur-3xl lg:top-[6%] lg:right-[-60px] lg:bottom-auto lg:left-auto lg:h-[520px] lg:w-[600px] lg:translate-x-0"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in oklab, var(--ds-accent) 55%, transparent), transparent 70%)',
          }}
        />
      </div>
    </div>
  );
}
