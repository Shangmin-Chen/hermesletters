import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Policy = {
  file: string;
  name: string;
  statement: string;
  table: string;
};

const drizzleDir = fileURLToPath(new URL("../drizzle", import.meta.url));
const sourceDir = fileURLToPath(new URL("../src", import.meta.url));

function normalizeTableName(rawTableName: string): string {
  return rawTableName.replaceAll('"', "").replace(/\s+/g, "");
}

function sqlMigrationFiles(): string[] {
  return readdirSync(drizzleDir)
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b));
}

function currentPolicyState(): Policy[] {
  const policies = new Map<string, Policy>();

  for (const file of sqlMigrationFiles()) {
    const sql = readFileSync(join(drizzleDir, file), "utf8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      const dropMatch = statement.match(
        /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"([^"]+)"\s+ON\s+((?:"[^"]+"\.)?"[^"]+")/i
      );

      if (dropMatch) {
        const [, name, table] = dropMatch;
        policies.delete(`${normalizeTableName(table)}:${name}`);
      }

      const createMatch = statement.match(
        /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+((?:"[^"]+"\.)?"[^"]+")/i
      );

      if (createMatch) {
        const [, name, table] = createMatch;
        const normalizedTable = normalizeTableName(table);
        policies.set(`${normalizedTable}:${name}`, {
          file,
          name,
          statement,
          table: normalizedTable,
        });
      }
    }
  }

  return [...policies.values()];
}

describe("migration security policy state", () => {
  it("keeps full letter rows default-deny for direct public-client access", () => {
    const letterPolicies = currentPolicyState().filter(
      (policy) => policy.table === "public.letters"
    );

    expect(letterPolicies).toEqual([]);
  });

  it("keeps letter image rows default-deny for direct client access", () => {
    const imagePolicies = currentPolicyState().filter(
      (policy) => policy.table === "public.letter_images"
    );

    expect(imagePolicies).toEqual([]);
  });

  it("does not create storage.objects policies for private letter assets", () => {
    const storagePolicies = currentPolicyState().filter(
      (policy) => policy.table === "storage.objects"
    );

    expect(storagePolicies).toEqual([]);
  });

  it("records verify attempts through a private advisory-locked database function", () => {
    const functionSql = readFileSync(
      join(drizzleDir, "0011_atomic_verify_attempts.sql"),
      "utf8"
    );
    const revokeSql = readFileSync(
      join(drizzleDir, "0012_revoke_verify_attempt_rpc_roles.sql"),
      "utf8"
    );
    const sql = `${functionSql}\n${revokeSql}`;

    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.record_letter_verify_attempt/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/DELETE\s+FROM\s+public\.letter_verify_attempts/i);
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.letter_verify_attempts/i);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.record_letter_verify_attempt/i);
    expect(sql).toMatch(/FROM\s+anon/i);
    expect(sql).toMatch(/FROM\s+authenticated/i);
  });

  it("uses the atomic verify-attempt function from the application helper", () => {
    const source = readFileSync(
      join(sourceDir, "lib/letter-verify-rate-limit.ts"),
      "utf8"
    );

    expect(source).toContain("public.record_letter_verify_attempt");
    expect(source).not.toContain(".insert(letterVerifyAttempts)");
    expect(source).not.toContain(".from(letterVerifyAttempts)");
  });
});
