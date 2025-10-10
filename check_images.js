const https = require('https');
const http = require('http');

const urls = [
  'https://images.unsplash.com/photo-1431274172761-fca41d930114?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
  'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
  'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=800',
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800',
  'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800',
  'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800',
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800',
  'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800',
  'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=800',
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
  'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
  'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
  'https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=800',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800',
  'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800'
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, { method: 'HEAD' }, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode === 200 });
    });
    
    req.on('error', () => resolve({ url, status: 'ERROR', ok: false }));
    req.setTimeout(5000, () => resolve({ url, status: 'TIMEOUT', ok: false }));
    req.end();
  });
}

async function checkAllUrls() {
  console.log('Checking image URLs...\n');
  
  const results = await Promise.all(urls.map(checkUrl));
  const broken = results.filter(r => !r.ok);
  const working = results.filter(r => r.ok);
  
  console.log(`✅ Working URLs: ${working.length}`);
  console.log(`❌ Broken URLs: ${broken.length}\n`);
  
  if (broken.length > 0) {
    console.log('Broken URLs:');
    broken.forEach(r => console.log(`  ${r.status}: ${r.url}`));
  }
  
  return broken;
}

checkAllUrls().catch(console.error);
