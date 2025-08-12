// Basic PWA app shell with offline-first content pack and a simple keyword "chat".
const VERSION_URL = "content/version.json";
const KB_URL = "content/kb-pack.json";
const SW_URL = "sw.js";

const els = {
  net: document.getElementById("net-status"),
  cver: document.getElementById("content-version"),
  check: document.getElementById("check-updates"),
  badge: document.getElementById("update-available"),
  kb: document.getElementById("kb-summary"),
  result: document.getElementById("result"),
  saveDraft: document.getElementById("save-draft"),
  modeWorkshop: document.getElementById("mode-workshop"),
  modePueblo: document.getElementById("mode-pueblo"),
  sectionWorkshop: document.getElementById("workshop"),
  sectionPueblo: document.getElementById("pueblo"),
  messages: document.getElementById("messages"),
  q: document.getElementById("q"),
  ask: document.getElementById("ask"),
  installControls: document.getElementById("install-controls"),
  installBtn: document.getElementById("install-btn"),
  iosA2HS: document.getElementById("ios-a2hs"),
  iosClose: document.getElementById("close-ios-tip"),
  toggleGlass: document.getElementById("toggle-glass"),
  toggleContrast: document.getElementById("toggle-contrast"),
};

let kb = {version: "—", articles: [], events: [], faqs: [], contacts: []};
let deferredPrompt;

// --- Network status
function updateOnlineStatus() {
  const online = navigator.onLine;
  els.net.textContent = online ? "online" : "offline";
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

// --- Service worker registration (skip on localhost/dev)
const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
if ("serviceWorker" in navigator && !isLocalhost) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(SW_URL);
      // Listen for waiting worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data === "SW_UPDATED") {
          els.badge.classList.remove("hidden");
        }
      });
    } catch(e) {
      console.error("SW registration failed", e);
    }
  });
}

// --- Install prompt (Android/Chromium)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installControls.classList.remove("hidden");
});
if (els.installBtn) {
  els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installControls.classList.add("hidden");
    console.log("Install prompt outcome:", outcome);
  });
}

// --- iOS A2HS tip (Safari)
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
function isInStandaloneMode() {
  return ("standalone" in window.navigator) && window.navigator.standalone;
}
if (isIOS() && !isInStandaloneMode()) {
  els.iosA2HS.classList.remove("hidden");
  els.iosClose.addEventListener("click", () => els.iosA2HS.classList.add("hidden"));
}

// --- Load KB from cache/network
async function loadKB() {
  try {
    const resp = await fetch(KB_URL, { cache: "no-cache" });
    if (!resp.ok) throw new Error("KB fetch failed");
    kb = await resp.json();
    els.cver.textContent = kb.version || "—";
    renderKBSummary();
  } catch {
    // Use cached version via service worker (fetch will fail offline but SW may have cached response)
  const cached = (typeof caches !== "undefined" && caches.match) ? await caches.match(KB_URL) : null;
  if (cached) {
      kb = await cached.json();
      els.cver.textContent = kb.version || "—";
      renderKBSummary();
    } else {
      els.kb.innerHTML = "<div class='item'>Sin contenido local todavía.</div>";
    }
  }
}
function renderKBSummary() {
  const items = [];
  items.push(`<div class="item border-thick"><strong>FAQ:</strong> ${kb.faqs.length}</div>`);
  items.push(`<div class="item border-thick"><strong>Eventos:</strong> ${kb.events.length}</div>`);
  items.push(`<div class="item border-thick"><strong>Artículos:</strong> ${kb.articles.length}</div>`);
  items.push(`<div class="item border-thick"><strong>Contactos:</strong> ${kb.contacts.length}</div>`);
  els.kb.innerHTML = items.join("");
}

// --- Workshop tiles
document.querySelectorAll(".tile").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tile").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.template;
    const tmpl = templates[t] || "";
    document.getElementById("ctx").value = "";
    document.getElementById("goal").value = "";
    document.getElementById("limits").value = "";
    document.getElementById("format").value = "";
    document.getElementById("tone").value = "";
    document.getElementById("result").textContent = tmpl.trim();
  });
});

document.getElementById("generate").addEventListener("click", () => {
  const ctx = document.getElementById("ctx").value.trim();
  const goal = document.getElementById("goal").value.trim();
  const limits = document.getElementById("limits").value.trim();
  const fmt = document.getElementById("format").value.trim();
  const tone = document.getElementById("tone").value.trim();
  const base = document.getElementById("result").textContent || "";
  const out = `# Borrador\n\n## Contexto\n${ctx}\n\n## Objetivo\n${goal}\n\n## Restricciones\n${limits}\n\n## Formato\n${fmt}\n\n## Tono\n${tone}\n\n---\n${base}`;
  els.result.textContent = out;
});

els.saveDraft.addEventListener("click", () => {
  try{
    const drafts = JSON.parse(localStorage.getItem("drafts") || "[]");
    drafts.push({ ts: Date.now(), text: els.result.textContent });
    localStorage.setItem("drafts", JSON.stringify(drafts));
    alert("Borrador guardado localmente.");
  }catch(e){
    alert("No se pudo guardar el borrador.");
  }
});

