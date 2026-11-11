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
          backgroundColor: 'var(--status-faulty-bg)',
          border: '1px solid var(--status-faulty-border)',
          color: 'var(--status-faulty)',
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
          color: isUrgent ? 'var(--status-faulty)' : 'var(--status-reserved)',
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
        backgroundColor: isUrgent ? 'var(--status-faulty-bg)' : 'var(--status-reserved-bg)',
        border: `1px solid ${isUrgent ? 'var(--status-faulty-border)' : 'var(--status-reserved-border)'}`,
        color: isUrgent ? 'var(--status-faulty)' : 'var(--status-reserved)',
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
