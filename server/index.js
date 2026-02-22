#!/usr/bin/env node
'use strict';

const { createApp } = require('./app');
const { getAuthConfig } = require('../config/env');

function toPort(value, fallback = 8082) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function main() {
  const workspaceRootAbs = process.cwd();
  const authConfig = getAuthConfig(workspaceRootAbs);
  const app = createApp({ workspaceRootAbs });
  const port = toPort(authConfig.authPort, 8082);
  const host = authConfig.authHost || '127.0.0.1';

  app.listen(port, host, () => {
    console.log(`Secure family tree server running at http://${host}:${port}`);
  });
}

main();
