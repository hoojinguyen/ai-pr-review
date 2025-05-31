import { Router } from 'express';
import webHookRouter from './webHookRoute';

const apiRouter = Router();

apiRouter.use('/webhook', webHookRouter);

export { apiRouter };
