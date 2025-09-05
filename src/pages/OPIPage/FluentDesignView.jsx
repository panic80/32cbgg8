import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { forceScrollToTop } from '@/utils/scroll';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { 
  Search, 
  Users, 
  Mail,
  Phone,
  Sparkles,
  ChevronRight,
  User,
  Building2,
  Clock,
  Columns3,
  List
} from 'lucide-react';
import { Crown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Fluent Card Component with Acrylic effect and Reveal highlight
const FluentCardComponent = ({ contact, onClick, delay = 0, type = null }) => {
  const cardRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  
  // Reveal highlight effect
  const revealX = useTransform(mouseX, (value) => value - 150);
  const revealY = useTransform(mouseY, (value) => value - 150);
  
  const handleMouseMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      initial={reducedMotion ? false : { opacity: 0, y: 0 }}
      animate={reducedMotion ? false : { opacity: 1, y: 0 }}
      transition={{ 
        delay,
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      whileHover={reducedMotion ? undefined : { y: -8, transition: { duration: 0.2 } }}
      onMouseEnter={() => !reducedMotion && setIsHovered(true)}
      onMouseLeave={() => !reducedMotion && setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className="relative cursor-pointer"
    >
      {/* Acrylic Card */}
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-[var(--card)]/80",
        "backdrop-blur-xl backdrop-saturate-150",
        "border border-[var(--border)]/30",
        "shadow-lg hover:shadow-2xl transition-shadow duration-300"
      )}>
        {/* Reveal Highlight */}
        <motion.div
          className="absolute inset-0 opacity-0 pointer-events-none"
          style={{
            background: `radial-gradient(300px circle at ${revealX}px ${revealY}px, rgba(var(--primary-rgb), 0.1), transparent)`,
            opacity: isHovered && !reducedMotion ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
        />
        
        {/* Card Content */}
        <div className="relative z-10 p-6 sm:p-8">
          {/* Icon with glow effect */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={reducedMotion ? false : { scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.1 }}
            className="mb-6"
          >
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: type === 'FMC' ? 'var(--warning)' : 'var(--success)'
              }}>
              {type ? (
                <span className="font-bold text-lg text-white">{type}</span>
              ) : (
                <Users className="w-8 h-8 text-white" />
              )}
            </div>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={reducedMotion ? false : { x: -20, opacity: 0 }}
            animate={reducedMotion ? false : { x: 0, opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
          >
            <h3 className="text-xl font-semibold mb-2 text-[var(--text)] flex items-center gap-2">
              {contact.name}
              {contact.isLeadership && (
                <Crown className="w-5 h-5 text-yellow-500" title="Leadership" />
              )}
            </h3>
            <p className="text-[var(--text-secondary)] mb-4">
              {contact.role}
            </p>
          </motion.div>

          {/* Units */}
          {contact.units && contact.units.length > 0 && (
            <motion.div
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={reducedMotion ? false : { opacity: 1 }}
              transition={{ delay: delay + 0.3 }}
              className="flex flex-wrap gap-2 mb-4"
            >
              {contact.units.map((unit, idx) => (
                <Badge 
                  key={idx}
                  variant="secondary"
                  className="backdrop-blur text-base px-4 py-2 font-semibold"
                >
                  {unit}
                </Badge>
              ))}
            </motion.div>
          )}

          {/* Email with hover effect */}
          <motion.a
            href={`mailto:${contact.email}`}
            className={cn(
              "inline-flex items-center gap-2 text-sm",
              "text-[var(--primary)]",
              "hover:text-[var(--primary-hover)]",
              "transition-colors duration-200"
            )}
            whileHover={{ x: 5 }}
          >
              <Mail className="w-4 h-4" />
              <span>{contact.email}</span>
            <ChevronRight className="w-3 h-3" />
          </motion.a>
        </div>

        {/* Depth shadow layers */}
        <div className="absolute inset-x-0 -bottom-1 h-8 bg-black/5 dark:bg-black/10 blur-md transform scale-x-95" />
        <div className="absolute inset-x-0 -bottom-2 h-8 bg-black/3 dark:bg-black/5 blur-lg transform scale-x-90" />
      </div>
    </motion.div>
  );
};
const FluentCard = React.memo(FluentCardComponent);

// Fluent List Component (adopted from original)
const FluentListComponent = ({ contact, delay = 0 }) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, x: -20 }}
      animate={reducedMotion ? false : { opacity: 1, x: 0 }}
      transition={{ delay }}
      className={cn(
        "p-4 rounded-lg",
        "bg-[var(--card)]/60 backdrop-blur-md",
        "hover:bg-[var(--background-secondary)] transition-colors",
        "border-b border-[var(--border)] last:border-0"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="text-base font-semibold mb-1 flex items-center gap-2">
            {contact.name}
            {contact.isLeadership && (
              <Crown className="w-4 h-4 text-yellow-500" title="Leadership" />
            )}
          </h4>
          <p className="text-base text-[var(--text-secondary)]">{contact.role}</p>
          {contact.units && contact.units.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {contact.units.map((unit, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {unit}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <a 
          href={`mailto:${contact.email}`} 
          className="text-base text-[var(--primary)] hover:underline font-medium whitespace-nowrap"
        >
          {contact.email}
        </a>
      </div>
    </motion.div>
  );
};
const FluentList = React.memo(FluentListComponent);

// Fluent Search Bar
const FluentSearchBarComponent = ({ value, onChange, placeholder }) => {
  return (
    <div className="relative">
      <div className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-[var(--card)]/80",
        "backdrop-blur-xl backdrop-saturate-150",
        "border border-[var(--border)]/30",
        "shadow-md hover:shadow-lg transition-all duration-300",
        "focus-within:ring-2 focus-within:ring-[var(--primary)]/50"
      )}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full pl-12 pr-4 py-4",
            "bg-transparent outline-none",
            "text-[var(--text)]",
            "placeholder-[var(--text-secondary)]"
          )}
        />
      </div>
    </div>
  );
};
const FluentSearchBar = React.memo(FluentSearchBarComponent);

// Navigation Pills
const NavigationPillsComponent = ({ activeView, onViewChange }) => {
  const views = useMemo(() => [
    { id: 'all', label: 'All Contacts', icon: Users },
    { id: 'fsc', label: 'FSC', icon: Building2 },
    { id: 'fmc', label: 'FMC', icon: Building2 },
    { id: 'search', label: 'Search Unit', icon: Search }
  ], []);

  return (
    <Tabs value={activeView} onValueChange={onViewChange} className="w-full">
      <TabsList className="grid grid-cols-4 gap-1 md:gap-2 rounded-lg bg-muted p-1 text-muted-foreground w-full mb-6 h-auto items-stretch">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <TabsTrigger
              key={view.id}
              value={view.id}
              className="w-full justify-center whitespace-nowrap font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow flex flex-col items-center gap-1 p-3 text-xs sm:text-sm rounded-md transition-all duration-200 min-h-[64px]"
            >
              <span className="text-lg">
                {/* Use lucide icon as emoji-like visual */}
                <Icon className="w-5 h-5" />
              </span>
              <span className="hidden sm:inline">{view.label}</span>
              <span className="sm:hidden">{view.label.split(' ')[0]}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
};
const NavigationPills = React.memo(NavigationPillsComponent);

export default function FluentDesignView({ 
  unitContacts = {}, 
  fscContacts = [], 
  fmcContacts = [],
  contactView: initialView = 'all',
  selectedUnit = '',
  searchTerm = '',
  setSelectedUnit = () => {},
  setSearchTerm = () => {},
  setContactView = () => {}
}) {
  const [localView, setLocalView] = useState(initialView || 'all');
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const deferredSearch = useDeferredValue(localSearchTerm);
  const [viewStyle, setViewStyle] = useState('card'); // 'card' or 'list'
  const reducedMotion = useReducedMotion();
  
  // Force scroll to top after animations complete
  useEffect(() => {
    // Calculate the total animation time (largest delay + animation duration)
    const maxDelay = Math.max(fscContacts.length, fmcContacts.length) * 0.05;
    const animationDuration = 0.3; // spring animation duration estimate
    const totalTime = (maxDelay + animationDuration) * 1000;
    
    const scrollResetTimer = setTimeout(() => {
      forceScrollToTop();
    }, totalTime + 100); // Add buffer time
    
    return () => clearTimeout(scrollResetTimer);
  }, [fscContacts.length, fmcContacts.length]);

  // Combine all contacts for "All" view
  const allContacts = useMemo(() => [...fscContacts, ...fmcContacts], [fscContacts, fmcContacts]);
  
  // Filter units
  const allUnits = useMemo(() => Object.keys(unitContacts).sort(), [unitContacts]);
  const filteredUnits = useMemo(() => {
    const term = (deferredSearch || '').toLowerCase();
    return allUnits.filter(unit => unit.toLowerCase().includes(term));
  }, [allUnits, deferredSearch]);

  // Get contacts to display based on view
  const getDisplayContacts = () => {
    switch (localView) {
      case 'fsc':
        return fscContacts;
      case 'fmc':
        return fmcContacts;
      case 'all':
        return allContacts;
      default:
        return [];
    }
  };

  const displayContacts = useMemo(() => getDisplayContacts(), [localView, fscContacts, fmcContacts, allContacts]);

  const handleContactClick = useCallback((email) => {
    window.location.href = `mailto:${email}`;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors duration-300">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {!reducedMotion && (
          <>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--primary)] rounded-full opacity-10 blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--primary)] rounded-full opacity-10 blur-3xl animate-pulse animation-delay-2000" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* View Tabs (Chat-style) */}
          <NavigationPills activeView={localView} onViewChange={setLocalView} />

          {/* View Style Toggle */}
          <div className="flex justify-end items-center mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setViewStyle('card')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  "backdrop-blur-xl",
                  viewStyle === 'card'
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--card)]/60 hover:bg-[var(--card)]/80 text-[var(--text)]"
                )}
              >
                <Columns3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewStyle('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  "backdrop-blur-xl",
                  viewStyle === 'list'
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--card)]/60 hover:bg-[var(--card)]/80 text-[var(--text)]"
                )}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Unit View */}
          {localView === 'search' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="max-w-2xl mx-auto space-y-4">
                <FluentSearchBar
                  value={localSearchTerm}
                  onChange={setLocalSearchTerm}
                  placeholder="Search units..."
                />
                
                <div className={cn(
                  "rounded-2xl overflow-hidden",
                  "bg-[var(--card)]/80",
                  "backdrop-blur-xl backdrop-saturate-150",
                  "border border-[var(--border)]/30",
                  "shadow-lg"
                )}>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger className="h-14 bg-transparent border-0 text-base">
                      <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedUnit && unitContacts[selectedUnit] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    viewStyle === 'card'
                      ? "grid gap-6 md:grid-cols-2 max-w-4xl mx-auto mt-8"
                      : "max-w-4xl mx-auto mt-8 space-y-4"
                  )}
                >
                  {viewStyle === 'card' ? (
                    <>
                      <FluentCard
                        contact={{
                          name: unitContacts[selectedUnit].fsc,
                          role: 'Financial Services Cell (FSC)',
                          email: unitContacts[selectedUnit].fscEmail,
                          units: [selectedUnit]
                        }}
                        type="FSC"
                      />
                      <FluentCard
                        contact={{
                          name: unitContacts[selectedUnit].fmc,
                          role: 'Financial Management Cell (FMC)',
                          email: unitContacts[selectedUnit].fmcEmail,
                          units: [selectedUnit]
                        }}
                        type="FMC"
                        delay={0.1}
                      />
                    </>
                  ) : (
                    <>
                      <FluentList
                        contact={{
                          name: unitContacts[selectedUnit].fsc,
                          role: 'Financial Services Cell (FSC)',
                          email: unitContacts[selectedUnit].fscEmail,
                          units: [selectedUnit]
                        }}
                      />
                      <FluentList
                        contact={{
                          name: unitContacts[selectedUnit].fmc,
                          role: 'Financial Management Cell (FMC)',
                          email: unitContacts[selectedUnit].fmcEmail,
                          units: [selectedUnit]
                        }}
                        delay={0.1}
                      />
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Contacts Display */}
          {localView !== 'search' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                viewStyle === 'card'
                  ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
                  : "space-y-2 max-w-4xl mx-auto"
              )}
            >
              {displayContacts.map((contact, index) => {
                // Determine if this is FSC or FMC based on role
                const isFSC = contact.role && contact.role.includes('FSC');
                const isFMC = contact.role && contact.role.includes('FMC');
                const type = isFSC ? 'FSC' : isFMC ? 'FMC' : null;
                
                return viewStyle === 'card' ? (
                  <FluentCard
                    key={index}
                    contact={contact}
                    delay={reducedMotion ? 0 : index * 0.05}
                    type={type}
                    onClick={() => handleContactClick(contact.email)}
                  />
                ) : (
                  <FluentList
                    key={index}
                    contact={contact}
                    delay={reducedMotion ? 0 : index * 0.05}
                  />
                );
              })}
            </motion.div>
          )}

          {/* Empty State */}
          {localView !== 'search' && displayContacts.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <User className="w-16 h-16 mx-auto text-[var(--text-secondary)] mb-4" />
              <p className="text-[var(--text-secondary)]">No contacts found</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Custom Styles for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.1;
          }
          50% {
            opacity: 0.2;
          }
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        :root {
          --primary-rgb: 59, 130, 246;
        }
      `}</style>
    </div>
  );
}
