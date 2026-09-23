import type { JSONContent } from '@tiptap/core';

/**
 * The gallery behind "New template": the emails a startup sends first, each
 * finished enough to publish after swapping the copy. Every starter has a
 * subject and preview text so a fresh template opens with no preflight
 * finding, and every button points at a variable or a real URL — the test
 * beside this file holds that line.
 *
 * Content is the editor's own JSON. Variables render as {{name}} pills with
 * a placeholder for previews (stored under the node's `fallback` attribute);
 * a real render needs every value in the data. A button whose
 * `isUrlVariable` is set reads its destination from the data too. The sample
 * company is Temply itself — a name every user of ours already knows to
 * replace, where "Acme" only reads as a placeholder to people who know the
 * convention.
 */
/** The company every starter is written for. It stands in until the
 *  workspace's own name replaces it — see personaliseStarter. */
export const SAMPLE_COMPANY = 'Temply';

export type StarterTemplate = {
  id: string;
  name: string;
  /** One line under the name in the gallery. */
  description: string;
  /** Becomes the template's title, which is also the subject line. */
  subject: string;
  previewText: string;
  content: JSONContent;
};

const logo: JSONContent = {
  type: 'logo',
  attrs: { src: '/brand/mark.png', alt: 'Temply', title: null, size: 'md', alignment: 'left' },
};
const spacer = (height: 'sm' | 'md' | 'lg' | 'xl' = 'lg'): JSONContent => ({ type: 'spacer', attrs: { height } });
const heading = (content: string | JSONContent[], level: 1 | 2 | 3 = 2): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: typeof content === 'string' ? [{ type: 'text', marks: [{ type: 'bold' }], text: content }] : content,
});
const text = (value: string): JSONContent => ({ type: 'text', text: value });
const variable = (id: string, fallback: string): JSONContent => ({
  type: 'variable',
  attrs: { id, label: null, fallback, required: true, hideDefaultValue: false },
});
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const button = (label: string, url: { variable: string } | { href: string }): JSONContent => ({
  type: 'button',
  attrs: {
    text: label,
    isTextVariable: false,
    url: 'variable' in url ? url.variable : url.href,
    isUrlVariable: 'variable' in url,
    alignment: 'left',
    variant: 'filled',
    borderRadius: 'smooth',
    buttonColor: null,
    textColor: null,
    paddingTop: null,
    paddingRight: null,
    paddingBottom: null,
    paddingLeft: null,
  },
});
const footer = (...content: JSONContent[]): JSONContent => ({ type: 'footer', content });

