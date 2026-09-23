import { Code, H2, P } from '~/components/docs/docs-content';
import { FigureWorkspace } from '~/components/docs/figure-workspace';

/**
 * Workspaces and roles, in the words the product uses. Kept short: the
 * whole model is two roles and one sentence about what each does.
 */
export function YourTeam() {
  return (
    <section>
      <H2 id="team">Your team</H2>
      <P>
        Everything in Temply belongs to a <strong className="font-medium text-ink">workspace</strong>:
        the templates, the brands, the image library, the API keys and the
        plan. You name yours when you sign up — usually after your company —
        and it is yours alone until you invite someone.
      </P>
      <P>
        Invite people from <Code>Settings → Team</Code>: an email address each,
        and they get a link that puts them in the workspace. Anyone you invite
        can build, edit and publish emails, save brands, upload images, share
        review links and send test emails — the same product you have, with
        two exceptions.
      </P>
      <FigureWorkspace />
      <P>
        Those exceptions are what an <strong className="font-medium text-ink">admin</strong>{' '}
        does: the plan and billing, the API keys, and who is on the team.
        The person who created the workspace is its admin; an admin can make
        others admins from the Team page. A{' '}
        <strong className="font-medium text-ink">member</strong> makes the
        emails; an admin manages the account. There are no other roles.
      </P>
      <P>
        If you are invited into another workspace — a client’s, say — you
        switch between them from the top of the sidebar. Each workspace has
        its own templates, keys and plan; nothing crosses over.
      </P>
    </section>
  );
}
