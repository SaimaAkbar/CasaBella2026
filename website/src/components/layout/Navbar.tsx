'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { navLinks, siteConfig } from '@/data/site';

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand__name">{siteConfig.brand.name}</span>
          <span className="brand__sub">Hotel & Residence</span>
        </Link>

        <nav className="nav-desktop" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <Link href="/booking" className="btn btn--primary">
            Book Now
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`nav-mobile${open ? ' is-open' : ''}`}
        aria-label="Mobile"
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(link.href) ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
        <Link href="/booking" className="btn btn--gold" onClick={() => setOpen(false)}>
          Book Now
        </Link>
      </nav>
    </header>
  );
}
