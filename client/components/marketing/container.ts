/**
 * The marketing column. The header, every section of the home page and the
 * footer hang from this one string, so their edges stay on the same two lines
 * at every width. 70rem is the 1120px of the design, border box included: the
 * content is 1056px wide where the gutter is 32px, and 280px wide at a 320px
 * phone, where it is 20px. A section that sets its own `max-w-*` and `px-*`
 * is the one that drifts when this changes.
 */
export const container = 'mx-auto w-full max-w-280 px-5 md:px-8';
