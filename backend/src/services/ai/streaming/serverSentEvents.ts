import { Response } from "express";

export function prepareSseResponse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

export function writeSseText(res: Response, text: string) {
  if (!text) return;
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
}

export function writeSseError(res: Response, error: string) {
  res.write(`data: ${JSON.stringify({ error })}\n\n`);
}

export function endSseResponse(res: Response) {
  res.write(`data: [DONE]\n\n`);
  res.end();
}

