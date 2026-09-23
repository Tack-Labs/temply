import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { eq } from 'drizzle-orm';
import { assets, mails, templateVersions } from '@temply/shared/schema';
import { resetImageKitForTests } from '../lib/imagekit';
import type { TestDb } from '../test/helpers';

process.env.IMAGEKIT_PUBLIC_KEY = 'public_test';
process.env.IMAGEKIT_PRIVATE_KEY = 'private_test';
process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/test';

/** The fake SDK's behaviour, mutable per test. */
const ik = {
  uploads: [] as Array<Record<string, unknown>>,
  deleted: [] as string[],
  failUpload: false,
  deleteStatus: 204 as number,
};

mock.module('imagekit', () => ({
  default: class {
    async upload(options: Record<string, unknown>) {
      ik.uploads.push(options);
      if (ik.failUpload) throw Object.assign(new Error('boom'), { $ResponseMetadata: { statusCode: 500 } });
      // ImageKit's useUniqueFileName appends a random suffix; the row must
      // keep the name the user gave, not this one.
      const given = String(options.fileName);
      const name = given.replace(/(\.[^.]+)$/, `_Ab3dEf9x1Q$1`);
      return {
        fileId: `file_${ik.uploads.length}`,
        url: `https://ik.imagekit.io/test/temply/u/${name}`,
        name,
        size: (options.file as Buffer).length,
        width: 640,
        height: 480,
        $ResponseMetadata: { statusCode: 200 },
      };
    }
    async deleteFile(fileId: string) {
      if (ik.deleteStatus === 404) throw Object.assign(new Error('missing'), { $ResponseMetadata: { statusCode: 404 } });
      if (ik.deleteStatus >= 500) throw Object.assign(new Error('down'), { $ResponseMetadata: { statusCode: ik.deleteStatus } });
      ik.deleted.push(fileId);
      return { $ResponseMetadata: { statusCode: 204 } };
    }
  },
}));

const { assetsRoutes } = await import('./assets');
const { createTestApp, createTestDb, del, get, givePlan, postForm } = await import('../test/helpers');

let db: TestDb;
let app: any;
const OWNER = 'user_owner';
const OTHER = 'user_other';

beforeEach(() => {
  db = createTestDb();
  app = createTestApp(db, assetsRoutes);
  ik.uploads = [];
  ik.deleted = [];
  ik.failUpload = false;
  ik.deleteStatus = 204;
});

/** Real PNG magic bytes, zero-padded to the requested size: the server now
 *  sniffs the format from the bytes, so a payload has to look like an actual
 *  image to reach the "uploaded" tests below. */
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function formWith(bytes: number, type = 'image/png', name = 'hero.png') {
  const data = new Uint8Array(bytes);
  data.set(PNG_MAGIC.subarray(0, Math.min(PNG_MAGIC.length, bytes)));
  const form = new FormData();
  form.append('file', new File([data], name, { type }));
  return form;
}

const upload = (userId: string | null, bytes = 1024, type?: string, name?: string) =>
  postForm(app, '/api/v1/assets', formWith(bytes, type, name), userId);

