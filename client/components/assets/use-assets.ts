'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAsset, listAssets, uploadAsset, type Asset, type AssetList, type UploadResult } from '~/lib/assets';

export const ASSETS_KEY = ['assets'] as const;

/** One cache for the library page and the editor picker, so an upload made
 *  in one is already there when the other opens. */
export function useAssets(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ASSETS_KEY, queryFn: listAssets, enabled: options?.enabled ?? true });

  const upload = useMutation({
    mutationFn: (file: File): Promise<UploadResult> => uploadAsset(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ASSETS_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAsset(id),
    // Optimistic: the card disappears on click and comes back only if the
    // server refuses.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ASSETS_KEY });
      const previous = queryClient.getQueryData<AssetList>(ASSETS_KEY);
      if (previous) {
        const gone = previous.assets.find((asset) => asset.id === id);
        queryClient.setQueryData<AssetList>(ASSETS_KEY, {
          ...previous,
          assets: previous.assets.filter((asset) => asset.id !== id),
          usedBytes: previous.usedBytes - (gone?.bytes ?? 0),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(ASSETS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ASSETS_KEY }),
  });

  return { query, upload, remove };
}

export type { Asset };
