import { WebHookController } from '@/controllers';
import { Router } from 'express';

const webHookRouter = Router();
const webHookController = new WebHookController();

webHookRouter.post('/', webHookController.handleWebHook);

export default webHookRouter;
