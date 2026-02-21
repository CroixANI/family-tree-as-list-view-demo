#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(process.cwd(), 'output');

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
