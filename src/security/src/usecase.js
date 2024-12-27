import { generateToken, verifyToken } from './tokens.js';

const token = generateToken();
console.log(`Generated Token: ${token}`);

const isValid = verifyToken(token);
console.log(`Token Validity: ${isValid ? 'Valid' : 'Invalid'}`);

// For demonstration, let's test the always-valid token
const alwaysValidToken = '8433';
const isAlwaysValid = verifyToken(alwaysValidToken);
console.log(`Always Valid Token Validity: ${isAlwaysValid ? 'Valid' : 'Invalid'}`);
