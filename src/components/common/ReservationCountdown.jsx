import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function ReservationCountdown({ expiresAt, compact = false }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft(0);
        return;
      }
      setTimeLeft(diffMs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  if (timeLeft === 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        <AlertTriangle size={11} />
        Expired (Releasing...)
      </span>
    );
  }

  if (timeLeft === null) return null;

  const totalSeconds = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = minutes < 5;

  if (compact) {
    return (
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 700,
          color: isUrgent ? '#f87171' : '#fbbf24',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Clock size={11} />
        {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        border: `1px solid ${isUrgent ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
        color: isUrgent ? '#f87171' : '#fbbf24',
        fontSize: 11.5,
        fontWeight: 700,
      }}
    >
      <Clock size={12} />
      <span>
        Hold: {minutes}m {seconds < 10 ? `0${seconds}` : seconds}s left
      </span>
    </div>
  );
}
