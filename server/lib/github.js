import axios from 'axios';
import axiosRetry from 'axios-retry';
import db from './db.js';
import semver from 'semver';

const github = axios.create({
  timeout: 30000,
});

axiosRetry(github, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
});

const GH_ACCOUNT = process.env.GH_ACCOUNT || 'CoinSpace/CoinSpace';
const { GH_TOKEN } = process.env;

const TYPE_FILE = 'file';
const TYPE_LINK = 'link';

const platforms = [{
  // Web wallet
  distribution: 'web',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /coin\.space\/wallet/ig,
  link: 'https://coin.space/wallet/',
}, {
  // Tor wallet
  distribution: 'tor',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /coinspacezp5mmyuicbz2hoafbnduj4vzkttq3grn5mnwdue5t343zid\.onion/ig,
  link: 'https://coinspacezp5mmyuicbz2hoafbnduj4vzkttq3grn5mnwdue5t343zid.onion/',
}, {
  // Windows application, update from app
  distribution: 'win',
  arch: 'x64',
  app: 'app',
  type: TYPE_FILE,
  pattern: /Setup\.exe$/i,
}, {
  // Windows application, electron auto update
  // Special case, we cache file content
  distribution: 'win',
  arch: 'x64',
  app: 'electron',
  type: TYPE_FILE,
  pattern: /^RELEASES$/i,
}, {
  // macOS application, electron auto update
  distribution: 'mac',
  arch: 'x64',
  app: 'electron',
  type: TYPE_FILE,
  pattern: /-darwin-x64-.*\.zip$/i,
}, {
  // macOS application, update from app
  distribution: 'mac',
  arch: 'x64',
  app: 'app',
  type: TYPE_FILE,
  pattern: /\.dmg$/i,
}, {
  // macOS application, update from app (wrong arch)
  distribution: 'mac',
  arch: 'any',
  app: 'app',
  type: TYPE_FILE,
  pattern: /\.dmg$/i,
}, {
  // Mac App Store application
  distribution: 'mas',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /id980719434\?platform=mac/ig,
  link: 'https://apps.apple.com/app/coin-wallet-bitcoin-crypto/id980719434',
}, {
  // Windows / Microsoft Store application
  distribution: 'appx',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /9NBLGGH5PXJQ/ig,
  link: 'https://apps.microsoft.com/store/detail/9NBLGGH5PXJQ',
}, {
  // Common for iPhone, iPad, and Apple Watch
  distribution: 'ios',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /id980719434\?platform=(iphone|ipad|appleWatch)/ig,
  link: 'https://apps.apple.com/app/coin-wallet-bitcoin-crypto/id980719434',
}, {
  // Android Play app (deprecated)
  distribution: 'android',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /details\/?\?id=com\.coinspace\.app/ig,
  link: 'https://play.google.com/store/apps/details?id=com.coinspace.app',
}, {
  // Android Play app
  distribution: 'android-play',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /details\/?\?id=com\.coinspace\.app/ig,
  link: 'https://play.google.com/store/apps/details?id=com.coinspace.app',
}, {
  // Android Galaxy app
  distribution: 'android-galaxy',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /galaxy\.store\/coinapp/ig,
  link: 'https://galaxy.store/coinapp',
}, {
  // Android AppGallery app
  distribution: 'android-huawei',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /appgallery\.huawei\.com\/app\/C112183767/ig,
  link: 'https://appgallery.huawei.com/app/C112183767',
}, {
  // Android Uptodown app
  distribution: 'android-uptodown',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /coin-wallet\.en\.uptodown\.com\/android/ig,
  link: 'https://coin-wallet.en.uptodown.com/android',
}, {
  // Android APK app
  distribution: 'android-apk',
  arch: 'any',
  app: 'app',
  type: TYPE_FILE,
  pattern: /\.apk$/i,
}, {
  // Linux snap
  distribution: 'snap',
  arch: 'any',
  app: 'app',
  type: TYPE_LINK,
  pattern: /snapcraft\.io\/coin/ig,
  link: 'https://snapcraft.io/coin',
}, {
  distribution: 'flatpak',
  arch: 'any',
  app: 'app',
  type: TYPE_FILE,
  pattern: /\.flatpak$/i,
}].map(item => {
  return {
    ...item,
    key: `${item.distribution}-${item.arch}-${item.app}`,
  };
});

async function sync() {
  console.time('github sync');
  const updates = await getLatest();
  if (!updates.length) {
    return;
  }
  await db.collection('releases')
    .bulkWrite(updates.map((update) => {
      return {
        updateOne: {
          filter: {
            distribution: update.distribution,
            arch: update.arch,
            app: update.app,
          },
          update: {
            $set: update,
          },
          upsert: true,
        },
      };
    }), { ordered: false });
  console.timeEnd('github sync');
}

async function getUpdates() {
  return db.collection('releases').find({}).toArray();
}

async function getUpdate(distribution, arch, app) {
  return db.collection('releases').findOne({
    distribution,
    arch,
    app,
  });
}

async function getLatest() {
  const latest = {};
  const url = `https://api.github.com/repos/${GH_ACCOUNT}/releases?per_page=100`;
  const headers = { Accept: 'application/vnd.github.preview' };
  if (GH_TOKEN) {
    headers.Authorization = `token ${GH_TOKEN}`;
  }

  const res = await github.get(url, { headers });

  if (res.status !== 200) {
    throw new Error(`GitHub API responded with ${res.status} for url ${url}`);
  }

  // releases ordered by date
  for (const release of res.data) {
    if (!semver.valid(release.tag_name) || release.draft || release.prerelease) {
      //console.log('Invalid GitHub release:', release);
      continue;
    }

    for (const platform of platforms) {
      if (latest[platform.key]) {
        //console.log(`Platform alredy found: ${platform.key}`);
        continue;
      }

      if (platform.type === TYPE_FILE) {
        for (const asset of release.assets) {
          if (asset.name.search(platform.pattern) !== -1) {
            latest[platform.key] = {
              distribution: platform.distribution,
              arch: platform.arch,
              app: platform.app,
              name: release.name,
              version: release.tag_name,
              url: asset.browser_download_url,
            };

            if (asset.name === 'RELEASES') {
              latest[platform.key].content = await getReleasesContent(release.tag_name);
            }

            // break for asset loop
            break;
          }
        }
      } else if (platform.type === TYPE_LINK) {
        if (release.body.replace(/<!--.+-->/ig, '').search(platform.pattern) !== -1) {
          latest[platform.key] = {
            distribution: platform.distribution,
            arch: platform.arch,
            app: platform.app,
            name: release.name,
            version: release.tag_name,
            url: platform.link,
          };
        }
      }
    }

    // exit loop early if all platforms matched
    if (platforms.every(item => !!latest[item.key])) {
      break;
    }
  }

  return Object.values(latest);
}

async function getReleasesContent(version) {
  const downloadBase = `https://github.com/${GH_ACCOUNT}/releases/download/${version}/`;
  const releasesUrl = `${downloadBase}RELEASES`;

  const res = await github.get(releasesUrl);

  if (res.status !== 200) {
    throw new Error(`GitHub responded with ${res.status} for url ${releasesUrl}`);
  }

  return res.data.replace(/[^ ]*\.nupkg/gim, (match) => {
    return `${downloadBase}${match}`;
  });
}

export default {
  account: GH_ACCOUNT,
  sync,
  getUpdate,
  getUpdates,
};
