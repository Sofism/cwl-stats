// ============================================
// components/DeleteConfirmModal.jsx
// ============================================
import React from "react";

const DeleteConfirmModal = ({ isAll, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-surface-950 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-800 border border-bad-400/40 rounded-md p-6 max-w-md w-full">
        <h3 className="text-xl font-semibold mb-4 text-bad-400">Confirm Delete</h3>
        <p className="mb-6 text-txt-mid">
          {isAll
            ? "Delete ALL seasons? This cannot be undone!"
            : "Delete this season?"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
 className="flex-1 bg-bad-900 hover:bg-bad-900 text-txt-hi font-semibold py-2 rounded transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
 className="flex-1 bg-surface-700 hover:bg-surface-700 text-txt-hi font-semibold py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
