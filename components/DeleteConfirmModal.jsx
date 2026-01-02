// ============================================
// components/DeleteConfirmModal.jsx
// ============================================
import React from "react";

const DeleteConfirmModal = ({ isAll, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-red-500 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4 text-red-400">Confirm Delete</h3>
        <p className="mb-6 text-gray-300">
          {isAll
            ? "Delete ALL seasons? This cannot be undone!"
            : "Delete this season?"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