const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Just your logo and a cursor.',
    subject: 'Untitled email',
    previewText: 'A line the inbox shows under the subject.',
    // An empty paragraph, not an empty text node — ProseMirror rejects the latter.
    content: doc(logo, spacer('lg'), { type: 'paragraph' }),
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'The first email after sign-up: one thing to do next.',
    subject: 'Welcome to Temply',
    previewText: 'Here is how to get the most out of your first week.',
    content: doc(
      logo,
      spacer('xl'),
      heading('Welcome aboard'),
      paragraph(text('Hi '), variable('firstName', 'there'), text(', thanks for signing up. You are all set — here is the one thing worth doing first.')),
      paragraph(text('Create your first project. It takes about two minutes, and everything else in Temply starts from there.')),
      button('Create a project', { variable: 'dashboardUrl' }),
      spacer('xl'),
      paragraph(text('Questions? Reply to this email — a real person reads it.')),
      footer(text('You are receiving this because you created an Temply account.')),
    ),
  },
  {
    id: 'verify-email',
    name: 'Verify email',
    description: 'A code and a button, nothing else.',
    subject: 'Confirm your email address',
    previewText: 'Your code expires in 15 minutes.',
    content: doc(
      logo,
      spacer('xl'),
      heading('Confirm your email'),
      paragraph(text('Enter this code, or press the button below. It works for the next 15 minutes.')),
      heading([variable('code', '123456')], 1),
      button('Confirm email', { variable: 'verifyUrl' }),
      spacer('xl'),
      paragraph(text('If you did not create an account, you can ignore this email.')),
      footer(text('Sent by Temply because someone used this address to sign up.')),
    ),
  },
  {
    id: 'password-reset',
    name: 'Password reset',
    description: 'One link, a time limit, and what to do if it was not you.',
    subject: 'Reset your password',
    previewText: 'The link works for one hour.',
    content: doc(
      logo,
      spacer('xl'),
      heading('Reset your password'),
      paragraph(text('Hi '), variable('firstName', 'there'), text(', someone asked to reset the password for this account. If that was you, press the button — the link works for one hour.')),
      button('Choose a new password', { variable: 'resetUrl' }),
      spacer('xl'),
      paragraph(text('If you did not ask for this, ignore this email. Your password stays as it is.')),
      footer(text('Temply will never ask for your password by email.')),
    ),
  },
  {
    id: 'receipt',
    name: 'Receipt',
    description: 'What they paid, for what, and where to see the order.',
    subject: 'Your Temply receipt',
    previewText: 'Thanks for your order.',
    content: doc(
      logo,
      spacer('xl'),
      heading('Thanks for your order'),
      paragraph(text('Order '), variable('orderNumber', '#1001'), text(' is confirmed. Here is a summary; the full invoice is on your account.')),
      paragraph(text('Total charged: '), variable('total', '$0.00')),
      paragraph(text('Paid with: '), variable('paymentMethod', 'card ending 4242')),
      button('View order', { variable: 'orderUrl' }),
      spacer('xl'),
      paragraph(text('Something not right? Reply to this email and we will sort it out.')),
      footer(text('Temply · This is your receipt; keep it for your records.')),
    ),
  },
  {
    id: 'invite',
    name: 'Team invite',
    description: 'Who invited them, to what, and one button to accept.',
    subject: 'You have been invited to Temply',
    previewText: 'Accept the invite to join the team.',
    content: doc(
      logo,
      spacer('xl'),
      heading('Join the team'),
      paragraph(variable('inviterName', 'A teammate'), text(' invited you to '), variable('workspaceName', 'their workspace'), text(' on Temply.')),
      paragraph(text('Accept to start working together. The invite expires in seven days.')),
      button('Accept invite', { variable: 'inviteUrl' }),
      spacer('xl'),
      paragraph(text('Not expecting this? You can ignore it, and nothing will happen.')),
      footer(text('Sent by Temply on behalf of '), variable('inviterName', 'a teammate'), text('.')),
    ),
  },
  {
    id: 'announcement',
    name: 'Product update',
    description: 'One feature, why it matters, one link.',
    subject: 'New in Temply: something worth a look',
    previewText: 'A short note on what changed this week.',
    content: doc(
      logo,
      spacer('xl'),
      heading('Something new for you'),
      paragraph(text('We shipped a feature people kept asking for. Here is what it does, in two sentences, and why it will save you time.')),
      paragraph(text('It is on for every account today — nothing to switch on.')),
      button('See what changed', { href: 'https://example.com/changelog' }),
      spacer('xl'),
      paragraph(text('As always, reply if you have thoughts. We read every one.')),
      footer(text('You get product updates because you have an Temply account. Unsubscribe from the account page.')),
    ),
  },
];

export type Workspace = {
  name?: string | null;
  /** The workspace's own logo, when one was uploaded; the Temply mark
   *  stands in otherwise. */
  logoUrl?: string | null;
};

/**
 * The starter made the workspace's: its name where the sample company was
 * — subject, preview text and every run of text — and its logo in the
 * logo slot when it has one.
 */
export function personaliseStarter(starter: StarterTemplate, workspace: Workspace | null | undefined): StarterTemplate {
  const name = workspace?.name?.trim();
  const logoUrl = workspace?.logoUrl?.trim();
  const swapName = name && name !== SAMPLE_COMPANY;
  if (!swapName && !logoUrl) return starter;
  const swap = (text: string) => (swapName ? text.split(SAMPLE_COMPANY).join(name) : text);
  // attrs is built up rather than spread twice — alt's swap and the logo's
  // src replacement both land in the same object, or the second spread would
  // silently drop the first.
  const walk = (node: JSONContent): JSONContent => {
    const attrs = node.attrs ? { ...node.attrs } : undefined;
    if (attrs) {
      if (typeof attrs.alt === 'string') attrs.alt = swap(attrs.alt);
      if (node.type === 'logo' && logoUrl) attrs.src = logoUrl;
    }
    return {
      ...node,
      ...(typeof node.text === 'string' ? { text: swap(node.text) } : {}),
      ...(attrs ? { attrs } : {}),
      ...(node.content ? { content: node.content.map(walk) } : {}),
    };
  };
  return {
    ...starter,
    subject: swap(starter.subject),
    previewText: swap(starter.previewText),
    content: walk(starter.content),
  };
}
