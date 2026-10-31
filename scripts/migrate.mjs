import { configuration, clients, reportFailure } from './lib/operator.mjs';
import { migrate, lockId, SetupError } from './lib/bootstrap.mjs';
let db;
try {
  ({ db } = clients(configuration()));
  await db.connect();
  if (!(await db.query('select pg_try_advisory_lock($1) as locked',[lockId])).rows[0].locked) throw new SetupError('Another migration is running.');
  await migrate(db);
  console.log('PASS: versioned migrations applied; no bootstrap or account changes requested.');
} catch(error) { reportFailure(error, 'versioned migrations'); }
finally { if(db) await db.end().catch(()=>{}); }
