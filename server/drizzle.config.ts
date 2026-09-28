import { defineConfig } from 'drizzle-kit';

// Only `drizzle-kit generate` reads this, and it needs no database. The
// migrations are applied by scripts/migrate.ts, once per deploy.
export default defineConfig({
  dialect: 'postgresql',
  schema: '../shared/schema.ts',
  out: './drizzle',
});
