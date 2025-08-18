import { db, Participant, Registration, nowIso } from "../db/fiestas.db";
import { supa } from "../core/api/supabase";
import { syncAll } from "../core/sync/sync";
import { getSessionInfo, signInWithMagic, signOut } from "../core/auth";
import React from "react";
import { createRoot } from "react-dom/client";
import { AgendaView } from "../components/AgendaView";
import { v4 as uuidv4 } from "uuid";

type Role = "admin" | "user";
type Session = { userId: string; role: Role; displayName: string };

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

  // --- CORRECCIÓN APLICADA AQUÍ ---
  // Se asegura de que el participante existe en Dexie antes de renderizar React.
  try {
    const existingParticipant = await db.participants.where({ owner_user_id: session.userId }).first();
    if (!existingParticipant) {
      const newParticipant: Participant = {
        id: uuidv4(), // Usamos uuid para generar un ID único
        owner_user_id: session.userId,
        display_name: session.displayName,
        deleted: false,
        created_at: nowIso(),
        updated_at: nowIso()
      };
      await db.participants.add(newParticipant);
      // Añadimos la operación a la outbox para sincronizar con Supabase
      await db.outbox.add({ id: uuidv4(), table: "participants", op: "upsert", payload: newParticipant, created_at: nowIso() });
    }
  } catch (e) {
    console.error("Error al asegurar el participante en Dexie:", e);
    // Si falla la escritura en la BD, no continuamos para evitar más errores.
    root.innerHTML = `<div class="p-4 text-red-500">Error crítico al inicializar la base de datos local.</div>`;
    return;
  }
  // --- FIN DE LA CORRECCIÓN ---

  root.innerHTML = layoutHTML(session);
  
  // Pequeño delay para asegurar que el DOM esté listo
  await new Promise(resolve => setTimeout(resolve, 10));
  
  await renderAgenda();
  await renderMyRegs(session);
  wireOutboxBadge();
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
    <span id="outbox-badge" class="badge" title="Operaciones pendientes">0</span>
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

async function countPendingOutbox(): Promise<number> {
  try {
    return await db.outbox.count();
  } catch { return 0; }
}

function wireOutboxBadge() {
  const el = document.getElementById('outbox-badge');
  if (!el) return;
  const update = async () => { const n = await countPendingOutbox(); el.textContent = String(n); el.classList.toggle('warn', n>0); };
  update();
  document.addEventListener('outbox-changed', update);
}

async function renderAgenda() {
  const el = document.getElementById("agenda-list");
  if (!el) {
    console.warn("Element #agenda-list not found, skipping renderAgenda");
    return;
  }
  el.innerHTML = "";
  const reactContainer = document.createElement("div");
  el.appendChild(reactContainer);
  const root = createRoot(reactContainer);
  root.render(React.createElement(AgendaView));
}

/* ---------- Mis inscripciones ---------- */
async function renderMyRegs(session: Session) {
  const el = document.getElementById("myregs");
  if (!el) {
    console.warn("Element #myregs not found, skipping renderMyRegs");
    return;
  }
  
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
  const el = document.getElementById("adminpanel");
  if (!el) {
    console.warn("Element #adminpanel not found, skipping renderAdminPanel");
    return;
  }
  
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
        const { error } = await supa.rpc("api_mark_paid", { p_registration_id: regId, p_method: "cash", p_amount: null });
        if (error) { alert("Error marcando pagado: " + error.message); return; }
        await syncAll();
        await renderAdminPanel(session);
      });
    });
  });
}

/* ---------- Participants & Registrations (Dexie) ---------- */

async function cancelRegistrationLocal(regId: string) {
  const row = await db.registrations.get(regId);
  if (!row) return;
  row.deleted = true;
  row.updated_at = nowIso();
  await db.registrations.put(row);
  await db.outbox.add({ id: uuidv4(), table: "registrations", op: "rpc_cancel", payload: { id: regId }, created_at: nowIso() });
}

/* ---------- Utils ---------- */
function exportCSV(regs: Registration[]) {
  const head = ["id","event_id","participant_name","payment_status","payment_amount","deleted","created_at","updated_at"];
  const rows = regs.map(r => [r.id, r.event_id, r.participant_name, r.payment_status, r.payment_amount ?? "", r.deleted, r.created_at, r.updated_at]);
  const csv = [head.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mis-inscripciones.csv"; a.click();
}

function escapeHTML(s: string) {
  const htmlEscapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => htmlEscapes[c]);
}