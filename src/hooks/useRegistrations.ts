import { useLiveQuery } from "dexie-react-hooks";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { db, nowIso, Participant } from "../db/fiestas.db";
import { Activity } from "../types";
import { getSessionInfo } from "../core/auth";

// Hook para gestionar las inscripciones a actividades
export function useRegistrations() {
  // 1. Obtenemos las inscripciones del usuario actual en tiempo real desde Dexie
  const registrations = useLiveQuery(() => db.registrations.toArray(), []);

  const isLoading = registrations === undefined;

  // 2. Creamos un conjunto con los IDs de los eventos a los que el usuario está apuntado
  const registeredEventIds = new Set(
    (registrations || [])
      .filter(r => !r.deleted)
      .map(r => r.event_id)
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
  const joinActivity = useCallback(async (activity: Activity) => {
    if (isLoading) return;

    const participant = await ensureSelfParticipant();
    if (!participant) {
      console.error("No se pudo obtener la información del participante para la inscripción.");
      alert("Error: No se pudo identificar al usuario para la inscripción.");
      return;
    }

    const registration = {
      id: uuidv4(),
      event_id: activity.id,
      participant_id: participant.id,
      participant_name: participant.display_name,
      created_by_user_id: participant.owner_user_id,
      payment_status: "pending" as const,
      payment_amount: activity.priceEUR || 0,
      is_confirmed: false,
      deleted: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    await db.registrations.add(registration);
    await db.outbox.add({ id: uuidv4(), table: "registrations", op: "upsert", payload: registration, created_at: nowIso() });
  }, [isLoading, ensureSelfParticipant]);

  // 5. Función para borrarse de una actividad
  const leaveActivity = useCallback(async (activity: Activity) => {
    if (isLoading) return;
    const reg = await db.registrations.where({ event_id: activity.id }).first();
    if (reg) {
      await db.registrations.update(reg.id, { deleted: true, updated_at: nowIso() });
      await db.outbox.add({ id: uuidv4(), table: "registrations", op: "rpc_cancel", payload: { id: reg.id }, created_at: nowIso() });
    }
  }, [isLoading]);

  // 6. El hook devuelve el estado de carga, los IDs de eventos registrados y las funciones
  return { isLoading, registeredEventIds, joinActivity, leaveActivity };
}