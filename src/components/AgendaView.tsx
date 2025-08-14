import { useState } from "react";
import { useActivities } from "../hooks/useActivities";
import { DayAgenda } from "./DayAgenda";
import { ActivityModal } from "./ActivityModal";
import { Activity } from "../types";

export function AgendaView() {
  const [selected, setSelected] = useState<Activity | null>(null);
  const acts = useActivities();
  const days = [...new Set(acts.map(a => a.relativeDay).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {days.map(day => (
        <DayAgenda
          key={day}
          day={day}
          activities={acts.filter(a => a.relativeDay === day)}
          onSelect={setSelected}
        />
      ))}
      {selected && <ActivityModal activity={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}