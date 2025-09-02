import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Download, Upload, RefreshCw } from 'lucide-react';

interface GlossaryTerm {
  term: string;
  expansion: string;
  description: string;
  category: string;
  variations: string[];
}

interface GlossaryData {
  [category: string]: GlossaryTerm[];
}

export const GlossaryConfig: React.FC = () => {
  const [glossaryData, setGlossaryData] = useState<GlossaryData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  useEffect(() => {
    fetchGlossaryData();
  }, []);

  const fetchGlossaryData = async () => {
    setLoading(true);
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
        setSelectedCategory(categories[0]);
      }
    } catch (error) {
      console.error('Error fetching glossary:', error);
      toast.error('Failed to load glossary data');
    } finally {
      setLoading(false);
    }
  };

  const saveGlossaryData = async () => {
    setSaving(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiBaseUrl}/api/v2/glossary/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ glossary: glossaryData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save glossary data');
      }
      
      toast.success('Glossary data saved successfully');
    } catch (error) {
      console.error('Error saving glossary:', error);
      toast.error('Failed to save glossary data');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify({ categories: glossaryData }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'acronyms_glossary.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.categories) {
          setGlossaryData(data.categories);
          toast.success('Glossary data imported successfully');
        } else {
          toast.error('Invalid glossary file format');
        }
      } catch (error) {
        console.error('Error importing glossary:', error);
        toast.error('Failed to import glossary data');
      }
    };
    reader.readAsText(file);
  };

  const addTerm = (newTerm: GlossaryTerm) => {
    const updatedData = { ...glossaryData };
    if (!updatedData[newTerm.category]) {
      updatedData[newTerm.category] = [];
    }
    updatedData[newTerm.category].push(newTerm);
    setGlossaryData(updatedData);
    setIsAddingNew(false);
    setEditingTerm(null);
    toast.success('Term added successfully');
  };

  const updateTerm = (oldCategory: string, oldTerm: string, updatedTerm: GlossaryTerm) => {
    const updatedData = { ...glossaryData };
    
    // Remove from old category
    if (updatedData[oldCategory]) {
      updatedData[oldCategory] = updatedData[oldCategory].filter(t => t.term !== oldTerm);
      if (updatedData[oldCategory].length === 0) {
        delete updatedData[oldCategory];
      }
    }
    
    // Add to new category
    if (!updatedData[updatedTerm.category]) {
      updatedData[updatedTerm.category] = [];
    }
    updatedData[updatedTerm.category].push(updatedTerm);
    
    setGlossaryData(updatedData);
    setEditingTerm(null);
    toast.success('Term updated successfully');
  };

  const deleteTerm = (category: string, term: string) => {
    const updatedData = { ...glossaryData };
    if (updatedData[category]) {
      updatedData[category] = updatedData[category].filter(t => t.term !== term);
      if (updatedData[category].length === 0) {
        delete updatedData[category];
      }
    }
    setGlossaryData(updatedData);
    toast.success('Term deleted successfully');
  };

  const getFilteredTerms = () => {
    const allTerms: (GlossaryTerm & { originalCategory: string })[] = [];
    
    Object.entries(glossaryData).forEach(([category, terms]) => {
      if (selectedCategory === 'all' || selectedCategory === category) {
        terms.forEach(term => {
          if (!searchQuery || 
              term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
              term.expansion.toLowerCase().includes(searchQuery.toLowerCase()) ||
              term.description.toLowerCase().includes(searchQuery.toLowerCase())) {
            allTerms.push({ ...term, originalCategory: category });
          }
        });
      }
    });
    
    return allTerms.sort((a, b) => a.term.localeCompare(b.term));
  };

  const categories = Object.keys(glossaryData);
  const filteredTerms = getFilteredTerms();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Glossary Management</CardTitle>
            <CardDescription>
              Manage military acronyms and abbreviations
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingTerm({
                  term: '',
                  expansion: '',
                  description: '',
                  category: categories[0] || 'military_general',
                  variations: [],
                });
                setIsAddingNew(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Term
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <label htmlFor="import-glossary">
              <Button
                variant="outline"
                size="sm"
                as="span"
              >
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
              <input
                id="import-glossary"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchGlossaryData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={saveGlossaryData}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search and filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Terms list */}
          <ScrollArea className="h-[500px] border rounded-lg p-4">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredTerms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No terms found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTerms.map((term) => (
                  <div
                    key={`${term.originalCategory}-${term.term}`}
                    className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">
                            {term.term}
                          </span>
                          <span className="text-muted-foreground">—</span>
                          <span>{term.expansion}</span>
                          <Badge variant="secondary" className="text-xs">
                            {term.originalCategory.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {term.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {term.description}
                          </p>
                        )}
                        {term.variations && term.variations.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Variations: {term.variations.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTerm({ ...term, category: term.originalCategory });
                            setIsAddingNew(false);
                          }}
                        >
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Term</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{term.term}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTerm(term.originalCategory, term.term)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Edit/Add Dialog */}
        {editingTerm && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>{isAddingNew ? 'Add New Term' : 'Edit Term'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="term">Term/Abbreviation</Label>
                      <Input
                        id="term"
                        value={editingTerm.term}
                        onChange={(e) => setEditingTerm({ ...editingTerm, term: e.target.value.toUpperCase() })}
                        placeholder="e.g., CAF"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={editingTerm.category}
                        onValueChange={(value) => setEditingTerm({ ...editingTerm, category: value })}
                      >
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                          <SelectItem value="new_category">+ New Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expansion">Full Expansion</Label>
                    <Input
                      id="expansion"
                      value={editingTerm.expansion}
                      onChange={(e) => setEditingTerm({ ...editingTerm, expansion: e.target.value })}
                      placeholder="e.g., Canadian Armed Forces"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editingTerm.description}
                      onChange={(e) => setEditingTerm({ ...editingTerm, description: e.target.value })}
                      placeholder="Brief description of the term"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="variations">Variations (comma-separated)</Label>
                    <Input
                      id="variations"
                      value={editingTerm.variations.join(', ')}
                      onChange={(e) => setEditingTerm({
                        ...editingTerm,
                        variations: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                      })}
                      placeholder="e.g., C.A.F., Canadian Forces, CF"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingTerm(null);
                        setIsAddingNew(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (isAddingNew) {
                          addTerm(editingTerm);
                        } else {
                          const originalCategory = filteredTerms.find(t => 
                            t.term === editingTerm.term && 
                            t.expansion === editingTerm.expansion
                          )?.originalCategory || editingTerm.category;
                          updateTerm(originalCategory, editingTerm.term, editingTerm);
                        }
                      }}
                      disabled={!editingTerm.term || !editingTerm.expansion}
                    >
                      {isAddingNew ? 'Add Term' : 'Update Term'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};