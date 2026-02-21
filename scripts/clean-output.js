#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getProjectConfig } = require('../config/env');

const config = getProjectConfig(process.cwd());
const outputDir = path.resolve(process.cwd(), config.siteOutputDir);

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
