import productSchema from "../drizzle/0008_complex_franklin_storm.sql?raw";

// Match the existing local bootstrap, using the actual additive migration so
// local previews and migrated deployments cannot drift into two schemas.
export async function initializeProducts(db: D1Database) {
  const statements = productSchema
    .split("--> statement-breakpoint")
    .map((sql) =>
      sql
        .trim()
        .replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")
        .replace(/^CREATE (UNIQUE )?INDEX /, "CREATE $1INDEX IF NOT EXISTS "),
    );
  await db.batch(statements.filter(Boolean).map((sql) => db.prepare(sql)));
}
