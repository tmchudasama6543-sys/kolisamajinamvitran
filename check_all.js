const fs = require('fs');

const content = fs.readFileSync('src/firebase/config.ts', 'utf8');
const match = content.match(/apiKey:\s*['"]([^'"]+)['"]/);
const apiKey = match ? match[1] : null;

async function checkAll() {
  const email = "tmchudasama123@gmail.com";
  const password = "Tushar6543@#";

  const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });

  const loginData = await loginRes.json();
  const idToken = loginData.idToken;
  const uid = loginData.localId;
  const projectId = "studio-3355214124-2b100";

  console.log("UID:", uid);

  // Read users/{uid}
  const userRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const userData = await userRes.json();
  console.log("users collection doc:", JSON.stringify(userData, null, 2));

  // Read roles_admin/{uid}
  const adminRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/roles_admin/${uid}`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const adminData = await adminRes.json();
  console.log("roles_admin collection doc:", JSON.stringify(adminData, null, 2));
}

checkAll();
