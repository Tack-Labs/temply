import { useRouter } from 'next/navigation';

/**
 * The click handler for a link that has to let the editor save first.
 *
 * Leaving the editor unmounts it, and an edit still inside the autosave's
 * debounce would go with it, so the editor passes `beforeNavigate` (flush the
 * draft, answer whether it is safe to go) and the link waits on it. A click
 * that asks for something other than "go here in this tab" — a modifier key
 * for a new tab or window — is left to the browser: nothing is lost by it,
 * since this page stays open to finish the save. With no guard there is
 * nothing to wait for and the link is an ordinary one.
 */
export function useGuardedLink(beforeNavigate?: () => Promise<boolean>) {
  const router = useRouter();
  return (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!beforeNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void beforeNavigate().then((proceed) => {
      if (proceed) router.push(href);
    });
  };
}
