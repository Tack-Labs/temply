import { Fragment, type ComponentProps, type CSSProperties, type JSX } from 'react';
import {
  Text,
  Html,
  Head,
  Body,
  Font,
  Container,
  Link,
  Heading,
  Hr,
  Button,
  Img,
  Preview,
  Row,
  Column,
  Section,
  HtmlProps,
} from '@react-email/components';
import { renderAsync as reactEmailRenderAsync } from '@react-email/render';
import type { JSONContent } from '@tiptap/core';
import { deepMerge } from '@antfu/utils';
import { generateKey } from './utils';
import type { MetaDescriptors } from './meta';
import { meta } from './meta';
import { parse } from 'node-html-parser';
import juice from 'juice';
import type {
  RendererThemeOptions as ThemeOptions,
} from '@temply/shared/theme';
import {
  DEFAULT_RENDERER_THEME as DEFAULT_THEME,
  DEFAULT_FONT,
  DEFAULT_LINK_TEXT_COLOR,
} from '@temply/shared/theme';
import { Preheader } from './preheader';

interface NodeOptions {
  parent?: JSONContent;
  prev?: JSONContent;
  next?: JSONContent;

  payloadValue?: PayloadValue;
  /** Which item of a Repeat this content belongs to. The margins a Repeat
   *  trims — the first block's top, the last block's bottom — are the
   *  block's edges, not each item's: trimming every item left the items
   *  flush against each other while the blocks inside kept their gaps. */
  repeatItem?: { index: number; count: number };
}

export interface MarkType {
  [key: string]: unknown;
  type: string;
  attrs?: Record<string, any> | undefined;
}

/**
 * A spacer's height in pixels.
 *
 * The attribute is meant to be a number, but the slash command inserted the
 * toolbar's size name instead — so documents in the wild carry `"sm"`, which
 * reached the stylesheet as `height: smpx` and collapsed the spacer to
 * nothing. Names are translated, anything else falls back to the default.
 */
const SPACER_SIZES: Record<string, number> = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 32,
  xl: 64,
};
const DEFAULT_SPACER_HEIGHT = 8;

