/**
 * Avatar.jsx
 * 
 * Componente reutilizable para mostrar avatares de usuarios.
 * Muestra imagen si está disponible, sino las iniciales del nombre.
 * 
 * Tamaños: xs, sm, md, lg, xl
 */

import React from 'react';

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
};

const Avatar = ({
  name = 'Usuario',
  email = '',
  image = null,
  size = 'md',
  className = '',
  variant = 'emerald', // emerald, amber, ruby, zinc
}) => {
  const variantClasses = {
    emerald: 'bg-emerald-600/20 border-emerald-600/40 text-emerald-300',
    amber: 'bg-amber-600/20 border-amber-600/40 text-amber-300',
    ruby: 'bg-ruby-600/20 border-ruby-600/40 text-ruby-300',
    zinc: 'bg-zinc-700/40 border-zinc-600/40 text-zinc-300',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const variantClass = variantClasses[variant] || variantClasses.emerald;

  return (
    <div
      className={`
        ${sizeClass}
        ${variantClass}
        rounded-full
        border
        flex items-center justify-center
        flex-shrink-0
        font-bold
        transition-all
        ${className}
      `}
      title={`${name}${email ? ` (${email})` : ''}`}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export default Avatar;
