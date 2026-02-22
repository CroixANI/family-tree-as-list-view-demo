'use strict';

(() => {
  const nextPath = typeof window.__NEXT_PATH__ === 'string' ? window.__NEXT_PATH__ : '/';
  const statusEl = document.getElementById('status');

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
  }

  async function handleGoogleCredential(response) {
    try {
      setStatus('Signing in...');
      const res = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          credential: response && response.credential ? response.credential : '',
          nextPath
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 && data && data.redirect) {
          window.location.assign(data.redirect);
          return;
        }
        throw new Error((data && data.error) || 'Sign-in failed.');
      }

      window.location.assign((data && data.redirect) || '/');
    } catch (err) {
      setStatus(err && err.message ? err.message : 'Sign-in failed.');
    }
  }

  window.handleGoogleCredential = handleGoogleCredential;
})();
