import type { ReactNode } from 'react';
import './PageHeader.css';

type PageHeaderProps = {
  title: string;
  breadcrumb: string[];
  actions?: ReactNode;
};

export function PageHeader({ title, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__top">
        <nav className="page-header__breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, index) => {
            const isLast = index === breadcrumb.length - 1;

            return (
              <span key={`${crumb}-${index}`} className="page-header__crumb">
                {index > 0 ? (
                  <span className="page-header__separator" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <span
                  className={
                    isLast
                      ? 'page-header__crumb-text page-header__crumb-text--current'
                      : 'page-header__crumb-text'
                  }
                >
                  {crumb}
                </span>
              </span>
            );
          })}
        </nav>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
      <h1 className="page-header__title">{title}</h1>
    </header>
  );
}
