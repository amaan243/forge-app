import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { env } from "../src/config/env.js";
const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())");
const migrations = (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((file) => file.endsWith(".sql")).sort();
for (const migration of migrations) {
	const applied = await client.query("select 1 from public.schema_migrations where version = $1", [migration]);
	if (applied.rowCount) continue;
	await client.query("begin");
	try { await client.query(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8")); await client.query("insert into public.schema_migrations (version) values ($1)", [migration]); await client.query("commit"); console.log(`Applied ${migration}`); } catch (error) { await client.query("rollback"); throw error; }
}
await client.end();
console.log("Migrations are up to date.");