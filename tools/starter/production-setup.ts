import { runProductionCommand } from "./production-bootstrap";

runProductionCommand("setup", process.argv.slice(2)).catch((error: unknown) => {
  console.error(`FAIL Production setup - ${error instanceof Error ? error.message : "Unknown error."}`);
  process.exitCode = 1;
});
