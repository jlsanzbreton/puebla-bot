import { useState } from "react";
import { useActivities } from "../hooks/useActivities";
import { DayAgenda } from "./DayAgenda";
import { ActivityModal } from "./ActivityModal";
import { Activity } from "../types";

export function AgendaView() {
  const [selected, setSelected] = useState<Activity | null>(null);
  const acts = useActivities();
  // Agrupar por day real (monthDay + relativeDay como key legible)
  const groups = new Map<string, Activity[]>();
  for (const a of acts) {
    const md = (a.monthDay || "?").trim();
    const rel = (a.relativeDay || "").trim();
    const key = `${md}__${rel}`.replace(/\s+/g, " "); // clave técnica normalizada
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
        // Ordenar por session y hora; 00:xx en 'noche' se considera 24:xx para ir al final
        const ordSession = { "mañana": 0, "tarde": 1, "noche": 2 } as Record<string, number>;
        const timeKey = (it: Activity) => {
          const t = it.time || "00:00";
          if ((it.session || "noche") === "noche" && /^00:\d{2}$/.test(t)) {
            return `24:${t.split(":")[1]}`;
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
            onSelect={setSelected}
          />
        );
      })}
      {selected && <ActivityModal activity={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}