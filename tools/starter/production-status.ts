import { runProductionCommand } from "./production-bootstrap";

runProductionCommand("status", process.argv.slice(2)).catch((error: unknown) => {
  console.error(`FAIL Production status - ${error instanceof Error ? error.message : "Unknown error."}`);
  process.exitCode = 1;
});
