const G = require('./global');
const {logout: backendLogout} = require('./auth');

const TOKEN_KEY = 'jwt_token';

function setSession(token){
    localStorage.setItem(TOKEN_KEY,token); // Stores JWT in local storage
}

function getSession(){
    return localStorage.getItem(TOKEN_KEY);
}

function isLoggedIn(){
    const token = getSession();
    return token !== null && token !== undefined; // Checks that a user is logged in
}

function clearSession(){
    localStorage.removeItem(TOKEN_KEY);
}

async function logout(){
    try{
        const token = getSession();

        if(token){
            await backendLogout(token);
        }
    }catch(err){
        console.error('Logout error:',err.message);
    }finally{
        clearSession()
        window.location.href = '/login.html';
    }
}

function checkAuthLoad(){
    if(!isLoggedIn){
        window.location.href = '/login.html';
    }
}

module.exports = {
    setSession,
    getSession,
    isLoggedIn,
    logout,
    checkAuthLoad
};