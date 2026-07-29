const fs = require('fs');
const content = fs.readFileSync('src/firebase/config.ts', 'utf8');
const match = content.match(/apiKey:\s*['"]([^'"]+)['"]/);
if (match) {
  const apiKey = match[1];
  fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test123456@gmail.com', password: 'password123', returnSecureToken: true })
  }).then(r => r.json()).then(data => {
    console.log('RESPONSE:', JSON.stringify(data, null, 2));
  }).catch(e => console.error(e));
} else {
  console.log('API KEY NOT FOUND');
}
