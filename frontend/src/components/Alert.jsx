import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function Alert({ alert, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  if (!alert) return null;

  return (
    <div className={`alert-banner ${alert.type === 'success' ? 'alert-success' : 'alert-error'}`}>
      {alert.type === 'success' ? (
        <CheckCircle size={20} />
      ) : (
        <AlertTriangle size={20} />
      )}
      <span>{alert.message}</span>
    </div>
  );
}
