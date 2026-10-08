import { Client } from "pg";
import { env } from "../src/config/env.js";
const client = new Client({ connectionString: env.DATABASE_URL });
await client.connect();
console.log("Development seed is intentionally empty; create users through Supabase Auth.");
await client.end();