function spacerHeight(height: unknown): number {
  if (typeof height === 'number' && Number.isFinite(height)) return height;
  if (typeof height === 'string') {
    if (SPACER_SIZES[height] !== undefined) return SPACER_SIZES[height];
    const parsed = Number.parseInt(height, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return DEFAULT_SPACER_HEIGHT;
}

const antialiased: CSSProperties = {
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
};

const allowedHeadings = ['h1', 'h2', 'h3'] as const;
type AllowedHeadings = (typeof allowedHeadings)[number];

const headings: Record<AllowedHeadings, CSSProperties> = {
  h1: {
    fontSize: '36px',
    lineHeight: '40px',
    fontWeight: 800,
  },
  h2: {
    fontSize: '30px',
    lineHeight: '36px',
    fontWeight: 700,
  },
  h3: {
    fontSize: '24px',
    lineHeight: '38px',
    fontWeight: 600,
  },
};

const allowedLogoSizes = ['sm', 'md', 'lg'] as const;
type AllowedLogoSizes = (typeof allowedLogoSizes)[number];

const logoSizes: Record<AllowedLogoSizes, string> = {
  sm: '40px',
  md: '48px',
  lg: '64px',
};

export interface EngineConfig {
  /**
   * The preview text is the snippet of text that is pulled into the inbox
   * preview of an email client, usually right after the subject line.
   *
   * Default: `undefined`
   */
  preview?: string | JSONContent;
  /**
   * The theme object allows you to customize the colors and font sizes of the
   * rendered email.
   *
   * Default:
   * ```js
   * {
   *   colors: {
   *     heading: '#111827',
   *     paragraph: '#374151',
   *     horizontal: '#EAEAEA',
   *     footer: '#64748B',
   *   },
   *   fontSize: {
   *     paragraph: '15px',
   *     footer: {
   *       size: '14px',
   *       lineHeight: '24px',
   *     },
   *   },
   * }
   * ```
   *
   * @example
   * ```js
   * const engine = new Engine(content, {
   *   theme: {
   *     colors: {
   *       heading: '#111827',
   *     },
   *     fontSize: {
   *       footer: {
   *         size: '14px',
   *         lineHeight: '24px',
   *       },
   *     },
   *   },
   * });
   * ```
   */
  theme?: Partial<ThemeOptions>;
}

const CODE_FONT_FAMILY =
  'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
export const DEFAULT_SECTION_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_SECTION_ALIGN = 'left';
export const DEFAULT_SECTION_BORDER_WIDTH = 1;
export const DEFAULT_SECTION_BORDER_COLOR = '#000000';

export const DEFAULT_SECTION_MARGIN_TOP = 0;
export const DEFAULT_SECTION_MARGIN_RIGHT = 0;
export const DEFAULT_SECTION_MARGIN_BOTTOM = 0;
export const DEFAULT_SECTION_MARGIN_LEFT = 0;

export const DEFAULT_SECTION_PADDING_TOP = 5;
export const DEFAULT_SECTION_PADDING_RIGHT = 5;
export const DEFAULT_SECTION_PADDING_BOTTOM = 5;
export const DEFAULT_SECTION_PADDING_LEFT = 5;

export const DEFAULT_COLUMNS_WIDTH = '100%';
export const DEFAULT_COLUMNS_GAP = 8;

export const DEFAULT_COLUMN_BACKGROUND_COLOR = 'transparent';
export const DEFAULT_COLUMN_BORDER_RADIUS = 0;
export const DEFAULT_COLUMN_BORDER_WIDTH = 0;
export const DEFAULT_COLUMN_BORDER_COLOR = 'transparent';

export const DEFAULT_COLUMN_PADDING_TOP = 0;
export const DEFAULT_COLUMN_PADDING_RIGHT = 0;
export const DEFAULT_COLUMN_PADDING_BOTTOM = 0;
export const DEFAULT_COLUMN_PADDING_LEFT = 0;

export const DEFAULT_INLINE_IMAGE_HEIGHT = 20;
export const DEFAULT_INLINE_IMAGE_WIDTH = 20;

export const LINK_PROTOCOL_REGEX = /https?:\/\//;

export const DEFAULT_META_TAGS: MetaDescriptors = [
  {
    name: 'viewport',
    content: 'width=device-width',
  },
  {
    httpEquiv: 'X-UA-Compatible',
    content: 'IE=edge',
  },
  {
    name: 'x-apple-disable-message-reformatting',
  },
  {
    // http://www.html-5.com/metatags/format-detection-meta-tag.html
    // It will prevent iOS from automatically detecting possible phone numbers in a block of text
    name: 'format-detection',
    content: 'telephone=no,address=no,email=no,date=no,url=no',
  },
  {
    name: 'color-scheme',
    content: 'light',
  },
  {
    name: 'supported-color-schemes',
    content: 'light',
  },
];

export const DEFAULT_HTML_PROPS: HtmlProps = {
  lang: 'en',
  dir: 'ltr',
};

const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  pretty: false,
  plainText: false,
};

export interface RenderOptions {
  /**
   * The options object allows you to customize the output of the rendered
   * email.
   * - `pretty` - If `true`, the output will be formatted with indentation and
   *  line breaks.
   * - `plainText` - If `true`, the output will be plain text instead of HTML.
   * This is useful for testing purposes.
   *
   * Default: `pretty` - `false`, `plainText` - `false`
   */
  pretty?: boolean;
  plainText?: boolean;
  /**
   * The data the template's variables and "Show if" conditions read. Omit it
   * and variables pass through as `{{name}}` while every conditional block
   * shows — the behaviour a template author wants while composing.
   */
  payload?: Record<string, PayloadValue>;
}

export type VariableFormatter = (options: {
  variable: string;
  fallback?: string;
}) => string;
export type VariableValues = Map<string, string>;
export type LinkValues = Map<string, string>;

export type PayloadValue = Record<string, any> | boolean;
export type PayloadValues = Map<string, PayloadValue>;

/**
 * What a render with data does about a variable the data does not carry.
 * `error` is the real thing — the placeholder set in the editor is for
 * previews, and a send that quietly showed it would mail wrong words;
 * `placeholder` is the editor's preview, which has nothing better to show;
 * `empty` drops the pill.
 */
export type MissingVariablePolicy = 'error' | 'placeholder' | 'empty';

export class MissingVariablesError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing values for: ${missing.join(', ')}`);
    this.name = 'MissingVariablesError';
  }
}

/** A Repeat's key held something other than a list. The caller's data is
 *  wrong in a way only the caller can fix, so the API answers 422 rather
 *  than the 500 a bare Error would become. */
export class RepeatNotListError extends Error {
  constructor(readonly key: string) {
    super(`"${key}" must be a list for the Repeat block to read it`);
    this.name = 'RepeatNotListError';
  }
}

/**
 * Root-relative sources ("/brand/logo.png") resolve against the app in a
 * browser tab and against nothing in an inbox or a sandboxed preview frame.
 * The renderer makes them absolute with the app's own origin — the same
 * origin a finished checkout returns to — so the editor, the API and the review
 * page all show the same image.
 */
function absoluteSrc<T extends string | null | undefined>(src: T): T | string {
  if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return src;
  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9000').replace(/\/$/, '');
  return `${origin}${src}`;
}

export class Engine {
  readonly preheader = new Preheader(this);

  private readonly content: JSONContent;
  private config: EngineConfig = {
    theme: DEFAULT_THEME,
  };

  private variableFormatter: VariableFormatter = ({ variable, fallback }) => {
    return fallback
      ? `{{${variable},fallback=${fallback}}}`
      : `{{${variable}}}`;
  };

  private shouldReplaceVariableValues = false;
  private missingPolicy: MissingVariablePolicy = 'error';
  private missing = new Set<string>();
  private variableValues: VariableValues = new Map();
  private linkValues: LinkValues = new Map();
  private openTrackingPixel: string | undefined;
  private payloadValues: PayloadValues = new Map();
  private marksOrder = ['underline', 'bold', 'italic', 'textStyle', 'link'];
  private meta: MetaDescriptors = DEFAULT_META_TAGS;
  private htmlProps: HtmlProps = DEFAULT_HTML_PROPS;

  constructor(content: JSONContent = { type: 'doc', content: [] }) {
    this.content = content;
  }

  setPreviewText(preview?: string | JSONContent) {
    this.config.preview = preview;
  }

  setTheme(theme: Partial<ThemeOptions>) {
    this.config.theme = deepMerge(
      this.config.theme || DEFAULT_THEME,
      theme
    ) as ThemeOptions;
  }

  setVariableFormatter(formatter: VariableFormatter) {
    this.variableFormatter = formatter;
  }

  setMissingVariablePolicy(policy: MissingVariablePolicy) {
    this.missingPolicy = policy;
  }

  /** Records a variable the data did not carry and answers with what the
   *  policy allows in its place. */
  private missingValue(variable: string, placeholder: string, required: boolean): string {
    if (this.missingPolicy === 'placeholder') return placeholder;
    if (!required || this.missingPolicy === 'empty') return '';
    this.missing.add(variable);
    return placeholder;
  }

  /**
   * `setVariableValue` will set the variable value.
   * It will also set `shouldReplaceVariableValues` to `true`.
   *
   * @param variable - The variable name
   * @param value - The variable value
   */
  setVariableValue(variable: string, value: string) {
    if (!this.shouldReplaceVariableValues) {
      this.shouldReplaceVariableValues = true;
    }

    this.variableValues.set(variable, value);
  }

  /**
   * `setVariableValues` will set the variable values.
   * It will also set `shouldReplaceVariableValues` to `true`.
   *
   * @param values - The variable values
   *
   * @example
   * ```js
   * const engine = new Engine(content);
   * engine.setVariableValues({
   *  name: 'John Doe',
   *  email: 'john@doe.com',
   * });
   * ```
   */
  setVariableValues(values: Record<string, string>) {
    if (!this.shouldReplaceVariableValues) {
      this.shouldReplaceVariableValues = true;
    }

    Object.entries(values).forEach(([variable, value]) => {
      this.setVariableValue(variable, value);
    });
  }

  setLinkValue(link: string, value: string) {
    this.linkValues.set(link, value);
  }

  setLinkValues(values: Record<string, string>) {
    Object.entries(values).forEach(([link, value]) => {
      this.setLinkValue(link, value);
    });
  }

  setPayloadValue(key: string, value: PayloadValue) {
    if (!this.shouldReplaceVariableValues) {
      this.shouldReplaceVariableValues = true;
    }

    this.payloadValues.set(key, value);
  }

  setPayloadValues(values: Record<string, PayloadValue>) {
    Object.entries(values).forEach(([key, value]) => {
      this.setPayloadValue(key, value);
    });
  }

  /**
   * `setOpenTrackingPixel` will set the open tracking pixel.
   *
   * @param pixel - The open tracking pixel
   */
  setOpenTrackingPixel(pixel?: string) {
    this.openTrackingPixel = pixel;
  }

  /**
   * `setShouldReplaceVariableValues` will determine whether to replace the
   * variable values or not. Otherwise, it will just return the formatted variable.
   *
   * Default: `false`
   */
  setShouldReplaceVariableValues(shouldReplace: boolean) {
    this.shouldReplaceVariableValues = shouldReplace;
  }

  /**
   * `setMetaTags` will add the meta tags.
   *
   * @param meta - The meta tags
   */
  setMetaTags(meta: MetaDescriptors) {
    this.meta.push(...meta);
  }

  /**
   * `setHtmlProps` will set the HTML props.
   *
   * @param props - The HTML props
   */
  setHtmlProps(props: HtmlProps) {
    this.htmlProps = {
      ...this.htmlProps,
      ...props,
    };
  }

  getAllLinks() {
    const nodes = this.content.content || [];
    const links = new Set<string>();

    const isValidLink = (href: string) => {
      return (
        href &&
        this.isValidUrl(href) &&
        !href.startsWith('#') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:') &&
        typeof href === 'string'
      );
    };

    const extractLinksFromNode = (node: JSONContent) => {
      if (node.type === 'button') {
        const originalLink = node.attrs?.url;
        if (isValidLink(originalLink) && originalLink) {
          links.add(originalLink);
        }
      } else if (node.content) {
        node.content.forEach((childNode) => {
          if (childNode.marks) {
            childNode.marks.forEach((mark) => {
              const originalLink = mark.attrs?.href;
              if (mark.type === 'link' && isValidLink(originalLink)) {
                links.add(originalLink);
              }
            });
          }
          if (childNode.content) {
            extractLinksFromNode(childNode);
          }
        });
      }
    };

    nodes.forEach((childNode) => {
      extractLinksFromNode(childNode);
    });

    return links;
  }

  private isValidUrl(href: string) {
    try {
      const _ = new URL(href);
      return true;
    } catch {
      return false;
    }
  }

  async render(
    options: RenderOptions = DEFAULT_RENDER_OPTIONS
  ): Promise<string> {
    this.missing.clear();
    const markup = this.markup();
    const html = await reactEmailRenderAsync(markup, options);
    if (this.missingPolicy === 'error' && this.missing.size > 0) {
      throw new MissingVariablesError([...this.missing]);
    }
    return html;
  }

  /**
   * `children` will return the children of the content.
   * this is useful for rendering the content in a custom component.
   *
   * @returns The children of the content as JSX elements
   */
  children() {
    const nodes = this.content.content || [];
    const jsxNodes = nodes.map((node, index) => {
      const nodeOptions: NodeOptions = {
        prev: nodes[index - 1],
        next: nodes[index + 1],
        parent: node,
      };

      const component = this.renderNode(node, nodeOptions);
      if (!component) {
        return null;
      }

      return <Fragment key={generateKey()}>{component}</Fragment>;
    });

    return jsxNodes;
  }

  /**
   * `markup` will render the JSON content into React Email markup.
   * and return the raw React Tree.
   */
  markup() {
    const jsxNodes = this.children();

    const { preview } = this.config;
    const tags = meta(this.meta);
    const htmlProps = this.htmlProps;
    const containerStyles = this.config.theme?.container;
    const fontOptions = {
      ...(this.config.theme?.font || DEFAULT_FONT),
      fontStyle: 'normal',
      fontWeight: 400,
    };

    const bodyStyles: CSSProperties = {
      margin: '0px',
      ...this.config.theme?.body,
    };

    const preheader = preview ? this.preheader.render(preview) : null;

    const markup = (
      <Html {...htmlProps}>
        <Head>
          {/* The shared FallbackFont union allows stacks like 'system-ui' that
              react-email's narrower union does not name, though it renders them
              fine — hence the cast to Font's own props rather than a rewrite of
              stored themes. */}
          <Font {...(fontOptions as ComponentProps<typeof Font>)} />

          <style
            dangerouslySetInnerHTML={{
              __html: /* css */ `blockquote,h1,h2,h3,img,li,ol,p,ul{margin-top:0;margin-bottom:0}@media only screen and (max-width:425px){.tab-row-full{width:100%!important}.tab-col-full{display:block!important;width:100%!important}.tab-pad{padding:0!important}}`,
            }}
          />
          {tags}
        </Head>
        <Body style={bodyStyles}>
          {preheader ? <Preview>{preheader}</Preview> : null}
          <Container
            style={{
              width: '100%',
              marginLeft: 'auto',
              marginRight: 'auto',
              borderStyle: 'solid',
              ...containerStyles,
            }}
          >
            {jsxNodes}
          </Container>
          {this.openTrackingPixel ? (
            <Img
              alt=""
              src={this.openTrackingPixel}
              style={{
                display: 'none',
                width: '1px',
                height: '1px',
              }}
            />
          ) : null}
        </Body>
      </Html>
    );

    return markup;
  }

  private getMarginOverrideConditions(
    node: JSONContent,
    options?: NodeOptions
  ) {
    const { parent, prev, next } = options || {};

    const isNextSpacer = next?.type === 'spacer';
    const isPrevSpacer = prev?.type === 'spacer';

    const isParentListItem = parent?.type === 'listItem';

    const isLastSectionElement = parent?.type === 'section' && !next;
    const isFirstSectionElement = parent?.type === 'section' && !prev;

    const isLastColumnElement = parent?.type === 'column' && !next;
    const isFirstColumnElement = parent?.type === 'column' && !prev;

    const { repeatItem } = options || {};
    const isFirstRepeatElement =
      parent?.type === 'repeat' && !prev && (!repeatItem || repeatItem.index === 0);
    const isLastRepeatElement =
      parent?.type === 'repeat' && !next && (!repeatItem || repeatItem.index === repeatItem.count - 1);

    // A parent is only ever a node this engine has just rendered, so a name
    // with no case above can never appear here. `show` — the conditional
    // wrapper that became the `showIfKey` attribute every block now carries —
    // was the one that did: two branches testing for a parent `renderNode`
    // throws on before any child of it is reached. Unlike `for` and
    // `codeBlock`, it was never a node this editor could build, so no stored
    // document holds one either, and the branches went rather than gaining a
    // case to justify them.

    return {
      isNextSpacer,
      isPrevSpacer,
      isLastSectionElement,
      isFirstSectionElement,
      isParentListItem,
      isLastColumnElement,
      isFirstColumnElement,
      isFirstRepeatElement,
      isLastRepeatElement,

      shouldRemoveTopMargin:
        isPrevSpacer ||
        isFirstSectionElement ||
        isFirstColumnElement ||
        isFirstRepeatElement,
      shouldRemoveBottomMargin:
        isNextSpacer ||
        isLastSectionElement ||
        isLastColumnElement ||
        isLastRepeatElement,
    };
  }

  // `getMappedContent` will call corresponding node type
  // and return text content
  private getMappedContent(
    node: JSONContent,
    options?: NodeOptions
  ): JSX.Element[] {
    const allNodes = node.content || [];
    return allNodes
      .map((childNode, index) => {
        const component = this.renderNode(childNode, {
          ...options,
          next: allNodes[index + 1],
          prev: allNodes[index - 1],
        });
        if (!component) {
          return null;
        }

        return <Fragment key={generateKey()}>{component}</Fragment>;
      })
      .filter((n) => n !== null) as JSX.Element[];
  }

  // `renderNode` will call the method of the corresponding node type
  private renderNode(
    node: JSONContent,
    options: NodeOptions = {}
  ): JSX.Element | null {
    const type = node.type || '';

    if (type in this) {
      // @ts-expect-error - `this` is not assignable to type 'never'
      return this[type]?.(node, options) as JSX.Element;
    }

    throw new Error(`Node type "${type}" is not supported.`);
  }

  // `renderMark` will call the method of the corresponding mark type
  private renderMark(node: JSONContent, options?: NodeOptions): JSX.Element {
    // It will wrap the text with the corresponding mark type
    const text = node?.text || <>&nbsp;</>;
    let marks = node?.marks || [];
    // sort the marks by uderline, bold, italic, textStyle, link
    // so that the text will be wrapped in the correct order
    marks.sort((a, b) => {
      return this.marksOrder.indexOf(a.type) - this.marksOrder.indexOf(b.type);
    });

    return marks.reduce(
      (acc, mark) => {
        const type = mark.type;
        if (type in this) {
          // @ts-expect-error - `this` is not assignable to type 'never'
          return this[type]?.(mark, acc, options) as JSX.Element;
        }

        throw new Error(`Mark type "${type}" is not supported.`);
      },
      <>{text}</>
    );
  }

  private paragraph(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const alignment = attrs?.textAlign || 'left';
    const textDirection = attrs?.textDirection || 'ltr';
    const { isParentListItem, shouldRemoveBottomMargin } =
      this.getMarginOverrideConditions(node, options);

    const show = this.shouldShow(node, options);
    if (!show) {
      return <></>;
    }

    const marginBottom = isParentListItem || shouldRemoveBottomMargin ? 0 : 20;

    return (
      <Text
        style={{
          ...(alignment !== 'left' ? { textAlign: alignment } : {}),
          ...(textDirection !== 'ltr' ? { direction: textDirection } : {}),
          ...antialiased,
          fontSize: this.config.theme?.fontSize?.paragraph?.size,
          lineHeight: this.config.theme?.fontSize?.paragraph?.lineHeight,
          color: this.config.theme?.colors?.paragraph,
          margin: `0 0 ${marginBottom}px 0`,
        }}
      >
        {node.content ? (
          this.getMappedContent(node, {
            ...options,
            parent: node,
          })
        ) : (
          <>&nbsp;</>
        )}
      </Text>
    );
  }

  private text(node: JSONContent, options?: NodeOptions): JSX.Element {
    if (node.marks) {
      return this.renderMark(node, options);
    }

    const text = node.text;
    // if it's all empty, return an invisible space length
    // of the text so that it doesn't look empty for inline-images
    const spaces = text?.match(/\s/g);
    if (spaces && spaces.length === text?.length) {
      return (
        <>
          {spaces.map((_, index) => (
            <Fragment key={index}>&nbsp;</Fragment>
          ))}
        </>
      );
    }

    return text ? <>{text}</> : <>&nbsp;</>;
  }

  private bold(_: MarkType, text: JSX.Element): JSX.Element {
    return <strong>{text}</strong>;
  }

  private italic(_: MarkType, text: JSX.Element): JSX.Element {
    return <em>{text}</em>;
  }

  private underline(_: MarkType, text: JSX.Element): JSX.Element {
    return <u>{text}</u>;
  }

  private strike(_: MarkType, text: JSX.Element): JSX.Element {
    return <s style={{ textDecoration: 'line-through' }}>{text}</s>;
  }

  private textStyle(mark: MarkType, text: JSX.Element): JSX.Element {
    const { attrs } = mark;
    const { color = this.config.theme?.colors?.paragraph } = attrs || {};

    return (
      <span
        style={{
          color,
        }}
      >
        {text}
      </span>
    );
  }

  private link(
    mark: MarkType,
    text: JSX.Element,
    options?: NodeOptions
  ): JSX.Element {
    const { attrs } = mark;

    const linkTheme = this.config.theme?.link;

    let href = attrs?.href || '#';
    const target = attrs?.target || '_blank';
    const rel = attrs?.rel || 'noopener noreferrer nofollow';
    const isUrlVariable = attrs?.isUrlVariable ?? false;

    if (isUrlVariable) {
      const linkWithoutProtocol = this.removeLinkProtocol(href);
      href = this.variableUrlValue(linkWithoutProtocol, options);
    } else {
      href = this.linkValues.get(href) || href;
    }

    return (
      <Link
        href={href}
        rel={rel}
        style={{
          fontWeight: 500,
          textDecoration: 'none',
          color: linkTheme?.color || DEFAULT_LINK_TEXT_COLOR,
        }}
        target={target}
      >
        {text}
      </Link>
    );
  }

  private removeLinkProtocol(href: string) {
    return href.replace(LINK_PROTOCOL_REGEX, '');
  }

  private variableUrlValue(href: string, options?: NodeOptions) {
    const { payloadValue } = options || {};
    const linkWithoutProtocol = this.removeLinkProtocol(href);

    if (!this.shouldReplaceVariableValues) {
      return this.variableFormatter({
        variable: linkWithoutProtocol,
      });
    }

    const value =
      (typeof payloadValue === 'object'
        ? payloadValue[linkWithoutProtocol]
        : payloadValue) ?? this.variableValues.get(linkWithoutProtocol);
    if (value !== undefined && value !== null) return value;
    // A destination, an image or a label has no optional form.
    return this.missingValue(
      linkWithoutProtocol,
      this.variableFormatter({ variable: linkWithoutProtocol }),
      true,
    );
  }

  private heading(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;

    const level = `h${Number(attrs?.level) || 1}`;
    const textDirection = attrs?.textDirection || 'ltr';
    const isRtl = textDirection === 'rtl';
    const defaultAlignment = isRtl ? 'right' : 'left';
    const alignment = attrs?.textAlign || defaultAlignment;
    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );
    const { fontSize, lineHeight, fontWeight } =
      headings[level as AllowedHeadings];

    const show = this.shouldShow(node, options);
    if (!show) {
      return <></>;
    }

    return (
      <Heading
        // @ts-expect-error - `this` is not assignable to type 'never'
        as={level}
        style={{
          ...(alignment !== 'left' ? { textAlign: alignment } : {}),
          ...(isRtl ? { direction: textDirection } : {}),
          color: this.config.theme?.colors?.heading,
          fontSize,
          lineHeight,
          fontWeight,
        }}
        mb={shouldRemoveBottomMargin ? 0 : 12}
        mt={0}
        mx={0}
      >
        {this.getMappedContent(node, {
          ...options,
          parent: node,
        })}
      </Heading>
    );
  }

  private variable(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { id: variable, fallback, required } = node.attrs || {};

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow || !variable) {
      return <></>;
    }

    const formattedVariable = this.getVariableValue(
      variable,
      fallback,
      options,
      required ?? true
    );

    if (node?.marks) {
      return this.renderMark(
        {
          text: formattedVariable,
          marks: node.marks,
        },
        options
      );
    }

    return <>{formattedVariable}</>;
  }

  getVariableValue(
    variable: string,
    fallback?: string,
    options?: NodeOptions,
    required: boolean = true,
  ) {
    const { payloadValue } = options || {};

    const formattedVariable = this.variableFormatter({
      variable,
      fallback,
    });

    // Composing: the pill shows as the formatter draws it.
    if (!this.shouldReplaceVariableValues) return formattedVariable;

    const value =
      (typeof payloadValue === 'object'
        ? payloadValue[variable]
        : payloadValue) ?? this.variableValues.get(variable);
    if (value !== undefined && value !== null) return value;
    // The editor's placeholder never stands in for missing data on a real
    // render — see MissingVariablePolicy.
    return this.missingValue(variable, formattedVariable, required);
  }

  private horizontalRule(_: JSONContent, __?: NodeOptions): JSX.Element {
    return (
      <Hr
        style={{
          marginTop: '32px',
          marginBottom: '32px',
        }}
      />
    );
  }

  private orderedList(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );

    return (
      <Container
        style={{
          marginTop: '0px',
          marginBottom: shouldRemoveBottomMargin ? '0' : '20px',
        }}
      >
        <ol
          style={{
            paddingLeft: '26px',
            listStyleType: 'decimal',
          }}
        >
          {this.getMappedContent(node, {
            ...options,
            parent: node,
          })}
        </ol>
      </Container>
    );
  }

  private bulletList(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { parent, next } = options || {};
    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      {
        parent,
        next,
      }
    );

    return (
      <Container
        style={{
          maxWidth: '100%',
          marginTop: '0px',
          marginBottom: shouldRemoveBottomMargin ? '0' : '20px',
        }}
      >
        <ul
          style={{
            paddingLeft: '26px',
            listStyleType: 'disc',
          }}
        >
          {this.getMappedContent(node, {
            ...options,
            parent: node,
          })}
        </ul>
      </Container>
    );
  }

  private listItem(node: JSONContent, options?: NodeOptions): JSX.Element {
    return (
      <li
        style={{
          marginBottom: '8px',
          marginTop: '8px',
          paddingLeft: '6px',
          ...antialiased,
        }}
      >
        {this.getMappedContent(node, { ...options, parent: node })}
      </li>
    );
  }

  private button(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;

    const buttonTheme = this.config.theme?.button;

    let {
      text: _text,
      isTextVariable,
      url,
      isUrlVariable,
      variant,
      buttonColor: _buttonColor,
      textColor: _textColor,
      borderRadius,
      // The editor and stored templates both say `alignment`; renaming it is a
      // breaking content migration, not a cleanup.
      alignment = 'left',

      paddingTop: _paddingTop,
      paddingRight: _paddingRight,
      paddingBottom: _paddingBottom,
      paddingLeft: _paddingLeft,
    } = attrs || {};

    const buttonColor = _buttonColor || buttonTheme?.backgroundColor;
    const textColor = _textColor || buttonTheme?.color;

    let paddingTop =
      parseInt(String(_paddingTop || buttonTheme?.paddingTop)) || 0;
    const paddingRight =
      parseInt(String(_paddingRight || buttonTheme?.paddingRight)) || 0;
    let paddingBottom =
      parseInt(String(_paddingBottom || buttonTheme?.paddingBottom)) || 0;
    const paddingLeft =
      parseInt(String(_paddingLeft || buttonTheme?.paddingLeft)) || 0;

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    // "smooth" follows the brand: the theme's button radius when one is set,
    // the classic 6px otherwise. Round and sharp are absolute choices.
    let radius: string | undefined = '0px';
    if (borderRadius === 'round') {
      radius = '9999px';
    } else if (borderRadius === 'smooth') {
      radius = buttonTheme?.borderRadius || '6px';
    }

    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );

    const href = isUrlVariable
      ? this.variableUrlValue(url, options)
      : this.linkValues.get(url) || url;
    const text = isTextVariable ? this.variableUrlValue(_text, options) : _text;

    paddingTop += 2;
    paddingBottom += 2;

    return (
      <Container
        style={{
          textAlign: alignment,
          maxWidth: '100%',
          marginBottom: shouldRemoveBottomMargin ? '0px' : '20px',
        }}
      >
        <Button
          href={href}
          style={{
            color: String(textColor),
            backgroundColor:
              variant === 'filled' ? String(buttonColor) : 'transparent',
            borderColor: String(buttonColor),
            borderWidth: '2px',
            borderStyle: 'solid',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: radius,
            padding: `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
          }}
        >
          {text}
        </Button>
      </Container>
    );
  }

  private spacer(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const { height } = attrs || {};

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    return (
      <Container
        style={{
          height: `${spacerHeight(height)}px`,
        }}
      />
    );
  }

  private hardBreak(_: JSONContent, __?: NodeOptions): JSX.Element {
    return <br />;
  }

  private logo(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    let {
      src,
      isSrcVariable,
      alt,
      title,
      size,
      // The editor and stored templates both say `alignment`; renaming it is a
      // breaking content migration, not a cleanup.
      alignment = 'left',
    } = attrs || {};

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    src = isSrcVariable ? this.variableUrlValue(src, options) : src;

    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );

    return (
      <Row
        style={{
          marginTop: '0px',
          marginBottom: shouldRemoveBottomMargin ? '0px' : '32px',
        }}
      >
        <Column align={alignment}>
          <Img
            alt={alt || title || 'Logo'}
            src={absoluteSrc(src)}
            style={{
              width: logoSizes[size as AllowedLogoSizes] || size,
              height: logoSizes[size as AllowedLogoSizes] || size,
            }}
            title={title || alt || 'Logo'}
          />
        </Column>
      </Row>
    );
  }

  private image(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    let {
      src,
      isSrcVariable,
      alt,
      title,
      width = 'auto',
      height = 'auto',
      alignment = 'center',
      externalLink = '',
      isExternalLinkVariable,
      borderRadius = 0,
    } = attrs || {};

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );

    src = isSrcVariable ? this.variableUrlValue(src, options) : src;
    externalLink = isExternalLinkVariable
      ? this.variableUrlValue(externalLink, options)
      : externalLink;

    // Handle width value
    const imageWidth = width === 'auto' ? 'auto' : Number(width);
    const widthStyle = imageWidth === 'auto' ? 'auto' : `${imageWidth}px`;

    // Handle height value
    const imageHeight = height === 'auto' ? 'auto' : Number(height);
    const heightStyle = imageHeight === 'auto' ? 'auto' : `${imageHeight}px`;

    const mainImage = (
      <Img
        alt={alt || title || 'Image'}
        src={absoluteSrc(src)}
        style={{
          width: widthStyle, // Use the calculated width
          height: heightStyle, // Use the calculated height
          maxWidth: '100%', // Ensure image doesn't overflow container
          outline: 'none',
          border: 'none',
          textDecoration: 'none',
          display: 'block', // Prevent unwanted spacing
          borderRadius,
        }}
        title={title || alt || 'Image'}
      />
    );

    return (
      <Row
        style={{
          marginTop: '0px',
          marginBottom: shouldRemoveBottomMargin ? '0px' : '32px',
        }}
      >
        <Column align={alignment}>
          {externalLink ? (
            <a
              href={externalLink}
              rel="noopener noreferrer"
              style={{
                display: 'block',
                maxWidth: '100%',
                textDecoration: 'none',
              }}
              target="_blank"
            >
              {mainImage}
            </a>
          ) : (
            mainImage
          )}
        </Column>
      </Row>
    );
  }

  private footer(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const { textAlign = 'left', textDirection = 'ltr' } = attrs || {};

    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );

    return (
      <Text
        style={{
          fontSize: this.config.theme?.fontSize?.footer?.size,
          lineHeight: this.config.theme?.fontSize?.footer?.lineHeight,
          color: this.config.theme?.colors?.footer,
          marginTop: '0px',
          marginBottom: shouldRemoveBottomMargin ? '0px' : '20px',
          textAlign,
          ...(textDirection !== 'ltr' ? { direction: textDirection } : {}),
          ...antialiased,
        }}
      >
        {this.getMappedContent(node, {
          ...options,
          parent: node,
        })}
      </Text>
    );
  }

  private blockquote(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { isPrevSpacer, shouldRemoveBottomMargin } =
      this.getMarginOverrideConditions(node, options);

    return (
      <blockquote
        style={{
          borderLeftWidth: '4px',
          borderLeftStyle: 'solid',
          borderLeftColor: this.config.theme?.colors?.blockquoteBorder,
          paddingLeft: '16px',
          marginLeft: '0px',
          marginRight: '0px',
          marginTop: isPrevSpacer ? '0px' : '20px',
          marginBottom: shouldRemoveBottomMargin ? '0px' : '20px',
        }}
      >
        {this.getMappedContent(node, {
          ...options,
          parent: node,
        })}
      </blockquote>
    );
  }
  private code(_: MarkType, text: JSX.Element): JSX.Element {
    return (
      <code
        style={{
          backgroundColor: this.config.theme?.colors?.codeBackground,
          color: this.config.theme?.colors?.codeText,
          padding: '2px 4px',
          borderRadius: '6px',
          fontFamily: CODE_FONT_FAMILY,
          fontWeight: 400,
          letterSpacing: 0,
        }}
      >
        {text}
      </code>
    );
  }
  private linkCard(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const { shouldRemoveBottomMargin } = this.getMarginOverrideConditions(
      node,
      options
    );

    const { title, description, link, linkTitle, image, badgeText, subTitle } =
      attrs || {};
    const href =
      this.linkValues.get(link) || this.variableValues.get(link) || link || '#';

    return (
      <a
        href={href}
        rel="noopener noreferrer"
        style={{
          border: '1px solid #eaeaea',
          borderRadius: '10px',
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          marginBottom: shouldRemoveBottomMargin ? '0px' : '20px',
        }}
        target="_blank"
      >
        {image ? (
          <Row
            style={{
              marginBottom: '6px',
            }}
          >
            <Column
              style={{
                width: '100%',
                height: '100%',
              }}
            >
              <Img
                alt={title || 'Link Card'}
                src={image}
                style={{
                  borderRadius: '10px 10px 0 0',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                title={title || 'Link Card'}
              />
            </Column>
          </Row>
        ) : null}

        <Row
          style={{
            padding: '15px',
            marginTop: 0,
            marginBottom: 0,
          }}
        >
          <Column
            style={{
              verticalAlign: 'top',
            }}
          >
            <Row
              align={undefined}
              style={{
                marginBottom: '8px',
                marginTop: '0px',
              }}
              width="auto"
            >
              <Column>
                <Text
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: this.config.theme?.colors?.linkCardTitle,
                    margin: '0px',
                    ...antialiased,
                  }}
                >
                  {title}
                </Text>
              </Column>
              {badgeText || subTitle ? (
                <Column
                  style={{
                    paddingLeft: '6px',
                    verticalAlign: 'middle',
                  }}
                >
                  {badgeText ? (
                    <span
                      style={{
                        fontWeight: 600,
                        color: this.config.theme?.colors?.linkCardBadgeText,
                        padding: '4px 8px',
                        borderRadius: '8px',
                        backgroundColor:
                          this.config.theme?.colors?.linkCardBadgeBackground,
                        fontSize: '12px',
                        lineHeight: '12px',
                      }}
                    >
                      {badgeText}
                    </span>
                  ) : null}{' '}
                  {subTitle && !badgeText ? (
                    <span
                      style={{
                        fontWeight: 'normal',
                        color: this.config.theme?.colors?.linkCardSubTitle,
                        fontSize: '12px',
                        lineHeight: '12px',
                      }}
                    >
                      {subTitle}
                    </span>
                  ) : null}
                </Column>
              ) : null}
            </Row>
            <Text
              style={{
                fontSize: '16px',
                color: this.config.theme?.colors?.linkCardDescription,
                marginTop: '0px',
                marginBottom: '0px',
                ...antialiased,
              }}
            >
              {description}{' '}
              {linkTitle ? (
                <a
                  href={href}
                  rel="noopener noreferrer"
                  style={{
                    color: this.config.theme?.colors?.linkCardTitle,
                    fontSize: '14px',
                    fontWeight: 600,
                    textDecoration: 'underline',
                  }}
                >
                  {linkTitle}
                </a>
              ) : null}
            </Text>
          </Column>
        </Row>
      </a>
    );
  }

  private section(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const {
      borderRadius = 0,
      backgroundColor = DEFAULT_SECTION_BACKGROUND_COLOR,
      align = DEFAULT_SECTION_ALIGN,
      borderWidth = DEFAULT_SECTION_BORDER_WIDTH,
      borderColor = DEFAULT_SECTION_BORDER_COLOR,

      marginTop = DEFAULT_SECTION_MARGIN_TOP,
      marginRight = DEFAULT_SECTION_MARGIN_RIGHT,
      marginBottom = DEFAULT_SECTION_MARGIN_BOTTOM,
      marginLeft = DEFAULT_SECTION_MARGIN_LEFT,

      paddingTop = DEFAULT_SECTION_PADDING_TOP,
      paddingRight = DEFAULT_SECTION_PADDING_RIGHT,
      paddingBottom = DEFAULT_SECTION_PADDING_BOTTOM,
      paddingLeft = DEFAULT_SECTION_PADDING_LEFT,
    } = attrs || {};

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    return (
      <Row
        style={{
          marginTop,
          marginRight,
          marginBottom,
          marginLeft,
        }}
      >
        <Column
          align={align}
          style={{
            borderColor,
            borderWidth,
            borderStyle: 'solid',
            backgroundColor,
            borderRadius,

            paddingTop,
            paddingRight,
            paddingBottom,
            paddingLeft,
          }}
        >
          {this.getMappedContent(node, {
            ...options,
            parent: node,
          })}
        </Column>
      </Row>
    );
  }

  private columns(node: JSONContent, options?: NodeOptions): JSX.Element {
    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    const [newNode, totalWidth] = this.adjustColumnsContent(node);

    return (
      <Row
        width={`${totalWidth}%`}
        style={{
          margin: 0,
          padding: 0,
          width: `${totalWidth}%`,
        }}
        className="tab-row-full"
      >
        {this.getMappedContent(newNode, {
          ...options,
          parent: newNode,
        })}
      </Row>
    );
  }

  private adjustColumnsContent(node: JSONContent): [JSONContent, number] {
    const { content = [] } = node;
    const totalWidth = 100;
    const columnsWithWidth = content.filter(
      (c) => c.type === 'column' && Boolean(Number(c.attrs?.width || 0))
    );
    const autoWidthColumns = content.filter(
      (c) =>
        c.type === 'column' && (c.attrs?.width === 'auto' || !c.attrs?.width)
    );

    const totalWidthUsed = columnsWithWidth.reduce(
      (acc, c) => acc + Number(c.attrs?.width),
      0
    );

    const remainingWidth = totalWidth - totalWidthUsed;
    const measuredWidth = Math.round(remainingWidth / autoWidthColumns.length);

    const columnCount = content.filter((c) => c.type === 'column').length;
    const gap = node.attrs?.gap ?? DEFAULT_COLUMNS_GAP;

    return [
      {
        ...node,
        content: content.map((c, index) => {
          const isAutoWidthColumn =
            c.type === 'column' &&
            (c.attrs?.width === 'auto' || !c.attrs?.width);
          const isFirstColumn = index === 0;
          const isMiddleColumn = index > 0 && index < columnCount - 1;
          const isLastColumn = index === content.length - 1;

          let paddingLeft = 0;
          let paddingRight = 0;

          // For 2 columns, apply a simple gap logic
          if (columnCount < 3) {
            paddingLeft = isFirstColumn ? 0 : gap / 2;
            paddingRight = isLastColumn ? 0 : gap / 2;
          } else {
            // For more than 2 columns, apply more gap in the first and last columns
            // and less gap in the middle columns to make it look more balanced
            // because the first and last columns have more space to fill
            const leftAndRightPadding = (gap / 2) * 1.5;
            const middleColumnPadding = leftAndRightPadding / 2;

            paddingLeft = isFirstColumn
              ? 0
              : isMiddleColumn
                ? middleColumnPadding
                : leftAndRightPadding;
            paddingRight = isLastColumn
              ? 0
              : isMiddleColumn
                ? middleColumnPadding
                : leftAndRightPadding;
          }

          paddingLeft = Math.round(paddingLeft * 100) / 100;
          paddingRight = Math.round(paddingRight * 100) / 100;

          return {
            ...c,
            attrs: {
              ...c.attrs,
              width: isAutoWidthColumn ? measuredWidth : c.attrs?.width,

              isFirstColumn,
              isLastColumn,
              index,

              paddingLeft,
              paddingRight,
            },
          };
        }),
      },
      autoWidthColumns.length === 0
        ? Math.min(totalWidth, totalWidthUsed)
        : totalWidth,
    ];
  }

  private column(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const {
      width,
      verticalAlign = 'top',
      paddingLeft = 0,
      paddingRight = 0,
    } = attrs || {};

    return (
      <Column
        width={`${Number(width)}%`}
        style={{
          width: `${Number(width)}%`,
          margin: 0,
          verticalAlign,
        }}
        className="tab-col-full"
      >
        <Section
          style={{
            margin: 0,
            paddingLeft,
            paddingRight,
          }}
          className="tab-pad"
        >
          {this.getMappedContent(node, {
            ...options,
            parent: node,
          })}
        </Section>
      </Column>
    );
  }

  private repeat(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    const { each = '' } = attrs || {};

    const shouldShow = this.shouldShow(node, options);
    if (!shouldShow) {
      return <></>;
    }

    let { payloadValue } = options || {};
    payloadValue = typeof payloadValue === 'object' ? payloadValue : {};

    // No data was supplied, so there is nothing to iterate — show the contents
    // once. Without this the block rendered as empty space in the editor's
    // preview, in Copy HTML and in a test send, since all three call render()
    // with content and theme only. "Show if" needs the same guard for the same
    // reason.
    if (!this.shouldReplaceVariableValues) {
      return (
        <>{this.getMappedContent(node, { ...options, parent: node })}</>
      );
    }

    const values = this.payloadValues.get(each) ?? payloadValue[each] ?? [];
    if (!Array.isArray(values)) {
      throw new RepeatNotListError(each);
    }

    return (
      <>
        {values.map((value, index) => {
          return (
            <Fragment key={generateKey()}>
              {this.getMappedContent(node, {
                ...options,
                parent: node,
                payloadValue: value,
                repeatItem: { index, count: values.length },
              })}
            </Fragment>
          );
        })}
      </>
    );
  }

  /**
   * An alias for `repeat`, kept because the schema dropping a node type does
   * not rewrite the rows already holding it. The editor migrates `for` on load
   * (`client/core/editor/utils/replace-deprecated.ts`), but the API renders
   * stored content without the document ever passing through the editor, so
   * this side has to answer for the old name too. A case here with no node in
   * the schema is the deliberate shape, not dead weight: deleting it turns a
   * stored template into a send that throws.
   */
  private for(node: JSONContent, options?: NodeOptions): JSX.Element {
    return this.repeat(node, options);
  }

  /**
   * The other half of that, for StarterKit's code block, which this product
   * stopped registering because nothing here could draw it. `htmlCodeBlock`
   * takes the same `language` attribute and its content expression admits the
   * text the old node held.
   */
  private codeBlock(node: JSONContent, options?: NodeOptions): JSX.Element {
    return this.htmlCodeBlock(node, options);
  }

  private shouldShow(node: JSONContent, options?: NodeOptions): boolean {
    const showIfKey = node?.attrs?.showIfKey ?? '';
    if (!showIfKey) {
      return true;
    }

    // No data was supplied, so no condition can be evaluated — show everything.
    // Without this a template that used "Show if" lost the block from every
    // render the app performs, since preview, Copy HTML and test send all call
    // render() with content and theme only. Variables already work this way.
    if (!this.shouldReplaceVariableValues) {
      return true;
    }

    let { payloadValue } = options || {};
    payloadValue = typeof payloadValue === 'object' ? payloadValue : {};
    return !!(this.payloadValues.get(showIfKey) ?? payloadValue[showIfKey]);
  }

  htmlCodeBlock(node: JSONContent, options?: NodeOptions): JSX.Element {
    const show = this.shouldShow(node, options);
    if (!show) {
      return <></>;
    }

    // the text can be a proper html code block
    // or only the body of the html
    // so we need to wrap it in a proper html tag
    const text =
      node.content?.reduce((acc, n) => {
        if (n?.type === 'text') {
          return acc + n?.text;
        } else if (n?.type === 'variable') {
          const value = this.getVariableValue(
            n?.attrs?.id,
            n?.attrs?.fallback,
            options
          );
          return acc + value;
        }

        return acc;
      }, '') || '';

    // we will inline the css in the html
    // so that it can be rendered properly
    const inlineCssHtml = juice(text);
    const doc = parse(inlineCssHtml);
    const head = doc?.querySelector('head');
    head?.remove();
    const html = doc.toString();

    return (
      <table
        align="left"
        width="100%"
        border={0}
        cellPadding="0"
        cellSpacing="0"
        role="presentation"
      >
        <tbody>
          <tr style={{ width: '100%' }}>
            <td
              style={{ width: '100%' }}
              dangerouslySetInnerHTML={{
                __html: html,
              }}
            />
          </tr>
        </tbody>
      </table>
    );
  }

  private inlineImage(node: JSONContent, options?: NodeOptions): JSX.Element {
    const { attrs } = node;
    let {
      src,
      isSrcVariable,
      alt = '',
      title = '',
      height = DEFAULT_INLINE_IMAGE_HEIGHT,
      width = DEFAULT_INLINE_IMAGE_WIDTH,
      externalLink = '',
      isExternalLinkVariable,
    } = attrs || {};

    src = isSrcVariable ? this.variableUrlValue(src, options) : src;
    externalLink = isExternalLinkVariable
      ? this.variableUrlValue(externalLink, options)
      : externalLink;

    const image = (
      <img
        src={absoluteSrc(src)}
        alt={alt}
        title={title}
        width={width}
        height={height}
        style={{
          display: 'inline',
          verticalAlign: 'middle',
          width: `${width}px`,
          height: `${height}px`,
          outline: 'none',
          border: 'none',
          textDecoration: 'none',
        }}
      />
    );

    if (!externalLink) {
      return image;
    }

    return (
      <a
        href={externalLink}
        rel="noopener noreferrer"
        style={{
          display: 'inline',
          textDecoration: 'none',
        }}
        target="_blank"
      >
        {image}
      </a>
    );
  }
}
