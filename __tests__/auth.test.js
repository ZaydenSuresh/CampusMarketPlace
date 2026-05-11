// Import supertest to make HTTP requests to our Express app in tests
const request = require('supertest');

// Mock Supabase client
const mockSignOut = jest.fn().mockResolvedValue({ error: null });

const mockSupabaseClient = {
  // Authentication operations
  auth: {
    signInWithOAuth: jest.fn().mockResolvedValue({ 
      data: { url: 'https://google.com/auth' }, 
      error: null 
    }),
    exchangeCodeForSession: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'user-123', email: 'test@example.com', user_metadata: { full_name: 'Test User' } } }, 
      error: null 
    }),
    signUp: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'user-123', email: 'test@example.com' } }, 
      error: null 
    }),
    signInWithPassword: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'user-123', email: 'test@example.com' } }, 
      error: null 
    }),
    signOut: mockSignOut,
    getUser: jest.fn().mockResolvedValue({ 
      data: { user: { id: 'user-123', email: 'test@example.com' } }, 
      error: null 
    }),
  },
  // Database query methods
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: { name: 'Test User', role: 'Student' }, error: null }),
  })),
};

// Mock the supabase library
jest.mock('../lib/supabase', () => ({
  createSupabaseClient: jest.fn(() => mockSupabaseClient),
}));

// Mock the database module
jest.mock('../database', () => mockSupabaseClient);

// Set up Express app for testing
const express = require('express');
const app = express();
app.use(express.json());
const { router: authRouter } = require('../routes/auth');
app.use('/auth', authRouter);

describe('Auth API', () => {
  // GET /auth/google - redirects to Google OAuth
  describe('GET /auth/google', () => {
    it('should redirect to Google OAuth', async () => {
      const response = await request(app).get('/auth/google');
      expect(response.status).toBe(302);
    });

    it('should return 500 when OAuth fails', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: { message: 'OAuth failed' },
      });
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toBe('Failed to start Google OAuth');
    });

    it('should return 500 when no OAuth URL returned', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
        data: { url: null },
        error: null,
      });
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toBe('OAuth URL was not returned by Supabase');
    });

    it('should return 500 on unexpected error', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockImplementationOnce(() => {
        throw new Error('Unexpected');
      });
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it('should use fallback message when thrown error has no message', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockImplementationOnce(() => {
        throw 'string error';
      });
      const res = await request(app).get('/auth/google');
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Google OAuth failed');
    });
  });

  // GET /auth/callback - OAuth callback
  describe('GET /auth/callback', () => {
    it('should return 401 when OAuth error is present', async () => {
      const res = await request(app).get('/auth/callback?error=access_denied&error_description=User+cancelled');
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toBe('User cancelled');
    });

    it('should use default message when OAuth error has no description', async () => {
      const res = await request(app).get('/auth/callback?error=access_denied');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Google sign-in was not completed');
    });

    it('should return 400 when code is missing', async () => {
      const res = await request(app).get('/auth/callback');
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/missing code/i);
    });

    it('should return 500 when exchangeCodeForSession fails', async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid code' },
      });
      const res = await request(app).get('/auth/callback?code=bad');
      expect(res.status).toBe(500);
      expect(res.body.ok).toBe(false);
    });

    it('should return 400 when no user returned', async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toBe('No user returned after Google sign-in.');
    });

    it('should handle profile lookup error gracefully', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Lookup error' },
        }),
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/dashboard.html');
    });

    it('should redirect new user to dashboard', async () => {
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/dashboard.html');
    });

    it('should use email username when full_name is missing', async () => {
      mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValueOnce({
        data: { user: { id: 'user-456', email: 'test@example.com' } },
        error: null,
      });
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/dashboard.html');
    });

    it('should redirect existing Student to dashboard', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { name: 'Test', role: 'Student' },
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/dashboard.html');
    });

    it('should redirect existing Staff to manage-slots', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { name: 'Staff', role: 'Trade Facility Staff' },
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/manage-slots.html');
    });

    it('should redirect existing Admin to admin-dashboard', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { name: 'Admin', role: 'Admin' },
          error: null,
        }),
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));
      const res = await request(app).get('/auth/callback?code=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/admin-dashboard.html');
    });
  });

  // GET /auth/me - returns current user info
  describe('GET /auth/me', () => {
    it('should return current user info when logged in', async () => {
      const response = await request(app).get('/auth/me');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
      expect(response.body.user).toHaveProperty('role');
    });

    it('should return 401 when not logged in', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
      const response = await request(app).get('/auth/me');
      expect(response.status).toBe(401);
    });

    it('should fallback to email username when profile is null', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }));
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('test');
      expect(res.body.user.role).toBe('Student');
    });
  });

  // GET /auth/profiles/:id - returns profile by ID
  describe('GET /auth/profiles/:id', () => {
    it('should return profile name', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { name: 'Test User' }, error: null }),
      }));
      const res = await request(app).get('/auth/profiles/user-123');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test User');
    });

    it('should return 500 on fetch error', async () => {
      mockSupabaseClient.from.mockImplementationOnce(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }));
      const res = await request(app).get('/auth/profiles/user-999');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('DB error');
    });
  });

  // POST /auth/register - creates new user
  describe('POST /auth/register', () => {
    it('should create a new user', async () => {
      const newUser = { email: 'new@example.com', password: 'password123', name: 'New User' };
      const response = await request(app).post('/auth/register').send(newUser);
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should return 400 when signup fails', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValueOnce({ data: null, error: { message: 'Email taken' } });
      const res = await request(app).post('/auth/register').send({
        email: 'taken@example.com',
        password: '123456',
        name: 'Taken',
      });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toBe('Signup failed');
    });

    it('should return 400 when signup throws', async () => {
      mockSupabaseClient.auth.signUp.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      const res = await request(app).post('/auth/register').send({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('should create user with specified role', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        role: 'Admin',
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('should handle profile creation error gracefully', async () => {
      const customBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseClient.from
        .mockImplementationOnce(() => customBuilder)
        .mockImplementationOnce(() => customBuilder);
      const res = await request(app).post('/auth/register').send({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });
      expect(res.status).toBe(200);
    });
  });

  // POST /auth/login - logs in existing user
  describe('POST /auth/login', () => {
    it('should login existing user', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      const response = await request(app).post('/auth/login').send(credentials);
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.user).toHaveProperty('email');
    });

    it('should return 400 for invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({ data: null, error: { message: 'Invalid' } });
      const response = await request(app).post('/auth/login').send({ email: 'wrong@example.com', password: 'wrong' });
      expect(response.status).toBe(400);
    });

    it('should return 400 when login throws', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      const res = await request(app).post('/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(res.status).toBe(400);
    });
  });

  // POST /auth/logout - clears user session
  describe('POST /auth/logout', () => {
    it('should logout the user', async () => {
      const response = await request(app).post('/auth/logout');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.message).toBe('Logout successful');
    });

    it('should return 400 when logout fails', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({ error: { message: 'Session expired' } });
      const response = await request(app).post('/auth/logout');
      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
    });

    it('should return 400 when logout throws', async () => {
      mockSupabaseClient.auth.signOut.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(400);
    });
  });
});