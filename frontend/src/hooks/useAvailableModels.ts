import { useCallback, useEffect, useState } from "react";
import { getModels } from "../api";
import { FALLBACK_MODEL } from "../config/personas";
import type { ModelOption } from "../types";

export function useAvailableModels() {
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([
    FALLBACK_MODEL,
  ]);
  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODEL.id);
  const [isModelListLoading, setIsModelListLoading] = useState(true);

  const refreshAvailableModels = useCallback(async (forceRefresh = false) => {
    try {
      const models = await getModels(forceRefresh);
      setAvailableModels((current) => (models.length > 0 ? models : current));
      setSelectedModel((current) =>
        models.length > 0 && !models.some((model) => model.id === current)
          ? models[0].id
          : current,
      );
    } catch (err) {
      console.error("Failed to fetch models:", err);
    } finally {
      setIsModelListLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(
      () => void refreshAvailableModels(),
      0,
    );
    return () => window.clearTimeout(refreshTimer);
  }, [refreshAvailableModels]);

  return {
    availableModels,
    selectedModel,
    setSelectedModel,
    isModelListLoading,
    refreshAvailableModels,
  };
}

