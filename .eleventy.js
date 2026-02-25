'use strict';

const { getProjectConfig } = require('./config/env');

module.exports = function(eleventyConfig) {
  const config = getProjectConfig(process.cwd());

  eleventyConfig.addPassthroughCopy({
    [`${config.siteInputDir}/style.css`]: 'style.css',
    [`${config.siteInputDir}/script.js`]: 'script.js',
    [`${config.siteInputDir}/favicon.svg`]: 'favicon.svg'
  });

  return {
    dir: {
      input: config.siteInputDir,
      includes: config.siteIncludesDir,
      data: config.siteDataDir,
      output: config.siteOutputDir
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['njk', 'md', 'html'],
    pathPrefix: config.eleventyPathPrefix
  };
};
