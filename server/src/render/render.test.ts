import { Engine, render } from './index';
import { Preheader } from './preheader';

describe('render', () => {
  it('should replace variables with values', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'variable',
              attrs: {
                id: 'name',
                fallback: 'Buddy',
              },
            },
          ],
        },
      ],
    };

    const engine = new Engine(content);
    engine.setVariableValue('name', 'John Doe');
    const result = await engine.render({
      plainText: true,
    });

    expect(result).toMatchInlineSnapshot(`"John Doe"`);
  });

  it('should replace variables with default formatted value', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'variable',
              attrs: {
                id: 'name',
                fallback: 'Buddy',
              },
            },
          ],
        },
      ],
    };
    const result = await render(content, {
      plainText: true,
    });
    expect(result).toMatchInlineSnapshot(`"{{name,fallback=Buddy}}"`);
  });

  it('should replace variables formatter with custom formatter', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'variable',
              attrs: {
                id: 'name',
                fallback: 'Buddy',
              },
            },
          ],
        },
      ],
    };

    const engine = new Engine(content);
    engine.setVariableFormatter((options) => {
      const { fallback, variable } = options;
      return `[${variable},fallback=${fallback}]`;
    });
    const result = await engine.render({
      plainText: true,
    });

    expect(result).toMatchInlineSnapshot(`"[name,fallback=Buddy]"`);
  });

  it('refuses a real render that is missing a required value, placeholder or not', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id: 'name', fallback: 'Buddy' } }] }],
    };
    const engine = new Engine(content);
    engine.setShouldReplaceVariableValues(true);
    await expect(engine.render({ plainText: true })).rejects.toMatchObject({ name: 'MissingVariablesError', missing: ['name'] });
  });

  it('renders an optional pill as nothing when its value is missing', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }, { type: 'variable', attrs: { id: 'name', fallback: 'Buddy', required: false } }] }],
    };
    const engine = new Engine(content);
    engine.setShouldReplaceVariableValues(true);
    expect(await engine.render({ plainText: true })).toBe('Hi');
  });

  it('shows the placeholder for a missing value only under the placeholder policy', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'variable', attrs: { id: 'name', fallback: 'Buddy' } }] }],
    };
    const engine = new Engine(content);
    engine.setShouldReplaceVariableValues(true);
    engine.setMissingVariablePolicy('placeholder');
    engine.setVariableFormatter(({ variable, fallback }) => fallback ?? `{{${variable}}}`);
    expect(await engine.render({ plainText: true })).toBe('Buddy');
  });

  it('should replace links with setLinkValue value', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: 'left',
          },
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://maily.to',
                    target: '_blank',
                    rel: 'noopener noreferrer nofollow',
                    class: null,
                  },
                },
              ],
              text: 'maily.to',
            },
          ],
        },
      ],
    };

    const engine = new Engine(content);
    engine.setLinkValue('https://maily.to', 'https://maily.to/playground');
    const result = await engine.render({
      plainText: true,
    });

    expect(result).toMatchInlineSnapshot(
      `"maily.to https://maily.to/playground"`
    );
  });

  it("should replace unsubscribe_url in button's href", async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'button',
          attrs: {
            mailyComponent: 'button',
            text: 'Unsubscribe',
            url: 'unsubscribe_url',
            isUrlVariable: true,
            alignment: 'left',
            variant: 'filled',
            borderRadius: 'smooth',
            buttonColor: 'rgb(0, 0, 0)',
            textColor: 'rgb(255, 255, 255)',
          },
        },
      ],
    };

    const engine = new Engine(content);
    engine.setVariableValue(
      'unsubscribe_url',
      'https://maily.to/unsubscribe_url'
    );
    const result = await engine.render({
      plainText: true,
    });

    expect(result).toMatchInlineSnapshot(
      `"Unsubscribe https://maily.to/unsubscribe_url"`
    );
  });

  it('should apply custom theme', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Custom Heading' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Custom Paragraph' }],
        },
      ],
    };

    const customTheme = {
      colors: {
        heading: 'rgb(255, 0, 0)',
        paragraph: 'rgb(0, 255, 0)',
      },
      fontSize: {
        paragraph: { size: '18px' },
      },
    };

    const engine = new Engine(content);
    engine.setTheme(customTheme);
    const result = await engine.render();

    expect(result).toContain('color:rgb(255, 0, 0)');
    expect(result).toContain('color:rgb(0, 255, 0)');
    expect(result).toContain('font-size:18px');
  });

  it('should remove preview header from text', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Empty Content' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'You will see me with the preview text' },
          ],
        },
      ],
    };

    const engine = new Engine(content);
    engine.setPreviewText('You will not see me!');

    const html = await engine.render();
    const text = await engine.render({ plainText: true });

    expect(text).toBe('EMPTY CONTENT\n\nYou will see me with the preview text');
    expect(html).toContain('You will not see me!');
    expect(html).toContain('data-skip-in-text="true"');
  });

  describe('paragraph text direction', () => {
    it('should render paragraph with RTL direction', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {
              textDirection: 'rtl',
            },
            content: [{ type: 'text', text: 'مرحبا بالعالم' }],
          },
        ],
      };

      const engine = new Engine(content);
      const result = await engine.render();

      expect(result).toContain('direction:rtl');
    });

    it('should render paragraph with LTR direction by default', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      };

      const engine = new Engine(content);
      const result = await engine.render();

      expect(result).not.toContain('direction:rtl');
    });

    it('should not add direction style for explicit LTR', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {
              textDirection: 'ltr',
            },
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      };

      const engine = new Engine(content);
      const result = await engine.render();

      expect(result).not.toContain('direction:rtl');
      expect(result).not.toContain('direction:ltr');
    });
  });

  describe('footer text direction', () => {
    it('should render footer with RTL direction', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'footer',
            attrs: {
              textDirection: 'rtl',
            },
            content: [{ type: 'text', text: 'تذييل الصفحة' }],
          },
        ],
      };

      const engine = new Engine(content);
      const result = await engine.render();

      expect(result).toContain('direction:rtl');
    });

    it('should render footer with LTR direction by default', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'footer',
            content: [{ type: 'text', text: 'Footer text' }],
          },
        ],
      };

      const engine = new Engine(content);
      const result = await engine.render();

      expect(result).not.toContain('direction:rtl');
    });
  });

  it('should resolve link URL variables from repeat item payload', async () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'repeat',
          attrs: {
            each: 'links',
          },
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: 'left',
              },
              content: [
                {
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://url',
                        target: '_blank',
                        rel: 'noopener noreferrer nofollow',
                        isUrlVariable: true,
                      },
                    },
                  ],
                  text: 'Click here',
                },
              ],
            },
          ],
        },
      ],
    };

    const engine = new Engine(content);
    engine.setPayloadValue('links', [
      { url: 'https://example.com/first' },
      { url: 'https://example.com/second' },
    ]);
    const result = await engine.render({ plainText: true });

    expect(result).toContain('https://example.com/first');
    expect(result).toContain('https://example.com/second');
  });

  describe('preheader', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Email content' }],
        },
      ],
    };

    it('should render preheader with string content', async () => {
      const preheaderText = 'This is a preview text';

      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      const result = preheader.render(preheaderText);

      expect(result).toBe('This is a preview text');
    });

    it('should render preheader with JSONContent', async () => {
      const preheaderContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'JSON preview text' }],
          },
        ],
      };

      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      const result = preheader.render(preheaderContent);

      expect(result).toBe('JSON preview text');
    });

    it('should render preheader with variables', async () => {
      const preheaderContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              {
                type: 'variable',
                attrs: {
                  id: 'name',
                  fallback: 'there',
                },
              },
              { type: 'text', text: '!' },
            ],
          },
        ],
      };

      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      engine.setVariableValue('name', 'John');
      const result = preheader.render(preheaderContent);

      expect(result).toBe('Hello John!');
    });

    it('should render preheader with variable fallback', async () => {
      const preheaderContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Welcome ' },
              {
                type: 'variable',
                attrs: {
                  id: 'username',
                  fallback: 'valued customer',
                },
              },
            ],
          },
        ],
      };

      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      engine.setShouldReplaceVariableValues(true);
      // A preview: the placeholder stands in. On a real render the missing
      // value is refused instead — see the render tests above.
      engine.setMissingVariablePolicy('placeholder');
      engine.setVariableFormatter(({ variable, fallback }) => fallback ?? `{{${variable}}}`);
      const result = preheader.render(preheaderContent);

      expect(result).toBe('Welcome valued customer');
    });

    it('should not render preheader when preview is not set', async () => {
      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      const result = preheader.render('');

      expect(result).toBe('');
    });

    it('should handle empty preheader content', async () => {
      const emptyPreheaderContent = {
        type: 'doc',
        content: [],
      };

      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      const result = preheader.render(emptyPreheaderContent);

      expect(result).toBe('');
    });

    it('should handle complex nested preheader content', async () => {
      const complexPreheaderContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Order #' },
              {
                type: 'variable',
                attrs: {
                  id: 'order_id',
                  fallback: '12345',
                },
              },
              { type: 'text', text: ' for ' },
              {
                type: 'variable',
                attrs: {
                  id: 'customer_name',
                  fallback: 'customer',
                },
              },
            ],
          },
        ],
      };

      const engine = new Engine(content);
      const preheader = new Preheader(engine);
      engine.setVariableValue('order_id', 'ORD-789');
      engine.setVariableValue('customer_name', 'Alice Smith');
      const result = preheader.render(complexPreheaderContent);

      expect(result).toBe('Order #ORD-789 for Alice Smith');
    });
  });
});
