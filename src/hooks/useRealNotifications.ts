
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
    id: string;
    title: string;
    desc: string;
    time: string;
    timestamp: Date;
    read: boolean; // Just simulated for now
    type: 'email' | 'campaign' | 'system';
}

export function useRealNotifications() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchNotifications() {
            try {
                // 1. Fetch recent messages (sent, opened, replied)
                const { data: messages } = await supabase
                    .from('messages')
                    .select('id, status, updated_at, leads(first_name, last_name, company), campaigns(name)')
                    .in('status', ['opened', 'replied']) // Focus on interesting events
                    .order('updated_at', { ascending: false })
                    .limit(5);

                // 2. Fetch recent campaign updates? 
                // Since we don't track "status changed" history, we'll just check active campaigns or recently created ones.
                // Better: Just use messages for now as they are the most high-frequency "notification" worthy events.
                // Or check for recently created campaigns.
                const { data: campaigns } = await supabase
                    .from('campaigns')
                    .select('id, name, status, created_at')
                    .order('created_at', { ascending: false })
                    .limit(3);

                const newNotifications: NotificationItem[] = [];

                // Process Messages
                if (messages) {
                    messages.forEach((msg: any) => {
                        let title = ' Attività Email';
                        let desc = 'Nuova attività rilevata';

                        if (msg.status === 'opened') {
                            title = '📧 Email Letta';
                            desc = `${msg.leads?.first_name || 'Un lead'} ${msg.leads?.last_name || ''} ha letto la tua email per ${msg.campaigns?.name || 'una campagna'}`;
                        } else if (msg.status === 'replied') {
                            title = '↩️ Risposta Ricevuta';
                            desc = `${msg.leads?.first_name || 'Un lead'} ha risposto alla campagna ${msg.campaigns?.name}`;
                        }

                        newNotifications.push({
                            id: `msg-${msg.id}`,
                            title,
                            desc,
                            time: formatTimeAgo(new Date(msg.updated_at)),
                            timestamp: new Date(msg.updated_at),
                            read: false,
                            type: 'email'
                        });
                    });
                }

                // Process Campaigns (New ones)
                if (campaigns) {
                    campaigns.forEach((camp: any) => {
                        newNotifications.push({
                            id: `camp-${camp.id}`,
                            title: '🚀 Nuova Campagna',
                            desc: `La campagna "${camp.name}" è stata creata`,
                            time: formatTimeAgo(new Date(camp.created_at)),
                            timestamp: new Date(camp.created_at),
                            read: true, // Auto-read old ones?
                            type: 'campaign'
                        });
                    });
                }

                // Sort by time desc
                newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

                setNotifications(newNotifications);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchNotifications();

        // Polling every 30s
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    return { notifications, loading };
}

function formatTimeAgo(date: Date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Adesso';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min fa`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ore fa`;
    return `${Math.floor(diffInSeconds / 86400)} gg fa`;
}
