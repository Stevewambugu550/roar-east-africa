const allowedPrefixes = ['/auth/', '/leads', '/admin/leads', '/promotion'];

export const handler = async event => {
    const backend = process.env.ROAR_BACKEND_URL?.replace(/\/$/, '');
    if (!backend) return { statusCode: 503, body: JSON.stringify({ message: 'Backend URL is not configured.' }) };
    const routePart = event.path.includes('/api/roar/')
        ? event.path.split('/api/roar/')[1]
        : event.path.split('/roar-proxy/')[1];
    const route = '/' + (routePart || '');
    if (!allowedPrefixes.some(prefix => route === prefix || route.startsWith(prefix))) {
        return { statusCode: 404, body: JSON.stringify({ message: 'API route not found.' }) };
    }
    const headers = { 'content-type': event.headers['content-type'] || 'application/json' };
    if (event.headers.authorization) headers.authorization = event.headers.authorization;
    try {
        const response = await fetch(`${backend}/api/roar${route}${event.rawQuery ? '?' + event.rawQuery : ''}`, {
            method: event.httpMethod,
            headers,
            body: ['GET','HEAD'].includes(event.httpMethod) ? undefined : event.body,
        });
        return {
            statusCode: response.status,
            headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
            body: await response.text(),
        };
    } catch {
        return { statusCode: 502, headers: { 'content-type':'application/json' }, body: JSON.stringify({ message: 'Backend service unavailable.' }) };
    }
};
