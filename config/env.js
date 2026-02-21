'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const DEFAULTS = Object.freeze({
  FAMILY_DATA_DIR: 'examples/royal-family-files',
  FAMILY_ROOT_PERSON: '',
  SITE_INPUT_DIR: 'site',
  SITE_INCLUDES_DIR: '_includes',
  SITE_DATA_DIR: '_data',
  SITE_OUTPUT_DIR: 'output',
  AVATARS_SUBDIR: 'avatars',
  ELEVENTY_PATH_PREFIX: '/'
});

let envLoaded = false;

function loadEnv(workspaceRootAbs = process.cwd()) {
  if (envLoaded) return;
  const envPath = path.join(workspaceRootAbs, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  envLoaded = true;
}

function getEnv(name, fallback) {
  const value = process.env[name];
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function getProjectConfig(workspaceRootAbs = process.cwd()) {
  loadEnv(workspaceRootAbs);

  return {
    familyDataDir: getEnv('FAMILY_DATA_DIR', DEFAULTS.FAMILY_DATA_DIR),
    familyRootPerson: getEnv('FAMILY_ROOT_PERSON', DEFAULTS.FAMILY_ROOT_PERSON),
    siteInputDir: getEnv('SITE_INPUT_DIR', DEFAULTS.SITE_INPUT_DIR),
    siteIncludesDir: getEnv('SITE_INCLUDES_DIR', DEFAULTS.SITE_INCLUDES_DIR),
    siteDataDir: getEnv('SITE_DATA_DIR', DEFAULTS.SITE_DATA_DIR),
    siteOutputDir: getEnv('SITE_OUTPUT_DIR', DEFAULTS.SITE_OUTPUT_DIR),
    avatarsSubdir: getEnv('AVATARS_SUBDIR', DEFAULTS.AVATARS_SUBDIR),
    eleventyPathPrefix: getEnv('ELEVENTY_PATH_PREFIX', DEFAULTS.ELEVENTY_PATH_PREFIX)
  };
}

module.exports = {
  DEFAULTS,
  loadEnv,
  getEnv,
  getProjectConfig
};
