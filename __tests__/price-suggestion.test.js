const {
  seedPriceSuggestions,
  getSuggestionForCategory,
} = require("../services/price-suggestion");

describe("Price Suggestion Service", () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn(),
    };
  });

  describe("getSuggestionForCategory", () => {
    test("should return adjusted suggestion for valid category and condition", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            category: "Electronics",
            base_price: 2500,
            source: "Stats SA CPI Electronics",
          },
          error: null,
        }),
      });

      const result = await getSuggestionForCategory(
        mockSupabase,
        "Electronics",
        "Good"
      );

      expect(result).toEqual({
        category: "Electronics",
        base_price: 2500,
        condition: "Good",
        multiplier: 0.85,
        adjusted_price: 2125,
        source: "Stats SA CPI Electronics",
      });
    });

    test("should return correct New multiplier", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            category: "Textbooks",
            base_price: 450,
            source: "Stats SA CPI Education",
          },
          error: null,
        }),
      });

      const result = await getSuggestionForCategory(
        mockSupabase,
        "Textbooks",
        "New"
      );

      expect(result.multiplier).toBe(1);
      expect(result.adjusted_price).toBe(450);
    });

    test("should return correct Damaged multiplier", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            category: "Furniture",
            base_price: 800,
            source: "Stats SA CPI Furniture",
          },
          error: null,
        }),
      });

      const result = await getSuggestionForCategory(
        mockSupabase,
        "Furniture",
        "Damaged"
      );

      expect(result.multiplier).toBe(0.3);
      expect(result.adjusted_price).toBe(240);
    });

    test("should return null for unknown category", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message: "Not found",
          },
        }),
      });

      const result = await getSuggestionForCategory(
        mockSupabase,
        "UnknownCategory",
        "Good"
      );

      expect(result).toBeNull();
    });

    test("should default invalid condition to Good multiplier", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            category: "Clothing",
            base_price: 350,
            source: "Stats SA CPI Clothing",
          },
          error: null,
        }),
      });

      const result = await getSuggestionForCategory(
        mockSupabase,
        "Clothing",
        "INVALID"
      );

      expect(result.multiplier).toBe(0.85);
      expect(result.adjusted_price).toBe(297.5);
    });
  });
});