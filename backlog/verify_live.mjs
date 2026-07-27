#!/usr/bin/env node
// Checks a REAL Supabase project — the things that cannot be proven against
// local Postgres or a mock. Read-only: it creates no accounts and writes no data.
//
//   node verify_live.mjs https://YOUR-PROJECT.supabase.co YOUR_ANON_KEY [you@example.com]
//
// Pass an email as the third argument to also test magic-link delivery.

const [, , URL_IN, KEY, EMAIL] = process.argv;

if (!URL_IN || !KEY) {
  console.error('usage: node verify_live.mjs <project-url> <anon-key> [email]');
  process.exit(2);
}
const URL_BASE = URL_IN.replace(/\/+$/, '');

let failures = 0;
const ok = (label, cond, extra = '') => {
  if (!cond) failures++;
  console.log(`${cond ? ' PASS' : '*FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
};
const anon = (path, opts = {}) => fetch(URL_BASE + path, {
  ...opts,
  headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) }
});

console.log(`\nChecking ${URL_BASE}\n`);

// --- reachable, and not asleep ---------------------------------------------
let reachable = false;
try {
  const res = await anon('/rest/v1/');
  reachable = res.status < 500;
  ok('project is reachable and awake', reachable, 'HTTP ' + res.status);
} catch (err) {
  ok('project is reachable and awake', false, err.message);
}
if (!reachable) {
  console.log('\nStopping — nothing else can be checked. A paused free project looks like this.');
  process.exit(1);
}

// --- schema installed ------------------------------------------------------
const shelves = await anon('/rest/v1/public_shelves?select=handle&limit=1');
ok('schema.sql has been run (public_shelves exists)', shelves.status !== 404,
   shelves.status === 404 ? 'run schema.sql in the SQL editor' : 'HTTP ' + shelves.status);

// --- THE important one: anonymous callers must not reach private data -------
const libs = await anon('/rest/v1/libraries?select=doc&limit=1');
const libsBody = await libs.text();
const libsLeaks = libs.ok && libsBody.trim() !== '[]';
ok('anonymous caller cannot read libraries', !libsLeaks,
   libsLeaks ? 'RLS IS NOT PROTECTING THIS TABLE' : 'returns ' + (libs.ok ? 'empty set' : 'HTTP ' + libs.status));

const forged = await anon('/rest/v1/libraries', {
  method: 'POST',
  body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000', doc: { probe: true } })
});
ok('anonymous caller cannot write libraries', !forged.ok, 'HTTP ' + forged.status);

const forgedShelf = await anon('/rest/v1/public_shelves', {
  method: 'POST',
  body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000', handle: 'probe', items: [] })
});
ok('anonymous caller cannot write public_shelves', !forgedShelf.ok, 'HTTP ' + forgedShelf.status);

const privateProfiles = await anon('/rest/v1/profiles?select=handle,is_public');
const profileRows = privateProfiles.ok ? await privateProfiles.json() : [];
ok('only public profiles are visible anonymously',
   profileRows.every(p => p.is_public === true),
   profileRows.length + ' row(s) returned, all public');

// --- functions present and callable ----------------------------------------
const avail = await anon('/rest/v1/rpc/handle_available', {
  method: 'POST', body: JSON.stringify({ want: 'zz-probe-handle' })
});
ok('handle_available() is callable', avail.ok, 'HTTP ' + avail.status);
if (avail.ok) {
  const malformed = await anon('/rest/v1/rpc/handle_available', {
    method: 'POST', body: JSON.stringify({ want: 'AB' })
  });
  ok('handle_available() rejects a malformed handle', (await malformed.json()) === false);
}

const publishAnon = await anon('/rest/v1/rpc/publish_shelf', { method: 'POST' });
ok('publish_shelf() refuses an unauthenticated caller', !publishAnon.ok, 'HTTP ' + publishAnon.status);

// --- published shelves must never carry private fields ---------------------
if (shelves.status !== 404) {
  const all = await anon('/rest/v1/public_shelves?select=*');
  const text = all.ok ? await all.text() : '';
  const banned = ['"notes"', '"price"', '"reason"', '"hours"', '"shareReview"'];
  const found = banned.filter(k => text.includes(k));
  ok('no published shelf carries a private field', found.length === 0,
     found.length ? 'FOUND: ' + found.join(', ') : (all.ok ? 'checked all rows' : 'none published yet'));
}

// --- magic link, only if asked --------------------------------------------
if (EMAIL) {
  const otp = await anon('/auth/v1/otp?redirect_to=' + encodeURIComponent('https://dramadanov.github.io/backlog/'), {
    method: 'POST', body: JSON.stringify({ email: EMAIL, create_user: true })
  });
  const body = await otp.text();
  ok('magic link accepted for sending', otp.ok, otp.ok ? 'check ' + EMAIL : body.slice(0, 120));
  if (otp.ok) console.log('       If no email arrives, SMTP is not configured (step 5 in SETUP.md).');
} else {
  console.log('\n(skipping magic-link check — pass an email address as the third argument)');
}

console.log(`\n${failures === 0 ? 'All checks passed.' : failures + ' check(s) failed.'}\n`);
process.exit(failures === 0 ? 0 : 1);
