import { Elysia, t } from 'elysia';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import { assets, mails, templateVersions } from '@temply/shared/schema';
import { PLAN_LIMITS } from '@temply/shared/plans';
import { checkStorageLimit, getPlan, getStorageUsed } from '../lib/billing';
import { json, notFound, paymentRequired, unauthorized } from '../lib/errors';
import { assetFolder, getImageKit } from '../lib/imagekit';
import { authPlugin } from '../plugins/auth';
import { noWorkspace } from '../lib/workspace';
import { dbPlugin } from '../plugins/db';

export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
/** SVG is excluded on purpose: Gmail and Outlook strip it, so it would never
 *  render in a real email. */
export const ASSET_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/** The ImageKit SDK rejects with the HTTP status tucked under $ResponseMetadata. */
function imagekitStatus(error: unknown): number | null {
  const meta = (error as { $ResponseMetadata?: { statusCode?: number } })?.$ResponseMetadata;
  return typeof meta?.statusCode === 'number' ? meta.statusCode : null;
}

/** Reads the file's own magic bytes rather than the part's declared
 *  Content-Type, which the client writes and cannot be trusted. Returns
 *  null when nothing recognised matches. */
export function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buffer.length >= 6) {
    const header = buffer.toString('ascii', 0, 6);
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export const assetsRoutes = new Elysia()
  .use(authPlugin)
  .use(dbPlugin)
  .post('/api/v1/assets', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const file = ctx.body.file;
    // Cheapest check first: an oversized file is refused before its bytes
    // are ever read into memory.
    if (file.size > MAX_ASSET_BYTES) {
      return json({ status: 400, message: 'Images must be under 5 MB.', errors: ['Images must be under 5 MB.'] }, 400);
    }
    // The part's Content-Type and the filename are both written by the
    // client, so the accepted format is decided from the bytes, not either
    // of those — sniffing also means the row's mime and the derived
    // extension always describe what was actually uploaded.
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffImageType(bytes);
    if (!mime || !ASSET_MIME_TYPES.has(mime)) {
      return json({ status: 400, message: 'Only JPEG, PNG, GIF and WebP images can be uploaded.', errors: ['Only JPEG, PNG, GIF and WebP images can be uploaded.'] }, 400);
    }
    const limit = await checkStorageLimit(ctx.db, ctx.orgId, file.size);
    if (!limit.allowed) return paymentRequired(limit.message!);

    const ik = getImageKit();
    if (!ik) return json({ status: 503, message: 'Image uploads are not configured', errors: ['Image uploads are not configured'] }, 503);

    const ext = EXT_BY_MIME[mime];
    const stem = (file.name || '').replace(/\.[^.]+$/, '') || 'image';
    const fileName = `${stem}.${ext}`;
    // Two files may share a name — they are different images with different
    // ids — but the user deserves to hear it, so the response says so.
    const [existing] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(eq(assets.org_id, ctx.orgId), eq(assets.name, fileName)));
    const duplicateName = Number(existing?.count ?? 0) > 0;

    let uploaded: Awaited<ReturnType<typeof ik.upload>>;
    try {
      uploaded = await ik.upload({
        file: bytes,
        fileName,
        folder: assetFolder(ctx.orgId),
        useUniqueFileName: true,
      });
    } catch {
      return json({ status: 502, message: 'The image host did not accept the upload. Please try again.', errors: ['The image host did not accept the upload. Please try again.'] }, 502);
    }

    const asset = {
      id: crypto.randomUUID(),
      user_id: ctx.userId,
      org_id: ctx.orgId,
      imagekit_file_id: uploaded.fileId,
      url: uploaded.url,
      // The name the user gave, not the one ImageKit uniquified: the random
      // suffix is theirs to keep collisions apart and means nothing here.
      name: fileName,
      mime,
      bytes: uploaded.size,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
    };
    // If this insert fails the ImageKit file is orphaned; reconciliation is
    // a documented non-goal for now.
    await ctx.db.insert(assets).values(asset);
    const [row] = await ctx.db.select().from(assets).where(eq(assets.id, asset.id)).limit(1);
    return json({ asset: row, duplicateName });
  }, { body: t.Object({ file: t.File() }) })

  .get('/api/v1/assets', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const list = await ctx.db.select().from(assets).where(eq(assets.org_id, ctx.orgId)).orderBy(desc(assets.created_at), desc(sql`rowid`));
    const { plan } = await getPlan(ctx.db, ctx.orgId);
    const raw = PLAN_LIMITS[plan].maxStorageBytes;
    return json({
      assets: list,
      usedBytes: await getStorageUsed(ctx.db, ctx.orgId),
      limitBytes: Number.isFinite(raw) ? raw : null,
    });
  })

  .get('/api/v1/assets/:id/usage', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const [asset] = await ctx.db.select().from(assets)
      .where(and(eq(assets.id, ctx.params.id), eq(assets.org_id, ctx.orgId))).limit(1);
    if (!asset) return notFound('Asset not found');
    // A substring match over serialised content is enough: the URL is unique
    // per file and a transform suffix does not change its prefix.
    const needle = `%${asset.url}%`;
    const inContent = ctx.db.select({ id: mails.id, title: mails.title }).from(mails)
      .where(and(eq(mails.org_id, ctx.orgId), like(mails.content, needle)));
    const inVersions = ctx.db.select({ id: mails.id, title: mails.title }).from(templateVersions)
      .innerJoin(mails, eq(mails.id, templateVersions.template_id))
      .where(and(eq(templateVersions.org_id, ctx.orgId), like(templateVersions.content, needle)));
    const seen = new Map<string, { id: string; title: string }>();
    for (const row of [...(await inContent), ...(await inVersions)]) seen.set(row.id, row);
    return json({ templates: [...seen.values()] });
  })

  .delete('/api/v1/assets/:id', async (ctx) => {
    if (!ctx.userId) return unauthorized();
    if (!ctx.orgId) return noWorkspace();
    const [asset] = await ctx.db.select().from(assets)
      .where(and(eq(assets.id, ctx.params.id), eq(assets.org_id, ctx.orgId))).limit(1);
    if (!asset) return notFound('Asset not found');
    const ik = getImageKit();
    if (ik) {
      try {
        await ik.deleteFile(asset.imagekit_file_id);
      } catch (error) {
        // Already gone on their side is the outcome we wanted; anything else
        // keeps the row so the user can retry instead of leaking storage.
        if (imagekitStatus(error) !== 404) {
          return json({ status: 502, message: 'The image host could not delete the file. Please try again.', errors: ['The image host could not delete the file. Please try again.'] }, 502);
        }
      }
    }
    await ctx.db.delete(assets).where(and(eq(assets.id, asset.id), eq(assets.org_id, ctx.orgId)));
    return json({ status: 'ok' });
  });
