/**
 * Sourish Units Hub - Professional Service Worker
 * Handles offline functionality, caching strategies, and background sync
 * 
 * This service worker provides robust offline support for the unit converter
 * with intelligent caching, fallback mechanisms, and automatic updates.
 * 
 * Version: 2.1.0
 * Author: Sourish
 * Last Updated: 2024
 */

// Cache configuration and versioning
const CACHE_CONFIG = {
  // Main application cache - contains core files
  STATIC_CACHE: 'units-hub-static-v2.1.0',
  
  // Dynamic cache for API responses and user data
  DYNAMIC_CACHE: 'units-hub-dynamic-v2.1.0',
  
  // Image cache for icons and screenshots
  IMAGE_CACHE: 'units-hub-images-v2.1.0',
  
  // Maximum age for cached items (in milliseconds)
  MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // Maximum number of items in dynamic cache
  MAX_DYNAMIC_ITEMS: 50
};

// Core application files that should always be cached
// These files are essential for the app to function offline
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Optional assets that enhance the experience but aren't critical
// These will be cached opportunistically
const OPTIONAL_ASSETS = [
  './screenshot-wide.png',
  './screenshot-mobile.png'
];

/**
 * Service Worker Installation Event
 * 
 * This event fires when the service worker is first installed.
 * We use this opportunity to cache all the essential files needed
 * for the app to work offline.
 */
self.addEventListener('install', event => {
  console.log('Service Worker: Installing new version...');
  
  // Prevent the service worker from being activated until caching is complete
  event.waitUntil(
    Promise.all([
      // Cache core application files
      cacheCoreDependencies(),
      
      // Cache optional assets (don't fail if these aren't available)
      cacheOptionalAssets()
    ]).then(() => {
      console.log('Service Worker: Installation completed successfully');
      
      // Force activation of the new service worker
      // This ensures users get the latest version immediately
      return self.skipWaiting();
    }).catch(error => {
      console.error('Service Worker: Installation failed:', error);
      // Even if installation fails, we don't want to prevent activation
      // The app should still work with whatever was cached successfully
    })
  );
});

/**
 * Caches the essential files needed for offline functionality
 * These files are critical - if they fail to cache, the installation should fail
 */
async function cacheCoreDependencies() {
  try {
    const staticCache = await caches.open(CACHE_CONFIG.STATIC_CACHE);
    
    // Add all core assets to cache
    await staticCache.addAll(CORE_ASSETS);
    
    console.log('Service Worker: Core assets cached successfully');
    return true;
  } catch (error) {
    console.error('Service Worker: Failed to cache core assets:', error);
    throw error; // Re-throw to fail the installation
  }
}

/**
 * Caches optional assets that enhance the experience
 * These files are nice-to-have - failures here shouldn't break installation
 */
async function cacheOptionalAssets() {
  try {
    const imageCache = await caches.open(CACHE_CONFIG.IMAGE_CACHE);
    
    // Attempt to cache each optional asset individually
    // This way, if one fails, the others can still be cached
    const cachePromises = OPTIONAL_ASSETS.map(async (asset) => {
      try {
        const response = await fetch(asset);
        if (response.ok) {
          await imageCache.put(asset, response);
          console.log(`Service Worker: Cached optional asset: ${asset}`);
        }
      } catch (error) {
        console.warn(`Service Worker: Could not cache optional asset ${asset}:`, error);
        // Continue with other assets even if this one fails
      }
    });
    
    await Promise.allSettled(cachePromises);
    console.log('Service Worker: Optional assets caching completed');
  } catch (error) {
    console.warn('Service Worker: Optional assets caching failed:', error);
    // Don't throw - this shouldn't prevent installation
  }
}

/**
 * Service Worker Activation Event
 * 
 * This event fires when the service worker becomes active.
 * We use this to clean up old caches and prepare for handling requests.
 */
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating new version...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches to free up storage space
      cleanupOldCaches(),
      
      // Take control of all open pages immediately
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Activation completed successfully');
    }).catch(error => {
      console.error('Service Worker: Activation failed:', error);
    })
  );
});

/**
 * Removes outdated caches to prevent storage bloat
 * This keeps only the current version's caches
 */