describe('POST /api/v1/assets', () => {
  it('401 without a user', async () => {
    expect((await upload(null)).status).toBe(401);
  });

  it('uploads into the user folder and records the row', async () => {
    const res = await upload(OWNER, 2048);
    expect(res.status).toBe(200);
    const { asset, duplicateName } = await res.json();
    expect(asset.url).toBe('https://ik.imagekit.io/test/temply/u/hero_Ab3dEf9x1Q.png');
    expect(asset.name).toBe('hero.png');
    expect(duplicateName).toBe(false);
    expect(asset.bytes).toBe(2048);
    expect(asset.width).toBe(640);
    expect(ik.uploads[0].folder).toBe(`/temply/${OWNER}`);
    expect(ik.uploads[0].useUniqueFileName).toBe(true);
    const rows = await db.select().from(assets).where(eq(assets.user_id, OWNER));
    expect(rows).toHaveLength(1);
    expect(rows[0].imagekit_file_id).toBe('file_1');
  });

  it('flags a second upload with the same name, but keeps it', async () => {
    await upload(OWNER, 100, 'image/png', 'hero.png');
    const res = await upload(OWNER, 200, 'image/png', 'hero.png');
    expect(res.status).toBe(200);
    const { asset, duplicateName } = await res.json();
    expect(duplicateName).toBe(true);
    expect(asset.name).toBe('hero.png');
    expect(await db.select().from(assets).where(eq(assets.user_id, OWNER))).toHaveLength(2);
    // Another user's hero.png is not a duplicate of mine.
    const theirs = await (await upload(OTHER, 100, 'image/png', 'hero.png')).json();
    expect(theirs.duplicateName).toBe(false);
  });

  it('400 on a MIME type email clients cannot show', async () => {
    // Real SVG bytes, not just a declared header: sniffing decides the
    // format from the content, so a spoofed Content-Type on real image
    // bytes would not be enough to fail this — the bytes themselves must
    // be unsniffable.
    const form = new FormData();
    form.append('file', new File([new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')], 'logo.svg', { type: 'image/svg+xml' }));
    const res = await postForm(app, '/api/v1/assets', form, OWNER);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Only JPEG, PNG, GIF and WebP images can be uploaded.');
    expect(ik.uploads).toHaveLength(0);
  });

  it('400 when the declared type lies about the bytes', async () => {
    const form = new FormData();
    form.append('file', new File([new Uint8Array([0x3c, 0x73, 0x76, 0x67])], 'hero.png', { type: 'image/png' }));
    const res = await postForm(app, '/api/v1/assets', form, OWNER);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Only JPEG, PNG, GIF and WebP images can be uploaded.');
    expect(ik.uploads).toHaveLength(0);
  });

  it('uploads a non-ASCII filename and normalises the extension to the sniffed type', async () => {
    const res = await upload(OWNER, 1024, 'image/png', 'héro 图.PNG');
    expect(res.status).toBe(200);
    expect(ik.uploads[0].fileName).toBe('héro 图.png');
  });

  it('400 over 5 MB, before touching ImageKit', async () => {
    const res = await upload(OWNER, 5 * 1024 * 1024 + 1);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe('Images must be under 5 MB.');
    expect(ik.uploads).toHaveLength(0);
  });

  it('402 when the plan quota would be crossed, with the formatted numbers', async () => {
    await db.insert(assets).values({
      id: 'seed', user_id: OWNER, org_id: OWNER, imagekit_file_id: 'f0', url: 'https://ik.imagekit.io/test/x.png',
      name: 'x.png', mime: 'image/png', bytes: 49 * 1024 * 1024,
    });
    const res = await upload(OWNER, 2 * 1024 * 1024);
    expect(res.status).toBe(402);
    expect((await res.json()).message).toBe('Storage is full — 49 MB of 50 MB used. Delete images in your library or upgrade.');
    expect(ik.uploads).toHaveLength(0);
  });

  it('never hits quota on enterprise', async () => {
    await givePlan(db, OWNER, 'enterprise');
    await db.insert(assets).values({
      id: 'seed', user_id: OWNER, org_id: OWNER, imagekit_file_id: 'f0', url: 'https://ik.imagekit.io/test/x.png',
      name: 'x.png', mime: 'image/png', bytes: 3 * 1024 * 1024 * 1024,
    });
    expect((await upload(OWNER)).status).toBe(200);
  });

  it('502 and no row when ImageKit fails', async () => {
    ik.failUpload = true;
    const res = await upload(OWNER);
    expect(res.status).toBe(502);
    expect(await db.select().from(assets)).toHaveLength(0);
  });
});

describe('GET /api/v1/assets', () => {
  it('lists only the caller’s assets, newest first, with usage and the plan cap', async () => {
    await upload(OWNER, 100, 'image/png', 'first.png');
    await upload(OWNER, 200, 'image/png', 'second.png');
    await upload(OTHER, 300, 'image/png', 'theirs.png');
    const body = await (await get(app, '/api/v1/assets', OWNER)).json();
    expect(body.assets.map((a: { name: string }) => a.name)).toEqual(['second.png', 'first.png']);
    expect(body.usedBytes).toBe(300);
    expect(body.limitBytes).toBe(50 * 1024 * 1024);
  });

  it('reports null (unlimited) for enterprise', async () => {
    await givePlan(db, OWNER, 'enterprise');
    const body = await (await get(app, '/api/v1/assets', OWNER)).json();
    expect(body.limitBytes).toBeNull();
  });
});

describe('GET /api/v1/assets/:id/usage', () => {
  it('names each template whose content or a version snapshot carries the URL', async () => {
    const { asset } = await (await upload(OWNER)).json();
    await db.insert(mails).values({ id: 'm1', user_id: OWNER, org_id: OWNER, title: 'Welcome', content: JSON.stringify({ src: asset.url }) });
    await db.insert(mails).values({ id: 'm2', user_id: OWNER, org_id: OWNER, title: 'Old', content: '{}' });
    await db.insert(templateVersions).values({
      id: 'v1', template_id: 'm2', user_id: OWNER, org_id: OWNER, title: 'Old', content: JSON.stringify({ src: asset.url }), version_number: 1,
    });
    await db.insert(mails).values({ id: 'm3', user_id: OTHER, org_id: OTHER, title: 'Not mine', content: JSON.stringify({ src: asset.url }) });
    const body = await (await get(app, `/api/v1/assets/${asset.id}/usage`, OWNER)).json();
    expect(body.templates.map((t: { id: string }) => t.id).sort()).toEqual(['m1', 'm2']);
  });

  it('404 for another user’s asset', async () => {
    const { asset } = await (await upload(OTHER)).json();
    expect((await get(app, `/api/v1/assets/${asset.id}/usage`, OWNER)).status).toBe(404);
  });
});

describe('DELETE /api/v1/assets/:id', () => {
  it('deletes on ImageKit first, then the row', async () => {
    const { asset } = await (await upload(OWNER)).json();
    const res = await del(app, `/api/v1/assets/${asset.id}`, OWNER);
    expect(res.status).toBe(200);
    expect(ik.deleted).toEqual(['file_1']);
    expect(await db.select().from(assets)).toHaveLength(0);
  });

  it('treats an ImageKit 404 as already gone', async () => {
    const { asset } = await (await upload(OWNER)).json();
    ik.deleteStatus = 404;
    expect((await del(app, `/api/v1/assets/${asset.id}`, OWNER)).status).toBe(200);
    expect(await db.select().from(assets)).toHaveLength(0);
  });

  it('keeps the row when ImageKit is down', async () => {
    const { asset } = await (await upload(OWNER)).json();
    ik.deleteStatus = 503;
    expect((await del(app, `/api/v1/assets/${asset.id}`, OWNER)).status).toBe(502);
    expect(await db.select().from(assets)).toHaveLength(1);
  });

  it('404 for another user’s asset, and nothing is deleted', async () => {
    const { asset } = await (await upload(OTHER)).json();
    expect((await del(app, `/api/v1/assets/${asset.id}`, OWNER)).status).toBe(404);
    expect(ik.deleted).toHaveLength(0);
  });
});

describe('POST /api/v1/assets without ImageKit configured', () => {
  it('503 on upload, but the library still lists', async () => {
    // getImageKit() caches its client, so an earlier test's successful
    // upload would otherwise leave a client behind even with the env vars
    // gone; reset it so this test observes the unconfigured path for real.
    resetImageKitForTests();
    const saved = {
      pub: process.env.IMAGEKIT_PUBLIC_KEY,
      priv: process.env.IMAGEKIT_PRIVATE_KEY,
      url: process.env.IMAGEKIT_URL_ENDPOINT,
    };
    delete process.env.IMAGEKIT_PUBLIC_KEY;
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    delete process.env.IMAGEKIT_URL_ENDPOINT;
    try {
      const res = await upload(OWNER);
      expect(res.status).toBe(503);
      expect((await res.json()).message).toBe('Image uploads are not configured');
      expect((await get(app, '/api/v1/assets', OWNER)).status).toBe(200);
    } finally {
      process.env.IMAGEKIT_PUBLIC_KEY = saved.pub;
      process.env.IMAGEKIT_PRIVATE_KEY = saved.priv;
      process.env.IMAGEKIT_URL_ENDPOINT = saved.url;
    }
  });
});
