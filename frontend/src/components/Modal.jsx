import { useState } from 'react';

export default function Modal({ title, onClose, children, size = '' }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${size}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onClose, loading }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-secondary" style={{ lineHeight: 1.7 }}>{message}</p>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? '⏳ Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
