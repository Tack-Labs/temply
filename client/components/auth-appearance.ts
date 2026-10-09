/**
 * How the sign-in and sign-up cards are drawn, on top of the palette the
 * theme provider hands every Clerk component. Clerk's own stylesheet
 * outranks a utility class on its elements, so these are style objects,
 * each reading the app's tokens through `var()` so one object serves both
 * themes. The measures are the app's: a 48px field with the field radius and
 * the 1.5px strong line, a 48px pill for the primary and the social button,
 * the display face on the title, the card on the dialog's shadow with no
 * hairline. Only the auth screens take these; the profile pages inside the
 * dashboard keep Clerk's own proportions, which suit a settings form.
 */
const field = {
  height: '3rem',
  paddingInline: '1rem',
  borderRadius: 'var(--radius-field)',
  borderWidth: '1.5px',
  borderColor: 'var(--ds-line-strong)',
  fontSize: 'var(--text-ui)',
  boxShadow: 'none',
  '&:hover': { borderColor: 'var(--ds-line-strong)' },
  '&:focus, &:focus-within': { borderColor: 'var(--ds-focus)', boxShadow: 'none' },
};

const pill = {
  height: '3rem',
  borderRadius: '9999px',
  fontSize: 'var(--text-ui)',
  fontWeight: 700,
  boxShadow: 'none',
};

export const authElements: Record<string, unknown> = {
  cardBox: {
    width: '26rem',
    maxWidth: '100%',
    borderRadius: 'var(--radius-card)',
    border: 'none',
    boxShadow: 'var(--shadow-lg)',
  },
  card: { padding: '2rem', gap: '1.5rem', boxShadow: 'none' },
  headerTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-2xl)',
    fontWeight: 700,
    letterSpacing: 'var(--tracking-display)',
  },
  headerSubtitle: { fontSize: 'var(--text-base)', color: 'var(--ds-muted)' },
  socialButtonsBlockButton: {
    ...pill,
    fontWeight: 600,
    borderWidth: '1.5px',
    borderColor: 'var(--ds-line-strong)',
    '&:hover': { backgroundColor: 'var(--ds-hover)' },
  },
  socialButtonsBlockButtonText: { fontSize: 'var(--text-ui)', fontWeight: 600 },
  dividerText: { fontSize: 'var(--text-sm)', color: 'var(--ds-muted)' },
  formFieldLabel: { fontSize: 'var(--text-base)', fontWeight: 700 },
  formFieldInput: field,
  otpCodeFieldInput: { ...field, paddingInline: 0 },
  formButtonPrimary: {
    ...pill,
    backgroundImage: 'none',
    boxShadow: 'var(--shadow-cta)',
    '&:hover': { backgroundColor: 'var(--ds-accent)', boxShadow: 'var(--shadow-cta-hover)' },
  },
  footer: { backgroundColor: 'var(--ds-sunken)', backgroundImage: 'none' },
  footerActionText: { fontSize: 'var(--text-base)' },
  footerActionLink: { fontSize: 'var(--text-base)', fontWeight: 600 },
};

/**
 * The profile and organization cards embedded on the Settings page: the
 * auth card's title, fields and buttons, on a Card's own footing, since they
 * sit in the dashboard column beside other cards rather than alone on a
 * page. The nav column takes the sunken surface the sidebar's cards sit on.
 */
export const profileElements: Record<string, unknown> = {
  rootBox: { width: '100%' },
  cardBox: {
    width: '100%',
    borderRadius: 'var(--radius-card)',
    border: 'none',
    boxShadow: 'var(--shadow-sm)',
  },
  card: { boxShadow: 'none' },
  navbar: { backgroundColor: 'var(--ds-sunken)', backgroundImage: 'none' },
  headerTitle: authElements.headerTitle,
  headerSubtitle: authElements.headerSubtitle,
  formFieldLabel: authElements.formFieldLabel,
  formFieldInput: authElements.formFieldInput,
  formButtonPrimary: authElements.formButtonPrimary,
  formButtonReset: { height: '3rem', borderRadius: '9999px', fontSize: 'var(--text-ui)', fontWeight: 600 },
};
