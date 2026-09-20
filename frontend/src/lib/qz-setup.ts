import qz from 'qz-tray';

let initialized = false;

function apiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export async function initializeQzSecurity(getToken?: () => string | null) {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  try {
    const certResponse = await fetch('/qz/digital-certificate.txt', {
      cache: 'no-store',
    });
    if (!certResponse.ok) return;

    const certificate = (await certResponse.text()).trim();
    if (!certificate.includes('BEGIN CERTIFICATE')) return;

    qz.security.setCertificatePromise((resolve) => {
      resolve(certificate);
    });

    qz.security.setSignaturePromise((toSign) => {
      return (resolve, reject) => {
        const token = getToken?.();
        if (!token) {
          reject(new Error('Missing auth token for QZ signing.'));
          return;
        }

        void fetch(`${apiBaseUrl()}/receipts/qz-sign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ request: toSign }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(await response.text());
            }
            return response.json() as Promise<{ signature?: string }>;
          })
          .then((payload) => {
            if (!payload.signature) {
              throw new Error('QZ signature missing from server response.');
            }
            resolve(payload.signature);
          })
          .catch(reject);
      };
    });
  } catch {
    // Unsigned mode: QZ Tray will show an Allow dialog on each print.
  }
}
