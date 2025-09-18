import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { AnimatedButton } from '../components/ui/animated-button';
import { EnhancedBackButton } from '../components/ui/enhanced-back-button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { 
  Brain, CheckCircle, Globe, Loader2, Trash2, AlertTriangle, 
  RefreshCw, Database, FileText, Hash, Search, Download,
  Filter, Clock, HardDrive, Activity, TrendingUp
} from 'lucide-react';
import { Skeleton, SkeletonText } from '../components/ui/skeleton';
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
} from '../components/ui/alert-dialog';
import IngestionConsole from '../components/IngestionConsole';

import { LLM_MODELS, type LLMModel, DEFAULT_MODEL_ID } from '../constants/models';

// Ensure LLM_MODELS is always an array
const MODELS = Array.isArray(LLM_MODELS) ? LLM_MODELS : [];

type DatabaseStats = {
  totalDocuments: number;
  totalChunks: number;
  totalSources: number;
  lastIngestedAt: string | null;
};

type DatabaseSource = {
  id: string;
  label: string;
  canonicalUrl: string | null;
  chunkCount: number;
  documentCount: number;
  lastIngestedAt: string | null;
  searchText: string;
};

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('model');
  
  // LLM Model state
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'google' | 'anthropic'>('openai');
  const [tempSelectedModel, setTempSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [tempSelectedProvider, setTempSelectedProvider] = useState<'openai' | 'google' | 'anthropic'>('openai');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // URL Ingestion state
  const [urlInput, setUrlInput] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [ingestionHistory, setIngestionHistory] = useState<Array<{url: string, status: string, timestamp: string}>>([]);
  const [showIngestionProgress, setShowIngestionProgress] = useState(false);
  const [currentIngestionUrl, setCurrentIngestionUrl] = useState('');
  
  // Database management state
  const [isPurging, setIsPurging] = useState(false);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [databaseSources, setDatabaseSources] = useState<DatabaseSource[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  
  // Enhanced database panel state
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [sourceSortBy, setSourceSortBy] = useState<'date' | 'count' | 'name'>('date');
  const [activityLog, setActivityLog] = useState<Array<{
    timestamp: string;
    action: string;
    details: string;
  }>>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);

  const resetIngestionProgress = useCallback(() => {
    setShowIngestionProgress(false);
    setCurrentIngestionUrl('');
  }, []);

  const formatDateDisplay = useCallback((value: string | null, includeTime = false) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return includeTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
  }, []);

  // Computed values for filtered and sorted sources
  const filteredSources = useMemo(() => {
    if (databaseSources.length === 0) return [];

    const query = sourceSearchQuery.trim().toLowerCase();
    const filtered = query
      ? databaseSources.filter(source => source.searchText.includes(query))
      : [...databaseSources];

    return filtered.sort((a, b) => {
      switch (sourceSortBy) {
        case 'name':
          return a.label.localeCompare(b.label);
        case 'count':
          return (b.chunkCount || 0) - (a.chunkCount || 0);
        case 'date':
        default: {
          const dateA = a.lastIngestedAt ? new Date(a.lastIngestedAt).getTime() : 0;
          const dateB = b.lastIngestedAt ? new Date(b.lastIngestedAt).getTime() : 0;
          const safeA = Number.isFinite(dateA) ? dateA : 0;
          const safeB = Number.isFinite(dateB) ? dateB : 0;
          return safeB - safeA;
        }
      }
    });
  }, [databaseSources, sourceSearchQuery, sourceSortBy]);

  // Calculate database usage percentage (mock calculation)
  const databaseUsagePercentage = useMemo(() => {
    if (!databaseStats) return 0;
    // Assume max capacity of 100k chunks for visualization
    const maxCapacity = 100000;
    return Math.min((databaseStats.totalChunks / maxCapacity) * 100, 100);
  }, [databaseStats]);

  const lastIngestedLabel = useMemo(
    () => formatDateDisplay(databaseStats?.lastIngestedAt ?? null, true),
    [databaseStats?.lastIngestedAt, formatDateDisplay]
  );

  // Load initial data
  useEffect(() => {
    loadModelSettings();
    loadIngestionHistory();
    loadActivityLog();
  }, []);

  // Load database stats when database tab is active
  const loadModelSettings = () => {
    // Load saved model from localStorage
    const savedModel = localStorage.getItem('selectedLLMModel');
    const savedProvider = localStorage.getItem('selectedLLMProvider');
    
    if (savedModel) {
      setSelectedModel(savedModel);
      setTempSelectedModel(savedModel);
    }
    if (savedProvider) {
      setSelectedProvider(savedProvider as 'openai' | 'google' | 'anthropic');
      setTempSelectedProvider(savedProvider as 'openai' | 'google' | 'anthropic');
    }
  };

  const handleModelChange = (modelId: string) => {
    const model = MODELS.find(m => m.id === modelId);
    if (model) {
      setTempSelectedModel(modelId);
      setTempSelectedProvider(model.provider);
      
      // Check if changes were made
      const hasChanges = modelId !== selectedModel || model.provider !== selectedProvider;
      setHasUnsavedChanges(hasChanges);
    }
  };

  const handleSaveModel = () => {
    const model = MODELS.find(m => m.id === tempSelectedModel);
    if (model) {
      // Update the actual state
      setSelectedModel(tempSelectedModel);
      setSelectedProvider(tempSelectedProvider);
      
      // Save to localStorage
      localStorage.setItem('selectedLLMModel', tempSelectedModel);
      localStorage.setItem('selectedLLMProvider', tempSelectedProvider);
      
      // Reset unsaved changes
      setHasUnsavedChanges(false);
      
      toast.success(`Model saved: ${model.name}`);
    }
  };

  const handleResetModel = () => {
    setTempSelectedModel(selectedModel);
    setTempSelectedProvider(selectedProvider);
    setHasUnsavedChanges(false);
  };

  const loadIngestionHistory = () => {
    const savedHistory = localStorage.getItem('ingestionHistory');
    if (savedHistory) {
      try {
        setIngestionHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading ingestion history:', e);
      }
    }
  };

  const loadActivityLog = () => {
    // Load from localStorage or initialize
    const savedLog = localStorage.getItem('databaseActivityLog');
    if (savedLog) {
      try {
        setActivityLog(JSON.parse(savedLog));
      } catch (e) {
        console.error('Error loading activity log:', e);
      }
    }
  };

  const addActivityLogEntry = (action: string, details: string) => {
    const newEntry = {
      timestamp: new Date().toISOString(),
      action,
      details
    };
    const updatedLog = [newEntry, ...activityLog].slice(0, 20); // Keep last 20 entries
    setActivityLog(updatedLog);
    localStorage.setItem('databaseActivityLog', JSON.stringify(updatedLog));
  };

  const fetchDatabaseStats = useCallback(async (): Promise<DatabaseStats> => {
    const emptyStats: DatabaseStats = {
      totalDocuments: 0,
      totalChunks: 0,
      totalSources: 0,
      lastIngestedAt: null,
    };

    try {
      const statsResponse = await fetch('/api/v2/sources/stats');
      if (statsResponse.ok) {
        const data = await statsResponse.json();
        if (data && (data.total_documents !== undefined || data.total_chunks !== undefined || data.total_sources !== undefined)) {
          return {
            totalDocuments: typeof data.total_documents === 'number'
              ? data.total_documents
              : typeof data.totalDocuments === 'number'
                ? data.totalDocuments
                : 0,
            totalChunks: typeof data.total_chunks === 'number'
              ? data.total_chunks
              : typeof data.totalChunks === 'number'
                ? data.totalChunks
                : 0,
            totalSources: typeof data.total_sources === 'number'
              ? data.total_sources
              : typeof data.totalSources === 'number'
                ? data.totalSources
                : Array.isArray(data.sources)
                  ? data.sources.length
                  : 0,
            lastIngestedAt: typeof data.last_ingested_at === 'string'
              ? data.last_ingested_at
              : typeof data.lastIngestedAt === 'string'
                ? data.lastIngestedAt
                : null,
          };
        }
      } else {
        try {
          const errorBody = await statsResponse.json();
          console.error('Source stats error response:', { status: statsResponse.status, body: errorBody });
        } catch (parseError) {
          console.error('Failed to parse source stats error response:', parseError);
        }
      }
    } catch (error) {
      console.error('Source stats request failed:', error);
    }

    try {
      const countResponse = await fetch('/api/v2/sources/count');
      if (countResponse.ok) {
        const countData = await countResponse.json();
        const count = typeof countData.count === 'number' ? countData.count : 0;
        const totalSources = typeof countData.total_sources === 'number'
          ? countData.total_sources
          : typeof countData.totalSources === 'number'
            ? countData.totalSources
            : 0;

        return {
          totalDocuments: count,
          totalChunks: typeof countData.total_chunks === 'number' ? countData.total_chunks : count,
          totalSources: totalSources || count,
          lastIngestedAt: null,
        };
      }
    } catch (error) {
      console.error('Source count request failed:', error);
    }

    try {
      const healthResponse = await fetch('/health?checkRag=true');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        const vectorStore = healthData?.ragService?.components?.vector_store;
        if (vectorStore) {
          const documentCount = typeof vectorStore.document_count === 'number' ? vectorStore.document_count : 0;
          return {
            totalDocuments: documentCount,
            totalChunks: documentCount,
            totalSources: 0,
            lastIngestedAt: null,
          };
        }
      }
    } catch (error) {
      console.error('Health endpoint request failed:', error);
    }

    return emptyStats;
  }, []);

  const fetchDatabaseSources = useCallback(async (): Promise<DatabaseSource[]> => {
    const response = await fetch('/api/v2/sources?page=1&page_size=100');
    if (!response.ok) {
      let message = `Failed to load sources (status ${response.status})`;
      try {
        const errorBody = await response.json();
        if (errorBody?.message) {
          message = errorBody.message;
        }
      } catch (parseError) {
        console.error('Failed to parse sources error response:', parseError);
      }
      throw new Error(message);
    }

    try {
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      return items.map((item: any): DatabaseSource => {
        const canonicalUrlCandidate = item?.canonical_url ?? item?.canonicalUrl ?? item?.metadata?.canonical_url ?? item?.metadata?.source ?? null;
        const canonicalUrl = typeof canonicalUrlCandidate === 'string' ? canonicalUrlCandidate : null;
        const lastUpdatedCandidate = item?.last_ingested_at ?? item?.lastIngestedAt ?? item?.metadata?.last_ingested_at ?? item?.metadata?.ingested_at ?? null;
        const lastIngestedAt = typeof lastUpdatedCandidate === 'string' ? lastUpdatedCandidate : null;
        const labelCandidates = [
          item?.title,
          canonicalUrl,
          item?.reference_path,
          item?.source_id,
        ];
        const label = labelCandidates.find((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0) ?? 'Unknown source';
        const searchComponents = [
          label,
          canonicalUrl,
          item?.source_id,
          item?.reference_path,
          item?.document_type,
          item?.section,
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

        return {
          id: typeof item?.source_id === 'string' && item.source_id.trim().length > 0 ? item.source_id : label,
          label,
          canonicalUrl,
          chunkCount: typeof item?.chunk_count === 'number' ? item.chunk_count : 0,
          documentCount: typeof item?.document_count === 'number' ? item.document_count : 0,
          lastIngestedAt,
          searchText: searchComponents.join(' ').toLowerCase(),
        };
      });
    } catch (error) {
      console.error('Failed to parse sources response:', error);
      return [];
    }
  }, []);

  const loadDatabaseStats = useCallback(async () => {
    setIsLoadingStats(true);
    setSourcesError(null);

    try {
      const stats = await fetchDatabaseStats();
      setDatabaseStats(stats);
    } catch (error) {
      console.error('Error loading database stats:', error);
      setDatabaseStats({
        totalDocuments: 0,
        totalChunks: 0,
        totalSources: 0,
        lastIngestedAt: null,
      });
    }

    try {
      const sources = await fetchDatabaseSources();
      setDatabaseSources(sources);
    } catch (error) {
      console.error('Error loading database sources:', error);
      setDatabaseSources([]);
      setSourcesError(error instanceof Error ? error.message : 'Unable to load indexed sources');
    }

    setIsLoadingStats(false);
  }, [fetchDatabaseStats, fetchDatabaseSources]);

  useEffect(() => {
    if (activeTab === 'database') {
      loadDatabaseStats();
    }
  }, [activeTab, loadDatabaseStats]);

  const handlePurgeDatabase = async () => {
    setIsPurging(true);
    
    try {
      const response = await fetch('/api/v2/database/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Database purged successfully');
        // Clear ingestion history as well
        setIngestionHistory([]);
        localStorage.removeItem('ingestionHistory');
        // Add to activity log
        addActivityLogEntry('Database Purged', 'All documents removed from vector database');
        // Reload database stats
        await loadDatabaseStats();
      } else {
        toast.error(data.message || 'Failed to purge database');
      }
    } catch (error) {
      console.error('Database purge error:', error);
      toast.error('Network error during database purge');
    } finally {
      setIsPurging(false);
    }
  };

  const exportDatabaseStats = () => {
    if (!databaseStats) return;
    
    const exportData = {
      exportDate: new Date().toISOString(),
      statistics: {
        totalDocuments: databaseStats.totalDocuments,
        totalChunks: databaseStats.totalChunks,
        totalSources: databaseStats.totalSources,
        databaseUsage: `${databaseUsagePercentage.toFixed(2)}%`
      },
      sources: databaseSources,
      activityLog: activityLog
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Database statistics exported');
    addActivityLogEntry('Stats Exported', 'Database statistics exported to JSON');
  };

  const handleIngestURL = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Validate URL
    try {
      new URL(urlInput.trim());
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    const normalizedUrl = urlInput.trim();

    setIsIngesting(true);
    setShowIngestionProgress(true);
    setCurrentIngestionUrl(normalizedUrl);

    try {
      const response = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: normalizedUrl,
          type: 'web',
          forceRefresh: forceRefresh,
          metadata: {
            source: 'manual_ingestion',
            ingested_from: 'config_page'
          }
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.status === 'success') {
          toast.success(`Successfully ingested ${data.chunks_created} chunks from URL`);
        } else if (data.status === 'exists') {
          toast.info('Document already exists in the database. Use force refresh to re-ingest.');
          resetIngestionProgress();
        } else {
          toast.info(data.message || 'Ingestion request received. Monitoring progress...');
        }

        // Add to history
        const newEntry = {
          url: normalizedUrl,
          status: data.status === 'exists' ? 'exists' : data.status || 'pending',
          timestamp: new Date().toISOString()
        };
        const updatedHistory = [newEntry, ...ingestionHistory].slice(0, 10); // Keep last 10
        setIngestionHistory(updatedHistory);
        localStorage.setItem('ingestionHistory', JSON.stringify(updatedHistory));
        
        // Add to activity log
        addActivityLogEntry('Document Ingested', `${normalizedUrl} - ${data.chunks_created ?? 0} chunks`);
        
        // Clear input and reset force refresh
        setUrlInput('');
        setForceRefresh(false);
        
        // Reload database stats if on database tab
        if (activeTab === 'database') {
          void loadDatabaseStats();
        }
      } else {
        const errorMessage = data.message || 'Failed to ingest URL';
        toast.error(errorMessage);
        resetIngestionProgress();
        
        // Add failed entry to history
        const newEntry = {
          url: normalizedUrl,
          status: 'failed',
          timestamp: new Date().toISOString()
        };
        const updatedHistory = [newEntry, ...ingestionHistory].slice(0, 10);
        setIngestionHistory(updatedHistory);
        localStorage.setItem('ingestionHistory', JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('Ingestion error:', error);
      toast.error('Network error during ingestion');
      resetIngestionProgress();
    } finally {
      setIsIngesting(false);
      // Progress will auto-hide after completion
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-float-slow delay-1000" />
      </div>
      
      <div className="container mx-auto py-8 px-4 relative z-10">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <EnhancedBackButton to="/chat" label="Back to Chat" variant="minimal" />
          </div>
          <h1 className="h1 text-fluid-4xl font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent animate-fade-up">Configuration</h1>
          <p className="body-lg text-muted-foreground animate-fade-up delay-100">
            Configure your chat assistant settings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              LLM Model
            </TabsTrigger>
            <TabsTrigger value="ingestion" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              URL Ingestion
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Database
            </TabsTrigger>
          </TabsList>

          <TabsContent value="model" className="space-y-4 animate-fade-up">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>LLM Model Selection</CardTitle>
                <CardDescription>
                  Choose your preferred AI model for the chat assistant. Different models offer varying capabilities and performance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Provider Tabs */}
                <Tabs value={tempSelectedProvider} onValueChange={(value) => {
                  setTempSelectedProvider(value as 'openai' | 'google' | 'anthropic');
                  // Check if changes were made
                  const hasChanges = value !== selectedProvider || tempSelectedModel !== selectedModel;
                  setHasUnsavedChanges(hasChanges);
                }}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="openai">OpenAI</TabsTrigger>
                    <TabsTrigger value="google">Google</TabsTrigger>
                    <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-4">
                    <div className="space-y-2">
                      {(MODELS || []).filter(model => model.provider === tempSelectedProvider).map((model) => (
                        <div
                          key={model.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            tempSelectedModel === model.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => handleModelChange(model.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{model.name}</h4>
                              {model.description && (
                                <p className="text-sm text-muted-foreground mt-1">{model.description}</p>
                              )}
                            </div>
                            {tempSelectedModel === model.id && (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Tabs>
                
                {/* Save/Reset buttons */}
                {hasUnsavedChanges && (
                  <div className="flex gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        You have unsaved changes
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-300">
                        Save your changes to apply the new model selection.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <AnimatedButton variant="outline" size="sm" onClick={handleResetModel} ripple>
                        Reset
                      </AnimatedButton>
                      <AnimatedButton size="sm" onClick={handleSaveModel} ripple>
                        Save Changes
                      </AnimatedButton>
                    </div>
                  </div>
                )}
                
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Active Model:</strong> {MODELS.find(m => m.id === selectedModel)?.name || 'None selected'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Model ID: <code className="px-1 py-0.5 bg-background rounded">{selectedModel}</code>
                  </p>
                  {hasUnsavedChanges && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                      <strong>Selected:</strong> {MODELS.find(m => m.id === tempSelectedModel)?.name} (not saved)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ingestion" className="space-y-4 animate-fade-up">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>URL Ingestion</CardTitle>
                <CardDescription>
                  Add external URLs to the knowledge base. The system will scrape and index the content for improved responses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="url-input">Enter URL to Ingest</Label>
                    <div className="flex gap-2">
                      <Input
                        id="url-input"
                        type="url"
                        placeholder="https://example.com/document"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isIngesting) {
                            handleIngestURL();
                          }
                        }}
                        disabled={isIngesting}
                      />
                      <AnimatedButton
                        onClick={handleIngestURL}
                        disabled={isIngesting || !urlInput.trim()}
                        ripple
                      >
                        {isIngesting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Ingesting...
                          </>
                        ) : (
                          'Ingest URL'
                        )}
                      </AnimatedButton>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="force-refresh"
                        checked={forceRefresh}
                        onCheckedChange={(checked) => setForceRefresh(checked as boolean)}
                      />
                      <Label
                        htmlFor="force-refresh"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Force refresh (re-ingest even if document already exists)
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The content will be automatically processed and added to the RAG knowledge base.
                    </p>
                  </div>

                  {/* Ingestion Progress Console */}
                  {showIngestionProgress && currentIngestionUrl && (
                    <div className="mt-4">
                      <IngestionConsole
                        url={currentIngestionUrl}
                        onComplete={(success) => {
                          resetIngestionProgress();
                          // Reload database stats if on database tab
                          if (activeTab === 'database') {
                            void loadDatabaseStats();
                          }
                        }}
                      />
                    </div>
                  )}

                  {ingestionHistory.length > 0 && !showIngestionProgress && (
                    <div className="space-y-2">
                      <Label>Recent Ingestions</Label>
                      <div className="space-y-2">
                        {ingestionHistory.map((entry, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border ${
                              entry.status === 'success'
                                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                                : entry.status === 'exists'
                                ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{entry.url}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  entry.status === 'success'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : entry.status === 'exists'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}
                              >
                                {entry.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Tips for URL Ingestion:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Make sure the URL is publicly accessible</li>
                    <li>• The system will extract text content from web pages</li>
                    <li>• PDF documents and other file types may be supported depending on the URL</li>
                    <li>• Large documents will be split into smaller chunks for processing</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="database" className="space-y-4 animate-fade-up">
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Database Management</CardTitle>
                <CardDescription>
                  Manage the RAG (Retrieval-Augmented Generation) vector database that stores indexed documents.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enhanced Database Statistics */}
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Database Overview
                      </h4>
                      <div className="flex gap-2">
                        <AnimatedButton
                          variant="ghost"
                          size="sm"
                          onClick={exportDatabaseStats}
                          disabled={!databaseStats || isLoadingStats}
                          ripple
                        >
                          <Download className="h-4 w-4" />
                        </AnimatedButton>
                        <AnimatedButton
                          variant="ghost"
                          size="sm"
                          onClick={loadDatabaseStats}
                          disabled={isLoadingStats}
                          ripple
                        >
                          <RefreshCw className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
                        </AnimatedButton>
                      </div>
                    </div>
                    {isLoadingStats ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <Skeleton className="h-24 rounded-lg" />
                          <Skeleton className="h-24 rounded-lg" />
                          <Skeleton className="h-24 rounded-lg" />
                        </div>
                        <Skeleton className="h-20 rounded-lg" />
                      </div>
                    ) : databaseStats ? (
                      <div className="space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-muted/50 rounded-lg glass-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total Documents</p>
                              <p className="text-2xl font-bold animate-scale-in">
                                {databaseStats.totalDocuments.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-muted/50 rounded-lg glass-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <Hash className="h-5 w-5 text-muted-foreground" />
                              <Activity className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total Chunks</p>
                              <p className="text-2xl font-bold animate-scale-in">
                                {databaseStats.totalChunks.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-muted/50 rounded-lg glass-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <HardDrive className="h-5 w-5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {databaseUsagePercentage.toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Storage Usage</p>
                              <Progress value={databaseUsagePercentage} className="h-2" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Aggregate Stats */}
                        <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Indexed sources:</span>
                            <span className="font-medium">
                              {databaseStats.totalSources.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Average chunks per document:</span>
                            <span className="font-medium">
                              {databaseStats.totalDocuments > 0
                                ? (databaseStats.totalChunks / databaseStats.totalDocuments).toFixed(1)
                                : '0'}
                            </span>
                          </div>
                          {lastIngestedLabel && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Last ingestion:</span>
                              <span className="font-medium">{lastIngestedLabel}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Unable to load database statistics
                      </p>
                    )}
                  </div>

                  {/* Sources Management */}
                  {!isLoadingStats && (
                    databaseSources.length > 0 ? (
                      <div className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Indexed Sources</h4>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="text"
                                placeholder="Search sources..."
                                value={sourceSearchQuery}
                                onChange={(e) => setSourceSearchQuery(e.target.value)}
                                className="h-8 pl-8 pr-3 text-xs w-48"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSourceSortBy(current => 
                                current === 'date' ? 'count' : current === 'count' ? 'name' : 'date'
                              )}
                              className="text-xs"
                            >
                              <Filter className="h-3 w-3 mr-1" />
                              {sourceSortBy === 'date' ? 'Date' : sourceSortBy === 'count' ? 'Count' : 'Name'}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {filteredSources.length > 0 ? (
                            filteredSources.map(source => {
                              const displayUrl = source.canonicalUrl
                                ? source.canonicalUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
                                : null;
                              const lastIndexedLabel = formatDateDisplay(source.lastIngestedAt);

                              return (
                                <div 
                                  key={source.id}
                                  className="p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <span className="font-medium text-sm truncate">
                                          {source.label}
                                        </span>
                                      </div>
                                      {displayUrl && (
                                        <p className="text-xs text-muted-foreground truncate pl-6">
                                          {displayUrl}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6">
                                        <span className="flex items-center gap-1">
                                          <FileText className="h-3 w-3" />
                                          {source.documentCount} docs
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Hash className="h-3 w-3" />
                                          {source.chunkCount} chunks
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {lastIndexedLabel ?? 'Unknown'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              No sources match your search
                            </p>
                          )}
                        </div>
                        
                        {(databaseStats?.totalSources || databaseSources.length) > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            Showing {filteredSources.length} of {(databaseStats?.totalSources || databaseSources.length).toLocaleString()} sources
                          </p>
                        )}
                      </div>
                    ) : (
                      <p
                        className={`text-xs text-center py-4 ${sourcesError ? 'text-destructive' : 'text-muted-foreground'}`}
                      >
                        {sourcesError ?? 'No sources have been indexed yet. Ingest content to populate this list.'}
                      </p>
                    )
                  )}

                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Purge Database
                        </h4>
                        <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                          This action will permanently delete all indexed documents from the vector database. 
                          You'll need to re-ingest any URLs or documents you want to use.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="text-sm font-medium">Clear Vector Database</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Remove all indexed documents and start fresh
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <AnimatedButton 
                          variant="destructive" 
                          size="sm"
                          disabled={isPurging}
                          ripple
                        >
                          {isPurging ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Purging...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Purge Database
                            </>
                          )}
                        </AnimatedButton>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all indexed documents 
                            from the vector database, including:
                            <ul className="mt-2 space-y-1 list-disc list-inside">
                              <li>All ingested URLs and their content</li>
                              <li>All document embeddings and metadata</li>
                              <li>All conversation history references</li>
                            </ul>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handlePurgeDatabase}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Yes, purge database
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Activity Timeline */}
                  {activityLog.length > 0 && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Recent Activity
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowActivityLog(!showActivityLog)}
                          className="text-xs"
                        >
                          {showActivityLog ? 'Hide' : 'Show'} Log
                        </Button>
                      </div>
                      
                      {showActivityLog && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {activityLog.slice(0, 10).map((entry, index) => (
                            <div key={index} className="flex items-start gap-2 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{entry.action}</span>
                                  <span className="text-muted-foreground">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="text-muted-foreground">{entry.details}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Database Information:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• The database stores document embeddings for semantic search</li>
                      <li>• Purging will not affect your chat history</li>
                      <li>• You can re-ingest documents at any time</li>
                      <li>• The database uses ChromaDB for vector storage</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
