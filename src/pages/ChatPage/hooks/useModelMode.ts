import { useEffect } from 'react';
import { getModelDisplayName, LLM_MODELS } from '@/constants/models';
import { StorageKeys } from '@/constants/storage';
import { setLocalStorageItem } from '@/utils/storage';

const MODEL_MODE_MAP = {
  smart: 'gpt-5-mini',
  fast: 'gpt-4.1-mini',
} as const;

const getProviderForModel = (modelId: string): string => {
  const model = LLM_MODELS.find((item) => item.id === modelId);
  return model?.provider ?? 'openai';
};

export const useModelMode = (
  modelMode: 'fast' | 'smart',
  setCurrentModel: (model: string) => void,
) => {
  useEffect(() => {
    const modelId = MODEL_MODE_MAP[modelMode];
    const provider = getProviderForModel(modelId);
    setLocalStorageItem(StorageKeys.selectedModel, modelId);
    setLocalStorageItem(StorageKeys.selectedProvider, provider);
    setCurrentModel(getModelDisplayName(modelId));
  }, [modelMode, setCurrentModel]);
};
