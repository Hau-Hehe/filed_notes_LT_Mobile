// Run with: node --test tests/session.node.cjs
// Isolated from device storage; no Expo native modules are loaded.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../src/services/session.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { createSessionController } = loaded.exports;

function setup(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  const failures = new Set();
  const storage = {
    async getItemAsync(key) {
      calls.push(`get:${key}`);
      if (failures.has(`get:${key}`)) throw new Error('Read failure');
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      calls.push(`set:${key}`);
      if (failures.has(`set:${key}`)) throw new Error('Write failure');
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      calls.push(`delete:${key}`);
      if (failures.has(`delete:${key}`)) throw new Error('Delete failure');
      values.delete(key);
    },
  };
  return { values, calls, failures, storage, controller: createSessionController(storage) };
}
const existing = { user_token: 'old-token', username: 'huy' };

test('restores session, logs out, stays signed out on restart and signs in again', async () => {
  const f = setup(existing);
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().user.username, 'huy');
  await f.controller.signOut();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.equal(f.values.has('user_token'), false);
  assert.equal(f.values.has('username'), false);
  assert.ok(f.calls.every(c => !c.includes('@field_notes')));
  const restarted = createSessionController(f.storage);
  await restarted.restore();
  assert.equal(restarted.getSnapshot().user, null);
  await restarted.signIn('huy', 'password');
  assert.equal(restarted.getSnapshot().user.username, 'huy');
  assert.equal(f.values.has('field_notes_session_revoked'), false);
  assert.ok(!Array.from(f.values.values()).includes('password'));
});

test('partial SecureStore deletion attempts both keys and prevents restart authentication', async () => {
  const f = setup(existing);
  await f.controller.restore();
  f.failures.add('delete:user_token');
  await f.controller.signOut();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.match(f.controller.getSnapshot().error, /chưa xóa hết/);
  assert.ok(f.calls.includes('delete:username'));
  // Even stale credential remnants must not restore a revoked session.
  f.values.set('username', 'huy');
  const restarted = createSessionController(f.storage);
  await restarted.restore();
  assert.equal(restarted.getSnapshot().user, null);
  f.failures.clear();
  await f.controller.signOut();
  assert.equal(f.controller.getSnapshot().error, null);
  assert.equal(f.controller.getSnapshot().retrySignOut, false);
  assert.equal(f.values.has('user_token'), false);
});

test('total storage failure locks memory and reports persistence uncertainty', async () => {
  const f = setup(existing);
  await f.controller.restore();
  ['set:field_notes_session_revoked', 'delete:user_token', 'delete:username'].forEach(k => f.failures.add(k));
  await f.controller.signOut();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.match(f.controller.getSnapshot().error, /chưa bảo đảm/);
  assert.equal(f.controller.getSnapshot().busy, false);
});

test('credential deletion still succeeds when revocation marker cannot be written', async () => {
  const f = setup(existing);
  f.failures.add('set:field_notes_session_revoked');
  await f.controller.signOut();
  const restarted = createSessionController(f.storage);
  await restarted.restore();
  assert.equal(restarted.getSnapshot().user, null);
  assert.equal(f.controller.getSnapshot().error, null);
});

test('repeated logout taps share one operation', async () => {
  const f = setup(existing);
  const first = f.controller.signOut();
  const second = f.controller.signOut();
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(f.calls.filter(c => c === 'delete:user_token').length, 1);
  assert.equal(f.calls.filter(c => c === 'delete:username').length, 1);
});

test('shared local data does not block another demo username', async () => {
  const f = setup({ ...existing, field_notes_data_owner: 'old-user', '@field_notes_data': '[{"id":"old-note"}]', '@field_notes_sync_queue': '[{"id":"old-operation"}]' });
  const notes = f.values.get('@field_notes_data');
  const queue = f.values.get('@field_notes_sync_queue');
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().user.username, 'huy');
  await f.controller.signOut();
  await f.controller.signIn('other-user', 'password');
  assert.equal(f.controller.getSnapshot().user.username, 'other-user');
  assert.equal(f.values.get('@field_notes_data'), notes);
  assert.equal(f.values.get('@field_notes_sync_queue'), queue);
  assert.ok(f.calls.every(c => !c.includes('field_notes_data_owner') && !c.includes('@field_notes')));
});

test('legacy notes with no owner allow sign-in and survive sign-out', async () => {
  const notes = '[{"id":"legacy-note","imageUri":"file:///existing-photo.jpg"}]';
  const f = setup({ '@field_notes_data': notes });
  await f.controller.signIn('huy', 'password');
  assert.equal(f.controller.getSnapshot().user.username, 'huy');
  assert.equal(f.controller.getSnapshot().error, null);
  await f.controller.signOut();
  assert.equal(f.values.get('@field_notes_data'), notes);
  assert.equal(f.values.has('field_notes_data_owner'), false);
});

test('partial sign-in cannot restore after token write fails', async () => {
  const f = setup();
  f.failures.add('set:user_token');
  await f.controller.signIn('huy', 'password');
  assert.equal(f.controller.getSnapshot().user, null);
  assert.ok(f.controller.getSnapshot().error);
  const restarted = createSessionController(f.storage);
  await restarted.restore();
  assert.equal(restarted.getSnapshot().user, null);
});

test('session read errors never authenticate and expose a recoverable error', async () => {
  const f = setup(existing);
  f.failures.add('get:user_token');
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().ready, true);
  assert.equal(f.controller.getSnapshot().user, null);
  assert.ok(f.controller.getSnapshot().error);
});

test('successful sign-in persists across restart', async () => {
  const f = setup();
  await f.controller.signIn('huy', 'password');
  const restarted = createSessionController(f.storage);
  await restarted.restore();
  assert.equal(restarted.getSnapshot().user.username, 'huy');
  assert.equal(restarted.getSnapshot().busy, false);
});

test('invalid credentials show validation error without logout-retry UI', async () => {
  const f = setup();
  await f.controller.signIn('', '');
  assert.equal(f.controller.getSnapshot().user, null);
  assert.ok(f.controller.getSnapshot().error);
  assert.equal(f.controller.getSnapshot().retrySignOut, false);
  assert.equal(f.calls.length, 0);
});
