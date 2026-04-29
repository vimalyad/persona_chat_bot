import { Router } from "express";
import { postChatController } from "../controllers/chatController";
import { getModelsController } from "../controllers/modelController";
import {
  getSessionController,
  resetSessionController,
} from "../controllers/sessionController";

const router = Router();

router.get("/sessions/:persona", getSessionController);
router.post("/sessions/:persona/reset", resetSessionController);
router.get("/models", getModelsController);
router.post("/chat", postChatController);

export default router;

