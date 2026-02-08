// scripts/check-keiba-payout.js
// Usage: node scripts/check-keiba-payout.js --raceId=YYYYMMDD_HHMM --userId=USERID
// Prints count of PAYOUT transactions and bet payout status.

const { createClient } = require('@libsql/client');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const [k, v] = a.split('=');
    if (k && v && k.startsWith('--')) out[k.slice(2)] = v;
  }
  return out;
}

(async () => {
  const { raceId, userId } = parseArgs();
  if (!raceId || !userId) {
    console.error('Missing --raceId or --userId');
    process.exit(1);
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set');
    process.exit(1);
  }

  const client = createClient({ url, authToken });

  const payoutTx = await client.execute({
    sql: `SELECT COUNT(*) as cnt
          FROM transactions
          WHERE user_id = ? AND type = 'PAYOUT' AND description LIKE ?`,
    args: [userId, `%競馬払戻 ${raceId}%`],
  });

  const betRows = await client.execute({
    sql: `SELECT id, payout, is_win, type, horse_id, bet_amount
          FROM keiba_transactions
          WHERE user_id = ? AND race_id = ?`,
    args: [userId, raceId],
  });

  console.log('PAYOUT count:', payoutTx.rows[0]?.cnt ?? 0);
  console.log('BETS:', betRows.rows);

  await client.close();
})();
