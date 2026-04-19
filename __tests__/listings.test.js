// Import supertest to make HTTP requests to our Express app in tests
const request = require('supertest');

// Mock the storage object that handles image uploads to Supabase
// This simulates what Supabase's storage bucket does when uploading images
const mockStorage = {
  upload: jest.fn().mockResolvedValue({ error: null }),
  getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/image.jpg' } }),
};

// Create a mock Supabase client that mimics the real Supabase functionality
// We need to mock the database interactions since we don't have a real database in tests
const mockSupabaseClient = {
  // Mock authentication - returns a fake user so routes don't fail on auth checks
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
  },
  // Mock the database query builder - simulates Supabase's chainable query methods
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  // Mock Supabase storage for handling image uploads
  storage: {
    from: jest.fn().mockReturnValue(mockStorage),
  },
};

// Mock the supabase library - the routes call createSupabaseClient to get a client
// We intercept that call and return our mock client instead of the real one
jest.mock('../lib/supabase', () => ({
  createSupabaseClient: jest.fn(() => mockSupabaseClient),
}));

// Also mock the database module to prevent real database connections
jest.mock('../database', () => mockSupabaseClient);

// Set up Express app for testing
const express = require('express');
const app = express();
app.use(express.json());
app.use('/listings', require('../routes/listings'));

describe('Listings API', () => {
  // Test the GET /listings endpoint - retrieves the latest 6 listings
  describe('GET /listings', () => {
    it('should return 200 with listings array', async () => {
      // Arrange: Set up mock data that the database should return
      const mockListings = [
        { id: 1, title: 'Test Item', price: 100, category: 'Textbooks' }
      ];
      
      // Configure the mock to return our test data when the route queries the database
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockListings, error: null })
          })
        })
      });

      // Act: Make a GET request to /listings
      const response = await request(app).get('/listings');

      // Assert: Check that the response is successful and contains an array
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.listings)).toBe(true);
    });
  });

  // Test the POST /listings endpoint - creates a new listing
  describe('POST /listings', () => {
    // Test that a valid listing with all required fields is created successfully
    it('should create a new listing with valid data', async () => {
      // Arrange: Create a complete listing object with all required fields
      // Including image data (base64 format from user selecting an image on their device)
      const newListing = {
        title: 'Test Item',
        description: 'Test description',
        price: 100,
        category: 'Textbooks',
        condition: 'Good',
        sale_type: 'Sale',
        imageName: 'test.jpg',
        imageBase64: 'data:image/jpeg;base64,abc123'
      };

      // The listing as it would exist after being saved to the database
      const createdListing = { ...newListing, id: 1, user_id: 'test-user-id' };
      
      // Configure mock to return our created listing when the insert query runs
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: [createdListing], error: null })
        })
      });

      // Act: Send POST request to create the listing
      const response = await request(app)
        .post('/listings')
        .send(newListing);
      
      // Assert: Verify the listing was created (201 status) and operation succeeded
      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
    });

    // Test that missing required fields results in a 400 Bad Request
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

  // GET /listings/search - searches listings by query and category
  describe('GET /listings/search', () => {
    it('should return listings matching search query', async () => {
      const mockListings = [
        { id: 1, title: 'Calculus Book', description: 'Used textbook', price: 50 }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            or: jest.fn().mockResolvedValue({ data: mockListings, error: null })
          })
        })
      });

      const response = await request(app).get('/listings/search?q=calculus');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.listings)).toBe(true);
    });

    it('should return listings filtered by category', async () => {
      const mockListings = [
        { id: 1, title: 'Laptop', category: 'Electronics', price: 300 }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockListings, error: null })
          })
        })
      });

      const response = await request(app).get('/listings/search?category=Electronics');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should return listings matching query and category', async () => {
      const mockListings = [
        { id: 1, title: 'iPhone', description: 'Used phone', category: 'Electronics', price: 200 }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              or: jest.fn().mockResolvedValue({ data: mockListings, error: null })
            })
          })
        })
      });

      const response = await request(app).get('/listings/search?q=phone&category=Electronics');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should return all listings when category is "All"', async () => {
      const mockListings = [
        { id: 1, title: 'Item 1' }, { id: 2, title: 'Item 2' }
      ];
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: mockListings, error: null })
        })
      });

      const response = await request(app).get('/listings/search?category=All');
      expect(response.status).toBe(200);
      expect(response.body.listings.length).toBe(2);
    });
  });
});