import { GoogleGenAI } from "@google/genai";
import {
  CACHE_TTL_MS,
  CHAT_FAILURE_COOLDOWN_MS,
  MODEL_PING_CONCURRENCY,
} from "../../constants";
import { isBlockedModel } from "./blockedModelPolicy";
import { UnavailableModelTracker } from "./unavailableModelTracker";
import {
  canGenerateWithGeminiModel,
  getGeminiClient,
  hasGeminiApiKey,
  listGeminiCandidateModels,
} from "./providers/geminiModelProvider";
import {
  canGenerateWithGroqModel,
  listGroqCandidateModels,
} from "./providers/groqModelProvider";
import { AvailableModel } from "./aiTypes";

export class AvailableModelRegistry {
  private cachedModels: AvailableModel[] | null = null;
  private cacheTimestamp = 0;
  private refreshPromise: Promise<AvailableModel[]> | null = null;

  constructor(private readonly unavailableModels: UnavailableModelTracker) {}

  getAvailableModels() {
    const now = Date.now();
    if (this.cachedModels && now - this.cacheTimestamp < CACHE_TTL_MS) {
      return Promise.resolve(this.getUsableCachedModels());
    }

    if (this.cachedModels) {
      return Promise.resolve(this.getUsableCachedModels());
    }

    return this.refreshModels("initial load");
  }

  async refreshAvailableModels() {
    const models = await this.refreshModels("requested refresh");
    return models.filter(
      (model) => !this.unavailableModels.isUnavailable(model.id),
    );
  }

  markUnavailable(modelId: string) {
    if (!modelId) return;

    this.unavailableModels.markUnavailable(modelId, CHAT_FAILURE_COOLDOWN_MS);
    if (this.cachedModels) {
      this.cachedModels = this.cachedModels.filter(
        (model) => model.id !== modelId,
      );
      this.cacheTimestamp = Date.now();
    }
  }

  private getUsableCachedModels() {
    return (this.cachedModels || []).filter(
      (model) => !this.unavailableModels.isUnavailable(model.id),
    );
  }

  private refreshModels(reason: string) {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    try {
      const client = hasGeminiApiKey() ? getGeminiClient() : null;
      console.log(`Refreshing available Gemini models: ${reason}`);
      this.refreshPromise = this.discoverReachableModels(client)
        .catch((error) => {
          console.error("Failed to refresh available Gemini models:", error);
          return this.cachedModels || [];
        })
        .finally(() => {
          this.refreshPromise = null;
        });

      return this.refreshPromise;
    } catch (error) {
      console.error("Failed to start Gemini model refresh:", error);
      return Promise.resolve(this.cachedModels || []);
    }
  }

  private async discoverReachableModels(client: GoogleGenAI | null) {
    const previousModels = this.getUsableCachedModels();
    const candidateModels = await this.listCandidateModels(client);
    const models = await this.filterReachableModels(
      client,
      candidateModels.filter(
        (model) =>
          model.id && !isBlockedModel(model.id) && !isBlockedModel(model.name),
      ),
    );

    models.sort((a, b) => modelSortPriority(a.id) - modelSortPriority(b.id));

    if (models.length > 0) {
      this.cachedModels = models;
      this.cacheTimestamp = Date.now();
      return models;
    }

    if (previousModels.length > 0) {
      console.warn(
        "Model refresh returned no reachable models; keeping previous available list.",
      );
      this.cachedModels = previousModels;
      this.cacheTimestamp = Date.now();
      return previousModels;
    }

    this.cachedModels = [];
    this.cacheTimestamp = Date.now();
    return [];
  }

  private async listCandidateModels(client: GoogleGenAI | null) {
    const candidateModels: AvailableModel[] = [];

    if (client) {
      candidateModels.push(...(await listGeminiCandidateModels(client)));
    }

    candidateModels.push(...(await listGroqCandidateModels()));
    return candidateModels;
  }

  private async filterReachableModels(
    client: GoogleGenAI | null,
    models: AvailableModel[],
  ) {
    const reachableModels: AvailableModel[] = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < models.length) {
        const model = models[nextIndex++];
        if (
          (await canGenerateWithModel(client, model)) &&
          !this.unavailableModels.isUnavailable(model.id)
        ) {
          reachableModels.push(model);
        }
      }
    };

    const canGenerateWithModel = async (
      activeClient: GoogleGenAI | null,
      model: AvailableModel,
    ) => {
      if (model.provider === "groq") {
        return canGenerateWithGroqModel(model.apiModel);
      }

      if (!activeClient) {
        return false;
      }

      const canGenerate = await canGenerateWithGeminiModel(
        activeClient,
        model.apiModel,
      );
      if (canGenerate) {
        this.unavailableModels.clear(model.id);
      }
      return canGenerate;
    };

    const workerCount = Math.min(MODEL_PING_CONCURRENCY, models.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return reachableModels;
  }
}

function modelSortPriority(id: string) {
  if (id.includes("flash")) return 0;
  if (id.includes("pro")) return 1;
  return 2;
}
