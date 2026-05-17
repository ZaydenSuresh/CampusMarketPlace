const supabase = require('../database');

class Shortfall {
    static async create({ transaction_id, amount_owed }) {
        const { data, error } = await supabase
            .from('shortfalls')
            .insert([{ transaction_id, amount_owed, status: 'outstanding' }])
            .select('*');

        if (error) throw new Error(error.message);
        return data[0];
    }

    static async findByTransaction(transaction_id) {
        const { data, error } = await supabase
            .from('shortfalls')
            .select('*')
            .eq('transaction_id', transaction_id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
    }

    static async settle(id) {
        const { data, error } = await supabase
            .from('shortfalls')
            .update({ status: 'settled', settled_at: new Date().toISOString() })
            .eq('id', id)
            .select('*');

        if (error) throw new Error(error.message);
        return data[0];
    }
}

module.exports = Shortfall;
