import Dexie, { Table } from "dexie";

/** Gemelo de Supabase + campos locales */
export type Participant = {
  id: string;
  owner_user_id: string;
  display_name: string;
  birth_year?: number;
  notes?: string;
  deleted: boolean;
  created_at: string; // ISO
  updated_at: string; // ISO
};

export type Registration = {
  id: string;
  event_id: string;
  participant_id: string;
  participant_name: string; // denormalizado para UI rápida
  created_by_user_id: string;
  payment_status: "pending" | "paid" | "waived";
  payment_amount?: number;
  payment_method?: "cash" | "bizum" | "other";
  is_confirmed: boolean;
  deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type Outbox = {
  id: string;             // uuid
  table: "participants" | "registrations";
  op: "upsert" | "delete" | "rpc_register" | "rpc_cancel";
  payload: any;           // objeto mínimo para la operación
  created_at: string;
};

export type Kv = { key: string; value: string }; // lastPullAt, etc.

class FiestasDB extends Dexie {
  participants!: Table<Participant, string>;
  registrations!: Table<Registration, string>;
  outbox!: Table<Outbox, string>;
  kv!: Table<Kv, string>;

  constructor() {
    super("fiestas");
    this.version(1).stores({
      participants: "id, owner_user_id, display_name, updated_at, deleted",
      registrations: "id, event_id, participant_id, [event_id+participant_id], created_by_user_id, updated_at, deleted, payment_status",
      outbox: "id, table, op, created_at",
      kv: "key"
    });
  }
}

export const db = new FiestasDB();

/** Util fecha */
export const nowIso = () => new Date().toISOString();

/** KV helpers */
export async function kvGet(key: string) {
  return (await db.kv.get(key))?.value ?? null;
}
export async function kvSet(key: string, value: string) {
  await db.kv.put({ key, value });
}