import * as React from 'react';
import blink from '@/blink/client';
import { useFamily } from '@/lib/familyContext';
import { featuresForcePro } from '@/lib/features';

export default function DiagPage() {
  const [state, setState] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isOwner, setIsOwner] = React.useState<boolean>(false);
  const { familyId } = useFamily();

  React.useEffect(() => {
    (async () => {
      try {
        // Skip auth for testing
        const me = { id: 'demo-user-testing-123', email: 'demo@familyops.test' };

        // Check if user is owner of the family
        if (familyId) {
          const member = await blink.db.familyMembers.list({
            where: { familyId, userId: me.id },
            limit: 1
          });
          setIsOwner(member[0]?.role === 'owner');
          
          if (member[0]?.role !== 'owner') {
            setError('Owner access only.');
            return;
          }
        }

        // Get counts if we have a family
        const [children, routines, events, meals, lists] = familyId
          ? await Promise.all([
              blink.db.children.list({ where: { familyId } }),
              blink.db.routines.list({}),
              blink.db.events.list({ where: { familyId } }),
              blink.db.meals.list({ where: { familyId } }),
              blink.db.lists.list({ where: { familyId } }),
            ])
          : [[],[],[],[],[]];

        // Filter routines by children in this family
        const familyChildren = children.map(c => c.id);
        const familyRoutines = routines.filter(r => familyChildren.includes(r.childId));

        // Simple pro check
        const hasPro = featuresForcePro();

        setState({
          me,
          familyId,
          hasPro,
          counts: {
            children: children.length,
            routines: familyRoutines.length,
            events: events.length,
            meals: meals.length,
            lists: lists.length,
          },
        });
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load diagnostics');
      }
    })();
  }, [familyId]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!state) return <div className="p-6">Loading…</div>;
  if (!isOwner && familyId) return <div className="p-6 text-red-600">Owner access only.</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Diagnostics</h1>
      <div><b>User:</b> {state.me?.email} ({state.me?.id})</div>
      <div><b>Family ID:</b> {state.familyId ?? '—'}</div>
      <div><b>Pro (test flag):</b> {String(state.hasPro)}</div>
      <div>
        <b>Counts:</b> children {state.counts.children} · routines {state.counts.routines} · events {state.counts.events} · meals {state.counts.meals} · lists {state.counts.lists}
      </div>
      <div className="text-sm text-gray-500">If these look off, click your Dashboard "Get Started" or run the seed action.</div>
    </div>
  );
}