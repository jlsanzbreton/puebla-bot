import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { db, nowIso, Participant } from "../db/fiestas.db";
import { Activity } from "../types";
import { getSessionInfo } from "../core/auth";
import { syncAll } from "../core/sync/sync";

// Hook para gestionar las inscripciones a actividades
export function useRegistrations() {
  // 0. session user id (para filtrar solo mis inscripciones)
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { (async () => { const s = await getSessionInfo(); setUserId(s.userId || null); })(); }, []);

  // 1. Mis inscripciones en Dexie, en vivo
  const myRegistrations = useLiveQuery(async () => {
    if (!userId) return [] as any[];
    return db.registrations
      .where("created_by_user_id")
      .equals(userId)
      .and(r => !r.deleted)
      .toArray();
  }, [userId]);

  const isLoading = myRegistrations === undefined;

  // 2. Conjunto de eventos a los que estoy apuntado
  const registeredEventIds = new Set(
    (myRegistrations || []).map(r => r.event_id)
  );

  // 3. Función interna para asegurar que el participante (usuario actual) existe en la BD local.
  // Si no existe, lo crea. Devuelve el objeto del participante.
  const ensureSelfParticipant = useCallback(async (): Promise<Participant | undefined> => {
    const session = await getSessionInfo();
    if (!session.userId) return undefined;

    const existing = await db.participants.where({ owner_user_id: session.userId }).first();
    if (existing) return existing;

    // Si no existe, lo creamos
    const newParticipant: Participant = {
      id: uuidv4(),
      owner_user_id: session.userId,
      display_name: session.displayName || session.email?.split('@')[0] || 'Usuario',
      deleted: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await db.participants.add(newParticipant);
    await db.outbox.add({ id: uuidv4(), table: "participants", op: "upsert", payload: newParticipant, created_at: nowIso() });
    return newParticipant;
  }, []);

  // 4. Función para apuntarse a una actividad
  const joinActivity = useCallback(async (activity: Activity, opts?: { participantId?: string; asOrganizer?: boolean }): Promise<string | undefined> => {
    if (isLoading) return;

    const session = await getSessionInfo();
    const currentUserId = session.userId;
    const currentRole = session.role;

    let participant: Participant | undefined;
    if (opts?.participantId) {
      participant = await db.participants.get(opts.participantId);
      // si no existe o no es de mi propiedad y no soy admin, fallamos
      if (!participant) {
        alert("Participante no encontrado.");
        return;
      }
      if (participant.owner_user_id !== currentUserId && currentRole !== "admin") {
        alert("No tienes permisos para inscribir a esa persona.");
        return;
      }
    } else {
      participant = await ensureSelfParticipant();
      if (!participant) {
        console.error("No se pudo obtener la información del participante para la inscripción.");
        alert("Error: No se pudo identificar al usuario para la inscripción.");
        return;
      }
    }

    // Evita duplicado: reactivar si existía borrado
    const existing = await db.registrations
      .where({ event_id: activity.id, participant_id: participant.id })
      .first();
  if (existing) {
      if (existing.deleted) {
        const patch = { deleted: false, updated_at: nowIso() } as const;
        await db.registrations.update(existing.id, patch);
        await db.outbox.add({
          id: uuidv4(), table: "registrations", op: "rpc_register",
          payload: { event_id: activity.id, participant_id: participant.id, payment_amount: activity.priceEUR || 0 }, created_at: nowIso()
        });
        
        // Intenta sincronizar automáticamente si hay conexión
        if (typeof document !== "undefined") {
          try { document.dispatchEvent(new CustomEvent('outbox-changed')); } catch {}
        }
        // If no session, mark the registration pending_auth locally
        const sessionNow = await getSessionInfo();
        if (!sessionNow.userId) {
          await db.registrations.update(existing.id, { pending_auth: true } as any);
        }
        // Disparar sync en background si hay conexión
        if (typeof navigator !== "undefined" && navigator.onLine) void syncAll();
      }
      return existing.id;
    }

  const registration: any = {
      id: uuidv4(),
      event_id: activity.id,
      participant_id: participant.id,
      participant_name: participant.display_name,
      // quien crea la inscripción es el usuario en sesión
      created_by_user_id: currentUserId || participant.owner_user_id,
      // si se registra como organizador, confirmamos y eximimos pago
      payment_status: opts?.asOrganizer ? ("waived" as const) : ("pending" as const),
      payment_amount: opts?.asOrganizer ? 0 : (activity.priceEUR || 0),
      is_confirmed: !!opts?.asOrganizer,
      deleted: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

  // If there is no authenticated session, mark registration pending_auth
  const willPushNow = !!currentUserId;
  if (!willPushNow) registration.pending_auth = true;
  await db.registrations.add(registration);
    await db.outbox.add({
      id: uuidv4(),
      table: "registrations",
      op: "rpc_register",
      payload: { event_id: registration.event_id, participant_id: registration.participant_id, payment_amount: registration.payment_amount ?? 0 },
      created_at: nowIso()
    });
    if (typeof document !== "undefined") {
      try { document.dispatchEvent(new CustomEvent('outbox-changed')); } catch {}
    }
    // Lanzar sync en background si hay conexión
  if (typeof navigator !== "undefined" && navigator.onLine) {
      // If no current user, syncAll will skip pushing outbox; still trigger it
      // so that when auth completes it can retry on 'auth-stable'.
      void syncAll();
    }

    return registration.id;
  }, [isLoading, ensureSelfParticipant]);

  // Listen for auth-stable to attempt re-sync of registrations marked pending_auth
  useEffect(() => {
    const onAuthStable = async () => {
      try {
        // Attempt a sync which will push outbox now that auth should be settled
        await syncAll();
        // Clear pending_auth flags for registrations that were pushed (best-effort)
        // If they still exist in outbox, leave the flag for next attempt.
        const pending = await db.registrations.where('pending_auth').equals(1).toArray();
        for (const r of pending) {
          // check whether there is a matching outbox item for this registration
          const exists = await db.outbox.where('table').equals('registrations').and(o => o.payload && (o.payload.p_participant_id === r.participant_id || o.payload.participant_id === r.participant_id)).first();
          if (!exists) {
            await db.registrations.update(r.id, { pending_auth: false } as any);
          }
        }
      } catch (e) {
        // noop: we'll retry on subsequent auth-stable events
      }
    };
  try { document.addEventListener('auth-stable', onAuthStable); } catch {}
  return () => { try { document.removeEventListener('auth-stable', onAuthStable); } catch {} };
  }, []);

  // 5. Función para borrarse de una actividad
  const leaveActivity = useCallback(async (activity: Activity) => {
    if (isLoading) return;

    const participant = await ensureSelfParticipant();
    if (!participant) return;

    const reg = await db.registrations
      .where({ event_id: activity.id, participant_id: participant.id, deleted: false })
      .first();

    if (reg) {
      await db.registrations.update(reg.id, { deleted: true, updated_at: nowIso() });
      await db.outbox.add({ id: uuidv4(), table: "registrations", op: "rpc_cancel", payload: { id: reg.id }, created_at: nowIso() });
      
      // Intenta sincronizar automáticamente si hay conexión
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try { await syncAll(); } catch { /* noop */ }
      }
    }
  }, [isLoading, ensureSelfParticipant]);

  // 6. El hook devuelve el estado de carga, los IDs de eventos registrados y las funciones
  return { isLoading, registeredEventIds, joinActivity, leaveActivity };
}