import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications';
import { resolveNotificationTarget } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import type { AppNotification } from '../types/approval';
import './NotificationBell.css';

// ─── Priority indicator ──────────────────────────────────────────────────────

type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | string;

function PriorityDot({ priority }: { priority: Priority }) {
  const cls =
    priority === 'CRITICAL'
      ? 'nb-priority nb-priority--critical'
      : priority === 'HIGH'
        ? 'nb-priority nb-priority--high'
        : priority === 'NORMAL'
          ? 'nb-priority nb-priority--normal'
          : 'nb-priority nb-priority--low';
  const label =
    priority === 'CRITICAL'
      ? 'Critical'
      : priority === 'HIGH'
        ? 'Warning'
        : 'Info';
  return (
    <span className={cls} aria-label={label} title={label} aria-hidden="true" />
  );
}

// ─── Relative time formatter ─────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

// ─── Resolve navigation target ───────────────────────────────────────────────

function resolveUrl(
  item: AppNotification,
  role?: string,
): string | null {
  return resolveNotificationTarget(item, role);
}

// ─── Single notification row ─────────────────────────────────────────────────

type NotificationRowProps = {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
};

function NotificationRow({ item, onOpen }: NotificationRowProps) {
  const priority = item.priority ?? 'NORMAL';
  const hasTarget = Boolean(resolveUrl(item, undefined));

  return (
    <li>
      <button
        type="button"
        className={[
          'nb-item',
          !item.isRead ? 'nb-item--unread' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onOpen(item)}
        aria-label={`${item.title}: ${item.message}`}
      >
        <span className="nb-item__left">
          <PriorityDot priority={priority} />
          {!item.isRead ? (
            <span className="nb-item__unread-dot" aria-label="Unread" />
          ) : null}
        </span>

        <span className="nb-item__body">
          <span className="nb-item__title">{item.title}</span>
          <span className="nb-item__message">{item.message}</span>
          <span className="nb-item__time">{formatRelative(item.createdAt)}</span>
        </span>

        {hasTarget ? (
          <span className="nb-item__view" aria-hidden="true">
            View →
          </span>
        ) : null}
      </button>
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const PANEL_LIMIT = 15;

export function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ── Unread count polling (every 30s) ───────────────────────────────────────
  const refreshCount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchUnreadNotificationCount(token);
      setCount(data.count);
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => void refreshCount(), 30000);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  // ── Load notifications when panel opens ────────────────────────────────────
  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(token, { take: 50 });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
    setShowAll(false);
  }, [open, loadItems]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // ── Keyboard close (Escape) ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // ── Click a notification row ───────────────────────────────────────────────
  async function handleOpen(item: AppNotification) {
    if (!token) return;
    try {
      if (!item.isRead) {
        await markNotificationRead(token, item.id);
        setItems((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, isRead: true } : r)),
        );
        setCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // silent — still navigate
    }
    setOpen(false);
    const url = resolveUrl(item, user?.role);
    if (url) navigate(url);
  }

  // ── Mark all read ──────────────────────────────────────────────────────────
  async function handleMarkAll() {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setItems((prev) => prev.map((r) => ({ ...r, isRead: true })));
      setCount(0);
    } catch {
      // silent
    }
  }

  const displayed = showAll ? items : items.slice(0, PANEL_LIMIT);
  const hasMore = !showAll && items.length > PANEL_LIMIT;

  return (
    <div className="nb-wrap" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        className="nb-bell"
        aria-label={count > 0 ? `Notifications — ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 ? (
          <span className="nb-bell__badge" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {/* Dropdown panel */}
      {open ? (
        <div
          className="nb-panel"
          role="dialog"
          aria-label="Notification Center"
          aria-modal="false"
        >
          {/* Header */}
          <div className="nb-panel__head">
            <strong className="nb-panel__title">Notifications</strong>
            <div className="nb-panel__actions">
              {count > 0 ? (
                <button
                  type="button"
                  className="nb-panel__btn"
                  onClick={() => void handleMarkAll()}
                >
                  Mark all read
                </button>
              ) : null}
              <button
                type="button"
                className="nb-panel__btn"
                onClick={() => {
                  setOpen(false);
                  navigate('/notifications');
                }}
              >
                View all
              </button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <p className="nb-panel__empty">Loading…</p>
          ) : items.length === 0 ? (
            <div className="nb-panel__caught-up">
              <span aria-hidden="true">✓</span>
              <span>All caught up</span>
            </div>
          ) : (
            <>
              <ul className="nb-list">
                {displayed.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onOpen={(n) => void handleOpen(n)}
                  />
                ))}
              </ul>

              {hasMore ? (
                <button
                  type="button"
                  className="nb-panel__show-more"
                  onClick={() => setShowAll(true)}
                >
                  Show {items.length - PANEL_LIMIT} older notifications
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
