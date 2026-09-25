import { publicRenderPath, publicTemplatePath, publicTemplatesPath } from '@temply/shared/api';
import { SITE_URL } from './site';

/** Where the API lives, as integrators will type it. */
export const API_ORIGIN = SITE_URL;

export type SnippetLanguage = 'curl' | 'javascript' | 'python' | 'ruby';

export const SNIPPET_LANGUAGES: { id: SnippetLanguage; label: string }[] = [
  { id: 'curl', label: 'curl' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'ruby', label: 'Ruby' },
];

const KEY = 'tply_live_…';
const DATA = { firstName: 'Ada', isMember: true };

/**
 * One render call per language, built from the shared path helpers so the
 * docs cannot show a URL the server does not answer. Kept deliberately plain
 * — the standard HTTP client of each language, no SDK, no wrapper.
 */
export function renderSnippets(shortCode: string): Record<SnippetLanguage, string> {
  const url = `${API_ORIGIN}${publicRenderPath(shortCode)}`;
  const data = JSON.stringify({ data: DATA });
  return {
    curl: `curl -X POST ${url} \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${data}'`,
    javascript: `const res = await fetch("${url}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${KEY}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${JSON.stringify({ data: DATA }, null, 2).replace(/\n/g, '\n  ')}),
});
const { html, text } = await res.json();`,
    python: `import requests

res = requests.post(
    "${url}",
    headers={"Authorization": "Bearer ${KEY}"},
    json={"data": {"firstName": "Ada", "isMember": True}},
)
html = res.json()["html"]`,
    ruby: `require "net/http"
require "json"

uri = URI("${url}")
req = Net::HTTP::Post.new(uri, {
  "Authorization" => "Bearer ${KEY}",
  "Content-Type" => "application/json",
})
req.body = { data: { firstName: "Ada", isMember: true } }.to_json
res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
html = JSON.parse(res.body)["html"]`,
  };
}

/** The list, curl only — the same one-liner without a code on the end. */
export function listSnippet(): string {
  return `curl -H "Authorization: Bearer ${KEY}" \\
  ${API_ORIGIN}${publicTemplatesPath()}`;
}

/** The metadata call, curl only — it is a one-liner in every language. */
export function metaSnippet(shortCode: string): string {
  return `curl -H "Authorization: Bearer ${KEY}" \\
  ${API_ORIGIN}${publicTemplatePath(shortCode)}`;
}

/**
 * The step after render: the finished email handed to a mail provider. Resend
 * is shown because it is the one Temply itself sends through; the shape is
 * the same for any provider — subject from the template, html and text as
 * the two parts of one message.
 */
export function sendSnippets(shortCode: string): Record<SnippetLanguage, string> {
  const meta = `${API_ORIGIN}${publicTemplatePath(shortCode)}`;
  const render = `${API_ORIGIN}${publicRenderPath(shortCode)}`;
  return {
    curl: `# 1. The subject line
curl -H "Authorization: Bearer ${KEY}" ${meta}
# → { "title": "Welcome email", ... }

# 2. The email for this recipient
curl -X POST ${render} \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"firstName":"Ada","isMember":true}}'
# → { "html": "<!doctype html>...", "text": "Welcome, Ada...", ... }

# 3. Hand both parts to your provider (Resend shown)
curl -X POST https://api.resend.com/emails \\
  -H "Authorization: Bearer re_..." \\
  -H "Content-Type: application/json" \\
  -d '{"from":"you@example.com","to":"ada@example.com","subject":"Welcome email","html":"...","text":"..."}'`,
    javascript: `import { Resend } from "resend";

const headers = { Authorization: "Bearer ${KEY}", "Content-Type": "application/json" };

const { title } = await (await fetch("${meta}", { headers })).json();
const { html, text } = await (
  await fetch("${render}", {
    method: "POST",
    headers,
    body: JSON.stringify({ data: { firstName: "Ada", isMember: true } }),
  })
).json();

await new Resend("re_...").emails.send({
  from: "you@example.com",
  to: "ada@example.com",
  subject: title,
  html,
  text,
});`,
    python: `import requests
import resend

headers = {"Authorization": "Bearer ${KEY}"}

title = requests.get("${meta}", headers=headers).json()["title"]
email = requests.post(
    "${render}",
    headers=headers,
    json={"data": {"firstName": "Ada", "isMember": True}},
).json()

resend.api_key = "re_..."
resend.Emails.send({
    "from": "you@example.com",
    "to": "ada@example.com",
    "subject": title,
    "html": email["html"],
    "text": email["text"],
})`,
    ruby: `require "net/http"
require "json"
require "resend"

headers = { "Authorization" => "Bearer ${KEY}", "Content-Type" => "application/json" }

title = JSON.parse(Net::HTTP.get(URI("${meta}"), headers))["title"]
uri = URI("${render}")
req = Net::HTTP::Post.new(uri, headers)
req.body = { data: { firstName: "Ada", isMember: true } }.to_json
email = JSON.parse(Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }.body)

Resend.api_key = "re_..."
Resend::Emails.send({
  from: "you@example.com",
  to: "ada@example.com",
  subject: title,
  html: email["html"],
  text: email["text"],
})`,
  };
}

