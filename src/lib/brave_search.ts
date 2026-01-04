export async function searchWeb(query: string) {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
        console.warn("BRAVE_SEARCH_API_KEY is missing");
        return [];
    }

    try {
        // Add country=IT for Italian results preference
        const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3&country=IT&search_lang=it`, {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Brave API error: ${response.status}`);
        }

        const data = await response.json();

        return (data.web?.results || []).map((r: any) => ({
            title: r.title,
            url: r.url,
            description: r.description
        }));

    } catch (error) {
        console.error("Search failed:", error);
        return [];
    }
}
