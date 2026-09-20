declare module 'qz-tray' {
  const qz: {
    websocket: {
      isActive(): boolean;
      connect(options?: {
        host?: string | string[];
        usingSecure?: boolean;
        retries?: number;
        delay?: number;
      }): Promise<void>;
      disconnect(): Promise<void>;
    };
    printers: {
      find(query?: string): Promise<string[] | string>;
      getDefault(): Promise<string>;
    };
    configs: {
      create(printer: string, options?: Record<string, unknown>): unknown;
    };
    print(config: unknown, data: Array<Record<string, unknown>>): Promise<void>;
    security: {
      setCertificatePromise(
        handler: (
          resolve: (value: string) => void,
          reject: (reason?: unknown) => void,
        ) => void,
        options?: Record<string, unknown>,
      ): void;
      setSignaturePromise(
        factory: (dataToSign: string) => (
          resolve: (signature: string) => void,
          reject: (reason?: unknown) => void,
        ) => void,
      ): void;
    };
  };
  export default qz;
}
