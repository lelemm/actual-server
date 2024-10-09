import * as bcrypt from 'bcrypt';
import getAccountDb, { clearExpiredSessions } from '../account-db.js';
import * as uuid from 'uuid';
import finalConfig from '../load-config.js';
import { TOKEN_EXPIRATION_NEVER } from '../util/validate-user.js';

function isValidPassword(password) {
  return password != null && password !== '';
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

export function bootstrapPassword(password) {
  if (!isValidPassword(password)) {
    return { error: 'invalid-password' };
  }

  let hashed = hashPassword(password);
  let accountDb = getAccountDb();
  accountDb.transaction(() => {
    accountDb.mutate('DELETE FROM auth WHERE method = ?', ['password']);
    accountDb.mutate('UPDATE auth SET active = 0');
    accountDb.mutate(
      "INSERT INTO auth (method, display_name, extra_data, active) VALUES ('password', 'Password', ?, 1)",
      [hashed],
    );
  });

  return {};
}

export function loginWithPassword(password) {
  if (!isValidPassword(password)) {
    return { error: 'invalid-password' };
  }

  let accountDb = getAccountDb();
  const { extra_data: passwordHash } =
    accountDb.first('SELECT extra_data FROM auth WHERE method = ?', [
      'password',
    ]) || {};

  let confirmed = bcrypt.compareSync(password, passwordHash);

  if (!confirmed) {
    return { error: 'invalid-password' };
  }

  let sessionRow = accountDb.first(
    'SELECT * FROM sessions WHERE auth_method = ?',
    ['password'],
  );

  let token = sessionRow ? sessionRow.token : uuid.v4();

  let { totalOfUsers } = accountDb.first(
    'SELECT count(*) as totalOfUsers FROM users',
  );
  let userId = null;
  if (totalOfUsers === 0) {
    userId = uuid.v4();
    accountDb.mutate(
      'INSERT INTO users (id, user_name, display_name, enabled, owner) VALUES (?, ?, ?, 1, 1)',
      [userId, '', ''],
    );

    const { id: adminRoleId } =
      accountDb.first('SELECT id FROM roles WHERE name = ?', ['Admin']) || {};

    if (!adminRoleId) {
      return { error: 'administrator-role-not-found' };
    }

    accountDb.mutate(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, adminRoleId],
    );
  } else {
    let { id: userIdFromDb } = accountDb.first(
      'SELECT id FROM users WHERE user_name = ?',
      [''],
    );

    userId = userIdFromDb;

    if (!userId) {
      return { error: 'user-not-found' };
    }
  }

  let expiration = TOKEN_EXPIRATION_NEVER;
  if (
    finalConfig.token_expiration != 'never' &&
    finalConfig.token_expiration != 'openid-provider' &&
    typeof finalConfig.token_expiration === 'number'
  ) {
    expiration =
      Math.floor(Date.now() / 1000) + finalConfig.token_expiration * 60;
  }

  if (!sessionRow) {
    accountDb.mutate(
      'INSERT INTO sessions (token, expires_at, user_id, auth_method) VALUES (?, ?, ?, ?)',
      [token, expiration, userId, 'password'],
    );
  } else {
    accountDb.mutate(
      'UPDATE sessions SET user_id = ?, expires_at = ? WHERE token = ?',
      [userId, expiration, token],
    );
  }

  clearExpiredSessions();

  return { token };
}

export function changePassword(newPassword) {
  let accountDb = getAccountDb();

  if (!isValidPassword(newPassword)) {
    return { error: 'invalid-password' };
  }

  let hashed = hashPassword(newPassword);
  accountDb.mutate("UPDATE auth SET extra_data = ? WHERE method = 'password'", [
    hashed,
  ]);
  return {};
}
