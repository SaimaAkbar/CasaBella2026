'use client';

import { FormEvent, useState } from 'react';

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const subject = String(data.get('subject') || '').trim();
    const body = String(data.get('message') || '').trim();

    if (!name || !email || !subject || !body) {
      setStatus('error');
      setMessage('Please complete all required fields.');
      return;
    }

    // Mock success — wire to POS/CRM or email API later.
    console.info('Contact enquiry', { name, email, phone, subject, body });
    setStatus('ok');
    setMessage('Thank you. Your message has been received (demo mode).');
    form.reset();
  }

  return (
    <form className="form-grid" onSubmit={onSubmit} noValidate>
      {status === 'error' ? <div className="alert alert--error form-field--full">{message}</div> : null}
      {status === 'ok' ? <div className="alert alert--ok form-field--full">{message}</div> : null}

      <label className="form-field">
        <span>Name *</span>
        <input name="name" required autoComplete="name" />
      </label>
      <label className="form-field">
        <span>Email *</span>
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="form-field">
        <span>Phone</span>
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label className="form-field">
        <span>Subject *</span>
        <input name="subject" required />
      </label>
      <label className="form-field form-field--full">
        <span>Message *</span>
        <textarea name="message" required />
      </label>
      <div className="form-field--full">
        <button type="submit" className="btn btn--primary">
          Send message
        </button>
      </div>
    </form>
  );
}
