import { Activity } from '../types';

interface ActivityModalProps {
  activity: Activity;
  onClose: () => void;
}

export function ActivityModal({ activity, onClose }: ActivityModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h3 className="font-bold text-xl mb-2">{activity.title}</h3>
        <p className="mb-4">{activity.description || 'Sin descripción disponible'}</p>
        <div className="text-sm text-gray-600 mb-4">
          <p><strong>Hora:</strong> {activity.time}</p>
          {activity.location && <p><strong>Lugar:</strong> {activity.location}</p>}
          {activity.priceEUR && <p><strong>Precio:</strong> {activity.priceEUR}€</p>}
        </div>
        <div className="flex gap-2">
          <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Apuntarme
          </button>
          <button className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
            Borrarme
          </button>
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            .ICS
          </button>
        </div>
        <button className="mt-4 text-sm text-gray-600 underline" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
