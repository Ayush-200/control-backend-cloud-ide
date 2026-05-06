import express from 'express';
import authRouter from './routes/auth.router.js'
import awsRouter from './routes/aws.router.js';
import projectRouter from './routes/project.router.js';
import 'dotenv/config'
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';

const app = express();
const PORT = process.env.PORT;

// Cookie parser (must be before CSRF)
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({extended: true}));
// Handle sendBeacon requests (sent as text/plain)
app.use(express.text({ type: 'text/plain' }));
app.use(cors({
    origin: ['http://localhost:3000', process.env.NEXT_PUBLIC_FRONTEND_URL].filter(Boolean) as string[], 
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    credentials: true
}));

// CSRF Protection Setup
const csrfProtection = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-secret-key-change-in-production',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getSessionIdentifier: (req) => {
    // Simple identifier - can be enhanced with actual session management
    return req.headers['user-agent'] || 'anonymous';
  },
});

// Health check endpoint (no CSRF needed)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// CSRF token endpoint (no CSRF validation needed for GET)
app.get('/api/csrf-token', (req, res) => {
    const token = csrfProtection.generateCsrfToken(req, res);
    res.json({ csrfToken: token });
});

// Log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Apply CSRF protection to all API routes
app.use('/auth', csrfProtection.doubleCsrfProtection, authRouter);
app.use('/aws', csrfProtection.doubleCsrfProtection, awsRouter);
app.use('/api', csrfProtection.doubleCsrfProtection, projectRouter);

// CSRF error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
        console.error('CSRF token validation failed:', err.message);
        return res.status(403).json({ 
            error: 'Invalid CSRF token',
            message: 'CSRF token validation failed. Please refresh and try again.'
        });
    }
    next(err);
});

// 404 handler
app.use((req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`CSRF Protection: ENABLED`);
    console.log(`=================================`);
    console.log('Available routes:');
    console.log('  GET  /api/csrf-token (Get CSRF token)');
    console.log('  POST /auth/user (Auth0 integration)');
    console.log('  POST /aws/startSession');
    console.log('  POST /aws/stopSession');
    console.log('  GET  /api/projects');
    console.log('  POST /api/projects');
    console.log('  DELETE /api/projects');
    console.log(`=================================`);
})
