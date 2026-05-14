export default async function handler(req: any, res: any) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'Missing env vars' })
  }

  try {
    // A simple query is enough to keep Supabase from auto-pausing
    const response = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    })

    if (!response.ok) {
      return res.status(500).json({ ok: false, status: response.status })
    }

    res.status(200).json({ ok: true, ts: new Date().toISOString() })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
