import getAccountDb from './src/account-db.js';
import runMigrations from './src/migrations.js';

const GENERIC_ADMIN_ID = 'genericAdmin';
const ADMIN_ROLE_ID = '213733c1-5645-46ad-8784-a7b20b400f93';

const createUser = (userId, userName, role, owner = 0, enabled = 1) => {
  if (!userId || !userName || !role) {
    throw new Error('Missing required parameters');
  }

  try {
    getAccountDb().mutate(
      'INSERT INTO users (id, user_name, display_name, enabled, owner) VALUES (?, ?, ?, ?, ?)',
      [userId, userName, `${userName} display`, enabled, owner],
    );
    getAccountDb().mutate(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, role],
    );
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

const setSessionUser = (userId, token = 'valid-token') => {
  getAccountDb().mutate('UPDATE sessions SET user_id = ? WHERE token = ?', [
    userId,
    token,
  ]);
};

export default async function setup() {
  await runMigrations();

  createUser(GENERIC_ADMIN_ID, 'admin', ADMIN_ROLE_ID, 1);

  // Insert a fake "valid-token" fixture that can be reused
  const db = getAccountDb();
  await db.mutate('DELETE FROM sessions');
  await db.mutate(
    'INSERT INTO sessions (token, expires_at, user_id) VALUES (?, ?, ?)',
    ['valid-token', -1, 'genericAdmin'],
  );
  await db.mutate(
    'INSERT INTO sessions (token, expires_at, user_id) VALUES (?, ?, ?)',
    ['valid-token-admin', -1, 'genericAdmin'],
  );

  setSessionUser('genericAdmin');
  setSessionUser('genericAdmin', 'valid-token-admin');
}
