'use client';

import { useOrganization } from '@clerk/nextjs';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { httpPost } from '~/lib/http';
import { personaliseStarter, STARTER_TEMPLATES, type StarterTemplate } from '~/lib/starter-templates';

type SaveTemplateResponse = {
  template: { id: string };
};

// One key for every place that offers a starter, so each can see that another
// has a template on its way and hold its own controls too.
const MUTATION_KEY = ['create-from-starter'];

/**
 * The starters, written for the workspace, and the one way to turn a pick into
 * a template. The gallery behind "New template" and the chips on the home page
 * both use it, and creating twice is the failure to avoid. While a request is
 * out, every surface holds its controls, through one mutation key. After the
 * response only the surface that was clicked stays busy, until the page moves
 * on; another surface is free in that gap, and if the route never changes the
 * pick stays held until the page unmounts.
 */
export function useCreateFromStarter() {
  const router = useRouter();
  const client = useQueryClient();
  const [pickedId, setPickedId] = useState<string | null>(null);
  // The starters are written for a sample company; the workspace's own name
  // and logo go in before anyone sees them, in the gallery and in the
  // template made. Clerk always has an image for an org — initials when
  // nothing was uploaded — so only a real upload replaces the mark.
  const { organization } = useOrganization();
  const workspace = {
    name: organization?.name,
    logoUrl: organization?.hasImage ? organization.imageUrl : null,
  };
  const starters = STARTER_TEMPLATES.map((starter) => personaliseStarter(starter, workspace));

  const { mutate } = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (starter: StarterTemplate) =>
      httpPost<SaveTemplateResponse>('/api/v1/templates', {
        title: starter.subject,
        previewText: starter.previewText,
        content: JSON.stringify(starter.content),
      }),
    onSuccess: (data) => {
      router.push(`/templates/${data.template.id}`);
    },
    onError: (error) => {
      setPickedId(null);
      toast.error(error.message || 'Could not create the template');
    },
  });

  const inFlight = useIsMutating({ mutationKey: MUTATION_KEY }) > 0;
  // The surface that picked stays busy past the response: the redirect is
  // still on its way, and a second click here in that gap would make a second
  // template. Other surfaces see only the request in flight.
  const busy = inFlight || pickedId !== null;

  const create = (starter: StarterTemplate) => {
    // Read from the cache, not the render: two clicks inside one frame both
    // see the same render's `busy`.
    if (pickedId !== null || client.isMutating({ mutationKey: MUTATION_KEY }) > 0) return;
    setPickedId(starter.id);
    mutate(starter);
  };

  return { starters, create, busy, pickedId };
}
