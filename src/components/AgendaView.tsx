import { useState, useMemo } from "react";
import { DayAgenda } from "./DayAgenda";
import { ActivityModal } from "./ActivityModal";
import { Activity, EventExtra, KbPack } from "../types";
import { useRegistrations } from "../hooks/useRegistrations";

// Importamos los datos JSON directamente
import events from "../../content/events.json";
import kb from "../../content/kb-pack.json";

export function AgendaView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedLocalId, setSavedLocalId] = useState<string | null>(null);
  const { isLoading, registeredEventIds, joinActivity, leaveActivity } = useRegistrations();

  // 1. Procesamos la lista de actividades base y la memoizamos.
  // Esto se ejecutará solo una vez.
  const baseActivities = useMemo((): Activity[] => {
    const typedKb = kb as KbPack;
    const extrasMap = new Map(typedKb.eventsExtra.map((e: EventExtra) => [e.eventId, e]));
    
    return (events as Activity[]).map(act => {
      const extra = extrasMap.get(act.id);
      return {
        ...act,
        shortName: extra?.shortName || act.title, // Use title as fallback
        description: extra?.desc || '', // Empty string as fallback
        isRegistered: false, // El estado de registro se añade en el siguiente paso
      };
    });
  }, []);

  // 2. Enriquecemos las actividades con el estado de registro.
  // Esto solo se recalculará si cambian las actividades base o las inscripciones.
  const enrichedActivities = useMemo(() => {
    return baseActivities.map(act => ({
      ...act,
      isRegistered: registeredEventIds.has(act.id),
    }));
  }, [baseActivities, registeredEventIds]);

  // Actividad seleccionada derivada de la lista enriquecida (si cambia el registro, se refleja)
  const selected = useMemo(() => {
    if (!selectedId) return null;
    return enrichedActivities.find(a => a.id === selectedId) || null;
  }, [selectedId, enrichedActivities]);

  if (isLoading) {
    return <div className="text-center p-8">Cargando agenda...</div>;
  }

  // 3. Agrupamos y ordenamos la lista enriquecida y estable.
  const groups = new Map<string, Activity[]>();
  for (const a of enrichedActivities) {
    const md = (a.monthDay || "?").trim();
    const rel = (a.relativeDay || "").trim();
    const key = `${md}__${rel}`.replace(/\s+/g, " ");
    const arr = groups.get(key) || [];
    arr.push(a);
    groups.set(key, arr);
  }

  const dayKeys = Array.from(groups.keys()).sort((ka, kb) => {
    const [mda] = ka.split("__");
    const [mdb] = kb.split("__");
    const num = (s: string) => parseInt((s.match(/\d+/)?.[0] || "0"), 10);
    return num(mda) - num(mdb);
  });

  return (
    <div className="space-y-6">
      {dayKeys.map(key => {
        const [monthDay, rel] = key.split("__");
        const items = groups.get(key) || [];
        const ordSession = { "mañana": 0, "tarde": 1, "noche": 2 } as Record<string, number>;
        const timeKey = (it: Activity) => {
          const t = it.time || "00:00";
          if ((it.session || "noche") === "noche" && /^0[0-4]:\d{2}$/.test(t)) {
            const [hh, mm] = t.split(":");
            return `${parseInt(hh, 10) + 24}:${mm}`;
          }
          return t;
        };
        items.sort((a,b) => (ordSession[a.session || "mañana"] - ordSession[b.session || "mañana"]) || timeKey(a).localeCompare(timeKey(b)));
        const label = rel ? `${rel} · ${monthDay}` : monthDay;
        return (
          <DayAgenda
            key={key}
            day={label}
            activities={items}
            onSelect={(a) => setSelectedId(a.id)}
          />
        );
      })}
      {selected && (
        <ActivityModal
          activity={selected}
          onClose={() => setSelectedId(null)}
          onJoin={async (a, opts) => {
            setBusyId(a.id);
            try {
              const regId = await joinActivity(a, opts as any);
              if (regId) {
                // Mostrar que se guardó localmente para esta actividad
                setSavedLocalId(a.id);
                // limpia el flag después de 4s
                setTimeout(() => setSavedLocalId(null), 4000);
              }
            } finally { setBusyId(null); }
          }}
          onLeave={async (a) => {
            setBusyId(a.id);
            try { await leaveActivity(a); } finally { setBusyId(null); }
          }}
          isJoined={registeredEventIds.has(selected.id)}
          isProcessing={busyId === selected.id}
          isSavedLocal={savedLocalId === selected.id}
        />
      )}
    </div>
  );
}