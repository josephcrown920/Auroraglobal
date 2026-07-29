import app from "./app";
import { logger } from "./lib/logger";
import { startStaleGenerationCleanup } from "./lib/cleanup";
import { startBackgroundPoller } from "./lib/backgroundPoller";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start periodic cleanup of generations stuck in queued/processing
  startStaleGenerationCleanup();

  // Start server-side background poller for real provider jobs
  startBackgroundPoller();
});
