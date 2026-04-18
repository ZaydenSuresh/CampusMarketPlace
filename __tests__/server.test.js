// Import supertest
const request = require('supertest');

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

// Mock supabase library
jest.mock('../lib/supabase', () => ({
  createSupabaseClient: jest.fn(() => mockSupabaseClient),
}));

// Mock database module
jest.mock('../database', () => mockSupabaseClient);

// Set up Express app
const express = require('express');
const app = express();
app.use(express.json());

// Import routes
const listingsRouter = require('../routes/listings');
app.use('/listings', listingsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, service: 'campus-marketplace-api' });
});

describe('Health & Listings API', () => {
  describe('GET /health', () => {
    // Returns health status object
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.service).toBe('campus-marketplace-api');
    });
  });

  describe('GET /listings/:id', () => {
    // Returns a single listing by ID
    it('should return single listing', async () => {
      const mockListing = { id: '1', title: 'Test Item', price: 100 };
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockListing, error: null })
          })
        })
      });

      const response = await request(app).get('/listings/1');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    // Returns 500 error when listing not found
    it('should handle errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Not found' } 
            })
          })
        })
      });

      const response = await request(app).get('/listings/999');
      expect(response.status).toBe(500);
    });
  });
});