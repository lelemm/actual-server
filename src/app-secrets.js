import express from 'express';
import { secretsService } from './services/secrets-service.js';
import getAccountDb, { isAdmin } from './account-db.js';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from './util/middlewares.js';

const app = express();

export { app as handlers };
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(validateSessionMiddleware);

app.post('/', async (req, res) => {
  const { method } =
    getAccountDb().first('SELECT method FROM auth WHERE active = 1') || {};

  const { name, value } = req.body;

  if (method === 'openid') {
    let canSaveSecrets = isAdmin(req.userSession.user_id);

    if (!canSaveSecrets) {
      res.status(403).send({
        status: 'error',
        reason: 'not-admin',
        details: 'You have to be admin to set secrets',
      });

      return null;
    }
  }

  secretsService.set(name, value);

  res.status(200).send({ status: 'ok' });
});

app.get('/:name', async (req, res) => {
  const name = req.params.name;
  const keyExists = secretsService.exists(name);
  if (keyExists) {
    res.sendStatus(204);
  } else {
    res.status(404).send('key not found');
  }
});
