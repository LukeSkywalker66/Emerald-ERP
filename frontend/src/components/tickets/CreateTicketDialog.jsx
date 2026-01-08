/**
 * CreateTicketDialog - Wizard de creación con 5 flujos de negocio
 * filepath: frontend/src/components/tickets/CreateTicketDialog.jsx
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
    bgGradient: 'from-emerald-500/10 to-emerald-600/5',
    borderColor: 'border-emerald-500/50',
    iconColor: 'text-emerald-400',
  },
  installation: {
    id: 'installation',
    label: 'Alta de Servicio',
    description: 'Instalación de nuevas conexiones',
    icon: Plus,
    color: 'blue',
    bgGradient: 'from-blue-500/10 to-blue-600/5',
    borderColor: 'border-blue-500/50',
    iconColor: 'text-blue-400',
  },
  withdrawal: {
    id: 'withdrawal',
    label: 'Baja de Servicio',
    description: 'Retiro de equipos y cancelación',
    icon: Minus,
    color: 'rose',
    bgGradient: 'from-rose-500/10 to-rose-600/5',
    borderColor: 'border-rose-500/50',
    iconColor: 'text-rose-400',
  },
  relocation: {
    id: 'relocation',
    label: 'Traslado/Mudanza',
    description: 'Cambio de domicilio del servicio',
    icon: Truck,
    color: 'purple',
    bgGradient: 'from-purple-500/10 to-purple-600/5',
    borderColor: 'border-purple-500/50',
    iconColor: 'text-purple-400',
  },
  administrative: {
    id: 'administrative',
    label: 'Administrativo',
    description: 'Facturación, datos y cambios de plan',
    icon: FileText,
    color: 'amber',
    bgGradient: 'from-amber-500/10 to-amber-600/5',
    borderColor: 'border-amber-500/50',
    iconColor: 'text-amber-400',
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
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            {selectedType ? TICKET_TYPES[selectedType].label : 'Crear Nuevo Ticket'}
          </DialogTitle>
          {!selectedType && (
            <p className="text-sm text-zinc-400 mt-2">
              Selecciona el tipo de gestión que necesitas realizar
            </p>
          )}
        </DialogHeader>

        {!selectedType ? (
          // Selector de tipo
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
            {Object.values(TICKET_TYPES).map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`
                    group p-6 rounded-xl border-2 transition-all text-left
                    bg-gradient-to-br ${type.bgGradient}
                    ${type.borderColor} hover:border-opacity-100 border-opacity-50
                    hover:scale-105 hover:shadow-2xl
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-zinc-900/50 ${type.iconColor}`}>
                      <Icon size={28} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {type.label}
                      </h3>
                      <p className="text-sm text-zinc-400">
                        {type.description}
                      </p>
                    </div>
                    <ChevronRight
                      size={20}
                      className="text-zinc-600 group-hover:text-zinc-400 transition-colors"
                    />
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