/**
 * The answers worth code rather than a retry loop: a 422 says which values
 * to add, and a 429 with Retry-After says how long to wait. A 429 without
 * it is the trial's monthly cap and a 402 a workspace with no plan — waiting
 * a minute fixes neither, so neither is retried. Everything else is an
 * ordinary failed request.
 */
export function errorSnippets(shortCode: string): Record<SnippetLanguage, string> {
  const render = `${API_ORIGIN}${publicRenderPath(shortCode)}`;
  return {
    curl: `curl -i -X POST ${render} \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{}}'
# HTTP/2 422
# { "status": 422, "message": "Missing values for: firstName", "missing": ["firstName"] }

# HTTP/2 429
# Retry-After: 12
# { "status": 429, "message": "...", ... }

# HTTP/2 402
# { "status": 402, "message": "...", ... }`,
    javascript: `const res = await fetch("${render}", {
  method: "POST",
  headers: { Authorization: "Bearer ${KEY}", "Content-Type": "application/json" },
  body: JSON.stringify({ data }),
});

if (res.status === 422) {
  const { missing } = await res.json(); // e.g. ["firstName"]
  throw new Error(\`Add these to data: \${missing.join(", ")}\`);
}
if (res.status === 429 && res.headers.has("Retry-After")) {
  const seconds = Number(res.headers.get("Retry-After"));
  // wait \`seconds\`, then try again — the call was not counted
}
if (res.status === 402) {
  throw new Error("The workspace has no plan; subscribe to resume live keys");
}
if (!res.ok) throw new Error(\`Render failed: \${res.status}\`);
const { html, text } = await res.json();`,
    python: `res = requests.post("${render}", headers=headers, json={"data": data})

if res.status_code == 422:
    missing = res.json()["missing"]  # e.g. ["firstName"]
    raise ValueError(f"Add these to data: {', '.join(missing)}")
if res.status_code == 429 and "Retry-After" in res.headers:
    seconds = int(res.headers["Retry-After"])
    # wait \`seconds\`, then try again — the call was not counted
if res.status_code == 402:
    raise RuntimeError("The workspace has no plan; subscribe to resume live keys")
res.raise_for_status()
email = res.json()`,
    ruby: `res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }

case res.code.to_i
when 422
  missing = JSON.parse(res.body)["missing"] # e.g. ["firstName"]
  raise "Add these to data: #{missing.join(", ")}"
when 429
  # Only with Retry-After: wait that long, then try again — the call was not
  # counted. Without it the month's calls are used up.
  raise "Monthly limit reached" unless res["Retry-After"]
  seconds = res["Retry-After"].to_i
when 402
  raise "The workspace has no plan; subscribe to resume live keys"
when 200
  email = JSON.parse(res.body)
else
  raise "Render failed: #{res.code}"
end`,
  };
}
