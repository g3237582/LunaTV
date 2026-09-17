#!/usr/bin/env node

/* eslint-disable no-console,@typescript-eslint/no-var-requires */
const http = require('http');
const path = require('path');
const { parseIsolatedSites } = require('./src/lib/site-runtime.js');

// 调用 generate-manifest.js 生成 manifest.json
function generateManifest() {
  console.log('Generating manifest.json for Docker deployment...');

  try {
    const generateManifestScript = path.join(
      __dirname,
      'scripts',
      'generate-manifest.js'
    );
    require(generateManifestScript);
  } catch (error) {
    console.error('❌ Error calling generate-manifest.js:', error);
    throw error;
  }
}

generateManifest();

// 直接在当前进程中启动 standalone Server（`server.js`）
require('./server.js');

const hostname = process.env.HOSTNAME || 'localhost';
const sites = parseIsolatedSites();
const readySites = new Set();

function siteOrigin(site) {
  if (site.siteBase) {
    return site.siteBase.replace(/\/$/, '');
  }
  const host = hostname === '0.0.0.0' ? 'localhost' : hostname;
  return `http://${host}:${site.port}`;
}

sites.forEach((site) => {
  const targetUrl = `${siteOrigin(site)}/login`;
  const intervalId = setInterval(() => {
    console.log(`Fetching ${targetUrl} ...`);

    const req = http.get(targetUrl, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`Server is up on ${site.id}, stop polling.`);
        clearInterval(intervalId);
        readySites.add(site.id);
        if (readySites.size === sites.length) {
          setTimeout(() => {
            executeCronJobs();
          }, 3000);
          setInterval(() => {
            executeCronJobs();
          }, 60 * 60 * 1000);
        }
      }
    });

    req.setTimeout(2000, () => {
      req.destroy();
    });
  }, 1000);
});

function executeCronJobs() {
  const cronPassword = process.env.CRON_PASSWORD || 'mtvpls';
  sites.forEach((site) => {
    const cronUrl = `${siteOrigin(site)}/api/cron/${cronPassword}`;
    console.log(`Executing cron job [${site.id}]: ${cronUrl}`);

    const req = http.get(cronUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`Cron job executed successfully [${site.id}]:`, data);
        } else {
          console.error(`Cron job failed [${site.id}]:`, res.statusCode, data);
        }
      });
    });

    req.on('error', (err) => {
      console.error(`Error executing cron job [${site.id}]:`, err);
    });

    req.setTimeout(30000, () => {
      console.error(`Cron job timeout [${site.id}]`);
      req.destroy();
    });
  });
}
