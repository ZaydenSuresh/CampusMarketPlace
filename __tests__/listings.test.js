const request = require('supertest');

// Mock the database before requiring server
jest.mock('../database', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

const express = require('express');
const app = express();
app.use(express.json());
app.use('/listings', require('../routes/listings'));

describe('Listings API', () => {
  describe('GET /listings', () => {
    it('should return 200 with listings array', async () => {
      const mockListings = [
        { id: 1, title: 'Test Item', price: 100, category: 'Textbooks' }
      ];
      
      const { from } = require('../database');
      from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockListings, error: null })
          })
        })
      });

      const response = await request(app).get('/listings');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.listings)).toBe(true);
    });
  });

  describe('POST /listings', () => {
    it('should create a new listing with valid data', async () => {
      const newListing = {
        title: 'Test Item',
        description: 'Test description',
        price: 100,
        user_id: '123',
        image_url: 'http://example.com/image.jpg',
        category: 'Textbooks',
        condition: 'Good',
        sale_type: 'Sale'
      };

      const { from } = require('../database');
      from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [newListing], error: null })
        })
      });

      const response = await request(app)
        .post('/listings')
        .send(newListing);
      
      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
    });

    it('should reject listing with missing required fields', async () => {
      const incompleteListing = {
        title: 'Test Item',
        description: 'Test description'
      };

      const response = await request(app)
        .post('/listings')
        .send(incompleteListing);
      
      expect(response.status).toBe(400);
    });
  });
});