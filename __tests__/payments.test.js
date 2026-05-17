const request = require('supertest');
const express = require('express');

jest.mock('../lib/supabase', () => ({
    createSupabaseClient: jest.fn(),
}));

jest.mock('../models/payment', () => ({
    create: jest.fn(),
    findByTransaction: jest.fn(),
}));

jest.mock('../models/shortfall', () => ({
    create: jest.fn(),
    findByTransaction: jest.fn(),
    settle: jest.fn(),
}));

const { createSupabaseClient } = require('../lib/supabase');
const Payment = require('../models/payment');
const Shortfall = require('../models/shortfall');
const paymentsRouter = require('../routes/payments');

const app = express();
app.use(express.json());
app.use('/payments', paymentsRouter);

function singleChain(result) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(result),
    };
}

function updateChain(result) {
    return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue(result),
    };
}

describe('Payments routes', () => {
    let mockSupabaseClient;

    function mockAuth(userId = 'user-1') {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });
    }

    function mockNoAuth() {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });
    }

    beforeEach(() => {
        jest.clearAllMocks();

        mockSupabaseClient = {
            auth: { getUser: jest.fn() },
            from: jest.fn(),
        };

        createSupabaseClient.mockReturnValue(mockSupabaseClient);
        global.fetch = jest.fn();
    });

    // ============ POST /pay ============
    describe('POST /pay', () => {
        const validBody = {
            transaction_id: 'tx-1',
            amount_paid: 50,
        };

        test('returns 401 when not authenticated', async () => {
            mockNoAuth();

            const res = await request(app)
                .post('/payments/pay')
                .send(validBody);
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, message: 'Not authenticated' });
        });

        test('returns 400 when transaction_id is missing', async () => {
            mockAuth();

            const res = await request(app)
                .post('/payments/pay')
                .send({ amount_paid: 50 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when amount_paid is missing', async () => {
            mockAuth();

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1' });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 404 when transaction not found', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: null, error: { message: 'not found' } })
            );

            const res = await request(app)
                .post('/payments/pay')
                .send(validBody);
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ ok: false, message: 'Transaction not found' });
        });

        test('returns 403 when user is not the buyer', async () => {
            mockAuth('user-2');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/pay')
                .send(validBody);
            expect(res.status).toBe(403);
            expect(res.body).toEqual({ ok: false, message: 'You are not the buyer for this transaction' });
        });

        test('returns 400 when transaction status is not in_progress', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'completed', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/pay')
                .send(validBody);
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ ok: false, message: 'Can only pay while transaction is in progress' });
        });

        test('returns 400 when amount_paid is 0 (invalid boundary)', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1', amount_paid: 0 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when amount_paid is negative (invalid boundary)', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1', amount_paid: -1 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when amount_paid exceeds listing price (invalid boundary)', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1', amount_paid: 100.01 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('processes cash payment at valid boundary minimum (0.01)', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(updateChain({ error: null }));

            Payment.create.mockResolvedValue({
                id: 'pay-1',
                transaction_id: 'tx-1',
                amount_paid: 0.01,
                payment_method: 'cash',
                status: 'paid',
                paid_at: new Date().toISOString(),
            });

            Shortfall.create.mockResolvedValue({
                id: 'short-1',
                transaction_id: 'tx-1',
                amount_owed: 99.99,
                status: 'outstanding',
            });

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1', amount_paid: 0.01 });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.payment.amount_paid).toBe(0.01);
            expect(res.body.shortfall).not.toBeNull();
        });

        test('processes cash payment at price boundary (full amount)', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(updateChain({ error: null }));

            Payment.create.mockResolvedValue({
                id: 'pay-1',
                transaction_id: 'tx-1',
                amount_paid: 100,
                payment_method: 'cash',
                status: 'paid',
                paid_at: new Date().toISOString(),
            });

            Shortfall.create.mockResolvedValue(null);

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1', amount_paid: 100 });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.shortfall).toBeNull();
        });

        test('creates shortfall when partially paid with cash', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 150 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(updateChain({ error: null }));

            Payment.create.mockResolvedValue({
                id: 'pay-1',
                transaction_id: 'tx-1',
                amount_paid: 50,
                payment_method: 'cash',
                status: 'paid',
            });

            Shortfall.create.mockResolvedValue({
                id: 'short-1',
                transaction_id: 'tx-1',
                amount_owed: 100,
                status: 'outstanding',
            });

            const res = await request(app)
                .post('/payments/pay')
                .send({ transaction_id: 'tx-1', amount_paid: 50 });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(Shortfall.create).toHaveBeenCalledWith(
                expect.objectContaining({ amount_owed: 100 })
            );
            expect(res.body.shortfall.amount_owed).toBe(100);
        });

        test('returns 500 on thrown error', async () => {
            mockAuth();
            mockSupabaseClient.from.mockImplementationOnce(() => {
                throw new Error('Kaboom');
            });

            const res = await request(app)
                .post('/payments/pay')
                .send(validBody);
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ ok: false, message: 'Kaboom' });
        });
    });

    // ============ GET /:transactionId ============
    describe('GET /:transactionId', () => {
        test('returns 401 when not authenticated', async () => {
            mockNoAuth();

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, message: 'Not authenticated' });
        });

        test('returns 404 when transaction not found', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: null, error: { message: 'not found' } })
            );

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ ok: false, message: 'Transaction not found' });
        });

        test('returns 403 when user is neither buyer nor seller', async () => {
            mockAuth('user-3');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { buyer_id: 'user-1', seller_id: 'user-2' },
                    error: null,
                })
            );

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(403);
            expect(res.body).toEqual({ ok: false, message: 'Not authorized to view this payment' });
        });

        test('returns payment data for the buyer', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { buyer_id: 'user-1', seller_id: 'user-2' },
                    error: null,
                })
            );

            Payment.findByTransaction.mockResolvedValue([
                { id: 'pay-1', amount_paid: 50, status: 'paid' },
            ]);

            Shortfall.findByTransaction.mockResolvedValue([
                { id: 'short-1', amount_owed: 50, status: 'outstanding' },
            ]);

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.total_paid).toBe(50);
            expect(res.body.total_shortfall).toBe(50);
            expect(res.body.fully_paid).toBe(false);
        });

        test('returns payment data for the seller', async () => {
            mockAuth('user-2');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { buyer_id: 'user-1', seller_id: 'user-2' },
                    error: null,
                })
            );

            Payment.findByTransaction.mockResolvedValue([
                { id: 'pay-1', amount_paid: 100, status: 'paid' },
            ]);

            Shortfall.findByTransaction.mockResolvedValue([]);

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(200);
            expect(res.body.total_paid).toBe(100);
            expect(res.body.total_shortfall).toBe(0);
            expect(res.body.fully_paid).toBe(true);
        });

        test('returns zeros and fully_paid false when no payments exist', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { buyer_id: 'user-1', seller_id: 'user-2' },
                    error: null,
                })
            );

            Payment.findByTransaction.mockResolvedValue([]);
            Shortfall.findByTransaction.mockResolvedValue([]);

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(200);
            expect(res.body.total_paid).toBe(0);
            expect(res.body.total_shortfall).toBe(0);
            expect(res.body.fully_paid).toBe(false);
        });

        test('returns 500 on thrown error', async () => {
            mockAuth();
            mockSupabaseClient.from.mockImplementationOnce(() => {
                throw new Error('Kaboom');
            });

            const res = await request(app).get('/payments/tx-1');
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ ok: false, message: 'Kaboom' });
        });
    });

    // ============ PUT /:transactionId/settle-shortfall ============
    describe('PUT /:transactionId/settle-shortfall', () => {
        test('returns 401 when not authenticated', async () => {
            mockNoAuth();

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, message: 'Not authenticated' });
        });

        test('returns 403 when user is not Staff or Admin', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: { role: 'Student' }, error: null })
            );

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(403);
            expect(res.body).toEqual({ ok: false, message: 'Only staff can settle shortfalls' });
        });

        test('returns 403 when profile not found', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: null, error: { message: 'not found' } })
            );

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(403);
            expect(res.body).toEqual({ ok: false, message: 'Only staff can settle shortfalls' });
        });

        test('returns 404 when no outstanding shortfall found', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: { role: 'Staff' }, error: null })
            );

            Shortfall.findByTransaction.mockResolvedValue([
                { id: 's-1', status: 'settled' },
            ]);

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ ok: false, message: 'No outstanding shortfall found' });
        });

        test('settles shortfall and marks transaction paid when none remain', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({ data: { role: 'Staff' }, error: null })
                )
                .mockReturnValueOnce(updateChain({ error: null }));

            Shortfall.findByTransaction
                .mockResolvedValueOnce([
                    { id: 's-1', transaction_id: 'tx-1', amount_owed: 50, status: 'outstanding' },
                ])
                .mockResolvedValueOnce([
                    { id: 's-1', transaction_id: 'tx-1', amount_owed: 50, status: 'settled' },
                ]);

            Shortfall.settle.mockResolvedValue({
                id: 's-1',
                transaction_id: 'tx-1',
                amount_owed: 50,
                status: 'settled',
                settled_at: new Date().toISOString(),
            });

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.shortfall.status).toBe('settled');
            expect(Shortfall.settle).toHaveBeenCalledWith('s-1');
        });

        test('settles shortfall but does not mark paid when other shortfalls remain', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({ data: { role: 'Admin' }, error: null })
                );

            Shortfall.findByTransaction
                .mockResolvedValueOnce([
                    { id: 's-1', amount_owed: 50, status: 'outstanding' },
                    { id: 's-2', amount_owed: 30, status: 'outstanding' },
                ])
                .mockResolvedValueOnce([
                    { id: 's-1', amount_owed: 50, status: 'settled' },
                    { id: 's-2', amount_owed: 30, status: 'outstanding' },
                ]);

            Shortfall.settle.mockResolvedValue({
                id: 's-1',
                amount_owed: 50,
                status: 'settled',
                settled_at: new Date().toISOString(),
            });

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        test('returns 500 on thrown error', async () => {
            mockAuth('user-1');
            mockSupabaseClient.from.mockImplementationOnce(() => {
                throw new Error('Kaboom');
            });

            const res = await request(app).put('/payments/tx-1/settle-shortfall');
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ ok: false, message: 'Kaboom' });
        });
    });

    // ============ POST /initialize ============
    describe('POST /initialize', () => {
        const validBody = {
            transaction_id: 'tx-1',
            amount_paid: 50,
        };

        test('returns 401 when not authenticated', async () => {
            mockNoAuth();

            const res = await request(app)
                .post('/payments/initialize')
                .send(validBody);
            expect(res.status).toBe(401);
            expect(res.body).toEqual({ ok: false, message: 'Not authenticated' });
        });

        test('returns 400 when transaction_id is missing', async () => {
            mockAuth();

            const res = await request(app)
                .post('/payments/initialize')
                .send({ amount_paid: 50 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when amount_paid is missing', async () => {
            mockAuth();

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1' });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 404 when transaction not found', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: null, error: { message: 'not found' } })
            );

            const res = await request(app)
                .post('/payments/initialize')
                .send(validBody);
            expect(res.status).toBe(404);
            expect(res.body).toEqual({ ok: false, message: 'Transaction not found' });
        });

        test('returns 403 when user is not the buyer', async () => {
            mockAuth('user-2');
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/initialize')
                .send(validBody);
            expect(res.status).toBe(403);
            expect(res.body).toEqual({ ok: false, message: 'You are not the buyer for this transaction' });
        });

        test('returns 400 when transaction status is not in_progress', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'completed', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/initialize')
                .send(validBody);
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ ok: false, message: 'Can only pay while transaction is in progress' });
        });

        test('returns 400 when amount_paid is 0', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 0 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when amount_paid is negative', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: -1 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when amount_paid exceeds listing price', async () => {
            mockAuth();
            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({
                    data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                    error: null,
                })
            );

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 100.01 });
            expect(res.status).toBe(400);
            expect(res.body.ok).toBe(false);
        });

        test('returns 400 when Paystack initialization fails', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(
                    singleChain({ data: { email: 'buyer@test.com' }, error: null })
                );

            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({ status: false, message: 'Invalid amount' }),
            });

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 50 });
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ ok: false, message: 'Invalid amount' });
        });

        test('returns 400 with default message when Paystack returns no message', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(
                    singleChain({ data: { email: 'buyer@test.com' }, error: null })
                );

            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({ status: false }),
            });

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 50 });
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ ok: false, message: 'Paystack initialization failed' });
        });

        test('successfully initializes Paystack payment', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(
                    singleChain({ data: { email: 'buyer@test.com' }, error: null })
                );

            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        authorization_url: 'https://paystack.com/checkout/sess_123',
                        reference: 'CAMPUS-tx-1-1234567890',
                    },
                }),
            });

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 50 });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
            expect(res.body.authorization_url).toBe('https://paystack.com/checkout/sess_123');
            expect(res.body.reference).toContain('CAMPUS-tx-1');
        });

        test('falls back to user.email when profile email is missing', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(
                    singleChain({ data: null, error: { message: 'not found' } })
                );

            mockSupabaseClient.auth.getUser.mockResolvedValue({
                data: { user: { id: 'user-1', email: 'fallback@test.com' } },
                error: null,
            });

            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        authorization_url: 'https://paystack.com/checkout/sess_456',
                        reference: 'CAMPUS-tx-1-999',
                    },
                }),
            });

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 50 });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        test('falls back to default email when both profile and user email are missing', async () => {
            mockAuth();
            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', buyer_id: 'user-1', status: 'in_progress', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(
                    singleChain({ data: null, error: { message: 'not found' } })
                );

            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        authorization_url: 'https://paystack.com/checkout/sess_789',
                        reference: 'CAMPUS-tx-1-111',
                    },
                }),
            });

            const res = await request(app)
                .post('/payments/initialize')
                .send({ transaction_id: 'tx-1', amount_paid: 50 });
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        test('returns 500 on thrown error', async () => {
            mockAuth();
            mockSupabaseClient.from.mockImplementationOnce(() => {
                throw new Error('Kaboom');
            });

            const res = await request(app)
                .post('/payments/initialize')
                .send(validBody);
            expect(res.status).toBe(500);
            expect(res.body).toEqual({ ok: false, message: 'Kaboom' });
        });
    });

    // ============ GET /callback ============
    describe('GET /callback', () => {
        test('redirects with error when reference is missing', async () => {
            const res = await request(app).get('/payments/callback');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('payment_error=No+reference+returned');
        });

        test('redirects with error when Paystack verification fails', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({ status: false }),
            });

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('error=Payment+verification+failed');
        });

        test('redirects with error when Paystack status is not success', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: { status: 'failed' },
                }),
            });

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('error=Payment+verification+failed');
        });

        test('redirects with error and empty transactionId when reference has no dash', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: { status: 'failed' },
                }),
            });

            const res = await request(app).get('/payments/callback?reference=plainref');
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/payment.html?transactionId=&error=Payment+verification+failed');
        });

        test('redirects with error when metadata has no transaction_id', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        status: 'success',
                        metadata: { amount_paid: 50 },
                    },
                }),
            });

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('payment_error=Invalid+payment+data');
        });

        test('redirects with error when amount_paid is zero in metadata', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        status: 'success',
                        metadata: { transaction_id: 'tx-1', amount_paid: 0 },
                    },
                }),
            });

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('payment_error=Invalid+payment+data');
        });

        test('redirects with error when transaction is not found in database', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        status: 'success',
                        metadata: { transaction_id: 'tx-99', amount_paid: 50 },
                    },
                }),
            });

            mockSupabaseClient.from.mockReturnValueOnce(
                singleChain({ data: null, error: { message: 'not found' } })
            );

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-99-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('payment_error=Transaction+not+found');
        });

        test('redirects to success for full Paystack payment', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        status: 'success',
                        metadata: { transaction_id: 'tx-1', amount_paid: 100 },
                    },
                }),
            });

            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(updateChain({ error: null }));

            Payment.create.mockResolvedValue({
                id: 'pay-1',
                transaction_id: 'tx-1',
                amount_paid: 100,
                payment_method: 'paystack',
                status: 'paid',
            });

            Shortfall.create.mockResolvedValue(null);

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/student-transactions.html?payment=success');
            expect(Payment.create).toHaveBeenCalledWith(
                expect.objectContaining({ amount_paid: 100, payment_method: 'paystack' })
            );
        });

        test('redirects to success and creates shortfall for partial Paystack payment', async () => {
            global.fetch.mockResolvedValue({
                json: jest.fn().mockResolvedValue({
                    status: true,
                    data: {
                        status: 'success',
                        metadata: { transaction_id: 'tx-1', amount_paid: 30 },
                    },
                }),
            });

            mockSupabaseClient.from
                .mockReturnValueOnce(
                    singleChain({
                        data: { id: 'tx-1', listings: { price: 100 } },
                        error: null,
                    })
                )
                .mockReturnValueOnce(updateChain({ error: null }));

            Payment.create.mockResolvedValue({
                id: 'pay-1',
                transaction_id: 'tx-1',
                amount_paid: 30,
                payment_method: 'paystack',
                status: 'paid',
            });

            Shortfall.create.mockResolvedValue({
                id: 'short-1',
                transaction_id: 'tx-1',
                amount_owed: 70,
                status: 'outstanding',
            });

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-456');
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('/student-transactions.html?payment=success');
            expect(Shortfall.create).toHaveBeenCalledWith(
                expect.objectContaining({ amount_owed: 70 })
            );
        });

        test('redirects with error on thrown exception', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const res = await request(app).get('/payments/callback?reference=CAMPUS-tx-1-123');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('payment_error=Network%20error');
        });
    });
});
