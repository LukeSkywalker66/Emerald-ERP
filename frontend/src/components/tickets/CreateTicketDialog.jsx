/**
 * CreateTicketDialog - Wizard de creación con 5 flujos de negocio
 * Versión mejorada con UI Premium
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import ticketsService from '@/services/tickets.service';

const FLOW_STYLES = {
  technical: {
    icon: Wrench,
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    borderColor: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/60',
    hoverShadow: 'hover:shadow-emerald-500/20',
  },
  installation: {
    icon: Plus,
    bgGradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    borderColor: 'border-blue-500/30',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    hoverBorder: 'hover:border-blue-500/60',
    hoverShadow: 'hover:shadow-blue-500/20',
  },
  withdrawal: {
    icon: Minus,
    bgGradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    borderColor: 'border-rose-500/30',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    hoverBorder: 'hover:border-rose-500/60',
    hoverShadow: 'hover:shadow-rose-500/20',
  },
  relocation: {
    icon: Truck,
    bgGradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    borderColor: 'border-purple-500/30',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    hoverBorder: 'hover:border-purple-500/60',
    hoverShadow: 'hover:shadow-purple-500/20',
  },
  administrative: {
    icon: FileText,
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/30',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    hoverBorder: 'hover:border-amber-500/60',
    hoverShadow: 'hover:shadow-amber-500/20',
  },
};

const resolveFlow = (name = '') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('instal')) return 'installation';
  if (normalized.includes('baja') || normalized.includes('reti')) return 'withdrawal';
  if (normalized.includes('trasl') || normalized.includes('muda')) return 'relocation';
  if (normalized.includes('admin')) return 'administrative';
  return 'technical';
};

export default function CreateTicketDialog({ isOpen, onClose, onSuccess }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadCategories = async () => {
      try {
        setIsLoadingCategories(true);
        setCategoriesError(null);
        const data = await ticketsService.getCategories();
        if (active) setCategories(data);
      } catch (err) {
        if (active) setCategoriesError(err.message || 'No se pudieron cargar las categorías');
      } finally {
        if (active) setIsLoadingCategories(false);
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const categoryCards = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories.map((cat) => {
      const flow = resolveFlow(cat.name);
      const style = FLOW_STYLES[flow] || FLOW_STYLES.technical;
      return { ...cat, flow, style };
    });
  }, [categories]);

  const handleBack = () => {
    setSelectedCategory(null);
  };

  const handleSuccess = (createdTicket) => {
    setSelectedCategory(null);
    onSuccess(createdTicket);
  };

  const renderWizard = () => {
    switch (selectedCategory?.flow) {
      case 'technical':
        return <TechnicalWizard onBack={handleBack} onSuccess={handleSuccess} categoryId={selectedCategory?.id} />;
      case 'installation':
        return <InstallationWizard onBack={handleBack} onSuccess={handleSuccess} categoryId={selectedCategory?.id} />;
      case 'withdrawal':
        return <WithdrawalWizard onBack={handleBack} onSuccess={handleSuccess} categoryId={selectedCategory?.id} />;
      case 'relocation':
        return <RelocationWizard onBack={handleBack} onSuccess={handleSuccess} categoryId={selectedCategory?.id} />;
      case 'administrative':
        return <AdministrativeWizard onBack={handleBack} onSuccess={handleSuccess} categoryId={selectedCategory?.id} />;
      default:
        return null;
    }
  };

  const selectedStyle = selectedCategory?.style;
  const SelectedIcon = selectedStyle?.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl w-full h-auto">
        <DialogHeader className="min-h-[100px]">
          <DialogTitle className="text-white text-2xl flex items-center gap-2">
            {selectedCategory ? (
              <>
                {SelectedIcon ? <SelectedIcon size={24} className={selectedStyle?.iconColor} /> : null}
                {selectedCategory.name}
              </>
            ) : (
              <>
                <Sparkles size={24} className="text-emerald-400" />
                Crear Nuevo Ticket
              </>
            )}
          </DialogTitle>
          {!selectedCategory && (
            <p className="text-sm text-zinc-400 mt-2 h-[48px] flex items-center transition-all duration-200 overflow-hidden">
              {hoveredCategory ? (
                <span className="truncate">
                  <span className="text-emerald-400 font-semibold">{hoveredCategory.name}</span>
                  <span className="text-zinc-500 mx-2">•</span>
                  <span className="text-zinc-300">{hoveredCategory.description}</span>
                </span>
              ) : (
                'Selecciona el tipo de gestión que necesitas realizar'
              )}
            </p>
          )}
        </DialogHeader>

        {!selectedCategory ? (
          // Selector de tipo con UI Premium - grid 4 columnas, tarjetas amplias
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-4">
            {isLoadingCategories && (
              <div className="col-span-4 text-center text-zinc-400 py-8">Consultando al Orquestador...</div>
            )}

            {categoriesError && (
              <div className="col-span-4 p-3 rounded-lg border border-rose-700/50 bg-rose-950/30 text-rose-200 text-sm">
                {categoriesError}
              </div>
            )}

            {!isLoadingCategories && !categoriesError && categoryCards.length === 0 && (
              <div className="col-span-4 text-center text-zinc-400 py-8">No hay categorías disponibles.</div>
            )}

            {categoryCards.map((category) => {
              const { style, id, name, description } = category;
              const Icon = style.icon;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedCategory(category)}
                  onMouseEnter={() => setHoveredCategory(category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`
                    group relative rounded-lg border-2 transition-all duration-300 flex flex-col items-center justify-center
                    h-40 w-full
                    bg-gradient-to-br ${style.bgGradient}
                    ${style.borderColor} ${style.hoverBorder}
                    hover:scale-[1.05] hover:shadow-lg ${style.hoverShadow}
                    active:scale-[0.95]
                    px-4 py-4
                    cursor-pointer
                    gap-2
                  `}
                >
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className={`w-14 h-14 rounded-lg ${style.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Icon size={30} className={style.iconColor} />
                  </div>

                  <h3 className="text-sm font-bold text-white text-center leading-tight w-full break-words hyphens-auto">
                    {name}
                  </h3>

                  <ChevronRight
                    size={16}
                    className={`${style.iconColor} opacity-0 group-hover:opacity-100 transform transition-all absolute bottom-2 right-2`}
                  />
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
