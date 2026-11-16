import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8')
]);

assert.match(html, /id="passwordRecoveryScreen"/, 'Dedicated recovery request screen must exist');
assert.match(html, /id="passwordRecoveryForm"/, 'Recovery email form must exist');
assert.match(html, /id="passwordResetScreen"/, 'Dedicated password reset screen must exist');
assert.match(html, /id="passwordResetPageForm"/, 'New password form must exist');
assert.match(app, /auth\.resetPasswordForEmail\(email,\s*\{\s*redirectTo:/, 'Recovery email must use Supabase Auth and a redirect URL');
assert.match(app, /auth\.updateUser\(\{\s*password\s*\}\)/, 'New password must be saved through Supabase Auth');
assert.match(app, /event === 'PASSWORD_RECOVERY'/, 'Recovery callback must open the dedicated reset screen');
assert.match(app, /if \(password !== confirmation\)/, 'Password confirmation must be checked');
assert.match(app, /Wenn zu dieser Adresse ein PFMS-Konto gehört/, 'Response must not reveal whether an email is registered');
assert.match(css, /PFMS PASSWORD RECOVERY/, 'Recovery screens must have dedicated responsive styling');

console.log('PFMS password recovery contract checks passed.');
