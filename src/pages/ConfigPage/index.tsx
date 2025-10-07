import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedBackButton } from '@/components/ui/enhanced-back-button';
import { toast } from 'sonner';
import { Brain, Globe, Trash2, FileText } from 'lucide-react';
import { ModelSettingsTab } from './tabs/ModelSettingsTab';
import { IngestionTab } from './tabs/IngestionTab';
import { DatabaseTab } from './tabs/DatabaseTab';
import { LogsTab } from './tabs/LogsTab';
import { LLM_MODELS, type LLMModel, DEFAULT_MODEL_ID } from '@/constants/models';
import { useModelPreferences } from './hooks/useModelPreferences';
import { useActivityLog } from './hooks/useActivityLog';
import { useDatabasePanel } from './hooks/useDatabasePanel';
import type { LogFilters, ModelProvider } from './types';
import { LOGS_FILTER_DEFAULTS } from './types';
import { useLogsPanel } from './hooks/useLogsPanel';
import { useVisitSummary } from './hooks/useVisitSummary';
import { useIngestionController } from './hooks/useIngestionController';
import { apiClient, ApiError } from '@/api/client';

// Ensure LLM_MODELS is always an array
const MODELS: LLMModel[] = Array.isArray(LLM_MODELS) ? LLM_MODELS : [];
const DEFAULT_PROVIDER: ModelProvider = 'openai';

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('model');

  const {
    selectedModel,
    selectedProvider,
    tempSelectedModel,
    tempSelectedProvider,
    hasUnsavedChanges,
    selectModel,
    selectProvider,
    savePreferences,
    resetPreferences,
  } = useModelPreferences(MODELS, DEFAULT_MODEL_ID, DEFAULT_PROVIDER);

  // Database management state
  const [isPurging, setIsPurging] = useState(false);
  const { activityLog, appendActivityLog } = useActivityLog();
  const [showActivityLog, setShowActivityLog] = useState(false);

  const addActivityLogEntry = useCallback(
    (action: string, details: string) => {
      appendActivityLog(action, details);
    },
    [appendActivityLog],
  );

  const formatDateDisplay = useCallback((value: string | null, includeTime = false) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return includeTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
  }, []);

  const {
    stats: databaseStats,
    sources: databaseSources,
    isLoading: isLoadingStats,
    error: sourcesError,
    searchQuery: sourceSearchQuery,
    sortBy: sourceSortBy,
    filteredSources,
    usagePercentage: databaseUsagePercentage,
    lastIngestedLabel,
    setSearchQuery: updateSourceSearchQuery,
    cycleSourceSort,
    refreshMetrics: refreshDatabaseMetrics,
  } = useDatabasePanel(formatDateDisplay);

  const {
    urlInput,
    setUrlInput,
    isIngesting,
    forceRefresh,
    setForceRefresh,
    ingestionHistory,
    showIngestionProgress,
    currentIngestionUrl,
    ingestionProgressEndpoint,
    handleIngestURL,
    handleIngestionProgressComplete,
    clearIngestionHistory,
  } = useIngestionController({
    activeTab,
    onActivityLog: addActivityLogEntry,
    refreshDatabaseMetrics,
  });

  // Chat logs panel state
  const [logsInitialized, setLogsInitialized] = useState(false);
  const {
    filters: logsFilters,
    setFilters: setLogsFilters,
    logs: chatLogs,
    loading: logsLoading,
    error: logsError,
    pagination: logsPagination,
    fetchLogs,
    applyFilters: applyLogFilters,
    resetFilters: resetLogFilters,
    refresh: refreshLogs,
    nextPage: goToNextLogsPage,
    previousPage: goToPreviousLogsPage,
  } = useLogsPanel(LOGS_FILTER_DEFAULTS);
  const {
    visitSummary,
    visitSummaryError,
    visitSummaryLoading,
    visitSummaryInitialized,
    loadVisitSummary,
  } = useVisitSummary();

  const formatBooleanLabel = useCallback((value: boolean | null) => {
    if (value === null) return 'Unknown';
    return value ? 'Yes' : 'No';
  }, []);

  const summariseMetadata = useCallback((metadata: unknown) => {
    if (!metadata) return null;
    try {
      const raw = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
      if (raw.length <= 160) return raw;
      return `${raw.slice(0, 157)}…`;
    } catch (error) {
      console.warn('Failed to summarise chat log metadata', error);
      return null;
    }
  }, []);

  const visitDailyCounts = useMemo(() => {
    if (!visitSummary?.dailyCounts) {
      return [] as Array<{ date: string; count: number }>;
    }

    const lastSeven = visitSummary.dailyCounts.slice(-7);
    return lastSeven;
  }, [visitSummary]);

  const handleLogsApplyFilters = useCallback(() => {
    applyLogFilters(logsFilters);
  }, [applyLogFilters, logsFilters]);

  const handleLogsResetFilters = useCallback(() => {
    resetLogFilters(LOGS_FILTER_DEFAULTS);
  }, [resetLogFilters]);

  const handleLogsRefresh = useCallback(() => {
    refreshLogs();
  }, [refreshLogs]);

  const handleLogsNextPage = useCallback(() => {
    goToNextLogsPage();
  }, [goToNextLogsPage]);

  const handleLogsPreviousPage = useCallback(() => {
    goToPreviousLogsPage();
  }, [goToPreviousLogsPage]);

  const handleRefreshVisitSummary = useCallback(() => {
    void loadVisitSummary();
  }, [loadVisitSummary]);

  // Computed values for filtered and sorted sources
  useEffect(() => {
    refreshDatabaseMetrics();
  }, [refreshDatabaseMetrics]);

  useEffect(() => {
    if (activeTab === 'logs' && !logsInitialized) {
      setLogsInitialized(true);
      void fetchLogs(0, logsFilters);
    }
  }, [activeTab, fetchLogs, logsFilters, logsInitialized]);

  useEffect(() => {
    if (activeTab === 'logs' && !visitSummaryInitialized && !visitSummaryLoading) {
      void loadVisitSummary();
    }
  }, [activeTab, loadVisitSummary, visitSummaryInitialized, visitSummaryLoading]);

  const handleProviderChange = useCallback(
    (provider: ModelProvider) => {
      selectProvider(provider);
    },
    [selectProvider],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      selectModel(modelId);
    },
    [selectModel],
  );

  const handleSaveModel = useCallback(() => {
    const savedModel = savePreferences();
    if (savedModel) {
      toast.success(`Model saved: ${savedModel.name}`);
    }
  }, [savePreferences]);

  const handleResetModel = useCallback(() => {
    resetPreferences();
  }, [resetPreferences]);

  useEffect(() => {
    if (activeTab === 'database') {
      refreshDatabaseMetrics();
    }
  }, [activeTab, refreshDatabaseMetrics]);

  const handlePurgeDatabase = async () => {
    setIsPurging(true);

    try {
      await apiClient.postJson<void>('/api/v2/database/purge', undefined, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      toast.success('Database purged successfully');
      // Clear ingestion history as well
      clearIngestionHistory();
      // Add to activity log
      addActivityLogEntry('Database Purged', 'All documents removed from vector database');
      // Reload database stats
      await refreshDatabaseMetrics();
    } catch (error) {
      if (error instanceof ApiError) {
        const message =
          typeof (error.data as any)?.message === 'string'
            ? (error.data as any).message
            : error.statusText || error.message;
        toast.error(message || 'Failed to purge database');
      } else if (error instanceof Error) {
        toast.error(error.message || 'Failed to purge database');
      } else {
        toast.error('Failed to purge database');
      }
      console.error('Database purge error:', error);
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
        databaseUsage: `${databaseUsagePercentage.toFixed(2)}%`,
      },
      sources: databaseSources,
      activityLog: activityLog,
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

  const handleToggleActivityLog = useCallback(() => {
    setShowActivityLog((prev) => !prev);
  }, []);

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
          <h1 className="h1 text-fluid-4xl font-bold text-foreground mb-2 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent animate-fade-up">
            Configuration
          </h1>
          <p className="body-lg text-muted-foreground animate-fade-up delay-100">
            Configure your chat assistant settings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="model">
            <ModelSettingsTab
              models={MODELS}
              selectedModel={selectedModel}
              tempSelectedModel={tempSelectedModel}
              tempSelectedProvider={tempSelectedProvider}
              hasUnsavedChanges={hasUnsavedChanges}
              onProviderChange={handleProviderChange}
              onModelChange={handleModelChange}
              onSave={handleSaveModel}
              onReset={handleResetModel}
            />
          </TabsContent>

          <TabsContent value="ingestion">
            <IngestionTab
              urlInput={urlInput}
              onUrlChange={setUrlInput}
              isIngesting={isIngesting}
              forceRefresh={forceRefresh}
              onForceRefreshChange={setForceRefresh}
              onSubmit={handleIngestURL}
              showIngestionProgress={showIngestionProgress}
              currentIngestionUrl={currentIngestionUrl}
              progressEndpoint={ingestionProgressEndpoint}
              onProgressComplete={handleIngestionProgressComplete}
              ingestionHistory={ingestionHistory}
            />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTab
              stats={databaseStats}
              usagePercentage={databaseUsagePercentage}
              lastIngestedLabel={lastIngestedLabel}
              isLoading={isLoadingStats}
              onExport={exportDatabaseStats}
              onRefresh={refreshDatabaseMetrics}
              sources={databaseSources}
              filteredSources={filteredSources}
              sourceSearchQuery={sourceSearchQuery}
              onSourceSearchQueryChange={updateSourceSearchQuery}
              sourceSortBy={sourceSortBy}
              onCycleSourceSort={cycleSourceSort}
              formatDateDisplay={formatDateDisplay}
              sourcesError={sourcesError}
              isPurging={isPurging}
              onPurge={handlePurgeDatabase}
              activityLog={activityLog}
              showActivityLog={showActivityLog}
              onToggleActivityLog={handleToggleActivityLog}
            />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab
              visitSummary={visitSummary}
              visitSummaryError={visitSummaryError}
              visitSummaryLoading={visitSummaryLoading}
              onRefreshVisitSummary={handleRefreshVisitSummary}
              visitDailyCounts={visitDailyCounts}
              logsFilters={logsFilters}
              onFiltersChange={setLogsFilters}
              logsLoading={logsLoading}
              logsError={logsError}
              chatLogs={chatLogs}
              formatDateDisplay={formatDateDisplay}
              formatBooleanLabel={formatBooleanLabel}
              summariseMetadata={summariseMetadata}
              logsPagination={logsPagination}
              onApplyFilters={handleLogsApplyFilters}
              onResetFilters={handleLogsResetFilters}
              onRefreshLogs={handleLogsRefresh}
              onNextPage={handleLogsNextPage}
              onPreviousPage={handleLogsPreviousPage}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
