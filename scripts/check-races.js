
const { createClient } = require('@libsql/client');

(async () => {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) {
        console.error('TURSO_DATABASE_URL is not set');
        process.exit(1);
    }

    const client = createClient({ url, authToken });

    // JST date for prefix
    const now = new Date();
    const jstParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const y = jstParts.find(p => p.type === "year").value;
    const m = jstParts.find(p => p.type === "month").value;
    const d = jstParts.find(p => p.type === "day").value;
    const todayJst = `${y}${m}${d}`;

    console.log(`Checking races for prefix: ${todayJst}`);

    try {
        const raceId = "20260209_0110";
        console.log(`Checking race: ${raceId}`);

        const race = await client.execute({
            sql: "SELECT * FROM keiba_races WHERE id = ?",
            args: [raceId]
        });
        console.log("Race:", JSON.stringify(race.rows, null, 2));

        const bets = await client.execute({
            sql: "SELECT count(*) as total, sum(bet_amount) as amount FROM keiba_transactions WHERE race_id = ?",
            args: [raceId]
        });
        console.log("Bets summary:", bets.rows);

        const winningBets = await client.execute({
            sql: "SELECT count(*) as wins, sum(payout) as payouts FROM keiba_transactions WHERE race_id = ? AND is_win = 1",
            args: [raceId]
        });
        console.log("Winning bets summary:", winningBets.rows);

        const payouts = await client.execute({
            sql: "SELECT count(*) as tx_count, sum(amount) as tx_amount FROM transactions WHERE type = 'PAYOUT' AND description LIKE ?",
            args: [`%${raceId}%`]
        });
        console.log("Ledger payouts summary:", payouts.rows);
    } catch (e) {
        console.error(e);
    }

    await client.close();
})();
