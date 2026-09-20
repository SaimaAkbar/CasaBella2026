import qz from 'qz-tray';

type ConnectOptions = {
  host?: string[];
  usingSecure?: boolean;
  retries?: number;
  delay?: number;
};

type QzConnection = {
  sendData?: (obj: unknown) => void;
  readyState?: number;
  established?: boolean;
};

let connectInFlight: Promise<void> | null = null;

function getQzConnection(): QzConnection | null {
  const internal = qz as unknown as {
    websocket?: { connection?: QzConnection | null };
  };
  return internal.websocket?.connection ?? null;
}

export function isQzConnectionReady() {
  const connection = getQzConnection();
  return typeof connection?.sendData === 'function';
}

function isQzConnecting() {
  const connection = getQzConnection();
  return connection?.readyState === 0;
}

function isHttpsPage() {
  return (
    typeof window !== 'undefined' && window.location.protocol === 'https:'
  );
}

function isLocalDevPage() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function formatQzConnectionHelp(cause?: string) {
  const detail = cause?.trim() ? `${cause.trim()} ` : '';
  return (
    `${detail}QZ Tray connection failed. ` +
    '1) Download and install QZ Tray from qz.io/download, then keep it running (green tray icon). ' +
    '2) In Chrome/Edge, click the lock icon next to the address bar → Site settings → allow ' +
    '"Local network access" / "Access other apps on this device". ' +
    '3) Refresh this page and click Retry.'
  );
}

function buildConnectAttempts(): ConnectOptions[] {
  const hosts = ['localhost', '127.0.0.1'];
  const secureFirst = isHttpsPage() && !isLocalDevPage();

  if (secureFirst) {
    return [
      { host: hosts, usingSecure: true, retries: 2, delay: 0.4 },
      { host: hosts, usingSecure: false, retries: 2, delay: 0.4 },
    ];
  }

  return [
    { host: hosts, usingSecure: false, retries: 3, delay: 0.4 },
    { host: hosts, usingSecure: true, retries: 2, delay: 0.4 },
  ];
}

async function resetQzConnection() {
  if (!qz.websocket.isActive()) return;
  try {
    await qz.websocket.disconnect();
  } catch {
    // Ignore disconnect errors while preparing a new attempt.
  }
}

async function waitForQzReady(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isQzConnectionReady()) return;
    if (!qz.websocket.isActive() && !isQzConnecting()) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!isQzConnectionReady()) {
    throw new Error(
      'QZ Tray connection is still starting. Wait a moment and try again.',
    );
  }
}

async function connectOnce(options: ConnectOptions) {
  await qz.websocket.connect(options);
  await waitForQzReady();
}

async function performConnect() {
  if (isQzConnectionReady()) return;

  if (isQzConnecting()) {
    await waitForQzReady();
    if (isQzConnectionReady()) return;
  }

  if (qz.websocket.isActive() && !isQzConnectionReady()) {
    await resetQzConnection();
  }

  const attempts = buildConnectAttempts();
  let lastMessage = 'Unable to establish connection with QZ Tray';

  for (const options of attempts) {
    try {
      await connectOnce(options);
      return;
    } catch (err) {
      lastMessage =
        err instanceof Error ? err.message : 'Unable to establish connection with QZ Tray';
      await resetQzConnection();
    }
  }

  throw new Error(formatQzConnectionHelp(lastMessage));
}

export async function connectQzTray(): Promise<void> {
  if (isQzConnectionReady()) return;

  if (connectInFlight) {
    await connectInFlight;
    if (isQzConnectionReady()) return;
    throw new Error(
      'QZ Tray connected but is not ready for printing. Refresh the page and try again.',
    );
  }

  connectInFlight = performConnect();
  try {
    await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}

export async function withQzConnection<T>(task: () => Promise<T>): Promise<T> {
  await connectQzTray();
  if (!isQzConnectionReady()) {
    throw new Error(
      'QZ Tray is not ready for printing yet. Refresh the page and try again.',
    );
  }
  return task();
}