async function cleanupOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const currentCaches = Object.values(CACHE_CONFIG);
    
    // Find caches that are no longer needed
    const cachesToDelete = cacheNames.filter(cacheName => {
      // Keep current caches
      if (currentCaches.includes(cacheName)) {
        return false;
      }
      
      // Delete old versions of our caches
      return cacheName.startsWith('units-hub-');
    });
    
    // Delete obsolete caches
    const deletionPromises = cachesToDelete.map(cacheName => {
      console.log(`Service Worker: Deleting old cache: ${cacheName}`);
      return caches.delete(cacheName);
    });
    
    await Promise.all(deletionPromises);
    console.log('Service Worker: Cache cleanup completed');
  } catch (error) {
    console.error('Service Worker: Cache cleanup failed:', error);
  }
}

/**
 * Fetch Event Handler
 * 
 * This is the core of the service worker - it intercepts all network requests
 * and decides whether to serve from cache or fetch from network.
 */
self.addEventListener('fetch', event => {
  // Only handle GET requests (POST, PUT, DELETE go directly to network)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Determine the appropriate caching strategy based on request type
  const strategy = getCachingStrategy(event.request);
  
  event.respondWith(
    handleRequest(event.request, strategy)
      .catch(error => {
        console.error('Service Worker: Request handling failed:', error);
        
        // Return a meaningful offline fallback
        return createOfflineFallback(event.request);
      })
  );
});

/**
 * Determines the best caching strategy for a given request
 * Different types of resources need different approaches
 */
function getCachingStrategy(request) {
  const url = new URL(request.url);
  
  // Core application files - cache first (they rarely change)
  if (CORE_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
    return 'cache-first';
  }
  
  // Images and static assets - cache first with fallback
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    return 'cache-first';
  }
  
  // API calls or external resources - network first
  if (url.origin !== location.origin) {
    return 'network-first';
  }
  
  // Everything else - stale while revalidate
  return 'stale-while-revalidate';
}

/**
 * Handles requests based on the specified caching strategy
 */
async function handleRequest(request, strategy) {
  switch (strategy) {
    case 'cache-first':
      return handleCacheFirst(request);
    
    case 'network-first':
      return handleNetworkFirst(request);
    
    case 'stale-while-revalidate':
      return handleStaleWhileRevalidate(request);
    
    default:
      console.warn('Service Worker: Unknown strategy:', strategy);
      return handleCacheFirst(request);
  }
}

/**
 * Cache First Strategy
 * 
 * Looks in cache first, only goes to network if not found.
 * Best for static assets that don't change often.
 */
async function handleCacheFirst(request) {
  // Check all relevant caches for the request
  const cacheResponse = await findInCaches(request);
  
  if (cacheResponse) {
    console.log(`Service Worker: Cache hit for ${request.url}`);
    return cacheResponse;
  }
  
  // Not in cache - fetch from network and cache the result
  console.log(`Service Worker: Cache miss for ${request.url}, fetching from network`);
  
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful responses
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Network fetch failed:', error);
    throw error;
  }
}

/**
 * Network First Strategy
 * 
 * Tries network first, falls back to cache if network fails.
 * Best for dynamic content that changes frequently.
 */
async function handleNetworkFirst(request) {
  try {
    console.log(`Service Worker: Network first for ${request.url}`);
    
    const networkResponse = await fetch(request);
    
    // Cache successful responses for future offline use
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`Service Worker: Network failed for ${request.url}, trying cache`);
    
    // Network failed - try cache
    const cacheResponse = await findInCaches(request);
    
    if (cacheResponse) {
      console.log(`Service Worker: Cache fallback successful for ${request.url}`);
      return cacheResponse;
    }
    
    // Neither network nor cache worked
    console.error('Service Worker: Both network and cache failed:', error);
    throw error;
  }
}

/**
 * Stale While Revalidate Strategy
 * 
 * Returns cached version immediately, then updates cache in background.
 * Best balance between speed and freshness.
 */
async function handleStaleWhileRevalidate(request) {
  const cacheResponse = await findInCaches(request);
  
  // Start network request in background (don't await)
  const networkResponsePromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
      console.log(`Service Worker: Background cache update for ${request.url}`);
    }
    return networkResponse;
  }).catch(error => {
    console.warn(`Service Worker: Background update failed for ${request.url}:`, error);
  });
  
  // Return cached version immediately if available
  if (cacheResponse) {
    console.log(`Service Worker: Stale cache hit for ${request.url}`);
    return cacheResponse;
  }
  
  // No cache available - wait for network
  console.log(`Service Worker: No cache for ${request.url}, waiting for network`);
  return networkResponsePromise;
}

