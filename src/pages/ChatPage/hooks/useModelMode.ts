import { useEffect } from 'react';
import { getModelDisplayName } from '@/constants/models';

export const useModelMode = (
  modelMode: 'fast' | 'smart',
  setCurrentModel: (model: string) => void,
) => {
  useEffect(() => {
    const modelId = modelMode === 'smart' ? 'gpt-5-mini' : 'gpt-4.1-mini';
    localStorage.setItem('selectedLLMModel', modelId);
    localStorage.setItem('selectedLLMProvider', 'openai');
    setCurrentModel(getModelDisplayName(modelId));
  }, [modelMode, setCurrentModel]);
};
