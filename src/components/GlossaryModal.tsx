import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Book, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlossaryTerm {
  term: string;
  expansion: string;
  description: string;
  category: string;
  variations: string[];
}

interface GlossaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlossaryModal: React.FC<GlossaryModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [glossaryData, setGlossaryData] = useState<Record<string, GlossaryTerm[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (open) {
      fetchGlossaryData();
    }
  }, [open]);

  const fetchGlossaryData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiBaseUrl}/api/v2/glossary/`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch glossary data');
      }
      
      const data = await response.json();
      setGlossaryData(data);
      
      // Set first category as default if available
      const categories = Object.keys(data);
      if (categories.length > 0 && selectedCategory === 'all') {
        setSelectedCategory('all');
      }
    } catch (err) {
      console.error('Error fetching glossary:', err);
      setError('Failed to load glossary. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Filter terms based on search query
  const getFilteredTerms = () => {
    const allTerms: GlossaryTerm[] = [];
    
    Object.entries(glossaryData).forEach(([category, terms]) => {
      if (selectedCategory === 'all' || selectedCategory === category) {
        terms.forEach(term => {
          if (!searchQuery || 
              term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
              term.expansion.toLowerCase().includes(searchQuery.toLowerCase()) ||
              term.description.toLowerCase().includes(searchQuery.toLowerCase())) {
            allTerms.push(term);
          }
        });
      }
    });
    
    // Sort alphabetically by term
    return allTerms.sort((a, b) => a.term.localeCompare(b.term));
  };

  const filteredTerms = getFilteredTerms();
  const categories = ['all', ...Object.keys(glossaryData)];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-[var(--card)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            Military Acronyms & Abbreviations
          </DialogTitle>
          <DialogDescription>
            Canadian Forces travel-related terms and their meanings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <Input
              placeholder="Search terms, expansions, or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full justify-start flex-wrap h-auto p-1">
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="capitalize"
                >
                  {category === 'all' ? 'All Categories' : category.replace(/_/g, ' ')}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading glossary...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  <p>{error}</p>
                </div>
              ) : filteredTerms.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  <p>No terms found matching your search.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {filteredTerms.map((term, index) => (
                      <div
                        key={`${term.category}-${term.term}-${index}`}
                        className={cn(
                          "p-3 rounded-lg border border-[var(--border)]",
                          "hover:bg-[var(--hover)] transition-colors"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-[var(--text-primary)]">
                                {term.term}
                              </span>
                              <span className="text-[var(--text-secondary)]">—</span>
                              <span className="text-[var(--text-primary)]">
                                {term.expansion}
                              </span>
                            </div>
                            
                            {term.description && (
                              <p className="text-sm text-[var(--text-secondary)]">
                                {term.description}
                              </p>
                            )}
                            
                            {term.variations && term.variations.length > 0 && (
                              <p className="text-xs text-[var(--text-secondary)]">
                                <span className="font-medium">Also:</span> {term.variations.join(', ')}
                              </p>
                            )}
                          </div>
                          
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {term.category.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
