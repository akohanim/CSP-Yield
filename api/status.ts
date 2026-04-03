export default function handler(req: any, res: any) {
  res.json({ 
    status: "ok", 
    backend: "node/yahoo-finance",
    env: process.env.NODE_ENV 
  });
}
