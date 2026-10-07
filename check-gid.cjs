const { JWT } = require('google-auth-library');
const fs = require('fs');

async function run() {
  const credentials = JSON.parse(fs.readFileSync('service-account.json'));
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const token = await client.getAccessToken();
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/1obGQuhQx0FcxdoHNYUMzGqOzLFalhA63W8ze1tygHkk', {
    headers: { Authorization: `Bearer ${token.token}` }
  });
  const data = await res.json();
  data.sheets.forEach(s => console.log(s.properties.title, s.properties.sheetId));
}
run();
