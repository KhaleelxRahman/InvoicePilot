import { loadAppConfig } from '../config.js';
import { openAndMigrateDatabase, STAGE04_SCHEMA_VERSION } from './schema.js';
import { InvoicePilotRepository } from './repository.js';

function main() {
  const mode = (process.argv[2] ?? 'migrate').trim().toLowerCase();
  const config = loadAppConfig(process.env, { loadDotEnvFile: true });

  console.log(`=== InvoicePilot Stage 04 Database CLI (${mode}) ===`);
  console.log(`Database File : ${config.databaseUrl}`);

  const db = openAndMigrateDatabase(config.databaseUrl);
  try {
    console.log(`Schema Version: v${STAGE04_SCHEMA_VERSION} applied.`);

    if (mode === 'seed-demo' || mode === 'reset-demo') {
      const repo = new InvoicePilotRepository(db);
      const seeded = repo.resetAndSeedDemoTenant();
      console.log(
        `Demo Tenant   : ${seeded.demoUser.id} (${seeded.demoUser.email}) — ${seeded.clients.length} clients, ${seeded.invoices.length} invoices seeded.`
      );
    }
  } finally {
    db.close();
  }
}

main();
