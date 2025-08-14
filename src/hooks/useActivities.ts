import events from "../../content/events.json";
import kb from "../../content/kb-pack.json";
import { Activity, EventExtra, KbPack } from "../types";

export function useActivities(): Activity[] {
  const typedKb = kb as KbPack;
  const extrasMap = new Map(typedKb.eventsExtra.map((e: EventExtra) => [e.eventId, e]));
  const monthFallback: Record<string, string> = {
    "jueves": "21 Agosto",
    "viernes": "22 Agosto",
    "sábado": "23 Agosto",
    "sabado": "23 Agosto",
    "domingo": "24 Agosto",
  };
  const inferSession = (time?: string): "mañana" | "tarde" | "noche" => {
    if (!time) return "mañana";
    const [hStr] = time.split(":");
    const h = parseInt(hStr || "0", 10);
    if (h < 14 && h >= 5) return "mañana";
    if (h >= 14 && h < 20) return "tarde";
    // 20–23 y 0–4 → noche
    return "noche";
  };
  
  return events.map(ev => {
    const extra = extrasMap.get(ev.id);
    const session = (ev as any).session as "mañana" | "tarde" | "noche" | undefined;
    const normalized: Activity = {
      ...ev,
      monthDay: ev.monthDay || monthFallback[(ev.relativeDay || "").toLowerCase()] || ev.monthDay,
      session: session || inferSession(ev.time),
      shortName: extra?.shortName || ev.title.split(' ')[0],
      description: extra?.desc || "",
      isRegistered: false,
    } as Activity;
    return normalized;
  });
}