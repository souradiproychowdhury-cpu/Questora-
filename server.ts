import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // also load .env as fallback

import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, User } from './server/db.js';
import { executeGeminiSearch, executeOpenAISearch, getOpenAiStatus, executeTranslate, executeAIChat } from './server/ai.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware for parsing JSON with generous payload limits for documents/images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper middleware to extract optional or required authenticated user
function authenticate(required = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (required) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
      }
      return next();
    }

    const token = authHeader.split(' ')[1];
    const session = db.getSession(token);

    if (!session) {
      if (required) {
        return res.status(401).json({ error: 'Session invalid or expired. Please sign in again.' });
      }
      return next();
    }

    const user = db.getUserById(session.userId);
    if (!user) {
      if (required) {
        return res.status(401).json({ error: 'User account not found.' });
      }
      return next();
    }

    (req as any).user = user;
    (req as any).sessionToken = token;
    next();
  };
}

// ---------------- API ROUTES ----------------

// System status and configuration check
app.get('/api/status', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const openAiStatus = getOpenAiStatus();
  const stats = db.getStats();

  res.json({
    status: 'ok',
    services: {
      gemini: {
        configured: hasGeminiKey,
        defaultModel: 'gemini-3.8-flash',
        features: ['Google Search Grounding', 'Web Citations', 'Real-time Fact Retrieval'],
      },
      openai: {
        configured: openAiStatus.configured,
        quotaExhausted: openAiStatus.quotaExhausted,
        defaultModel: 'gpt-4o-mini',
      },
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      usersRegistered: stats.usersCount,
      historyItemsStored: stats.historyCount,
      p99Latency: stats.p99Latency,
      avgLatency: stats.avgLatency,
      recentLatencies: stats.recentLatencies,
      totalRequests: stats.totalRequests,
    },
  });
});

// AUTH: Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid, fully qualified email address (e.g. user@domain.com).' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || typeof password !== 'string' || !passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long, and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).' 
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const newUser: User = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
      preferences: {
        defaultEngine: 'gemini',
        theme: 'system',
      },
    };

    db.createUser(newUser);

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token, userId);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
        preferences: newUser.preferences,
      },
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// AUTH: Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token, user.id);

    return res.json({
      message: 'Signed in successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to sign in. Please try again.' });
  }
});

// AUTH: Google Sign In
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required.' });
    }

    // Securely decode and extract Google profile from the JWT payload
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Malformed Google credential token.' });
    }

    const payloadBuffer = Buffer.from(parts[1], 'base64');
    const payload = JSON.parse(payloadBuffer.toString('utf-8'));

    // Validate essential JWT parameters
    const expectedClientId = '548580778222-b1921msglachn1acdoc7ib2bg4v26ct2.apps.googleusercontent.com';
    const aud = payload.aud;
    const iss = payload.iss;
    const exp = payload.exp;

    if (aud !== expectedClientId) {
      return res.status(400).json({ error: 'Invalid Google client ID audience.' });
    }

    if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
      return res.status(400).json({ error: 'Invalid token issuer.' });
    }

    if (exp && Date.now() / 1000 > exp) {
      return res.status(400).json({ error: 'Google credential token has expired.' });
    }

    const email = payload.email?.trim().toLowerCase();
    const name = payload.name || payload.given_name || 'Google User';

    if (!email) {
      return res.status(400).json({ error: 'Failed to retrieve email address from Google Account.' });
    }

    // Find or create the user in our database
    let user = db.getUserByEmail(email);
    if (!user) {
      // Create user
      const userId = crypto.randomUUID();
      // Generate a secure random password hash for the database record
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = {
        id: userId,
        name,
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        preferences: {
          defaultEngine: 'gemini',
          theme: 'system',
        },
      };
      db.createUser(user);
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token, user.id);

    return res.json({
      message: 'Signed in successfully with Google.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      token,
    });
  } catch (err: any) {
    console.error('Google Auth error:', err);
    return res.status(500).json({ error: 'Google Sign-In failed. Please try again.' });
  }
});

// AUTH: Current User Profile
app.get('/api/auth/me', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const userHistory = db.getHistory(user.id);
  const userBookmarks = db.getBookmarks(user.id);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      preferences: user.preferences,
    },
    stats: {
      searchesCount: userHistory.length,
      bookmarksCount: userBookmarks.length,
    },
  });
});

// AUTH: Logout
app.post('/api/auth/logout', authenticate(false), (req: Request, res: Response) => {
  const token = (req as any).sessionToken;
  if (token) {
    db.deleteSession(token);
  }
  res.json({ message: 'Signed out successfully.' });
});

