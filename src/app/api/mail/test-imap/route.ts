import { NextResponse } from 'next/server';
import imaps from 'imap-simple';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, imap_host, imap_port, imap_user, imap_pass } = body;

        if (!imap_host || !imap_port) {
            return NextResponse.json({ success: false, error: "Missing IMAP Host/Port" }, { status: 400 });
        }

        const config = {
            imap: {
                user: imap_user || email,
                password: imap_pass,
                host: imap_host,
                port: parseInt(imap_port.toString()),
                tls: parseInt(imap_port.toString()) === 993, // Auto TLS for 993
                authTimeout: 15000,
                tlsOptions: { rejectUnauthorized: false } // Relaxed for testing
            }
        };

        const connection = await imaps.connect(config);

        // Optional: Open Inbox to be sure
        await connection.openBox('INBOX');
        await connection.end();

        return NextResponse.json({ success: true, message: 'IMAP Connection Successful' });

    } catch (error: any) {
        console.error("IMAP Test Error:", error);
        return NextResponse.json({ success: false, error: error.message || "Connection Failed" }, { status: 400 });
    }
}
