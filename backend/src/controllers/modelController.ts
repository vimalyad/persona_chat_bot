import { Request, Response } from "express";
import {
  getAvailableModels,
  refreshAvailableModels,
} from "../services/geminiService";

export async function getModelsController(req: Request, res: Response) {
  try {
    const shouldRefresh = req.query.refresh === "true";
    const models = shouldRefresh
      ? await refreshAvailableModels()
      : await getAvailableModels();

    res.json({ models });
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Failed to fetch available models" });
  }
}

