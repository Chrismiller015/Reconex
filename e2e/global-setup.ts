import { execSync } from "node:child_process";

async function globalSetup() {
  // Ensure DB schema is up to date for E2E runs (covers new tables like WorkflowStatus/AuditEvent).
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
}

export default globalSetup;

