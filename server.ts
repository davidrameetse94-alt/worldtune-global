import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Real YouTube Search API endpoint
  app.get('/api/search', async (req, res) => {
    const query = (req.query.q as string) || 'Chris Brown';
    try {
      // 1. First attempt: inv.nadeko.net if available
      try {
        const invRes = await fetch(
          `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          if (Array.isArray(invData)) {
            const vids = invData
              .filter((item: any) => item.type === 'video')
              .slice(0, 12)
              .map((item: any) => ({
                videoId: item.videoId,
                title: item.title,
                author: item.author,
                views:
                  item.viewCountText ||
                  (item.viewCount
                    ? `${(item.viewCount / 1000000).toFixed(1)}M views`
                    : 'Popular Video'),
                duration: item.lengthSeconds
                  ? `${Math.floor(item.lengthSeconds / 60)}:${(item.lengthSeconds % 60)
                      .toString()
                      .padStart(2, '0')}`
                  : '3:30',
              }));
            if (vids.length > 0) {
              return res.json({ items: vids });
            }
          }
        }
      } catch {
        // Fall through to real YouTube scraper
      }

      // 2. Fetch directly from YouTube search
      const ytRes = await fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(4000),
        }
      );

      const html = await ytRes.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const sections =
          data.contents?.twoColumnSearchResultsRenderer?.primaryContents
            ?.sectionListRenderer?.contents || [];

        const videos: any[] = [];
        for (const section of sections) {
          const contents = section.itemSectionRenderer?.contents || [];
          for (const item of contents) {
            if (item.videoRenderer?.videoId) {
              const v = item.videoRenderer;
              videos.push({
                videoId: v.videoId,
                title: v.title?.runs?.[0]?.text || query,
                author: v.ownerText?.runs?.[0]?.text || query,
                views: v.viewCountText?.simpleText || 'Popular Video',
                duration: v.lengthText?.simpleText || '3:30',
              });
            }
          }
        }

        if (videos.length > 0) {
          return res.json({ items: videos.slice(0, 12) });
        }
      }

      return res.json({ items: [] });
    } catch (err: any) {
      console.error('Search endpoint error:', err);
      return res.status(500).json({ error: err.message || 'Search failed' });
    }
  });

  // In development, mount Vite dev server middlewares
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve dist folder
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WorldTune server running on port ${PORT}`);
  });
}

startServer();
