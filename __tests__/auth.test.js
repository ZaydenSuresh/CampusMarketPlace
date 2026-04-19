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
  });

  // POST /auth/register - creates new user
  describe('POST /auth/register', () => {
    it('should create a new user', async () => {
      const newUser = { email: 'new@example.com', password: 'password123', name: 'New User' };
      const response = await request(app).post('/auth/register').send(newUser);
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
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
  });

  // POST /auth/logout - clears user session
  // describe('POST /auth/logout', () => {
  //   it('should logout the user', async () => {
  //     mockSupabaseClient.auth.signOut = jest.fn().mockResolvedValue({ error: null });
  //     const response = await request(app).post('/auth/logout');
  //     expect(response.status).toBe(200);
  //     expect(response.body.ok).toBe(true);
  //   });
  // });
});