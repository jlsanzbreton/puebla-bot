import { db, Participant, Registration, nowIso } from "../db/fiestas.db";
import { supa } from "../core/api/supabase";
import { syncAll } from "../core/sync/sync";
import { getSessionInfo, signInWithMagic, signOut } from "../core/auth";

type Role = "admin" | "user";
type Session = { userId: string; role: Role; displayName: string };

type EventCore = {
  id: string; title: string; startsAt?: string; endsAt?: string;
  relativeDay?: string; time?: string; location?: string;
  priceEUR?: number; notifyMinutesBefore?: number;
};

type KbPack = { events: EventCore[] };

export async function mountFiestasPage(root: HTMLElement) {
  // -------- AUTH GATE ----------
  const ses = await getSessionInfo();
  if (!ses.userId) {
    root.innerHTML = loginHTML();
    wireLogin(root);
    return;
  }

  // sesión válida → perfil/rol real
  const session: Session = {
    userId: ses.userId,
    role: (ses.role ?? "user") as Role,
    displayName: ses.displayName ?? "Yo"
  };

  await ensureSelfParticipant(session);

  const pack: KbPack = await fetch("/content/kb-pack.json").then(r => r.json());

  root.innerHTML = layoutHTML(session);
  await renderAgenda(pack.events, session);
  await renderMyRegs(session);
  await renderAdminPanel(session);

  // tabs
  const tabs = root.querySelectorAll<HTMLButtonElement>("[data-tab]");
  const panes = root.querySelectorAll<HTMLElement>("[data-pane]");
  tabs.forEach(btn => btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.toggle("active", b === btn));
    panes.forEach(p => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
  }));

  // acciones de header
  document.getElementById("btnSync")?.addEventListener("click", async () => {
    await syncAll(); await renderMyRegs(session); alert("Sincronizado");
  });
  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    await signOut(); location.reload();
  });

  // primer sync
  void syncAll().then(() => renderMyRegs(session));
}

/* ---------- UI ---------- */

function loginHTML() {
  return `
    <div class="card" style="max-width:520px;margin:2rem auto;">
      <h2 class="title" style="margin:0 0 .6rem 0;">Accede a Fiestas</h2>
      <p style="opacity:.85;margin:0 0 .8rem 0;">Introduce tu email y te enviaremos un enlace seguro para entrar.</p>
      <div class="form">
        <label for="email">Email</label>
        <input id="email" type="email" placeholder="tu@correo.com" />
      </div>
      <div style="display:flex;gap:.6rem;margin-top:.8rem">
        <button id="btnMagic" class="primary">Recibir enlace</button>
        <button id="btnCancel" class="outline">Cancelar</button>
      </div>
      <p style="opacity:.7;margin-top:.8rem">* Revisa tu bandeja (y spam) y abre el enlace desde este dispositivo.</p>
    </div>
  `;
}

function wireLogin(root: HTMLElement) {
  const email = root.querySelector<HTMLInputElement>("#email")!;
  root.querySelector("#btnMagic")?.addEventListener("click", async () => {
    const val = (email.value || "").trim();
    if (!val) return alert("Escribe un email válido.");
    try {
      await signInWithMagic(val);
      alert("Enlace enviado. Abre el correo para entrar.");
    } catch (e: any) {
      alert("Error: " + (e?.message ?? "no se pudo enviar"));
    }
  });
  root.querySelector("#btnCancel")?.addEventListener("click", () => {
    location.hash = "#/"; // vuelve a otra pestaña
  });
}

function layoutHTML(session: Session) {
  return `
  <div class="card">
    <div class="status" style="gap:.6rem">
      <span class="badge">Hola, ${escapeHTML(session.displayName)} (${session.role})</span>
      <button id="btnSync" class="outline small">Sincronizar</button>
      <button id="btnLogout" class="outline small">Salir</button>
    </div>
  </div>

  <div class="card">
    <div class="mode-switch" style="margin-bottom:.6rem">
      <button data-tab="pane-agenda" class="active">Agenda</button>
      <button data-tab="pane-mis">Mis inscripciones</button>
      <button data-tab="pane-admin">Panel (admin)</button>
    </div>

    <section id="pane-agenda" data-pane>
      <div id="agenda-list" class="grid"></div>
    </section>

    <section id="pane-mis" data-pane class="hidden">
      <div id="myregs"></div>
    </section>

    <section id="pane-admin" data-pane class="hidden">
      <div id="adminpanel"></div>
    </section>
  </div>`;
}

