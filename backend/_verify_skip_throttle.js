(async () => {
  const api = 'http://localhost:3000';
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hotel.com', password: 'Admin123@' }),
  }).then((r) => r.json());
  const propertyId = 'dcad6836-73a7-45fa-b9e9-d387797c9525';
  const url = `${api}/monthly-unit-assignments/eligible-units?propertyId=${propertyId}`;
  const results = await Promise.all(
    Array.from({ length: 8 }, async () => {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${login.accessToken}` },
      });
      const body = await r.json();
      return {
        status: r.status,
        count: Array.isArray(body) ? body.length : body,
        units: Array.isArray(body)
          ? body.map((u) => u.unitNumber).join(',')
          : null,
      };
    }),
  );
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
