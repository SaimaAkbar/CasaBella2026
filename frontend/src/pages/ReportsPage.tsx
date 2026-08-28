import { useEffect, useMemo, useState } from 'react';
import { fetchReportCatalog } from '../api/reports';
import { PageHeader } from '../components/PageHeader';
import { ReportViewer } from '../components/reports/ReportViewer';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useApiErrorHandler } from '../hooks/useApiErrorHandler';
import type {
  ReportCatalogItem,
  ReportCategory,
  ReportType,
} from '../types/report';
import '../styles/forms.css';
import './ReportsPage.css';

const CATEGORY_ORDER: ReportCategory[] = [
  'Operations',
  'Guests and Tenants',
  'Finance',
  'Owners',
  'Employees',
  'Inventory',
  'Audit',
];

export function ReportsPage() {
  const { token } = useAuth();
  const handleApiError = useApiErrorHandler();

  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ReportCatalogItem | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  }>({ message: '', tone: 'success' });

  useEffect(() => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    void fetchReportCatalog(token)
      .then(setCatalog)
      .catch((err) => {
        setError(handleApiError(err, 'Unable to load report catalog'));
      })
      .finally(() => setIsLoading(false));
  }, [token, handleApiError]);

  const grouped = useMemo(() => {
    const map = new Map<ReportCategory, ReportCatalogItem[]>();

    for (const item of catalog) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }

    return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
      category: cat,
      items: map.get(cat) ?? [],
    }));
  }, [catalog]);

  function openReport(item: ReportCatalogItem) {
    setSelected(item);
  }

  function closeReport() {
    setSelected(null);
  }

  function showToast(message: string, tone: 'success' | 'error') {
    setToast({ message, tone });
  }

  if (selected && token) {
    return (
      <section className="reports-page">
        <PageHeader title="Reports" breadcrumb={['Home', 'Reports', selected.reportName]} />
        <ReportViewer
          token={token}
          reportType={selected.reportType as ReportType}
          reportName={selected.reportName}
          onBack={closeReport}
          onToast={showToast}
        />
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast({ message: '', tone: 'success' })}
        />
      </section>
    );
  }

  return (
    <section className="reports-page">
      <PageHeader title="Reports" breadcrumb={['Home', 'Reports']} />

      {isLoading ? <LoadingState message="Loading report catalog…" /> : null}

      {!isLoading && error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            if (!token) return;
            setIsLoading(true);
            setError('');
            void fetchReportCatalog(token)
              .then(setCatalog)
              .catch((err) => {
                setError(handleApiError(err, 'Unable to load report catalog'));
              })
              .finally(() => setIsLoading(false));
          }}
        />
      ) : null}

      {!isLoading && !error && catalog.length === 0 ? (
        <EmptyState
          title="No reports available"
          description="Your role does not have access to any reports yet."
        />
      ) : null}

      {!isLoading && !error && grouped.length > 0 ? (
        <div className="reports-page__catalog">
          {grouped.map(({ category, items }) => (
            <section key={category} className="reports-page__section">
              <h2 className="reports-page__section-title">{category}</h2>
              <div className="reports-page__grid">
                {items.map((item) => (
                  <button
                    key={item.reportType}
                    type="button"
                    className="reports-page__card"
                    onClick={() => openReport(item)}
                  >
                    <div className="reports-page__card-head">
                      <h3>{item.reportName}</h3>
                      {item.availability === 'NOT_IMPLEMENTED' ? (
                        <span className="reports-page__badge">Coming soon</span>
                      ) : (
                        <span className="reports-page__badge reports-page__badge--ready">
                          Ready
                        </span>
                      )}
                    </div>
                    <p>{item.description}</p>
                    <span className="reports-page__card-action">Open report →</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ message: '', tone: 'success' })}
      />
    </section>
  );
}
