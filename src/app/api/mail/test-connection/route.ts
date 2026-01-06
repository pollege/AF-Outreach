
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure } = body;

        const domain = email.split('@')[1];
        const report = {
            smtp: { status: 'pending', message: '' },
            mx: { status: 'pending', message: '' },
            spf: { status: 'pending', message: '' },
            dmarc: { status: 'pending', message: '' }
        };

        // 1. SMTP Connection Test
        try {
            const transporter = nodemailer.createTransport({
                host: smtp_host,
                port: parseInt(smtp_port),
                secure: smtp_secure ?? (smtp_port == 465), // Default secure true if 465
                auth: {
                    user: smtp_user,
                    pass: smtp_pass,
                },
                tls: {
                    rejectUnauthorized: false // Allow self-signed for testing flexibility, though risky for strict prod
                }
            });

            await transporter.verify();
            report.smtp = { status: 'ok', message: 'Connection successful' };
        } catch (e: any) {
            report.smtp = { status: 'error', message: e.message };
        }

        // 2. DNS Checks (Domain Health)

        // MX Records
        try {
            const mxRecords = await resolveMx(domain);
            if (mxRecords && mxRecords.length > 0) {
                report.mx = { status: 'ok', message: `Found ${mxRecords.length} MX records` };
            } else {
                report.mx = { status: 'error', message: 'No MX records found' };
            }
        } catch (e: any) {
            report.mx = { status: 'error', message: 'MX Lookup failed: ' + e.message };
        }

        // SPF Record
        try {
            const txtRecords = await resolveTxt(domain);
            const spfRecord = txtRecords.flat().find(r => r.includes('v=spf1'));
            if (spfRecord) {
                report.spf = { status: 'ok', message: `Found SPF: ${spfRecord}` };
            } else {
                report.spf = { status: 'warning', message: 'No SPF record found (v=spf1)' };
            }
        } catch (e: any) {
            report.spf = { status: 'error', message: 'SPF Lookup failed: ' + e.message };
        }

        // DMARC Record
        try {
            const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
            const dmarcRecord = dmarcRecords.flat().find(r => r.includes('v=DMARC1'));
            if (dmarcRecord) {
                report.dmarc = { status: 'ok', message: `Found DMARC: ${dmarcRecord}` };
            } else {
                report.dmarc = { status: 'warning', message: 'No DMARC record found (_dmarc subdomain)' };
            }
        } catch (e: any) {
            // DMARC is optional but recommended
            if (e.code === 'ENOTFOUND') {
                report.dmarc = { status: 'warning', message: 'No DMARC record found' };
            } else {
                report.dmarc = { status: 'error', message: 'DMARC Lookup failed: ' + e.message };
            }
        }

        return NextResponse.json({ report });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
