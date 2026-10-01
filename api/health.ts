import { setCORS } from './_sheetsHelper';

export default function handler(req: any, res: any) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  return res.status(200).json({
    status: 'ok',
    server: 'vercel-serverless-native',
    timestamp: new Date().toISOString()
  });
}
