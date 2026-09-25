/**
 * The facts the legal pages are written around. One place, so a change of
 * operator, address or law is a one-line edit and both pages agree.
 * Confirm these before launch: the governing law in particular is a
 * placeholder for the operator's own jurisdiction.
 */
import { CONTACT_EMAIL, SITE_URL } from './site';

export const LEGAL = {
  /** The name the contract is with. */
  operator: 'Temply',
  product: 'Temply',
  site: SITE_URL,
  contactEmail: CONTACT_EMAIL,
  governingLaw: 'England and Wales',
  /** ISO date; shown as "Last updated". Bump it when the text changes. */
  updated: '2026-09-25',
} as const;

/** The services personal data passes through, named so the privacy policy
 *  is honest about who else holds it and why. */
export const PROCESSORS = [
  { name: 'Clerk', purpose: 'sign-in, accounts and team membership', site: 'https://clerk.com' },
  { name: 'Stripe', purpose: 'checkout, payments, invoices and storing your card details, as our payment processor; card details never reach us', site: 'https://stripe.com' },
  { name: 'Resend', purpose: 'the email we send: test sends from the editor and contact-form delivery', site: 'https://resend.com' },
  { name: 'ImageKit', purpose: 'storing the images you upload for your templates', site: 'https://imagekit.io' },
  { name: 'Sentry', purpose: 'error reports when something in the product breaks', site: 'https://sentry.io' },
] as const;
