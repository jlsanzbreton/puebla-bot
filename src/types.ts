export interface Activity {
  id: string;
  shortName: string; // p.ej. "paseo"
  title: string;
  time: string;
  location?: string;
  category: string;
  priceEUR?: number;
  description?: string;
  isRegistered?: boolean;
  relativeDay?: string;
  monthDay?: string;
  session?: "mañana" | "tarde" | "noche";
  host?: string;
  notes?: string;
  endTime?: string;
  notifyMinutesBefore?: number;
}

export interface ActivityCardProps {
  id: string;
  shortName: string; // p.ej. "paseo"
  title: string;
  time: string;
  location?: string;
  category: string;
  priceEUR?: number;
  description?: string;
  isRegistered?: boolean;
  onRegister?: () => void;
  onUnregister?: () => void;
  onDownloadIcs?: () => void;
}

export interface EventExtra {
  eventId: string;
  desc: string;
  shortName?: string;
}

export interface KbPack {
  version: string;
  eventsExtra: EventExtra[];
  faqs: Array<{ q: string; a: string; }>;
  articles: Array<{ title: string; body: string; }>;
  contacts: Array<{ name: string; role: string; phone: string; hours: string; }>;
}
