/**
 * app.js — Login page logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Already logged in? → go to dashboard
  Auth.redirectIfLoggedIn();

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('show');
    errorBox.textContent = '';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showError('Username dan password wajib diisi');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Masuk...';

    try {
      const res = await API.login(username, password);
      if (res.success) {
        Auth.setSession({ username });
        window.location.href = 'dashboard.html';
      } else {
        showError(res.message || 'Login gagal');
      }
    } catch (err) {
      showError(err.message || 'Tidak dapat terhubung ke server');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Masuk';
    }
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
  }
});
