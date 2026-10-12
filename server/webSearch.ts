export interface WebSourceItem {
  title: string;
  uri: string;
  snippet?: string;
  source: string;
}

/**
 * Concurrently fetches live web search results across Google News, Wikipedia, and Hacker News
 * without requiring any external paid API keys.
 */
export async function fetchLiveWebSources(query: string, filterType = 'all'): Promise<WebSourceItem[]> {
  const sources: WebSourceItem[] = [];
  const cleanQuery = query.trim();
  const seenUrls = new Set<string>();

  const addSource = (item: WebSourceItem) => {
    if (!item.uri || seenUrls.has(item.uri)) return;
    seenUrls.add(item.uri);
    sources.push(item);
  };

  const tasks: Promise<void>[] = [];

  // 1. Google News RSS (up-to-the-minute live news and reporting)
  tasks.push(
    (async () => {
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(4500),
        });
        if (res.ok) {
          const xml = await res.text();
          const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g)];
          for (const m of items.slice(0, 5)) {
            const rawTitle = m[1]
              .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
            const cleanTitle = rawTitle.replace(/\s*-\s*Google News$/, '');
            addSource({
              title: cleanTitle,
              uri: m[2].trim(),
              source: 'Google News',
            });
          }
        }
      } catch {
        // Silently skip if network error or timeout
      }
    })()
  );

  // 2. Wikipedia Search API (encyclopedic, science, historical, reference facts)
  tasks.push(
    (async () => {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&srlimit=5`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'GeminiSearchAssistant/1.0 (academic research)' },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          const hits = data.query?.search || [];
          for (const hit of hits.slice(0, 4)) {
            const snippet = hit.snippet
              ? hit.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
              : '';
            addSource({
              title: `${hit.title} - Wikipedia`,
              uri: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, '_'))}`,
              snippet,
              source: 'Wikipedia',
            });
          }
        }
      } catch {
        // Silently skip
      }
    })()
  );

  // 3. DuckDuckGo Instant Answer & Related Topics API
  tasks.push(
    (async () => {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.AbstractText && data.AbstractURL) {
            addSource({
              title: data.Heading || cleanQuery,
              uri: data.AbstractURL,
              snippet: data.AbstractText,
              source: data.AbstractSource || 'DuckDuckGo Knowledge',
            });
          }
          if (Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, 3)) {
              if (topic.FirstURL && topic.Text) {
                addSource({
                  title: topic.Text.split(' - ')[0] || cleanQuery,
                  uri: topic.FirstURL,
                  snippet: topic.Text,
                  source: 'Web Index',
                });
              }
            }
          }
        }
      } catch {
        // Silently skip
      }
    })()
  );

  // 4. Hacker News Algolia API (technology, development, startup discussions)
  if (filterType === 'all' || filterType === 'technical' || filterType === 'discussions') {
    tasks.push(
      (async () => {
        try {
          const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanQuery)}&tags=story&hitsPerPage=5`;
          const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            const data = await res.json();
            const hits = data.hits || [];
            for (const hit of hits.slice(0, 4)) {
              const uri = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
              addSource({
                title: hit.title,
                uri,
                source: 'Tech Community',
              });
            }
          }
        } catch {
          // Silently skip
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
  return sources.slice(0, 8);
}

export interface WebImageItem {
  title: string;
  url: string;
  source: string;
}

/**
 * Retrieves 5-6 genuine, topic-specific images exclusively from Wikipedia and Wikimedia Commons.
 * Accurately searches the primary topic article and Wikimedia Commons photography.
 * Strictly filters out logos, icons, flags, diagrams, memorabilia, and unrelated images.
 * Never falls back to unrelated placeholder or stock images.
 */
export async function fetchLiveWebImages(query: string): Promise<WebImageItem[]> {
  const images: WebImageItem[] = [];
  const cleanQuery = query.trim();
  if (!cleanQuery) return images;

  const searchTerms = cleanQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const seenUrls = new Set<string>();

  const isGarbage = (rawTitle: string): boolean => {
    return /icon|logo|flag|symbol|signature|button|blank|disambig|shield|crest|map|stub|locator|diagram|schema|placeholder|edit-clear|ambox|question_mark|wikimedia|commons-logo|arrow|chart|graph|badge|template|jersey|bat|ticket|scorecard|museum/i.test(
      rawTitle
    );
  };

  const matchesTopic = (rawTitle: string): boolean => {
    if (searchTerms.length === 0) return true;
    const lower = rawTitle.toLowerCase();
    // Verify that at least one key word from the query is present in the title
    return searchTerms.some((term) => lower.includes(term));
  };

  const addImage = (rawTitle: string, url: string, source: string, requireTopicMatch = true) => {
    if (!url || seenUrls.has(url) || images.length >= 6) return;
    if (isGarbage(rawTitle)) return;
    if (requireTopicMatch && !matchesTopic(rawTitle)) return;

    seenUrls.add(url);
    const cleanTitle = rawTitle
      .replace(/^File:/i, '')
      .replace(/\.(jpe?g|png|webp|gif)$/i, '')
      .replace(/_/g, ' ')
      .trim();

    images.push({
      title: cleanTitle || cleanQuery,
      url,
      source,
    });
  };

  const headers = { 'User-Agent': 'GeminiSearchAssistant/2.0 (TopicMediaGrounding)' };

  try {
    // 1. Search Wikipedia for the exact entity article
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery
    )}&utf8=&format=json&srlimit=3&origin=*`;
    const sRes = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(4000) });
    if (sRes.ok) {
      const sData = await sRes.json();
      const mainTitle = sData.query?.search?.[0]?.title;

      if (mainTitle) {
        // Task A: Fetch official lead portrait/thumbnail of the article
        const leadUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
          mainTitle
        )}&prop=pageimages&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;
        const lRes = await fetch(leadUrl, { headers, signal: AbortSignal.timeout(4000) });
        if (lRes.ok) {
          const lData = await lRes.json();
          const lPages = lData.query?.pages || {};
          for (const k of Object.keys(lPages)) {
            if (lPages[k].thumbnail?.source) {
              addImage(lPages[k].title, lPages[k].thumbnail.source, 'Wikipedia', false);
            }
          }
        }

        // Task B: Fetch authentic embedded photos from the Wikipedia article
        const articleImgsUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=${encodeURIComponent(
          mainTitle
        )}&gimlimit=35&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
        const aRes = await fetch(articleImgsUrl, { headers, signal: AbortSignal.timeout(4000) });
        if (aRes.ok) {
          const aData = await aRes.json();
          const pages = aData.query?.pages || {};
          for (const k of Object.keys(pages)) {
            const p = pages[k];
            const info = p.imageinfo?.[0];
            if (
              info?.thumburl &&
              (info.mime === 'image/jpeg' || info.mime === 'image/png' || info.mime === 'image/webp')
            ) {
              addImage(p.title, info.thumburl, 'Wikipedia', true);
            }
          }
        }
      }
    }
  } catch {
    // Continue
  }

  // 2. Search Wikimedia Commons directly for dedicated topic photography if needed
  if (images.length < 6) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleanQuery
      )}&gsrnamespace=6&gsrlimit=18&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
      const cRes = await fetch(commonsUrl, { headers, signal: AbortSignal.timeout(4000) });
      if (cRes.ok) {
        const cData = await cRes.json();
        const cPages = cData.query?.pages || {};
        for (const k of Object.keys(cPages)) {
          const p = cPages[k];
          const info = p.imageinfo?.[0];
          if (
            info?.thumburl &&
            (info.mime === 'image/jpeg' || info.mime === 'image/png' || info.mime === 'image/webp')
          ) {
            addImage(p.title, info.thumburl, 'Wikimedia Commons', true);
          }
        }
      }
    } catch {
      // Continue
    }
  }

  return images.slice(0, 6);
}

