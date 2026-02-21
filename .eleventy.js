'use strict';

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    'site/style.css': 'style.css',
    'site/script.js': 'script.js'
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
