'use client';

import { Loader2Icon, PaletteIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FetchError, httpDelete, httpPost, httpPut } from '~/lib/http';
import { toast } from 'sonner';
import { DEFAULT_RENDERER_THEME, type RendererThemeOptions } from '@temply/shared/theme';
import { BRAND_PRESETS } from '@temply/shared/brand-presets';
import { Button } from '~/components/ui/button';
import { ConfirmDialog } from '~/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { PageLoading } from '~/components/ui/page-loading';
import { Tile } from '~/components/ui/item';
import { Badge, EmptyState, ErrorState, PageHeader } from '~/components/ui/surfaces';
import { PlanLimitBanner } from '~/components/dashboard/plan-limit-banner';
import { BrandEditor } from '~/components/brand/brand-editor';
import { BrandPreview } from '~/components/brand/brand-preview';
import { useMinimumDisplay } from '~/hooks/use-minimum-display';
import { brandsQueryOptions, type Brand } from '~/lib/brands';

/** The three colours that read a brand at a glance: page, button, link. */
function Swatches({ theme }: { theme: RendererThemeOptions }) {
  const colors = [theme.body?.backgroundColor, theme.button?.backgroundColor, theme.link?.color];
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((c, i) => (
        <span key={i} className="size-5 rounded-sm border border-line" style={{ background: c }} />
      ))}
    </div>
  );
}

/** A brand's theme comes back from the API as a raw string; a corrupted or
 *  hand-edited row should degrade to a default look instead of throwing
 *  during render. */