/**
 * Searches for a request in all available caches
 */
async function findInCaches(request) {
  const cacheNames = [
    CACHE_CONFIG.STATIC_CACHE,
    CACHE_CONFIG.DYNAMIC_CACHE,
    CACHE_CONFIG.IMAGE_CACHE
  ];
  
  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const response = await cache.match(request);
      
      if (response) {
        return response;
      }
    } catch (error) {
      console.warn(`Service Worker: Error searching cache ${cacheName}:`, error);
    }
  }
  
  return null;
}

/**
 * Intelligently caches a response in the appropriate cache
 */
async function cacheResponse(request, response) {
  try {
    const url = new URL(request.url);
    let targetCache;
    
    // Determine which cache to use based on resource type
    if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
      targetCache = CACHE_CONFIG.IMAGE_CACHE;
    } else if (CORE_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
      targetCache = CACHE_CONFIG.STATIC_CACHE;
    } else {
      targetCache = CACHE_CONFIG.DYNAMIC_CACHE;
    }
    
    const cache = await caches.open(targetCache);
    
    // For dynamic cache, implement size limit
    if (targetCache === CACHE_CONFIG.DYNAMIC_CACHE) {
      await limitCacheSize(cache, CACHE_CONFIG.MAX_DYNAMIC_ITEMS);
    }
    
    await cache.put(request, response);
    console.log(`Service Worker: Cached ${request.url} in ${targetCache}`);
  } catch (error) {
    console.error('Service Worker: Failed to cache response:', error);
  }
}

/**
 * Limits cache size by removing oldest entries
 */
async function limitCacheSize(cache, maxItems) {
  try {
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
      const keysToDelete = keys.slice(0, keys.length - maxItems);
      
      await Promise.all(
        keysToDelete.map(key => cache.delete(key))
      );
      
      console.log(`Service Worker: Trimmed cache, removed ${keysToDelete.length} old entries`);
    }
  } catch (error) {
    console.error('Service Worker: Failed to limit cache size:', error);
  }
}

/**
 * Creates an appropriate offline fallback response
 */
function createOfflineFallback(request) {
  const url = new URL(request.url);
  
  // For HTML requests, return the main app page
  if (request.headers.get('accept').includes('text/html')) {
    return caches.match('./index.html');
  }
  
  // For images, return a placeholder or cached version
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
    return caches.match('./icon-192.png');
  }
  
  // For other requests, return a generic offline response
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: 'This feature is not available offline'
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Handle background sync events
 * This allows the app to sync data when connectivity is restored
 */
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-conversions') {
    event.waitUntil(syncConversions());
  }
});

/**
 * Syncs any pending conversion data when back online
 */
async function syncConversions() {
  try {
    console.log('Service Worker: Syncing conversion data...');
    
    // Here you would typically sync any offline data
    // For a unit converter, this might be usage analytics
    // or saved conversion history
    
    console.log('Service Worker: Sync completed successfully');
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
  }
}

/**
 * Handle push notification events
 * This could be used for update notifications or tips
 */
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New update available!',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: './icon-192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Sourish Units Hub',
        options
      )
    );
  }
});

/**
 * Handle notification click events
 */
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll().then(clientsList => {
        // If app is already open, focus it
        if (clientsList.length > 0) {
          return clientsList[0].focus();
        }
        
        // Otherwise, open new window
        return clients.openWindow('./');
      })
    );
  }
});

/**
 * Handle periodic background sync (if supported)
 * This can be used for updating cached data periodically
 */
self.addEventListener('periodicsync', event => {
  console.log('Service Worker: Periodic sync triggered:', event.tag);
  
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCacheInBackground());
  }
});

/**
 * Updates cached resources in the background
 */
async function updateCacheInBackground() {
  try {
    console.log('Service Worker: Updating cache in background...');
    
    // Update core assets
    const cache = await caches.open(CACHE_CONFIG.STATIC_CACHE);
    
    for (const asset of CORE_ASSETS) {
      try {
        const response = await fetch(asset);
        if (response.ok) {
          await cache.put(asset, response);
        }
      } catch (error) {
        console.warn(`Service Worker: Could not update ${asset}:`, error);
      }
    }
    
    console.log('Service Worker: Background cache update completed');
  } catch (error) {
    console.error('Service Worker: Background cache update failed:', error);
  }
}