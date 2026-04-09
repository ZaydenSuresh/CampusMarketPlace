const supabase = require('../database');
const User = require('../models/user');

async function signup(newUser) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: newUser.email,
            password: newUser.password
        });

        if (authError || !authData?.user) {
            console.error('Signup error:', authError?.message);
            return null;
        }

        const { error: profileError } = await supabase
            .from('User_test')
            .insert({
                id: authData.user.id,
                name: newUser.name,
                email: newUser.email,
                role : newUser.role
            });

        if (profileError) {
            console.error('Profile creation error:', profileError.message);
            return null;
        }

        console.log('Signup successful:', authData.user);
        return authData.user;

    } catch (err) {
        console.error('Unexpected signup error:', err);
        return null;
    }
}

async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Login error:', error.message);
            return null;
        }

        console.log('Login successful:', data.user);
        return data.user;

    } catch (err) {
        console.error('Unexpected error during login:', err);
        return null;
    }
}

async function logout() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Logout error:', error.message);
        } else {
            console.log('Logout successful');
        }
    } catch (err) {
        console.error('Unexpected logout error', err);
    }
}

module.exports = { signup, login, logout };





