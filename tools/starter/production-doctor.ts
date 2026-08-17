import { runProductionCommand } from "./production-bootstrap";

runProductionCommand("doctor", process.argv.slice(2)).catch((error: unknown) => {
  console.error(`FAIL Production doctor - ${error instanceof Error ? error.message : "Unknown error."}`);
  process.exitCode = 1;
});
