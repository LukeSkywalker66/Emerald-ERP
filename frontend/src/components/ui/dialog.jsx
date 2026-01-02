import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Dialog - Componente modal estilo Shadcn para Emerald Orchestrator
 * Utiliza React Context + Portals para manejo de estado
 */

const DialogContext = React.createContext();

export function Dialog({ open = false, onOpenChange, children }) {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const handleOpenChange = (newState) => {
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  return (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              onClick={() => handleOpenChange(false)}
              className="absolute inset-0"
            ></div>
            {children}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function DialogContent({ children, className = '' }) {
  const context = React.useContext(DialogContext);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative z-50 w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className = '' }) {
  return (
    <div className={`mb-4 flex items-start justify-between ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = '' }) {
  return (
    <h2 className={`text-lg font-semibold text-white ${className}`}>
      {children}
    </h2>
  );
}

export function DialogFooter({ children, className = '' }) {
  return (
    <div
      className={`mt-6 flex items-center justify-end gap-2 border-t border-zinc-800 pt-4 ${className}`}
    >
      {children}
    </div>
  );
}