// --- Mode switch
function setMode(mode) {
  if (mode === "workshop") {
    els.sectionWorkshop.classList.remove("hidden");
    els.sectionPueblo.classList.add("hidden");
    els.modeWorkshop.classList.add("active");
    els.modePueblo.classList.remove("active");
  } else {
    els.sectionWorkshop.classList.add("hidden");
    els.sectionPueblo.classList.remove("hidden");
    els.modeWorkshop.classList.remove("active");
    els.modePueblo.classList.add("active");
  }
}
els.modeWorkshop.addEventListener("click", () => setMode("workshop"));
els.modePueblo.addEventListener("click", () => setMode("pueblo"));

// --- Simple "chat" over KB (keyword search)
function addMsg(text, who="bot") {
  const div = document.createElement("div");
  div.className = "message " + (who === "user" ? "user" : "bot");
  div.textContent = text;
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
}
els.ask.addEventListener("click", ask);
els.q.addEventListener("keydown", (e) => (e.key === "Enter") && ask());
function ask() {
  const text = els.q.value.trim();
  if (!text) return;
  addMsg(text, "user");
  els.q.value = "";
  const ans = searchKB(text);
  addMsg(ans, "bot");
}
function searchKB(q) {
  const query = q.toLowerCase();
  const hits = [];
  const scan = (obj, type, fields) => {
    for (const it of kb[type] || []) {
      const hay = fields.map(f => (it[f]||"").toLowerCase()).join(" ");
      if (hay.includes(query)) hits.push({type, it});
    }
  };
  scan({}, "faqs", ["q","a"]);
  scan({}, "articles", ["title","body"]);
  scan({}, "events", ["title","place","desc"]);
  scan({}, "contacts", ["name","role","phone","hours"]);
  if (!hits.length) return "No encuentro nada en la base local. Si tienes conexión, actualiza contenido.";
  const top = hits.slice(0,3).map(h => {
    if (h.type === "faqs") return `FAQ: ${h.it.q}\n→ ${h.it.a}`;
    if (h.type === "events") return `Evento: ${h.it.title} @ ${h.it.place} (${h.it.date})`;
    if (h.type === "contacts") return `Contacto: ${h.it.name} (${h.it.role}) Tel: ${h.it.phone} Horario: ${h.it.hours}`;
    return `Artículo: ${h.it.title}`;
  }).join("\n\n");
  return top + "\n\n(Fuente: base local v" + (kb.version||"") + ")";
}

// --- Update checker
els.check.addEventListener("click", async () => {
  const v = await fetch(VERSION_URL, {cache: "no-cache"}).then(r => r.json()).catch(()=>null);
  if (!v) return alert("Sin conexión o no se pudo comprobar.");
  const current = kb.version || "0.0.0";
  if (v.version && v.version !== current) {
    els.badge.classList.remove("hidden");
    alert(`Hay nueva versión de contenido (${v.version}). Se actualizará al recargar.`);
  } else {
    alert("Ya tienes la última versión de contenido.");
  }
});

// --- Templates for workshop
const templates = {
  cartel: `## Cartel (evento)
Título: 
Fecha y hora: 
Lugar: 
Descripción breve (máx. 40 palabras):

### Texto del cartel (versión corta)
[Frase pegadiza] — [Qué, cuándo, dónde]. Entrada libre. 
Organiza: [Asociación/Ayto.]

### Texto del cartel (versión larga)
Únete a [evento] el [fecha] en [lugar]. Habrá [actividades]. ¡Te esperamos!`,
  acta: `## Resumen de acta (borrador)
Asunto: 
Fecha: 
Asistentes: 

### Decisiones
- 

### Tareas
- Responsable — Acción — Vencimiento

### Próxima reunión
[fecha] — [hora] — [lugar]`,
  agricultor: `## Plan semanal agricultor (plantilla)
Lunes: 
Martes: 
Miércoles: 
Jueves: 
Viernes: 
Sábado: 
Domingo: 

Checklist: riego, revisión plagas, mantenimiento, pedidos.`,
  faq: `## Nueva FAQ
P: [escribe la pregunta]
R: [respuesta breve y clara]
Fuente: [indica origen si procede]`
};

// Init
loadKB();

// Clear storage
document.getElementById("clear-storage").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const keys = await caches.keys();
    for (const k of keys) await caches.delete(k);
    localStorage.clear();
    alert("Datos locales eliminados. Vuelve a cargar para re-instalar el contenido.");
  } catch (err) {
    alert("No se pudieron borrar los datos locales.");
  }
});

// UI toggles for visual variants
if (els.toggleGlass) {
  els.toggleGlass.addEventListener("click", () => {
    document.body.classList.toggle("theme-glass");
  });
}
if (els.toggleContrast) {
  els.toggleContrast.addEventListener("click", () => {
    document.body.classList.toggle("contrast-high");
  });
}