function safeTheme(raw: string): RendererThemeOptions {
  try {
    return JSON.parse(raw) as RendererThemeOptions;
  } catch {
    return structuredClone(DEFAULT_RENDERER_THEME);
  }
}

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<RendererThemeOptions>(() => structuredClone(BRAND_PRESETS[0].theme));
  const [preview, setPreview] = useState<{ name: string; theme: RendererThemeOptions } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Keep the preview data mounted while the dialog plays its close animation —
  // clearing it on close blanks the content a frame before the dialog leaves.
  const openPreview = (name: string, theme: RendererThemeOptions) => {
    setPreview({ name, theme });
    setPreviewOpen(true);
  };

  const { data, isLoading, isError, refetch } = useQuery(brandsQueryOptions());
  const showLoading = useMinimumDisplay(isLoading);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['brands'] });

  const { mutateAsync: createBrand, isPending: isCreating } = useMutation({
    mutationFn: (input: { name: string; theme: RendererThemeOptions }) =>
      httpPost('/api/v1/brands', { name: input.name, theme: JSON.stringify(input.theme) }),
    onSuccess: () => {
      toast.success('Brand created');
      invalidate();
    },
    onError: (error) => {
      if (FetchError.isFetchError(error) && error.status === 402) {
        toast.error(error.message);
      } else {
        toast.error(error.message || 'Could not create the brand');
      }
    },
  });

  const { mutateAsync: updateBrand, isPending: isUpdating } = useMutation({
    mutationFn: (input: { id: string; name: string; theme: RendererThemeOptions }) =>
      httpPut(`/api/v1/brands/${input.id}`, { name: input.name, theme: JSON.stringify(input.theme) }),
    onSuccess: () => {
      toast.success('Brand saved');
      invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not save the brand'),
  });

  const { mutateAsync: deleteBrand } = useMutation({
    mutationFn: (id: string) => httpDelete(`/api/v1/brands/${id}`),
    onSuccess: () => {
      toast.success('Brand deleted');
      invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not delete the brand'),
  });

  const { mutateAsync: setDefaultBrand } = useMutation({
    mutationFn: (id: string) => httpPost(`/api/v1/brands/${id}/default`, {}),
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not set the default brand'),
  });

  const openCreate = () => {
    setEditingBrand(null);
    setName('');
    setTheme(structuredClone(BRAND_PRESETS[0].theme));
    setShowEditor(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setTheme(safeTheme(brand.theme));
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingBrand) {
      await updateBrand({ id: editingBrand.id, name: name.trim(), theme });
    } else {
      await createBrand({ name: name.trim(), theme });
    }
    setShowEditor(false);
  };

  const brands = data?.brands ?? [];
  const limit = data?.limit ?? null;
  const defaultBrandId = data?.defaultBrandId ?? null;
  const atLimit = limit !== null && brands.length >= limit;
  const isSaving = isCreating || isUpdating;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Brands"
        description="Reusable looks you apply to templates."
        actions={
          <Button variant="primary" disabled={atLimit} onClick={openCreate}>
            <PlusIcon />
            New brand
          </Button>
        }
      />

      {atLimit ? (
        <PlanLimitBanner
          title={`You've used all ${limit} custom brand${limit === 1 ? '' : 's'} on your plan.`}
          detail="Upgrade to save more."
        />
      ) : null}

      {/* The user's own saved brands. */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink">Your brands</h2>
        {showLoading ? (
          <PageLoading label="Loading your brands…" />
        ) : isError ? (
          <ErrorState description="We could not load your brands." onRetry={() => refetch()} />
        ) : brands.length === 0 ? (
          <EmptyState
            icon={PaletteIcon}
            title="No custom brands yet"
            description="Save a look — from a preset or your own colours — to reuse it across templates."
            action={
              <Button onClick={openCreate} disabled={atLimit}>
                New brand
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {brands.map((brand) => {
              const brandTheme = safeTheme(brand.theme);
              const isDefault = brand.id === defaultBrandId;
              return (
                <Tile
                  key={brand.id}
                  onClick={() => openPreview(brand.name, brandTheme)}
                  primaryLabel={`Preview ${brand.name}`}
                  title={brand.name}
                  badge={isDefault ? <Badge tone="accent">Default</Badge> : null}
                  actions={
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Edit"
                        aria-label={`Edit ${brand.name}`}
                        onClick={() => openEdit(brand)}
                      >
                        <PencilIcon />
                      </Button>
                      <ConfirmDialog
                        title="Delete this brand?"
                        description={
                          isDefault
                            ? 'It’s your default — the default will move to another brand or a preset.'
                            : 'Templates using it keep their own copy of the look.'
                        }
                        onConfirm={() => deleteBrand(brand.id)}
                      >
                        <Button variant="danger-quiet" size="icon-sm" title="Delete" aria-label={`Delete ${brand.name}`}>
                          <Trash2Icon />
                        </Button>
                      </ConfirmDialog>
                      {!isDefault ? (
                        <Button variant="ghost" size="sm" onClick={() => setDefaultBrand(brand.id)}>
                          Set as default
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  <div className="mt-2">
                    <Swatches theme={brandTheme} />
                  </div>
                </Tile>
              );
            })}
          </ul>
        )}
      </section>

      {/* Built-in looks — always available in the editor, not deletable. */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink">Presets</h2>
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {BRAND_PRESETS.map((p) => {
            const isDefault = p.id === defaultBrandId;
            return (
              <Tile
                key={p.id}
                onClick={() => openPreview(p.name, p.theme)}
                primaryLabel={`Preview ${p.name}`}
                title={p.name}
                badge={
                  <>
                    <Badge tone="neutral">Preset</Badge>
                    {isDefault ? <Badge tone="accent">Default</Badge> : null}
                  </>
                }
                actions={
                  !isDefault ? (
                    <Button variant="ghost" size="sm" onClick={() => setDefaultBrand(p.id)}>
                      Set as default
                    </Button>
                  ) : null
                }
              >
                <div className="mt-2">
                  <Swatches theme={p.theme} />
                </div>
              </Tile>
            );
          })}
        </ul>
      </section>

      <Dialog
        open={showEditor}
        onOpenChange={(open) => {
          setShowEditor(open);
          if (!open) {
            setEditingBrand(null);
            setName('');
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Edit brand' : 'Create brand'}</DialogTitle>
            <DialogDescription>
              Pick a preset and tweak it, or dial in your own colors.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 sm:grid-cols-[300px_minmax(0,1fr)]">
            {/* Live-ish preview on the left; controls on the right. */}
            <div className="sm:sticky sm:top-0 sm:self-start">
              <BrandPreview theme={theme} />
            </div>

            <div className="min-w-0 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="brand-name" className="block text-sm font-medium text-ink">
                  Brand name
                </label>
                <input
                  id="brand-name"
                  className="h-8 w-full rounded-sm border border-line bg-raised px-2.5 text-sm text-ink placeholder:text-faint"
                  placeholder="Your brand name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <BrandEditor theme={theme} onChange={setTheme} />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowEditor(false);
                setEditingBrand(null);
                setName('');
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!name.trim() || isSaving}>
              {isSaving ? <Loader2Icon className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-only look preview — the same email mock the editor shows. */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>How an email looks with this brand.</DialogDescription>
          </DialogHeader>
          {preview ? <BrandPreview theme={preview.theme} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
