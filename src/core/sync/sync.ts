//src/core/sync/sync.ts

import { db, nowIso, kvGet, kvSet, Participant, Registration } from "../../db/fiestas.db";
import { supa } from "../api/supabase";

/** PUSH: intenta vaciar outbox (idempotente por claves únicas en server) */
export async function pushOutbox() {
  // Evitar ejecutar push cuando no hay sesión autenticada.
  // Si la app pierde foco y la sesión cambia/expira, preferimos dejar los items
  // en la outbox para reintentar más tarde con credenciales válidas.
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) {
      console.warn("pushOutbox: no authenticated session, skipping push");
      return;
    }
  } catch (e) {
    console.warn("pushOutbox: error getting session, skipping push", e);
    return;
  }

  const items = await db.outbox.orderBy("created_at").toArray();
  for (const it of items) {
    try {
      if (it.table === "participants" && it.op === "upsert") {
        const row = it.payload as Participant;
        // owner_user_id debe ser el del usuario logado
        await supa.from("participants").upsert({
          id: row.id,
          owner_user_id: row.owner_user_id,
          display_name: row.display_name,
          birth_year: row.birth_year ?? null,
          notes: row.notes ?? null,
          deleted: row.deleted,
          updated_at: row.updated_at
        });
      } else if (it.table === "participants" && it.op === "delete") {
        // Soft delete
        await supa.from("participants").update({ deleted: true, updated_at: nowIso() }).eq("id", it.payload.id);
      } else if (it.table === "registrations" && it.op === "rpc_register") {
        const p = it.payload as { event_id: string; participant_id: string; payment_amount?: number };
        await supa.rpc("api_register", { p_event_id: p.event_id, p_participant_id: p.participant_id, p_amount: p.payment_amount ?? null });
      } else if (it.table === "registrations" && it.op === "rpc_cancel") {
        await supa.rpc("api_cancel_registration", { p_registration_id: it.payload.id });
      }
  await db.outbox.delete(it.id);
  try { if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('outbox-changed')); } catch {}
    } catch (e) {
      // Si falla, dejamos el item para reintentar más tarde
      console.warn("pushOutbox failed", e);
      break;
    }
  }
}

/** PULL: trae cambios incrementales por updated_at LWW */
export async function pullChanges() {
  const last = (await kvGet("lastPullAt")) ?? "1970-01-01T00:00:00.000Z";

  // Participants
  {
    const { data, error } = await supa.from("participants")
      .select("*")
      .gt("updated_at", last);
    if (!error && data) {
      await db.transaction("rw", db.participants, async () => {
        for (const row of data) {
          const local = await db.participants.get(row.id);
          if (!local || new Date(row.updated_at) >= new Date(local.updated_at)) {
            await db.participants.put({
              id: row.id,
              owner_user_id: row.owner_user_id,
              display_name: row.display_name,
              birth_year: row.birth_year ?? undefined,
              notes: row.notes ?? undefined,
              deleted: row.deleted,
              created_at: row.created_at,
              updated_at: row.updated_at
            });
          }
        }
      });
    }
  }

  // Registrations
  {
    const { data, error } = await supa.from("registrations")
      .select("*")
      .gt("updated_at", last);
    if (!error && data) {
      await db.transaction("rw", db.registrations, async () => {
        for (const row of data) {
          const local = await db.registrations.get(row.id);
          if (!local || new Date(row.updated_at) >= new Date(local.updated_at)) {
            const registration: Registration = {
              id: row.id,
              event_id: row.event_id,
              participant_id: row.participant_id,
              participant_name: local?.participant_name ?? "(desconocido)",
              created_by_user_id: row.created_by_user_id,
              payment_status: row.payment_status,
              payment_amount: row.payment_amount ?? undefined,
              payment_method: (row.payment_method as any) ?? undefined,
              is_confirmed: row.is_confirmed,
              deleted: row.deleted,
              created_at: row.created_at,
              updated_at: row.updated_at
            };
            await db.registrations.put(registration);
          }
        }
      });
    }
  }

  await kvSet("lastPullAt", nowIso());
}

/** Paso único de sync (push-then-pull) */
export async function syncAll() {
  await pushOutbox();
  await pullChanges();
}