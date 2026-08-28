import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../lib/auth-error';
import './LoginPage.css';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-page__panel" aria-labelledby="login-brand">
        <div className="login-page__brand-block">
          <p className="login-page__eyebrow">Hotel Residences POS</p>
          <h1 id="login-brand" className="login-page__brand">
            Residences
          </h1>
          <div className="login-page__gold-line" aria-hidden="true" />
          <p className="login-page__subtitle">
            Sign in to manage your property operations.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-form__field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@hotel.com"
              required
            />
          </label>

          <label className="login-form__field">
            <span>Password</span>
            <div className="login-form__password">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                minLength={8}
              />
              <button
                type="button"
                className="login-form__toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error ? (
            <p className="login-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="login-form__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
