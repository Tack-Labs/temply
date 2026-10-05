import { publicRenderPath } from '@temply/shared/api';

export type ConnectionLanguage = 'curl' | 'javascript' | 'python';

export function connectionSnippet({ origin, shortCode, data, version, language }: {
  origin: string; shortCode: string; data: Record<string, unknown>; version?: number; language: ConnectionLanguage;
}) {
  const url = `${origin}${publicRenderPath(shortCode)}`;
  const body = { ...(version ? { version } : {}), data };
  const json = JSON.stringify(body, null, 2);
  if (language === 'javascript') return `const response = await fetch(${JSON.stringify(url)}, {\n  method: 'POST',\n  headers: {\n    Authorization: \`Bearer \${process.env.TEMPLY_KEY}\`,\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify(${json}),\n});\nif (!response.ok) throw new Error(await response.text());\nconst { html, text, version } = await response.json();\n// Pass html and text to your email provider.`;
  if (language === 'python') return `import json\nimport os\nimport urllib.request\n\nrequest = urllib.request.Request(\n    ${JSON.stringify(url)},\n    data=${JSON.stringify(json)}.encode(),\n    headers={\n        "Authorization": "Bearer " + os.environ["TEMPLY_KEY"],\n        "Content-Type": "application/json",\n    },\n    method="POST",\n)\nwith urllib.request.urlopen(request) as response:\n    email = json.load(response)\n# Pass email["html"] and email["text"] to your email provider.`;
  // Shell single quotes must also survive a sample value such as O'Brien.
  const quoted = json.replace(/'/g, `'"'"'`);
  return `curl -X POST ${JSON.stringify(url)} \\\n  -H "Authorization: Bearer $TEMPLY_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${quoted}'`;
}
