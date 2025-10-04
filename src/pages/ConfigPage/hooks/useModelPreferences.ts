import { useState, useEffect, useCallback } from 'react';
import type { LLMModel } from '@/constants/models';
import type { ModelProvider } from '../types';

const MODEL_STORAGE_KEY = 'selectedLLMModel';
const PROVIDER_STORAGE_KEY = 'selectedLLMProvider';

const isModelProvider = (value: string | null): value is ModelProvider => {
  return value === 'openai' || value === 'google' || value === 'anthropic';
};

export interface ModelPreferencesHook {
  selectedModel: string;
  selectedProvider: ModelProvider;
  tempSelectedModel: string;
  tempSelectedProvider: ModelProvider;
  hasUnsavedChanges: boolean;
  selectModel: (modelId: string) => void;
  selectProvider: (provider: ModelProvider) => void;
  savePreferences: () => LLMModel | null;
  resetPreferences: () => void;
}

export const useModelPreferences = (
  models: LLMModel[],
  defaultModelId: string,
  fallbackProvider: ModelProvider
): ModelPreferencesHook => {
  const defaultProvider = (models.find((model) => model.id === defaultModelId)?.provider as ModelProvider) || fallbackProvider;

  const [selectedModel, setSelectedModel] = useState<string>(defaultModelId);
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>(defaultProvider);
  const [tempSelectedModel, setTempSelectedModel] = useState<string>(defaultModelId);
  const [tempSelectedProvider, setTempSelectedProvider] = useState<ModelProvider>(defaultProvider);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      const savedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);

      const initialModel = models.find((model) => model.id === savedModel)?.id || defaultModelId;
      const initialProvider = isModelProvider(savedProvider)
        ? savedProvider
        : ((models.find((model) => model.id === initialModel)?.provider as ModelProvider) || defaultProvider);

      setSelectedModel(initialModel);
      setSelectedProvider(initialProvider);
      setTempSelectedModel(initialModel);
      setTempSelectedProvider(initialProvider);
    } catch (error) {
      console.warn('Failed to load model preferences from storage', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultModelId, defaultProvider, models]);

  const selectProvider = useCallback(
    (provider: ModelProvider) => {
      setTempSelectedProvider(provider);
      setHasUnsavedChanges(provider !== selectedProvider || tempSelectedModel !== selectedModel);
    },
    [selectedModel, selectedProvider, tempSelectedModel]
  );

  const selectModel = useCallback(
    (modelId: string) => {
      const model = models.find((item) => item.id === modelId);
      if (!model) return;

      const provider = model.provider as ModelProvider;
      setTempSelectedModel(modelId);
      setTempSelectedProvider(provider);
      setHasUnsavedChanges(modelId !== selectedModel || provider !== selectedProvider);
    },
    [models, selectedModel, selectedProvider]
  );

  const savePreferences = useCallback(() => {
    const model = models.find((item) => item.id === tempSelectedModel);
    if (!model) {
      return null;
    }

    const provider = tempSelectedProvider;

    setSelectedModel(tempSelectedModel);
    setSelectedProvider(provider);
    setHasUnsavedChanges(false);

    try {
      localStorage.setItem(MODEL_STORAGE_KEY, tempSelectedModel);
      localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    } catch (error) {
      console.warn('Failed to persist model preferences', error);
    }

    return model;
  }, [models, tempSelectedModel, tempSelectedProvider]);

  const resetPreferences = useCallback(() => {
    setTempSelectedModel(selectedModel);
    setTempSelectedProvider(selectedProvider);
    setHasUnsavedChanges(false);
  }, [selectedModel, selectedProvider]);

  return {
    selectedModel,
    selectedProvider,
    tempSelectedModel,
    tempSelectedProvider,
    hasUnsavedChanges,
    selectModel,
    selectProvider,
    savePreferences,
    resetPreferences,
  };
};
