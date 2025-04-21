'use server'

export async function GET() {
  const response = await fetch('https://portfolio-roan-phi-14.vercel.app/', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
  })

  const contentType = response.headers.get('content-type')
  const body = await response.text()

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': contentType || 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
      'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    },
  })
} 