import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonLd } from './json-ld';

test('JSON-LD text cannot close its script element', () => {
  const description = '</script><script>alert("injected")</script>';
  const html = renderToStaticMarkup(<JsonLd data={{ '@context': 'https://schema.org', description }} />);
  expect(html.match(/<script/g)).toHaveLength(1);
  expect(html.match(/<\/script>/g)).toHaveLength(1);
  const json = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
  expect(JSON.parse(json).description).toBe(description);
});