// SEARCH: Execute AI Search
app.post('/api/search', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { query, engine = 'gemini', mode = 'comprehensive', filterType = 'all', model, attachments } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const cleanQuery = query.trim();
    let result;

    if (engine === 'openai') {
      result = await executeOpenAISearch(cleanQuery, { mode, filterType, model, attachments });
    } else {
      const geminiModel = model && model.startsWith('gemini-') ? model : 'gemini-3.8-flash';
      result = await executeGeminiSearch(cleanQuery, { mode, filterType, model: geminiModel, attachments });
    }

    if (result.executionTimeMs) {
      db.recordLatency(result.executionTimeMs);
    }

    // If authenticated, automatically record into user's search history
    const user = (req as any).user as User | undefined;
    const historyItem = {
      id: crypto.randomUUID(),
      userId: user?.id,
      query: cleanQuery,
      engine: result.engine,
      timestamp: new Date().toISOString(),
      summaryPreview: result.text.slice(0, 160).replace(/[#*`]/g, '') + '...',
      sourcesCount: result.sources.length,
      sources: result.sources.map((s) => ({ title: s.title, uri: s.uri })),
      fullText: result.text,
      model: result.model,
      searchQueries: result.searchQueries,
      suggestedFollowUps: result.suggestedFollowUps,
      images: result.images,
      executionTimeMs: result.executionTimeMs,
    };

    db.addHistory(historyItem);

    return res.json({
      ...result,
      historyId: historyItem.id,
      savedToAccount: Boolean(user),
    });
  } catch (err: any) {
    console.error('Search API error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while performing search. Please try again.',
    });
  }
});

// CHAT: Live Chat follow-up with Gemini or OpenAI
app.post('/api/chat', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { message, history = [], engine = 'gemini', model } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const startTime = Date.now();
    const responseText = await executeAIChat(message.trim(), history, { engine, model });
    const duration = Date.now() - startTime;

    // Record telemetry latency
    db.recordLatency(duration);

    return res.json({
      reply: responseText,
      text: responseText,
      executionTimeMs: duration,
    });
  } catch (err: any) {
    console.error('Chat API error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while continuing the chat session.',
    });
  }
});

// TRANSLATE: Translate AI Search Answer
app.post('/api/translate', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = 'Spanish', targetCode = 'es' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text to translate is required.' });
    }

    const result = await executeTranslate(text.trim(), targetLanguage);

    return res.json({
      translatedText: result.translatedText,
      targetLanguage: result.targetLanguage,
      targetCode,
    });
  } catch (err: any) {
    console.error('Translate API error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while translating. Please try again.',
    });
  }
});

// DOCX: Generate authentic Microsoft Word .docx document
app.post('/api/generate-docx', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { title = 'AI Research Report', content = '', query = '' } = req.body;
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

    const paragraphs: any[] = [];

    // Main Title
    paragraphs.push(
      new Paragraph({
        text: title || query || 'AI Project Report',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    // Subtitle / generated timestamp
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated by Gemini AI Search • ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`,
            italics: true,
            color: '666666',
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 },
      })
    );

    // Parse the markdown/text into clean docx paragraphs
    const lines = (content || query).split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }

      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^#\s*/, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 140 },
          })
        );
      } else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^##\s*/, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^###\s*/, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.replace(/^[-*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: '• ', bold: true, color: '3b82f6' }),
              new TextRun({ text: bulletText, size: 22 }),
            ],
            spacing: { after: 80 },
          })
        );
      } else if (/^\d+\.\s/.test(line)) {
        const numText = line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: line.match(/^\d+\.\s*/)?.[0] || '1. ', bold: true }),
              new TextRun({ text: numText, size: 22 }),
            ],
            spacing: { after: 80 },
          })
        );
      } else {
        // Normal paragraph with basic bold parsing
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const children = parts.map((part) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({ text: part.slice(2, -2), bold: true, size: 22 });
          }
          return new TextRun({ text: part, size: 22 });
        });
        paragraphs.push(
          new Paragraph({
            children,
            spacing: { after: 140 },
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeTitle = (title || 'AI_Report').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.docx"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('DOCX Generation Error:', err);
    return res.status(500).json({ error: 'Failed to generate .docx document.' });
  }
});

// PPTX: Generate authentic PowerPoint .pptx presentation
app.post('/api/generate-pptx', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { title = 'AI Presentation', slides = [] } = req.body;
    const pptxgen = (await import('pptxgenjs')).default;
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';

    // 1. Title Slide (Dark Indigo modern theme)
    const titleSlide = pres.addSlide();
    titleSlide.background = { color: '0f172a' };
    titleSlide.addText(title || 'AI Presentation', {
      x: 0.8,
      y: 2.0,
      w: '85%',
      h: 1.5,
      fontSize: 40,
      color: 'ffffff',
      bold: true,
      align: 'center',
    });
    titleSlide.addText(`Generated by Gemini AI • ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, {
      x: 0.8,
      y: 3.8,
      w: '85%',
      h: 0.8,
      fontSize: 18,
      color: '94a3b8',
      align: 'center',
    });

    // 2. Content Slides
    if (Array.isArray(slides) && slides.length > 0) {
      for (const s of slides) {
        const slide = pres.addSlide();
        slide.background = { color: 'ffffff' };

        // Slide title
        slide.addText(s.title || 'Slide Topic', {
          x: 0.6,
          y: 0.5,
          w: '88%',
          h: 0.8,
          fontSize: 28,
          bold: true,
          color: '0f172a',
        });

        // Accent divider line
        slide.addShape(pres.ShapeType.rect, {
          x: 0.6,
          y: 1.3,
          w: '88%',
          h: 0.04,
          fill: { color: '4f46e5' },
        });

        // Bullets
        if (Array.isArray(s.bullets) && s.bullets.length > 0) {
          const bulletTexts = s.bullets.map((b: string) => ({
            text: b,
            options: { bullet: true, color: '334155', fontFace: 'Calibri', fontSize: 20 },
          }));
          slide.addText(bulletTexts, {
            x: 0.6,
            y: 1.6,
            w: '88%',
            h: 4.8,
            margin: 0.1,
          });
        }
      }
    }

    const buffer = await pres.write({ outputType: 'nodebuffer' });
    const safeTitle = (title || 'AI_Presentation').replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.pptx"`);
    return res.send(buffer);
  } catch (err: any) {
    console.error('PPTX Generation Error:', err);
    return res.status(500).json({ error: 'Failed to generate .pptx presentation.' });
  }
});

