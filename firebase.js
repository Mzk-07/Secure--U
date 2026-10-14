/* SecureU Firebase bridge */
(function(){
  var ready=false;
  try {
    if(window.firebase && window.SECUREU_FIREBASE_CONFIG && SECUREU_FIREBASE_CONFIG.apiKey && SECUREU_FIREBASE_CONFIG.apiKey.indexOf('PASTE_')!==0){
      if(!firebase.apps.length) firebase.initializeApp(SECUREU_FIREBASE_CONFIG);
      ready=true;
    }
  } catch(e){ console.log('Firebase is not configured yet:',e); }
  window.secureuFirebaseReady=function(){return ready;};
})();
