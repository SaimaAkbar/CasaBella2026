const MUTE_PREFIXES = [
  '/auth',
  '/health',
  '/notifications',
  '/approval-requests',
];

export function shouldNotifyAdminMutation(
  method: string,
  path: string,
): boolean {
  const verb = method.toUpperCase();
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(verb)) {
    return false;
  }
  const route = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return !MUTE_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`),
  );
}

export function describeAdminMutation(method: string, path: string) {
  const verb =
    method.toUpperCase() === 'DELETE'
      ? 'deleted'
      : method.toUpperCase() === 'POST'
        ? 'created or submitted'
        : 'edited';
  const segment = (path.split('?')[0] || '/')
    .split('/')
    .filter(Boolean)[0]
    ?.replace(/-/g, ' ') ?? 'a record';
  return { verb, module: segment };
}
