import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileMenu.css';

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return null;
  }

  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        type="button"
        className="profile-menu__trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="profile-menu__avatar" aria-hidden="true">
          {initials || 'U'}
        </span>
        <span className="profile-menu__meta">
          <span className="profile-menu__name">{user.fullName}</span>
          <span className="profile-menu__email">{user.email}</span>
        </span>
      </button>

      {open ? (
        <div className="profile-menu__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
