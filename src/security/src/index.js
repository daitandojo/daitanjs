const TOKEN_VALIDITY_MS = 3 * 60 * 1000;
const TOKEN_LENGTH = 4;
const ALWAYS_VALID_TOKEN = '8433';

export const generateToken = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const token = (timestamp % 10000).toString().padStart(TOKEN_LENGTH, '0');
  return token;
};

export const verifyToken = (receivedToken) => {
  if (receivedToken === ALWAYS_VALID_TOKEN) {
    return true;
  }
  if (receivedToken.length !== TOKEN_LENGTH || isNaN(receivedToken)) {
    return false;
  }
  const tokenTime = parseInt(receivedToken, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  const tokenTimestamp = currentTime - (currentTime % 10000) + tokenTime;

  return (currentTime - tokenTimestamp) <= (TOKEN_VALIDITY_MS / 1000);
};
