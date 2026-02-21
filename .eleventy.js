'use strict';

module.exports = function(eleventyConfig) {
  const familyDataDir = process.env.FAMILY_DATA_DIR || 'royal-family-files';

  eleventyConfig.addPassthroughCopy({
    'site/style.css': 'style.css',
    'site/script.js': 'script.js'
  });

  // Copy only local image assets from the source family folder.
  ['png', 'jpg', 'jpeg', 'webp', 'avif'].forEach(ext => {
    eleventyConfig.addPassthroughCopy(`${familyDataDir}/**/*.${ext}`);
  });

  return {
    dir: {
      input: 'site',
      includes: '_includes',
      data: '_data',
      output: 'output'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['njk', 'md', 'html'],
    pathPrefix: process.env.ELEVENTY_PATH_PREFIX || '/'
  };
};