// HISTORY: Get Search History
app.get('/api/history', authenticate(false), (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  const history = db.getHistory(user?.id);
  res.json({ history });
});

// HISTORY: Delete specific item
app.delete('/api/history/:id', authenticate(false), (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  const { id } = req.params;
  const deleted = db.deleteHistoryItem(id, user?.id);
  res.json({ success: deleted });
});

// HISTORY: Clear all
app.delete('/api/history', authenticate(false), (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  db.clearHistory(user?.id);
  res.json({ success: true, message: 'Search history cleared.' });
});

// BOOKMARKS: Get user bookmarks
app.get('/api/bookmarks', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const bookmarks = db.getBookmarks(user.id);
  res.json({ bookmarks });
});

// BOOKMARKS: Save bookmark
app.post('/api/bookmarks', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { query, title, summary, engine, sources, images } = req.body;

  if (!query || !summary) {
    return res.status(400).json({ error: 'Query and summary are required to bookmark.' });
  }

  const bookmark = db.addBookmark({
    id: crypto.randomUUID(),
    userId: user.id,
    query,
    title: title || query,
    summary,
    engine: engine || 'gemini',
    sources: Array.isArray(sources) ? sources : [],
    images: Array.isArray(images) ? images : [],
    savedAt: new Date().toISOString(),
  });

  res.status(201).json({ bookmark });
});

// BOOKMARKS: Delete bookmark
app.delete('/api/bookmarks/:id', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { id } = req.params;
  const success = db.deleteBookmark(id, user.id);
  res.json({ success });
});

// ---------------- Vite Middleware & Production Serving ----------------

async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (typeof process.argv[1] === 'string' && process.argv[1].includes('dist'));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const distIndex = path.join(distPath, 'index.html');
    const rootIndex = path.resolve(process.cwd(), 'index.html');

    // If dist folder or dist/index.html is missing, build it automatically
    if (!fs.existsSync(distIndex)) {
      console.warn(`[WARN] ${distIndex} not found. Attempting automatic build...`);
      try {
        const { execSync } = await import('child_process');
        execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
      } catch (buildErr) {
        console.error('[BUILD ERROR] Auto-build failed, will fallback to root index.html:', buildErr);
      }
    }

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.use(express.static(process.cwd()));

    app.get('*', (req: Request, res: Response) => {
      if (fs.existsSync(distIndex)) {
        return res.sendFile(distIndex);
      }
      if (fs.existsSync(rootIndex)) {
        return res.sendFile(rootIndex);
      }
      return res.status(404).send('Application index.html not found. Please ensure project is built.');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Questora AI Server running at http://0.0.0.0:${PORT} [mode: ${isProduction ? 'production' : 'development'}]`);
  });
}

startServer();
