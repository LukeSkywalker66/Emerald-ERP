import { createContext, useContext, useEffect } from 'react';
import React from 'react';

const PopoverContext = createContext({ open: false, onOpenChange: () => {} });

function usePopoverContext() {
  const ctx = useContext(PopoverContext);
  if (!ctx) {
    throw new Error('Popover components must be used within <Popover>');
  }
  return ctx;
}

export function Popover({ open, onOpenChange, children }) {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onOpenChange]);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({ children, asChild = false }) {
  const { open, onOpenChange } = usePopoverContext();
  const handleClick = () => onOpenChange?.(!open);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        handleClick();
      },
    });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

export function PopoverContent({ children, className = '' }) {
  const { open } = usePopoverContext();
  if (!open) return null;
  return (
    <div className={`absolute right-0 mt-2 z-50 ${className}`}>
      {children}
    </div>
  );
}
