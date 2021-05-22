// ==UserScript==
// @name         The CW
// @description  Watch videos in external player.
// @version      1.0.0
// @match        *://cwtv.com/*
// @match        *://*.cwtv.com/*
// @match        *://player.theplatform.com/p/cwtv/*
// @match        *://*.player.theplatform.com/p/cwtv/*
// @icon         https://www.cwtv.com/images/cw/favicon.ico
// @run-at       document-end
// @homepage     https://github.com/warren-bank/crx-The-CW/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-The-CW/issues
// @downloadURL  https://github.com/warren-bank/crx-The-CW/raw/webmonkey-userscript/es5/webmonkey-userscript/The-CW.user.js
// @updateURL    https://github.com/warren-bank/crx-The-CW/raw/webmonkey-userscript/es5/webmonkey-userscript/The-CW.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "redirect_to_webcast_reloaded": true,
  "force_http":                   true,
  "force_https":                  false
}

// ----------------------------------------------------------------------------- helpers

// make GET request, pass plaintext response to callback
var download_text = function(url, headers, callback) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  xhr.send()
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if ((url[0] === '/') && (typeof GM_resolveUrl === 'function'))
      url = GM_resolveUrl(url, unsafeWindow.location.href)
    if (url.indexOf('http') === 0)
      GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
  if (!referer_url)
    referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ video_url,
      /* type   = */ video_type
    ]

    // extras:
    if (vtt_url) {
      args.push('textUrl')
      args.push(vtt_url)
    }
    if (referer_url) {
      args.push('referUrl')
      args.push(referer_url)
    }

    GM_startIntent.apply(this, args)
    return true
  }
  else if (user_options.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  if (unsafeWindow.location.hostname.indexOf('cwtv.com') >= 0) {
    if (unsafeWindow.CWTV && ('object' === (typeof unsafeWindow.CWTV)) && unsafeWindow.CWTV.Site && ('object' === (typeof unsafeWindow.CWTV.Site)) && ('full' === CWTV.Site.curPlayingFormat) && CWTV.Site.mpx_player_url) {
      redirect_to_url(CWTV.Site.mpx_player_url)
      return
    }
  }

  if ((unsafeWindow.location.hostname.indexOf('player.theplatform.com') >= 0) && (unsafeWindow.location.pathname.indexOf('/p/cwtv/') === 0)) {
    var el = unsafeWindow.document.querySelector('link[rel="alternate"][type="application/smil+xml"][href]')
    if (el) {
      var url      = el.getAttribute('href') + '&format=SMIL&tracking=true&formats=MPEG-DASH+widevine,M3U+appleHlsEncryption,M3U+none,MPEG-DASH+none,MPEG4,MP3&vpaid=script&schema=2.0&sdk=PDK+6.4.2'
      var headers  = null
      var callback = function(smil) {
        smil = smil.replace(/[\t\r\n]+/g, ' ')

        var video_regex = /^.*?<video [^>]*src=['"]([^'"]+)['"][^>]*>.*$/

        if (video_regex.test(smil)) {
          var hls_url = smil.replace(video_regex, '$1')

          process_hls_url(hls_url)
        }
      }

      download_text(url, headers, callback)
    }
  }
}

init()

// -----------------------------------------------------------------------------
