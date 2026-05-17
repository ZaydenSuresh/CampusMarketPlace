const supabase = require('../database');

class Payment {
    static async create({ transaction_id, amount_paid, payment_method, status = 'pending' }) {
        const record = { transaction_id, amount_paid, payment_method, status };

        if (status === 'paid') {
            record.paid_at = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('payments')
            .insert([record])
            .select('*');

        if (error) throw new Error(error.message);
        return data[0];
    }

    static async findByTransaction(transaction_id) {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('transaction_id', transaction_id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
    }

    static async updateStatus(id, status) {
        const updates = { status };

        if (status === 'paid') {
            updates.paid_at = new Date().toISOString();
        }

        // Update status (and paid_at if applicable) on the payments table, then return the updated row
        const { data, error } = await supabase
            .from('payments')
            .update(updates)
            .eq('id', id)
            .select('*');

        if (error) throw new Error(error.message);
        return data[0];
    }
}

module.exports = Payment;