async function renderAgenda(events: EventCore[], session: Session) {
  const el = document.getElementById("agenda-list")!;
  el.innerHTML = events.map(ev => cardEvent(ev)).join("");

  el.querySelectorAll<HTMLButtonElement>("[data-reg]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const eventId = btn.dataset.reg!;
      const participant = await pickParticipant(session);
      if (!participant) return;
      await createRegistrationLocal(eventId, participant, session);
      await syncAll();
      await renderMyRegs(session);
      alert("Apuntado ✅");
    });
  });

  el.querySelectorAll<HTMLAnchorElement>("[data-ics]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const id = (e.currentTarget as HTMLAnchorElement).dataset.ics!;
      const ev = events.find(x => x.id === id)!;
      downloadICS(ev);
    });
  });
}

function cardEvent(ev: EventCore) {
  const when = ev.startsAt
    ? new Date(ev.startsAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })
    : `${ev.relativeDay ?? ""} ${ev.time ?? ""}`.trim();
  const price = ev.priceEUR ? ` · ${ev.priceEUR.toFixed(2)} €` : "";
  return `
  <div class="tile">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <div>
        <div style="font-weight:800">${ev.title}</div>
        <div style="opacity:.8">${when}${price}${ev.location ? " · " + ev.location : ""}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <a href="#" class="outline small" data-ics="${ev.id}">.ics</a>
        <button class="primary small" data-reg="${ev.id}">Apuntarme</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Mis inscripciones ---------- */
async function renderMyRegs(session: Session) {
  const el = document.getElementById("myregs")!;
  const regs = await db.registrations
    .where("created_by_user_id").equals(session.userId)
    .and(r => !r.deleted)
    .toArray();

  if (!regs.length) {
    el.innerHTML = `<div class="kb item">Aún no tienes inscripciones.</div>`;
    return;
  }
  const totals = regs.reduce((acc, r) => {
    const amt = r.payment_amount ?? 0;
    if (r.payment_status === "paid") acc.paid += amt; else acc.due += amt;
    return acc;
  }, { paid: 0, due: 0 });

  el.innerHTML = `
    <div class="status" style="margin-bottom:.5rem">
      <span class="badge">Pagado: ${totals.paid.toFixed(2)} €</span>
      <span class="badge">Pendiente: ${totals.due.toFixed(2)} €</span>
      <button class="outline small" id="btnCSV">Exportar CSV</button>
    </div>
    <div class="kb">
      ${regs.map(r => `
        <div class="item">
          <div style="font-weight:700">${escapeHTML(r.participant_name)}</div>
          <div style="opacity:.8">Evento: ${escapeHTML(r.event_id)}</div>
          <div>Pago: ${r.payment_status}${r.payment_amount ? " · " + r.payment_amount + "€" : ""}</div>
          <div style="display:flex;gap:.5rem;margin-top:.4rem">
            <button class="outline small" data-cancel="${r.id}">Cancelar</button>
          </div>
        </div>`).join("")}
    </div>
  `;

  el.querySelectorAll<HTMLButtonElement>("[data-cancel]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.cancel!;
      await cancelRegistrationLocal(id);
      await syncAll();
      await renderMyRegs(session);
    });
  });
  document.getElementById("btnCSV")?.addEventListener("click", async () => {
    const fresh = await db.registrations.where("created_by_user_id").equals(session.userId).toArray();
    exportCSV(fresh);
  });
}

/* ---------- Admin Panel ---------- */
async function renderAdminPanel(session: Session) {
  const el = document.getElementById("adminpanel")!;
  if (session.role !== "admin") {
    el.innerHTML = `<div class="kb item">Acceso restringido.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="status" style="margin-bottom:.5rem">
      <span class="badge">Admin</span>
      <input id="admEvent" placeholder="ID de evento…" />
      <button class="outline small" id="btnLoad">Cargar inscritos</button>
    </div>
    <div id="admin-table"></div>
  `;
  document.getElementById("btnLoad")?.addEventListener("click", async () => {
    const evId = (document.getElementById("admEvent") as HTMLInputElement).value.trim();
    if (!evId) return;
    await syncAll();
    const data = await db.registrations.where("event_id").equals(evId).and(r => !r.deleted).toArray();
    const tbl = document.getElementById("admin-table")!;
    if (!data.length) { tbl.innerHTML = `<div class="kb item">Sin inscritos aún.</div>`; return; }
    tbl.innerHTML = `
      <div class="kb">
        ${data.map(r => `
          <div class="item">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
              <div>
                <div style="font-weight:700">${escapeHTML(r.participant_name)}</div>
                <div style="opacity:.8">${r.payment_status}${r.payment_amount ? " · " + r.payment_amount + "€" : ""}</div>
              </div>
              <div style="display:flex;gap:.4rem">
                <button class="small outline" data-paid="${r.id}">Marcar pagado</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    tbl.querySelectorAll<HTMLButtonElement>("[data-paid]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const regId = btn.dataset.paid!;
        // Llama RPC (requiere rol admin en tu perfil)
        const { error } = await supa.rpc("api_mark_paid", { p_registration_id: regId, p_method: "cash", p_amount: null });
        if (error) { alert("Error marcando pagado: " + error.message); return; }
        await syncAll();
        await renderAdminPanel(session);
      });
    });
  });
}

/* ---------- Participants & Registrations (Dexie) ---------- */
async function ensureSelfParticipant(session: Session) {
  const me = await db.participants.where({ owner_user_id: session.userId, display_name: session.displayName }).first();
  if (me) return me;
  const p: Participant = {
    id: crypto.randomUUID(),
    owner_user_id: session.userId,
    display_name: session.displayName,
    deleted: false,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  await db.participants.add(p);
  await db.outbox.add({ id: crypto.randomUUID(), table: "participants", op: "upsert", payload: p, created_at: nowIso() });
  return p;
}

async function pickParticipant(session: Session): Promise<Participant | null> {
  const list = await db.participants.where("owner_user_id").equals(session.userId).and(p => !p.deleted).toArray();
  const name = prompt(`¿A quién apuntas?\n${list.map(p => `- ${p.display_name}`).join("\n")}\n\nEscribe nombre para crear nuevo o deja vacío para “${session.displayName}”.`, "");
  if (name === null) return null;
  const trimmed = name.trim();
  if (!trimmed) {
    return (await db.participants.where({ owner_user_id: session.userId, display_name: session.displayName }).first())!;
  }
  const existing = list.find(p => p.display_name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;

  const p: Participant = {
    id: crypto.randomUUID(),
    owner_user_id: session.userId,
    display_name: trimmed,
    deleted: false,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  await db.participants.add(p);
  await db.outbox.add({ id: crypto.randomUUID(), table: "participants", op: "upsert", payload: p, created_at: nowIso() });
  return p;
}

async function createRegistrationLocal(event_id: string, participant: Participant, session: Session) {
  const dup = await db.registrations.where({ event_id, participant_id: participant.id }).first();
  if (dup && !dup.deleted) return;

  const reg: Registration = {
    id: crypto.randomUUID(),
    event_id,
    participant_id: participant.id,
    participant_name: participant.display_name,
    created_by_user_id: session.userId,
    payment_status: "pending",
    payment_amount: undefined,
    payment_method: undefined,
    is_confirmed: true,
    deleted: false,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  await db.registrations.add(reg);
  await db.outbox.add({
    id: crypto.randomUUID(),
    table: "registrations",
    op: "rpc_register",
    payload: { event_id, participant_id: participant.id, payment_amount: reg.payment_amount },
    created_at: nowIso()
  });
}

async function cancelRegistrationLocal(regId: string) {
  const row = await db.registrations.get(regId);
  if (!row) return;
  row.deleted = true;
  row.updated_at = nowIso();
  await db.registrations.put(row);
  await db.outbox.add({ id: crypto.randomUUID(), table: "registrations", op: "rpc_cancel", payload: { id: regId }, created_at: nowIso() });
}

/* ---------- Utils ---------- */
function downloadICS(ev: EventCore) {
  const dt = ev.startsAt ? new Date(ev.startsAt) : new Date();
  const dtEnd = ev.endsAt ? new Date(ev.endsAt) : new Date(dt.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PueblaBot//Fiestas//ES
BEGIN:VEVENT
UID:${ev.id}@puebla-bot
DTSTAMP:${fmt(new Date())}
DTSTART:${fmt(dt)}
DTEND:${fmt(dtEnd)}
SUMMARY:${ev.title}
LOCATION:${ev.location ?? ""}
END:VEVENT
END:VCALENDAR`;
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${ev.id}.ics`; a.click();
}

function exportCSV(regs: Registration[]) {
  const head = ["id","event_id","participant_name","payment_status","payment_amount","deleted","created_at","updated_at"];
  const rows = regs.map(r => [r.id, r.event_id, r.participant_name, r.payment_status, r.payment_amount ?? "", r.deleted, r.created_at, r.updated_at]);
  const csv = [head.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mis-inscripciones.csv"; a.click();
}

function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}