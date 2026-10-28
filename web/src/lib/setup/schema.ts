import fs from "fs";
import path from "path";

/**
 * Loads the complete database schema initialization script.
 */
export function getFullInitSql(): string {
  const candidates = [
    path.resolve(process.cwd(), "supabase_setup", "init.sql"),
    path.resolve(process.cwd(), "..", "supabase_setup", "init.sql"),
    path.resolve(process.cwd(), "web", "..", "supabase_setup", "init.sql"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf-8");
    }
  }

  throw new Error("Could not locate supabase_setup/init.sql");
}
