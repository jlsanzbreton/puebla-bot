// src/components/ActivityModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity } from "../types";
import { useParticipants } from "../hooks/useParticipants";
import { getSessionInfo } from "../core/auth";

interface ActivityModalProps {
  activity: Activity | null;
  onClose: () => void;
  onJoin?: (activity: Activity, opts?: { participantId?: string; asOrganizer?: boolean }) => void;
  onLeave?: (activity: Activity) => void;
  onExportICS?: (activity: Activity) => void;
  isJoined?: boolean;
  isProcessing?: boolean;
  isSavedLocal?: boolean;
}

export function ActivityModal({
  activity,
  onClose,
  onJoin,
  onLeave,
  onExportICS,
  isJoined = false,
  isProcessing = false,
  isSavedLocal = false,
}: ActivityModalProps) {
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [action, setAction] = useState<'self'|'other'|'organizer'>('self');
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSessionInfo();
      setIsAdmin(s.role === 'admin');
    })();
  }, []);

  const { items: myParticipants, addParticipant } = useParticipants(isAdmin ? undefined : undefined);

  const open = !!activity;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setTimeout(() => firstBtnRef.current?.focus(), 0);
  }, [open]);

  if (!open || !activity) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const addAndSelect = async () => {
    const s = await getSessionInfo();
    if (!s.userId) return alert('No session');
    if (!newName.trim()) return alert('Escribe un nombre');
    const p = await addParticipant(s.userId, newName.trim());
    setSelectedParticipant(p.id);
    setNewName('');
    setAction('other');
  };

  const modalContent = (
    <div
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-modal-title"
    >
      <div
        className="relative z-[110] mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 
                   dark:bg-neutral-900 dark:ring-white/10 max-h-[85vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-full p-2 text-neutral-500 hover:bg-neutral-100 
                     hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          ×
        </button>

        <h2
          id="activity-modal-title"
          className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100"
        >
          {activity.title}
        </h2>

        <div className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
          {activity.description && (
            <p className="mb-2 leading-relaxed">{activity.description}</p>
          )}
          {activity.time && (
            <p>
              <strong>Hora:</strong> {activity.time}
            </p>
          )}
          {activity.location && (
            <p>
              <strong>Lugar:</strong> {activity.location}
            </p>
          )}
          {activity.host && (
            <p>
              <strong>Responsable:</strong> {activity.host}
            </p>
          )}
          {activity.priceEUR != null && (
            <p>
              <strong>Precio:</strong> {activity.priceEUR > 0 ? `${activity.priceEUR}€` : 'Gratis'}
            </p>
          )}
          {activity.notes && (
            <p className="pt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {activity.notes}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <div style={{display: 'flex', gap: 8, alignItems: 'center', width: '100%', marginBottom: 8}}>
            <label style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="radio" checked={action==='self'} onChange={() => setAction('self')} /> Yo
            </label>
            <label style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="radio" checked={action==='other'} onChange={() => setAction('other')} /> Otra persona
            </label>
            <label style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="radio" checked={action==='organizer'} onChange={() => setAction('organizer')} disabled={!isAdmin} /> Como organizador
            </label>
          </div>
          {action === 'other' && (
            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
              <select value={selectedParticipant ?? ''} onChange={e => setSelectedParticipant(e.target.value)}>
                <option value="">-- seleccionar --</option>
                {myParticipants.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <input placeholder="Añadir nombre" value={newName} onChange={e => setNewName(e.target.value)} />
              <button onClick={addAndSelect} className="outline small">Añadir</button>
            </div>
          )}
          {!isJoined ? (
            <button
              ref={firstBtnRef}
              onClick={() => onJoin?.(activity, action === 'other' ? { participantId: selectedParticipant ?? undefined } : action === 'organizer' ? { asOrganizer: true } : undefined)}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
        {isProcessing ? "Guardando…" : isSavedLocal ? "Guardado localmente" : "Apuntarme"}
            </button>
          ) : (
            <button
              ref={firstBtnRef}
              onClick={() => onLeave?.(activity)}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 
                         dark:bg-emerald-900/30 dark:text-emerald-300 disabled:opacity-60"
            >
              {isProcessing ? "Quitando…" : "Borrarme"}
            </button>
          )}
          <button
            onClick={() => onExportICS?.(activity)}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700"
          >
            .ICS
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-800 hover:bg-neutral-300 
                       dark:bg-neutral-800 dark:text-neutral-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}