# Custom JWT Authentication Implementation Guide

This document explains your current JWT (JSON Web Token) authentication implementation with access tokens and refresh tokens.

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Step-by-Step Flow](#step-by-step-flow)
5. [Code Breakdown](#code-breakdown)
6. [Issues & Improvements](#issues--improvements)

---

## Overview

### What is JWT?
JWT (JSON Web Token) is a compact, URL-safe token format used for securely transmitting information between parties. It consists of three parts:
- **Header**: Token type and signing algorithm
- **Payload**: Claims (user data)
- **Signature**: Verification signature

### Why Two Tokens?

**Access Token (Short-lived)**
- Used for API requests
- Expires quickly (1 day in your implementation)
- If stolen, limited damage window

**Refresh Token (Long-lived)**
- Used to get new access tokens
- Expires slowly (7 days in your implementation)
- Stored securely, rarely transmitted

---

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. POST /auth/signup or /auth/login
       │    { email, password }
       ▼
┌─────────────────────────────────────┐
│         Auth Controller             │
│  - Validate input                   │
│  - Hash password                    │
│  - Generate tokens                  │
└──────┬──────────────────────────────┘
       │
       │ 2. Set HTTP-only cookies
       │    - access-token
       │    - refresh-token
       ▼
┌─────────────────────────────────────┐
│         Client Storage              │
│  Cookies (HTTP-only, secure)        │
└──────┬──────────────────────────────┘
       │
       │ 3. API requests with cookies
       ▼
┌─────────────────────────────────────┐
│      Auth Middleware                │
│  - Extract token from cookie        │
│  - Verify signature                 │
│  - Decode payload                   │
└──────┬──────────────────────────────┘
       │
       │ 4. Access granted
       ▼
┌─────────────────────────────────────┐
│      Protected Route                │
│  - Execute business logic           │
└─────────────────────────────────────┘
```

---

## Core Components

### 1. Token Generation (`src/utils/jwt.ts`)

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = String(process.env.JWT_SECRET);

export const generateToken = (payload: Object) => {
    return jwt.sign(payload, JWT_SECRET, {expiresIn: "1d"});
}

export const validateToken = (token: string) => { 
    return jwt.verify(token, JWT_SECRET);
}
```

**Explanation:**
- `generateToken()`: Creates a JWT access token
  - **Payload**: User data (email, userId, etc.)
  - **Secret**: Environment variable for signing
  - **Expiry**: 1 day ("1d")
  
- `validateToken()`: Verifies token authenticity
  - Checks signature matches
  - Checks expiration
  - Returns decoded payload if valid

**How JWT Signing Works:**
```
1. Take payload: { userId: "123", email: "user@example.com" }
2. Encode to Base64: eyJ1c2VySWQiOiIxMjMi...
3. Create signature: HMACSHA256(base64Header + base64Payload, secret)
4. Combine: header.payload.signature
```

---

### 2. Refresh Token Generation (`src/utils/createRefreshToken.ts`)

```typescript
import jwt from "jsonwebtoken"

export const createRefreshToken = (payload: Object) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!);
}
```

**Explanation:**
- Creates a refresh token with different secret
- **Issue**: No expiration set! Should have `expiresIn: "7d"`
- Used to obtain new access tokens without re-login

**Why Different Secret?**
- If access token secret is compromised, refresh tokens remain secure
- Allows independent rotation of secrets
- Better security isolation

---

### 3. Token Refresh Endpoint (`src/utils/refreshAccessToken.ts`)

```typescript
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateToken } from './jwt.js';
import { createRefreshToken } from './createRefreshToken.js';

export const refreshAccessToken = (req: Request, res: Response) => { 
    const refreshToken = req.cookies.Refreshtoken;
    
    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token not provided" });
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
        
        // Create new tokens
        const payload = {
            userId: decoded.userId,
            email: decoded.email
        };
        
        const newAccessToken = generateToken(payload);
        const newRefreshToken = createRefreshToken(payload);
        
        // Set new tokens in cookies
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        res.cookie('Refreshtoken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        return res.status(200).json({ 
            message: "Tokens refreshed successfully",
            accessToken: newAccessToken 
        });
        
    } catch (error) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
}
```

**Explanation:**

**Step 1: Extract Refresh Token**
```typescript
const refreshToken = req.cookies.Refreshtoken;
```
- Reads from HTTP-only cookie
- Cookie name: "Refreshtoken" (note the capital R)

**Step 2: Verify Refresh Token**
```typescript
const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
```
- Checks signature with refresh token secret
- Throws error if invalid or expired
- Returns decoded payload if valid

**Step 3: Generate New Tokens**
```typescript
const newAccessToken = generateToken(payload);
const newRefreshToken = createRefreshToken(payload);
```
- Creates fresh access token (1 day expiry)
- Creates fresh refresh token (no expiry - bug!)
- This is called "token rotation"

**Step 4: Set New Cookies**
```typescript
res.cookie('accessToken', newAccessToken, {
    httpOnly: true,      // JavaScript can't access
    secure: true,        // HTTPS only in production
    sameSite: 'strict',  // CSRF protection
    maxAge: 24 * 60 * 60 * 1000  // 1 day in milliseconds
});
```

**Cookie Security Flags:**
- `httpOnly`: Prevents XSS attacks (JavaScript can't read)
- `secure`: Only sent over HTTPS
- `sameSite: 'strict'`: Prevents CSRF attacks
- `maxAge`: Browser deletes cookie after this time

---

### 4. Authentication Middleware (`src/middleware/auth.middleware.ts`)

```typescript
import jwt from "jsonwebtoken";
import "dotenv/config"

export const authMiddleware = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    
    if(!token){
        return res.status(500).json({message: "no token provided"});   
    }
    
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        return res.status(200).json(decoded);
    }catch(err){
        return res.status(500).json("given token did not match");
    }
}
```

**Explanation:**

**Purpose**: Protect routes by verifying JWT tokens

**Step 1: Extract Token**
```typescript
const token = req.cookies.token;
```
- **Issue**: Cookie name is "token" but controller sets "access-token"
- This mismatch means middleware won't work!

**Step 2: Verify Token**
```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET!);
```
- Validates signature
- Checks expiration
- Returns payload if valid

**Issues:**
1. Returns response instead of calling `next()`
2. Should attach user to request: `req.user = decoded`
3. Wrong cookie name
4. Wrong status codes (should be 401, not 500)

**How It Should Work:**
```typescript
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken;  // Fixed name
    
    if(!token){
        return res.status(401).json({error: "No token provided"});   
    }
    
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded;  // Attach to request
        next();  // Continue to next middleware/route
    }catch(err){
        return res.status(401).json({error: "Invalid token"});
    }
}
```

---

### 5. Input Validation

#### Login Validator (`src/utils/loginValidator.ts`)

```typescript
import { body } from "express-validator"

export const loginValidator = [
    body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("email is not valid"), 
    
    body("password")
    .trim()
]
```

**Explanation:**
- Uses `express-validator` library
- Validates email format
- Trims whitespace
- **Issue**: Password has no validation rules!

#### Signup Validator (`src/utils/singupValidator.ts`)

```typescript
import { body } from "express-validator"

export const signupValidator = [
    body("name")
    .trim()
    .notEmpty()
    .withMessage("name cannot be empty")
    .isLength({min: 2, max: 20})
    .withMessage("name is too long or too short")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("name is not valid"), 

    body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("email is not valid"),

    body("password")
    .trim()
    .isLength({min: 8})
    .withMessage("password must be atleast of 8 length")
    .isStrongPassword()
    .withMessage("passowrd is not strong")
]
```

**Explanation:**

**Name Validation:**
- Must not be empty
- Length: 2-20 characters
- Regex: Only letters, spaces, hyphens, apostrophes
- Prevents: Numbers, special characters

**Email Validation:**
- Trims whitespace
- Normalizes (converts to lowercase)
- Validates email format

**Password Validation:**
- Minimum 8 characters
- `isStrongPassword()` checks for:
  - Uppercase letters
  - Lowercase letters
  - Numbers
  - Special characters

#### Error Handler (`src/utils/validateErrors.ts`)

```typescript
import { validationResult } from "express-validator";

const validateErrors = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    
    if(!errors.isEmpty()){
        return res.status(500).json({errors: errors.array()});
    }

    next();
}

export default validateErrors;
```

**Explanation:**
- Collects validation errors from validators
- If errors exist, returns 400 response
- If no errors, calls `next()` to continue
- **Issue**: Should return 400, not 500

**Usage in Routes:**
```typescript
router.post('/login', 
    loginValidator,      // Validate input
    validateErrors,      // Check for errors
    loginController      // Execute if valid
);
```

---

### 6. Authentication Service (`src/services/auth.service.ts`)

```typescript
import db from '../db/index.js';
import { users } from '../db/schema.js';
import { insertUser } from '../repositories/user.repository.js';
import type {signupDataType} from '../types/types.js';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { generateToken } from '../utils/jwt.js';
import { createRefreshToken } from '../utils/createRefreshToken.js';

export const signupUser = (data: signupDataType) => { 
    const password = data.password;
    const email = data.email;
    const name = data.name;
    const hashedPassword = String(bcrypt.hash(password, 10));
    
    try{
        const refreshToken = createRefreshToken(data);
        insertUser(name, email, hashedPassword, refreshToken);
        return ("user inserted into database");
    }catch(error){
        throw new Error(String(error));
    }
}

export async function loginUser (email: string, password: string):
    Promise<{token: string, refreshToken: string, userId: string}> {
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.select().from(users).where(eq(users.email, email));
    
    if(hashedPassword === user[0].password){
        const token = generateToken({user}) || "";
        const refreshToken = createRefreshToken(user[0]) || "";        
        return { token, refreshToken, userId: user[0].userId };
    }
    
    throw new Error("unable to find user");
}
```

**Explanation:**

#### Signup Function

**Step 1: Extract Data**
```typescript
const password = data.password;
const email = data.email;
const name = data.name;
```

**Step 2: Hash Password**
```typescript
const hashedPassword = String(bcrypt.hash(password, 10));
```
- **Issue**: Missing `await`! This won't work correctly
- `bcrypt.hash()` is async, returns a Promise
- Should be: `await bcrypt.hash(password, 10)`
- Salt rounds: 10 (good security level)

**What is Password Hashing?**
```
Plain password: "mypassword123"
                    ↓
            bcrypt.hash()
                    ↓
Hashed: "$2b$10$N9qo8uLOickgx2ZMRZoMye..."

- One-way function (can't reverse)
- Same password = different hash each time (salt)
- Slow by design (prevents brute force)
```

**Step 3: Store User**
```typescript
const refreshToken = createRefreshToken(data);
insertUser(name, email, hashedPassword, refreshToken);
```
- Creates refresh token
- Stores in database
- **Issue**: Refresh token stored but never validated on refresh!

#### Login Function

**Step 1: Hash Input Password**
```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```
- **Critical Bug**: Should use `bcrypt.compare()`, not `hash()`!
- Hashing the input creates a NEW hash
- Should compare with stored hash

**Step 2: Get User**
```typescript
const user = await db.select().from(users).where(eq(users.email, email));
```
- Queries database for user by email

**Step 3: Compare Passwords**
```typescript
if(hashedPassword === user[0].password){
```
- **Wrong**: Comparing two different hashes
- **Should be**: `await bcrypt.compare(password, user[0].password)`

**Correct Implementation:**
```typescript
export async function loginUser (email: string, password: string) {
    // Get user from database
    const users = await db.select().from(users).where(eq(users.email, email));
    
    if (users.length === 0) {
        throw new Error("User not found");
    }
    
    const user = users[0];
    
    // Compare password with stored hash
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
        throw new Error("Invalid password");
    }
    
    // Generate tokens
    const token = generateToken({ userId: user.userId, email: user.email });
    const refreshToken = createRefreshToken({ userId: user.userId });
    
    return { token, refreshToken, userId: user.userId };
}
```

---

### 7. Auth Controller (`src/controller/auth.controller.ts`)

```typescript
export const loginUserController = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    
    try{
        const {token, refreshToken, userId} = await loginUser(email, password);
        
        res.cookie("access-token", token, {
            httpOnly: true, 
            secure: true, 
            maxAge: 15* 60* 1000
        });

        res.cookie("refresh-token", refreshToken, {
            httpOnly: true, 
            secure: true,
            maxAge: 7 * 24* 60* 60* 1000
        });
        
        return res.status(200).json({ success: true, userId });
    }catch(err){
        console.error("Login error:", err);
        return res.status(401).json({ error: "Login failed", details: String(err) });
    }
}
```

**Explanation:**

**Step 1: Extract Credentials**
```typescript
const { email, password } = req.body;
```

**Step 2: Authenticate**
```typescript
const {token, refreshToken, userId} = await loginUser(email, password);
```
- Calls auth service
- Returns tokens if valid
- Throws error if invalid

**Step 3: Set Cookies**
```typescript
res.cookie("access-token", token, {
    httpOnly: true,      // Can't access via JavaScript
    secure: true,        // HTTPS only
    maxAge: 15* 60* 1000 // 15 minutes
});
```

**Cookie Names Issue:**
- Controller sets: `"access-token"` and `"refresh-token"`
- Refresh endpoint reads: `"Refreshtoken"`
- Middleware reads: `"token"`
- **All different!** Won't work together.

---

## Step-by-Step Flow

### Complete Authentication Flow

#### 1. User Signup

```
Client                          Server
  │                               │
  ├─ POST /auth/signup ──────────►│
  │  {                            │
  │    name: "John",              │
  │    email: "john@example.com", │
  │    password: "SecurePass123!" │
  │  }                            │
  │                               │
  │                               ├─ Validate input
  │                               │  (signupValidator)
  │                               │
  │                               ├─ Hash password
  │                               │  bcrypt.hash(password, 10)
  │                               │
  │                               ├─ Generate refresh token
  │                               │  jwt.sign(data, REFRESH_SECRET)
  │                               │
  │                               ├─ Store in database
  │                               │  INSERT INTO users...
  │                               │
  │                               ├─ Generate access token
  │                               │  jwt.sign(data, SECRET, {expiresIn: "1d"})
  │                               │
  │                               ├─ Set cookies
  │                               │  - access-token (15 min)
  │                               │  - refresh-token (7 days)
  │                               │
  │◄─ 201 Created ────────────────┤
  │  {                            │
  │    success: true,             │
  │    userId: "uuid-123"         │
  │  }                            │
  │  Set-Cookie: access-token=... │
  │  Set-Cookie: refresh-token=...│
```

#### 2. Making Authenticated Requests

```
Client                          Server
  │                               │
  ├─ GET /api/protected ─────────►│
  │  Cookie: access-token=jwt...  │
  │                               │
  │                               ├─ authMiddleware
  │                               │  - Extract token from cookie
  │                               │  - Verify signature
  │                               │  - Check expiration
  │                               │  - Decode payload
  │                               │
  │                               ├─ Attach user to request
  │                               │  req.user = decoded
  │                               │
  │                               ├─ Execute route handler
  │                               │  - Access req.user
  │                               │  - Perform business logic
  │                               │
  │◄─ 200 OK ─────────────────────┤
  │  { data: "protected content" }│
```

#### 3. Token Refresh Flow

```
Client                          Server
  │                               │
  │ (Access token expires)        │
  │                               │
  ├─ POST /auth/refresh ─────────►│
  │  Cookie: refresh-token=jwt... │
  │                               │
  │                               ├─ Extract refresh token
  │                               │  from cookie
  │                               │
  │                               ├─ Verify refresh token
  │                               │  jwt.verify(token, REFRESH_SECRET)
  │                               │
  │                               ├─ Generate new access token
  │                               │  jwt.sign(payload, SECRET, {expiresIn: "1d"})
  │                               │
  │                               ├─ Generate new refresh token
  │                               │  jwt.sign(payload, REFRESH_SECRET)
  │                               │
  │                               ├─ Set new cookies
  │                               │  - accessToken (1 day)
  │                               │  - Refreshtoken (7 days)
  │                               │
  │◄─ 200 OK ─────────────────────┤
  │  {                            │
  │    message: "Tokens refreshed"│
  │    accessToken: "new-jwt..."  │
  │  }                            │
  │  Set-Cookie: accessToken=...  │
  │  Set-Cookie: Refreshtoken=... │
```

---

## Issues & Improvements

### Critical Issues

#### 1. Cookie Name Inconsistency
```typescript
// auth.controller.ts sets:
res.cookie("access-token", ...)
res.cookie("refresh-token", ...)

// refreshAccessToken.ts reads:
req.cookies.Refreshtoken

// auth.middleware.ts reads:
req.cookies.token

// ❌ All different names!
```

**Fix**: Standardize names
```typescript
const COOKIE_NAMES = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken'
};
```

#### 2. Middleware Doesn't Call next()
```typescript
// Current (wrong):
try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    return res.status(200).json(decoded);  // ❌ Returns response
}

// Should be:
try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;  // ✅ Attach to request
    next();              // ✅ Continue to route
}
```

#### 3. Refresh Token Has No Expiry
```typescript
// Current (wrong):
export const createRefreshToken = (payload: Object) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!);
    // ❌ No expiration!
}

// Should be:
export const createRefreshToken = (payload: Object) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: '7d'  // ✅ 7 days expiry
    });
}
```

#### 4. Password Hashing Bugs
```typescript
// signupUser - Missing await:
const hashedPassword = String(bcrypt.hash(password, 10));  // ❌
const hashedPassword = await bcrypt.hash(password, 10);    // ✅

// loginUser - Wrong method:
const hashedPassword = await bcrypt.hash(password, 10);           // ❌
const isValid = await bcrypt.compare(password, user.password);    // ✅
```

#### 5. Middleware Never Applied
```typescript
// Routes don't use authMiddleware:
router.post('/startSession', startSession);  // ❌ No protection

// Should be:
router.post('/startSession', authMiddleware, startSession);  // ✅
```

#### 6. Refresh Token Not Validated
```typescript
// Refresh token stored in database but never checked
// Should verify stored token matches provided token
```

### Security Improvements

#### 1. Add Token Blacklist
```typescript
// When user logs out, blacklist their tokens
const blacklistedTokens = new Set();

export const logout = (req, res) => {
    const token = req.cookies.accessToken;
    blacklistedTokens.add(token);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
};
```

#### 2. Store Refresh Tokens Properly
```typescript
// Hash refresh tokens before storing
const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
await db.update(users)
    .set({ refreshToken: hashedRefreshToken })
    .where(eq(users.userId, userId));
```

#### 3. Add Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts'
});

router.post('/login', loginLimiter, loginValidator, loginController);
```

#### 4. Add CSRF Protection
```typescript
import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);
```

---

## Environment Variables Required

```env
# JWT Secrets (use strong random strings)
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars

# Node Environment
NODE_ENV=production
```

**Generate Strong Secrets:**
```bash
# In terminal:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Complete Working Example

Here's how all pieces work together:

### 1. User Signs Up
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### 2. Server Response
```
HTTP/1.1 201 Created
Set-Cookie: access-token=eyJhbGc...; HttpOnly; Secure
Set-Cookie: refresh-token=eyJhbGc...; HttpOnly; Secure

{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Make Authenticated Request
```bash
curl -X POST http://localhost:4000/aws/startSession \
  -H "Content-Type: application/json" \
  -H "Cookie: access-token=eyJhbGc..." \
  -d '{
    "projectName": "my-project"
  }'
```

### 4. When Access Token Expires
```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Cookie: refresh-token=eyJhbGc..."
```

### 5. Get New Tokens
```
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGc...; HttpOnly; Secure
Set-Cookie: Refreshtoken=eyJhbGc...; HttpOnly; Secure

{
  "message": "Tokens refreshed successfully",
  "accessToken": "eyJhbGc..."
}
```

---

## Conclusion

Your JWT implementation has the right structure but several critical bugs prevent it from working:

**What Works:**
✅ Token generation logic
✅ Cookie-based storage
✅ Refresh token concept
✅ Input validation structure

**What Doesn't Work:**
❌ Cookie name inconsistencies
❌ Middleware doesn't call next()
❌ Password comparison logic wrong
❌ Refresh token has no expiry
❌ Middleware never applied to routes
❌ Missing await on async operations

**Recommendation:**
Since you're using Auth0, remove this custom implementation and use Auth0's battle-tested token management instead.
