import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markNotificationRead,
} from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types/approval';
import './OnlineBookingAlert.css';

const SOUND_PREF_KEY = 'casa_bella_online_booking_sound';
const SOUND_ENABLED_KEY = 'casa_bella_online_booking_sound_enabled';
const SEEN_KEY = 'casa_bella_online_booking_seen';
const POLL_MS = 12_000;

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
}

function parseAlertDetails(message: string) {
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean);
  const pick = (label: string) => {
    const line = lines.find((l) =>
      l.toLowerCase().startsWith(label.toLowerCase()),
    );
    if (!line) return '';
    const idx = line.indexOf(':');
    return idx >= 0 ? line.slice(idx + 1).trim() : '';
  };
  return {
    customer: pick('Customer') || pick('Guest'),
    apartment: pick('Apartment') || pick('Unit') || pick('Room'),
    checkIn: pick('Check-in') || pick('Check in'),
    checkOut: pick('Check-out') || pick('Check out'),
    amount: pick('Amount') || pick('Total') || pick('Submitted Amount'),
    expectedAmount: pick('Expected Amount'),
    submittedAmount: pick('Submitted Amount'),
    paymentType: pick('Payment Type'),
    transactionReference: pick('Transaction Reference'),
    bookingNumber: pick('Booking Number') || pick('Booking'),
  };
}

function isPaymentVerificationAlert(item: AppNotification) {
  return (
    item.relatedModule === 'ONLINE_BOOKING' &&
    (item.title?.includes('NEW PAYMENT VERIFICATION') ||
      item.title?.includes('PAYMENT VERIFICATION'))
  );
}

function isBookingAlert(item: AppNotification) {
  return (
    item.relatedModule === 'ONLINE_BOOKING' &&
    item.title?.includes('BOOKING FROM WEBSITE')
  );
}

export function OnlineBookingAlert() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<AppNotification | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundOn, setSoundOn] = useState(
    () => localStorage.getItem(SOUND_PREF_KEY) !== 'off',
  );
  const [audioReady, setAudioReady] = useState(
    () => localStorage.getItem(SOUND_ENABLED_KEY) === 'true',
  );
  const seenRef = useRef<Set<string>>(loadSeen());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    if (!soundOn || !audioReady) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/new-booking.mp3');
        audioRef.current.preload = 'auto';
      }
      void audioRef.current.play().catch(() => {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      });
    } catch {
      /* ignore */
    }
  }, [audioReady, soundOn]);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const items = await fetchNotifications(token, {
        unreadOnly: true,
        module: 'ONLINE_BOOKING',
        take: 10,
      });
      const relevant = items.filter(
        (item) => isPaymentVerificationAlert(item) || isBookingAlert(item),
      );
      setPendingCount(relevant.length);

      const next = relevant.find((item) => !seenRef.current.has(item.id));
      if (!next) return;
      seenRef.current.add(next.id);
      saveSeen(seenRef.current);
      setAlert(next);
      setShowModal(true);
      playSound();
    } catch {
      /* keep polling */
    }
  }, [playSound, token]);

  useEffect(() => {
    if (!token) return;
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [poll, token]);

  function enableNotifications() {
    localStorage.setItem(SOUND_ENABLED_KEY, 'true');
    setAudioReady(true);
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/new-booking.mp3');
      }
      void audioRef.current.play().then(() => {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
      });
    } catch {
      /* ignore */
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem(SOUND_PREF_KEY, next ? 'on' : 'off');
  }

  async function closeAlert(markRead: boolean) {
    if (!alert || !token) {
      setAlert(null);
      setShowModal(false);
      return;
    }
    if (markRead) {
      try {
        await markNotificationRead(token, alert.id);
        setPendingCount((n) => Math.max(0, n - 1));
      } catch {
        /* ignore */
      }
    }
    setAlert(null);
    setShowModal(false);
  }

  function viewBooking() {
    const bookingId = alert?.relatedId;
    const verify = alert ? isPaymentVerificationAlert(alert) : false;
    void closeAlert(true);
    if (bookingId) {
      navigate(
        `/online-bookings?booking=${bookingId}${verify ? '&verify=1' : ''}`,
      );
    } else if (alert?.actionUrl) {
      navigate(alert.actionUrl);
    } else {
      navigate('/online-bookings');
    }
  }

  const details = alert ? parseAlertDetails(alert.message || '') : null;
  const paymentAlert = alert ? isPaymentVerificationAlert(alert) : false;
  const badgeCount = pendingCount > 0 ? pendingCount : 0;

  return (
    <>
      <div className="oba-fab">
        <button
          type="button"
          className={`oba-bell-btn${badgeCount > 0 ? ' is-active' : ''}`}
          aria-label="Online booking alerts"
          onClick={() => {
            if (!audioReady) enableNotifications();
            else if (alert) setShowModal(true);
            else navigate('/online-bookings');
          }}
          title={soundOn ? 'Alert sound on' : 'Alert sound off'}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!audioReady) enableNotifications();
            else toggleSound();
          }}
        >
          <span aria-hidden="true">🔔</span>
          {badgeCount > 0 ? (
            <span className="oba-badge">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          ) : null}
        </button>
      </div>

      {showModal && alert && details ? (
        <div className="oba-backdrop" role="presentation">
          <div
            className="oba-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="oba-title"
          >
            <div className="oba-bell-icon" aria-hidden="true">
              🔔
            </div>
            <h1 id="oba-title" className="oba-title">
              {paymentAlert
                ? 'NEW PAYMENT VERIFICATION'
                : 'BOOKING FROM WEBSITE'}
            </h1>
            <p className="oba-subtitle">
              {paymentAlert
                ? 'A customer has submitted a payment for verification.'
                : 'New online booking received.'}
            </p>
            <dl className="oba-details">
              <div>
                <dt>Customer</dt>
                <dd>{details.customer || '—'}</dd>
              </div>
              <div>
                <dt>Booking</dt>
                <dd>{details.bookingNumber || '—'}</dd>
              </div>
              <div>
                <dt>Room / Apartment</dt>
                <dd>{details.apartment || '—'}</dd>
              </div>
              <div>
                <dt>Check-in</dt>
                <dd>{details.checkIn || '—'}</dd>
              </div>
              <div>
                <dt>Check-out</dt>
                <dd>{details.checkOut || '—'}</dd>
              </div>
              {paymentAlert ? (
                <>
                  <div>
                    <dt>Payment Type</dt>
                    <dd>{details.paymentType || '—'}</dd>
                  </div>
                  <div>
                    <dt>Expected</dt>
                    <dd>{details.expectedAmount || details.amount || '—'}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{details.submittedAmount || details.amount || '—'}</dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>{details.transactionReference || '—'}</dd>
                  </div>
                </>
              ) : (
                <div>
                  <dt>Amount</dt>
                  <dd>{details.amount || '—'}</dd>
                </div>
              )}
            </dl>
            <div className="oba-actions">
              <button
                type="button"
                className="oba-btn oba-btn--primary"
                onClick={viewBooking}
              >
                {paymentAlert ? 'VERIFY PAYMENT' : 'VIEW BOOKING'}
              </button>
              <button
                type="button"
                className="oba-btn oba-btn--ghost"
                onClick={() => void closeAlert(true)}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
