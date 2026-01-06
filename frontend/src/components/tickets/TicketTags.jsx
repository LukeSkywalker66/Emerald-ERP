import { useEffect, useState } from 'react';
import { X, Plus, Search, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { assignTagToTicket, getTags, removeTagFromTicket } from '@/services/tickets.service';

export default function TicketTags({ ticket, onTagsChanged, disabled = false }) {
  const [allTags, setAllTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const assignedTagIds = ticket?.tags?.map((t) => t.id) || [];

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const tags = await getTags(true);
      setAllTags(tags);
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };

  const availableTags = allTags.filter(
    (tag) =>
      !assignedTagIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssignTag = async (tagId) => {
    if (disabled || isLoading) return;
    setIsLoading(true);
    try {
      const response = await assignTagToTicket(ticket.id, tagId);
      onTagsChanged?.(response.tags || []);
      setSearchTerm('');
      setIsPopoverOpen(false);
    } catch (err) {
      console.error('Error assigning tag:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (disabled || isLoading) return;
    setIsLoading(true);
    try {
      const response = await removeTagFromTicket(ticket.id, tagId);
      onTagsChanged?.(response.tags || []);
    } catch (err) {
      console.error('Error removing tag:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const pillClasses = (color = 'emerald') => {
    const map = {
      emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
      red: 'bg-red-500/10 border-red-500/20 text-red-300',
      ruby: 'bg-red-500/10 border-red-500/20 text-red-300',
      gold: 'bg-amber-500/10 border-amber-500/20 text-amber-200',
      blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
      purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
      cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200',
      teal: 'bg-teal-500/10 border-teal-500/20 text-teal-200',
      pink: 'bg-pink-500/10 border-pink-500/20 text-pink-200',
      gray: 'bg-gray-500/10 border-gray-500/20 text-gray-200',
      zinc: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-200',
    };
    return map[color.toLowerCase()] || map.emerald;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-200 font-semibold">
          <TagIcon className="w-4 h-4" />
          Etiquetas
        </div>
        {!disabled && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-zinc-900 border border-zinc-800 shadow-lg">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Buscar etiqueta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 bg-zinc-950 border-zinc-800 text-sm text-white"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {availableTags.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-2">
                    {allTags.length === assignedTagIds.length ? 'Todas asignadas' : 'Sin coincidencias'}
                  </p>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleAssignTag(tag.id)}
                      disabled={isLoading}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-xs font-medium border transition ${pillClasses(
                        tag.color
                      )} hover:opacity-80 disabled:opacity-50`}
                    >
                      {tag.name}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(ticket?.tags || []).length === 0 && <p className="text-xs text-zinc-500 italic">Sin etiquetas</p>}
        {ticket?.tags?.map((tag) => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${pillClasses(
              tag.color
            )}`}
          >
            {tag.name}
            {!disabled && (
              <button
                onClick={() => handleRemoveTag(tag.id)}
                disabled={isLoading}
                className="p-0.5 rounded-full hover:bg-white/10 transition disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
