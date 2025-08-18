import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { db } from "../db/fiestas.db";
import { v4 as uuidv4 } from "uuid";
import { nowIso } from "../db/fiestas.db";

export function useParticipants(ownerUserId?: string) {
  const items = useLiveQuery(async () => {
    if (!ownerUserId) return [] as any[];
    return db.participants.where('owner_user_id').equals(ownerUserId).and(p => !p.deleted).toArray();
  }, [ownerUserId]);

  const addParticipant = useCallback(async (owner_user_id: string, display_name: string) => {
    const p = { id: uuidv4(), owner_user_id, display_name, deleted: false, created_at: nowIso(), updated_at: nowIso() };
    await db.participants.add(p);
    await db.outbox.add({ id: uuidv4(), table: 'participants', op: 'upsert', payload: p, created_at: nowIso() });
    try { if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('outbox-changed')); } catch {}
    return p;
  }, []);

  return { items: items || [], addParticipant };
}
