import { ActivityCard } from "./ActivityCard";
import { Activity } from "../types";

interface DayAgendaProps {
  day: string;
  activities: Activity[];
  onSelect: (activity: Activity) => void;
}

export function DayAgenda({ day, activities, onSelect }: DayAgendaProps) {
  // Separar actividades por sesión (con fallback por hora si faltara)
  const toSession = (a: Activity): "mañana" | "tarde" | "noche" => {
    if (a.session) return a.session;
    const hour = parseInt(a.time.split(':')[0]);
    if (hour < 14 && hour >= 5) return "mañana";
    if (hour >= 14 && hour < 20) return "tarde";
    return "noche";
  };

  const morningActivities = activities.filter(a => toSession(a) === "mañana");
  const afternoonActivities = activities.filter(a => toSession(a) === "tarde");
  const nightActivities = activities.filter(a => toSession(a) === "noche");

  // Agrupar actividades por hora
  const groupByTime = (activities: Activity[]) => {
    const grouped: Record<string, Activity[]> = {};
    activities.forEach(activity => {
      const time = activity.time;
      if (!grouped[time]) {
        grouped[time] = [];
      }
      grouped[time].push(activity);
    });
    return grouped;
  };

  const morningByTime = groupByTime(morningActivities);
  const afternoonByTime = groupByTime(afternoonActivities);
  const nightByTime = groupByTime(nightActivities);

  // Componente para renderizar un grupo de actividades por hora
  const TimeGroup = ({ time, activities }: { time: string; activities: Activity[] }) => {
    const isMultiple = activities.length > 1;
    
    return (
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-600 mb-2">{time}</div>
        <div className={`grid gap-2 ${isMultiple ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {activities.map((activity) => (
            <ActivityCard 
              key={activity.id} 
              activity={activity} 
              onClick={() => onSelect(activity)}
              isCompact={isMultiple}
            />
          ))}
        </div>
      </div>
    );
  };

  // Obtener número del día y mes para mostrar (extraído del label "jueves · 21 Agosto" o similar)
  const { number: dayNumber, monthAbbr } = getDayNumberAndMonth(day);
  
  return (
    <div className="mb-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header del día */}
  <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{dayNumber}</div>
    <div className="text-sm opacity-90">{monthAbbr}</div>
          </div>
          <div>
            <h2 className="text-2xl font-bold capitalize">{day}</h2>
            <div className="text-sm opacity-90">
              {activities.length} actividad{activities.length !== 1 ? 'es' : ''}
            </div>
          </div>
        </div>
      </div>
      
      {/* Contenido del día */}
      <div className="p-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Mañana */}
          {Object.keys(morningByTime).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                🌅 Mañana
              </h3>
              <div className="space-y-4">
                {Object.entries(morningByTime)
                  .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
                  .map(([time, timeActivities]) => (
                    <TimeGroup key={time} time={time} activities={timeActivities} />
                  ))}
              </div>
            </div>
          )}
          
          {/* Tarde */}
          {Object.keys(afternoonByTime).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                🌇 Tarde
              </h3>
              <div className="space-y-4">
                {Object.entries(afternoonByTime)
                  .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
                  .map(([time, timeActivities]) => (
                    <TimeGroup key={time} time={time} activities={timeActivities} />
                  ))}
              </div>
            </div>
          )}

          {/* Noche */}
          {Object.keys(nightByTime).length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                🌃 Noche
              </h3>
              <div className="space-y-4">
                {Object.entries(nightByTime)
                  .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
                  .map(([time, timeActivities]) => (
                    <TimeGroup key={time} time={time} activities={timeActivities} />
                  ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Si no hay actividades */}
        {activities.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay actividades programadas para este día
          </div>
        )}
      </div>
    </div>
  );
}

// Helper para obtener número y mes desde una etiqueta "<relDay> · <DD Mes>"
function getDayNumberAndMonth(label: string): { number: string; monthAbbr: string } {
  const parts = label.split("·").map(s => s.trim());
  const monthDay = parts[1] || parts[0] || ""; // puede venir sólo el monthDay
  const m = monthDay.match(/(\d{1,2})\s+(\p{L}+)/u);
  const num = m?.[1] || "?";
  const mon = (m?.[2] || "").toLowerCase();
  const abbrMap: Record<string, string> = {
    "enero": "ENE", "febrero": "FEB", "marzo": "MAR", "abril": "ABR",
    "mayo": "MAY", "junio": "JUN", "julio": "JUL", "agosto": "AGO",
    "septiembre": "SEP", "octubre": "OCT", "noviembre": "NOV", "diciembre": "DIC"
  };
  return { number: num, monthAbbr: abbrMap[mon] || mon.slice(0,3).toUpperCase() || "" };
}
