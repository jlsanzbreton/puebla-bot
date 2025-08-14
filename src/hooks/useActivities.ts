import events from "../../content/events.json";
import kb from "../../content/kb-pack.json";
import { Activity, EventExtra, KbPack } from "../types";

export function useActivities(): Activity[] {
  const typedKb = kb as KbPack;
  const extrasMap = new Map(typedKb.eventsExtra.map((e: EventExtra) => [e.eventId, e]));
  
  return events.map(ev => {
    const extra = extrasMap.get(ev.id);
    const session = ev.session as "mañana" | "tarde" | "noche" | undefined;
    return {
      ...ev,
      session,
      shortName: extra?.shortName || ev.title.split(' ')[0].toLowerCase(),
      description: extra?.desc || "",
      isRegistered: false // Por defecto no registrado
    };
  });
}