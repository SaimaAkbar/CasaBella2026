'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { navLinks, siteConfig } from '@/data/site';

export function Footer() {
  const [message, setMessage] = useState('');

  function onNewsletter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Thanks — newsletter signup will connect when email service is configured.');
    event.currentTarget.reset();
  }

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">{siteConfig.brand.name}</div>
          <p style={{ color: '#cfc5b5' }}>{siteConfig.brand.shortDescription}</p>
        </div>

        <div>
          <h3>Quick links</h3>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/faq">FAQ</Link>
            </li>
            <li>
              <Link href="/policies">Policies</Link>
            </li>
          </ul>
        </div>

        <div>
          <h3>Contact</h3>
          <ul>
            <li>
              <a href={siteConfig.contact.phoneHref}>{siteConfig.contact.phoneLabel}</a>
            </li>
            <li>
              <a href={siteConfig.contact.emailHref}>{siteConfig.contact.emailLabel}</a>
            </li>
            {siteConfig.contact.addressLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {siteConfig.social.facebook ? (
              <li>
                <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              </li>
            ) : null}
            {siteConfig.social.instagram ? (
              <li>
                <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="newsletter">
          <h3>Newsletter</h3>
          <p style={{ color: '#cfc5b5', margin: 0 }}>
            Occasional updates on residences and seasonal stays.
          </p>
          <form onSubmit={onNewsletter}>
            <label className="sr-only" htmlFor="newsletter-email">
              Email
            </label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              placeholder="Email address"
              autoComplete="email"
            />
            <button type="submit" className="btn btn--gold">
              Join
            </button>
          </form>
          {message ? <p style={{ color: '#d7c7a4', margin: 0 }}>{message}</p> : null}
        </div>
      </div>

      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {siteConfig.brand.fullName}
        </span>
        <span>
          <Link href="/policies">Privacy Policy</Link>
          {' · '}
          <Link href="/policies">Terms & Conditions</Link>
        </span>
      </div>
    </footer>
  );
}
