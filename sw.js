// SecureU - Service Worker
// This file lets the app load even when there is no internet connection.
// It saves ("caches") the main files the first time the app is opened,
// and serves those saved copies whenever the network is not available.

var CACHE_NAME = "secureu-cache-v4";

// List of files to save for offline use
var FILES_TO_CACHE = [
  "index.html",
  "style.css",
  "script.js", "firebase-config.js", "firebase.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

// Step 1: when the service worker is installed, save the files above
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// Step 2: remove any old caches from previous versions of the app
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
});

// Step 3: whenever the app asks for a file, try the network first.
// If the network fails (offline), give back the saved copy instead.
self.addEventListener("fetch", function (event) {
  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match("index.html");
      });
    })
  );
});
