'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const { getAuthConfig, getProjectConfig } = require('../config/env');

const PUBLIC_DIR = path.join(__dirname, 'public');
const LOGIN_TEMPLATE_PATH = path.join(__dirname, 'views', 'login.html');
const NOT_ALLOWED_TEMPLATE_PATH = path.join(__dirname, 'views', 'not-allowed.html');
const BUILD_UNAVAILABLE_TEMPLATE_PATH = path.join(__dirname, 'views', 'build-unavailable.html');

function loadTemplate(templatePath) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

const LOGIN_TEMPLATE = loadTemplate(LOGIN_TEMPLATE_PATH);
const NOT_ALLOWED_TEMPLATE = loadTemplate(NOT_ALLOWED_TEMPLATE_PATH);
const BUILD_UNAVAILABLE_TEMPLATE = loadTemplate(BUILD_UNAVAILABLE_TEMPLATE_PATH);

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplate(template, replacements) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(`{{${key}}}`).join(String(value));
  }
  return output;
}

function toSafeInlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function wantsHtml(req) {
  return (req.get('accept') || '').includes('text/html');
}

function normalizeNextPath(value) {
  const fallback = '/';
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  return trimmed;
}

function buildUnavailableResponse(res, expectedIndexPath) {
  res.status(503).send(
    renderTemplate(BUILD_UNAVAILABLE_TEMPLATE, {
      EXPECTED_INDEX_PATH: escapeHtml(expectedIndexPath)
    })
  );
}

function renderLoginPage({ googleClientId, nextPath }) {
  return renderTemplate(LOGIN_TEMPLATE, {
    GOOGLE_CLIENT_ID: escapeHtml(googleClientId),
    NEXT_PATH_JSON: toSafeInlineJson(nextPath)
  });
}

function renderNotAllowedPage({ deniedEmail, supportContactEmail }) {
  return renderTemplate(NOT_ALLOWED_TEMPLATE, {
    DENIED_EMAIL: escapeHtml(deniedEmail || 'Unknown email'),
    SUPPORT_CONTACT_EMAIL: escapeHtml(supportContactEmail)
  });
}

function createApp(options = {}) {
  const workspaceRootAbs = options.workspaceRootAbs || process.cwd();
  const projectConfig = getProjectConfig(workspaceRootAbs);
  const authConfig = getAuthConfig(workspaceRootAbs);
  const outputDir = path.resolve(workspaceRootAbs, projectConfig.siteOutputDir);
  const outputIndexAbs = path.join(outputDir, 'index.html');
  const googleClient = new OAuth2Client(authConfig.googleClientId);
  const allowedEmailSet = new Set(authConfig.allowedEmails);
  const sessionTtlMs = Math.max(Number(authConfig.sessionTtlHours) || 8, 1) * 60 * 60 * 1000;

  if (!authConfig.googleClientId) {
    throw new Error('Missing required env var GOOGLE_CLIENT_ID');
  }
  if (!authConfig.sessionSecret || authConfig.sessionSecret.length < 16) {
    throw new Error('SESSION_SECRET must be set and at least 16 characters long');
  }
  if (allowedEmailSet.size === 0) {
    throw new Error('ALLOWED_EMAILS must include at least one email');
  }

  const app = express();
  app.disable('x-powered-by');
  if (authConfig.trustProxy) {
    app.set('trust proxy', 1);
  }
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    '/auth-assets',
    express.static(PUBLIC_DIR, {
      index: false,
      fallthrough: false,
      redirect: false
    })
  );
  app.use(
    session({
      name: 'family_tree_session',
      secret: authConfig.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sessionTtlMs
      }
    })
  );

  function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    if (wantsHtml(req)) {
      const nextPath = encodeURIComponent(normalizeNextPath(req.originalUrl || '/'));
      return res.redirect(`/login?next=${nextPath}`);
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
      return res.redirect(normalizeNextPath(req.query.next || '/'));
    }
    const nextPath = normalizeNextPath(req.query.next || '/');
    return res.status(200).send(
      renderLoginPage({
        googleClientId: authConfig.googleClientId,
        nextPath
      })
    );
  });

  app.post('/auth/google', async (req, res) => {
    try {
      const credential = typeof req.body.credential === 'string' ? req.body.credential : '';
      const nextPath = normalizeNextPath(req.body.nextPath || '/');
      if (!credential) {
        return res.status(400).json({ error: 'Missing Google credential token' });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: authConfig.googleClientId
      });
      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(401).json({ error: 'Unable to verify Google token' });
      }

      const email = String(payload.email || '')
        .trim()
        .toLowerCase();
      const name = String(payload.name || email || '').trim();
      const picture = String(payload.picture || '').trim();
      const emailVerified = Boolean(payload.email_verified);

      if (!email || !emailVerified || !allowedEmailSet.has(email)) {
        req.session.deniedEmail = email || 'unknown';
        return res.status(403).json({ error: 'Email not allowlisted', redirect: '/not-allowed' });
      }

      req.session.regenerate(regenerateErr => {
        if (regenerateErr) {
          return res.status(500).json({ error: 'Failed to initialize session' });
        }

        req.session.user = {
          sub: String(payload.sub || ''),
          email,
          name,
          picture
        };
        req.session.authenticatedAt = Date.now();

        req.session.save(saveErr => {
          if (saveErr) {
            return res.status(500).json({ error: 'Failed to persist session' });
          }
          return res.json({ ok: true, redirect: nextPath });
        });
      });
    } catch (error) {
      return res.status(401).json({ error: 'Google authentication failed' });
    }
  });

  app.get('/not-allowed', (req, res) => {
    const deniedEmail = (req.session && req.session.deniedEmail) || '';
    return res.status(403).send(
      renderNotAllowedPage({
        deniedEmail,
        supportContactEmail: authConfig.supportContactEmail
      })
    );
  });

  app.post('/logout', (req, res) => {
    if (!req.session) {
      return res.redirect('/login');
    }

    req.session.destroy(() => {
      res.clearCookie('family_tree_session');
      if (wantsHtml(req)) {
        return res.redirect('/login');
      }
      return res.json({ ok: true });
    });
  });

  app.get('/api/session', requireAuth, (req, res) => {
    res.json({
      user: req.session.user || null,
      authenticatedAt: req.session.authenticatedAt || null
    });
  });

  app.get('/', requireAuth, (req, res) => {
    if (!fs.existsSync(outputIndexAbs)) {
      return buildUnavailableResponse(res, outputIndexAbs);
    }
    return res.sendFile(outputIndexAbs);
  });

  app.use(requireAuth, (req, res, next) => {
    if (!fs.existsSync(outputIndexAbs)) {
      return buildUnavailableResponse(res, outputIndexAbs);
    }
    return next();
  });

  app.use(
    express.static(outputDir, {
      index: false,
      fallthrough: false,
      redirect: false
    })
  );

  app.use((req, res) => {
    res.status(404).send('Not found');
  });

  return app;
}

module.exports = {
  createApp
};
