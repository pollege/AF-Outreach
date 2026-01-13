import { NextRequest, NextResponse } from 'next/server';

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};

export function middleware(req: NextRequest) {
    // 1. Get Environment Credentials
    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // 2. If no credentials set (e.g. Development), skip auth
    if (!adminUser || !adminPassword) {
        return NextResponse.next();
    }

    // 3. Check Authorization Header
    const basicAuth = req.headers.get('authorization');

    if (basicAuth) {
        const authValue = basicAuth.split(' ')[1];
        // Decoding Base64
        const [user, pwd] = atob(authValue).split(':');

        if (user === adminUser && pwd === adminPassword) {
            // Success
            return NextResponse.next();
        }
    }

    // 4. Prompt for Login
    return new NextResponse('Authentication Required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Secure Cold Outreach Dashboard"',
        },
    });
}
