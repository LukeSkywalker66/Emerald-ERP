import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

/**
 * Dialog - Componente modal estilo Shadcn para Emerald Orchestrator
 * Utiliza React Context + Portals para manejo de estado.
 * Renderiza mediante createPortal para evitar problemas de stacking context
 * con otros componentes porteados (ej. Radix Sheet).
 */

const DialogContext = React.createContext();

export function Dialog({ open = false, onOpenChange, children, portal = true }) {
  const [isOpen, setIsOpen] = useState(open);
  const [interactOutsideHandler, setInteractOutsideHandler] = useState(null);
  const [escapeKeyHandler, setEscapeKeyHandler] = useState(null);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const handleOpenChange = (newState) => {
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const handleOutsideClick = useCallback(() => {
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };

    interactOutsideHandler?.(event);

    if (!event.defaultPrevented) {
      handleOpenChange(false);
    }
  }, [interactOutsideHandler]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;

      const customEvent = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };

      escapeKeyHandler?.(customEvent);

      if (!customEvent.defaultPrevented) {
        handleOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, escapeKeyHandler]);

  return (
    <DialogContext.Provider
      value={{
        open: isOpen,
        onOpenChange: handleOpenChange,
        setInteractOutsideHandler,
        setEscapeKeyHandler,
      }}
    >
      {/*
        portal=true (default): render via createPortal to document.body
        portal=false: render in-place with z-[100] (for use inside Radix Sheet)
      */}
      {isOpen &&
        (portal
          ? ReactDOM.createPortal(
              <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm pointer-events-none">
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-auto">
                  <div
                    onClick={handleOutsideClick}
                    className="absolute inset-0"
                  ></div>
                  {children}
                </div>
              </div>,
              document.body
            )
          : (
              <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm pointer-events-none">
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
                  <div
                    onClick={handleOutsideClick}
                    className="absolute inset-0"
                  ></div>
                  {children}
                </div>
              </div>
            )
        )}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  children,
  className = '',
  onInteractOutside,
  onEscapeKeyDown,
}) {
  const context = React.useContext(DialogContext);

  useEffect(() => {
    context?.setInteractOutsideHandler?.(() => onInteractOutside || null);
    return () => {
      context?.setInteractOutsideHandler?.(() => null);
    };
  }, [context, onInteractOutside]);

  useEffect(() => {
    context?.setEscapeKeyHandler?.(() => onEscapeKeyDown || null);
    return () => {
      context?.setEscapeKeyHandler?.(() => null);
    };
  }, [context, onEscapeKeyDown]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative z-[60] w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-lg ${className}`}
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
