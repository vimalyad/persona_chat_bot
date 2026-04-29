import { Request, Response } from "express";
import { getOrCreateSession, resetSession } from "../services/sessionService";

export async function getSessionController(req: Request, res: Response) {
  const persona = String(req.params.persona);
  const session = await getOrCreateSession(persona);
  res.json(session);
}

export async function resetSessionController(req: Request, res: Response) {
  const persona = String(req.params.persona);
  const session = await resetSession(persona);
  res.json(session);
}
