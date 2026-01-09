/**
 * CreateTicketDialog - Wizard de creación con 5 flujos de negocio
 * Versión mejorada con UI Premium
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Wrench,
  Plus,
  Minus,
  Truck,
  FileText,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import TechnicalWizard from './wizards/TechnicalWizard';
import InstallationWizard from './wizards/InstallationWizard';
import WithdrawalWizard from './wizards/WithdrawalWizard';
import RelocationWizard from './wizards/RelocationWizard';
import AdministrativeWizard from './wizards/AdministrativeWizard';

const TICKET_TYPES = {
  technical: {
    id: 'technical',
    label: 'Soporte Técnico',
    description: 'Reclamos y reparaciones de servicios activos',
    icon: Wrench,
    color: 'emerald',
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    borderColor: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/60',
    hoverShadow: 'hover:shadow-emerald-500/20',
  },
  installation: {
    id: 'installation',
    label: 'Alta de Servicio',
    description: 'Instalación de nuevas conexiones',
    icon: Plus,
    color: 'blue',
    bgGradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    borderColor: 'border-blue-500/30',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    hoverBorder: 'hover:border-blue-500/60',
    hoverShadow: 'hover:shadow-blue-500/20',
  },
  withdrawal: {
    id: 'withdrawal',
    label: 'Baja de Servicio',
    description: 'Retiro de equipos y cancelación',
    icon: Minus,
    color: 'rose',
    bgGradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    borderColor: 'border-rose-500/30',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    hoverBorder: 'hover:border-rose-500/60',
    hoverShadow: 'hover:shadow-rose-500/20',
  },
  relocation: {
    id: 'relocation',
    label: 'Traslado/Mudanza',
    description: 'Cambio de domicilio del servicio',
    icon: Truck,
    color: 'purple',
    bgGradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    borderColor: 'border-purple-500/30',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    hoverBorder: 'hover:border-purple-500/60',
    hoverShadow: 'hover:shadow-purple-500/20',
  },
  administrative: {
    id: 'administrative',
    label: 'Administrativo',
    description: 'Facturación, datos y cambios de plan',
    icon: FileText,
    color: 'amber',
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/30',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    hoverBorder: 'hover:border-amber-500/60',
    hoverShadow: 'hover:shadow-amber-500/20',
  },
};

export default function CreateTicketDialog({ isOpen, onClose, onSuccess }) {
  const [selectedType, setSelectedType] = useState(null);

  const handleBack = () => {
    setSelectedType(null);
  };

  const handleSuccess = (createdTicket) => {
    setSelectedType(null);
    onSuccess(createdTicket);
  };

  const renderWizard = () => {
    switch (selectedType) {
      case 'technical':
        return <TechnicalWizard onBack={handleBack} onSuccess={handleSuccess} />;
      case 'installation':
        return <InstallationWizard onBack={handleBack} onSuccess={handleSuccess} />;
      case 'withdrawal':
        return <WithdrawalWizard onBack={handleBack} onSuccess={handleSuccess} />;
      case 'relocation':
        return <RelocationWizard onBack={handleBack} onSuccess={handleSuccess} />;
      case 'administrative':
        return <AdministrativeWizard onBack={handleBack} onSuccess={handleSuccess} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            {selectedType ? (
              <>
                {React.createElement(TICKET_TYPES[selectedType].icon, { size: 24, className: TICKET_TYPES[selectedType].iconColor })}
                {TICKET_TYPES[selectedType].label}
              </>
            ) : (
              <>
                <Sparkles size={24} className="text-emerald-400" />
                Crear Nuevo Ticket
              </>
            )}
          </DialogTitle>
          {!selectedType && (
            <p className="text-sm text-zinc-400 mt-2">
              Selecciona el tipo de gestión que necesitas realizar
            </p>
          )}
        </DialogHeader>

        {!selectedType ? (
          // Selector de tipo con UI Premium
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
            {Object.values(TICKET_TYPES).map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`
                    group relative p-6 rounded-xl border-2 transition-all duration-300 text-left
                    bg-gradient-to-br ${type.bgGradient}
                    ${type.borderColor} ${type.hoverBorder}
                    hover:scale-[1.02] hover:shadow-xl ${type.hoverShadow}
                    active:scale-[0.98]
                  `}
                >
                  {/* Glow effect en hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="relative flex flex-col gap-4">
                    {/* Icono con contenedor circular */}
                    <div className={`w-16 h-16 rounded-2xl ${type.iconBg} flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                      <Icon size={32} className={type.iconColor} />
                    </div>

                    {/* Texto */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-opacity-90 transition-colors">
                        {type.label}
                      </h3>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {type.description}
                      </p>
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex justify-end">
                      <ChevronRight
                        size={20}
                        className={`${type.iconColor} opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          // Wizard específico
          <div className="py-4">{renderWizard()}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
