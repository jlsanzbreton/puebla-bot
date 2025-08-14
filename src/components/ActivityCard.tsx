import { Calendar, MapPin, User } from "lucide-react";
import { cn } from "../utils/cn";
import { Activity } from "../types";

const categoryColors: Record<string, string> = {
  gastronomía: "bg-orange-200 border-orange-300",
  ruta: "bg-green-200 border-green-300",
  "infantil-familiar": "bg-yellow-200 border-yellow-300",
  torneo: "bg-blue-200 border-blue-300",
  música: "bg-purple-200 border-purple-300",
  religioso: "bg-amber-200 border-amber-300",
  acto: "bg-gray-200 border-gray-300",
  cultura: "bg-pink-200 border-pink-300",
  bienestar: "bg-emerald-200 border-emerald-300",
  taller: "bg-indigo-200 border-indigo-300",
  juego: "bg-cyan-200 border-cyan-300",
  tradición: "bg-stone-200 border-stone-300",
  mercadillo: "bg-rose-200 border-rose-300"
};

interface ActivityCardProps {
  activity: Activity;
  onClick: () => void;
  isCompact?: boolean;
}

export function ActivityCard({ activity, onClick, isCompact = false }: ActivityCardProps) {
  const categoryStyle = categoryColors[activity.category] || "bg-slate-200 border-slate-300";
  
  return (
    <div
      className={cn(
        "rounded-lg border-2 shadow cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]",
        isCompact ? "p-3" : "p-4",
        categoryStyle
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className={cn(
          "font-bold text-gray-800 leading-tight",
          isCompact ? "text-sm" : "text-base"
        )}>
          {activity.shortName || activity.title}
        </h3>
        <div className={cn(
          isCompact ? "text-base" : "text-xl"
        )}>👣</div>
      </div>
      
      <div className={cn(
        "space-y-1 text-gray-700",
        isCompact ? "text-xs" : "text-sm"
      )}>
        {!isCompact && (
          <div className="flex items-center gap-2">
            <Calendar size={14} /> 
            <span>{activity.time}</span>
          </div>
        )}
        
        {activity.location && (
          <div className="flex items-center gap-2">
            <MapPin size={isCompact ? 12 : 14} /> 
            <span>{activity.location}</span>
          </div>
        )}
        
        {activity.host && !isCompact && (
          <div className="flex items-center gap-2">
            <User size={14} /> 
            <span>{activity.host}</span>
          </div>
        )}
        
        {activity.priceEUR && (
          <div className="text-green-700 font-semibold">
            {activity.priceEUR}€
          </div>
        )}
      </div>
    </div>
  );
}
