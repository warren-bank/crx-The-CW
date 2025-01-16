// ==UserScript==
// @name         The CW: shows
// @description  Watch videos in external player.
// @version      1.0.6
// @match        *://*.cwtv.com/shows/*
// @icon         https://www.cwtv.com/images/cw/favicon.ico
// @run-at       document-end
// @homepage     https://github.com/warren-bank/crx-The-CW/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-The-CW/issues
// @downloadURL  https://github.com/warren-bank/crx-The-CW/raw/webmonkey-userscript/es5/webmonkey-userscript/The-CW-shows.user.js
// @updateURL    https://github.com/warren-bank/crx-The-CW/raw/webmonkey-userscript/es5/webmonkey-userscript/The-CW-shows.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "webmonkey": {
    "post_intent_redirect_to_url":  null
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": false,
    "force_http":                   true,
    "force_https":                  false
  }
}

var constants = {
  "dom_ids": {
    "episodes_list":               "video-thumbs-container"
  },
  "dom_classes": {
    "div_webcast_icons":           "icons-container"
  },
  "img_urls": {
    "base_webcast_reloaded_icons": "https://github.com/warren-bank/crx-webcast-reloaded/raw/gh-pages/chrome_extension/2-release/popup/img/"
  }
}

// ----------------------------------------------------------------------------- state

var state = {}

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

// -----------------------------------------------------------------------------

var make_element = function(elementName, html) {
  var el = unsafeWindow.document.createElement(elementName)

  if (html)
    el.innerHTML = html

  return el
}

var remove_elements = function(nodes) {
  if (!nodes) return

  var node
  for (var i=0; i < nodes.length; i++) {
    node = nodes[i]

    if (node.parentNode)
      node.parentNode.removeChild(node)
  }
}

var add_style_element = function(css) {
  if (!css) return

  var head = unsafeWindow.document.getElementsByTagName('head')[0]
  if (!head) return

  if ('function' === (typeof css))
    css = css()
  if (Array.isArray(css))
    css = css.join("\n")

  head.appendChild(
    make_element('style', css)
  )
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, drm_scheme, drm_server, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, encoded_drm_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))
  encoded_drm_url       = (drm_scheme && drm_server) ? encodeURIComponent(encodeURIComponent(btoa(drm_scheme + '|' + drm_server))) : null

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

  webcast_reloaded_url  = webcast_reloaded_base    + '#/watch/'    + encoded_video_url
                            + (encoded_vtt_url     ? ('/subtitle/' + encoded_vtt_url) : '')
                            + (encoded_referer_url ? ('/referer/'  + encoded_referer_url) : '')
                            + (encoded_drm_url     ? ('/drm/'      + encoded_drm_url) : '')

  return webcast_reloaded_url
}

var get_webcast_reloaded_url_chromecast_sender = function(video_url, vtt_url, referer_url, drm_scheme, drm_server) {
  return get_webcast_reloaded_url(video_url, vtt_url, referer_url, drm_scheme, drm_server, /* force_http= */ null, /* force_https= */ null).replace('/index.html', '/chromecast_sender.html')
}

var get_webcast_reloaded_url_airplay_sender = function(video_url, vtt_url, referer_url, drm_scheme, drm_server) {
  return get_webcast_reloaded_url(video_url, vtt_url, referer_url, drm_scheme, drm_server, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/airplay_sender.es5.html')
}

var get_webcast_reloaded_url_proxy = function(hls_url, vtt_url, referer_url, drm_scheme, drm_server) {
  return get_webcast_reloaded_url(hls_url, vtt_url, referer_url, drm_scheme, drm_server, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/proxy.html')
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

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

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url, drm_scheme, drm_server) {
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
    if (drm_scheme && drm_server) {
      args.push('drmScheme')
      args.push(drm_scheme)

      args.push('drmUrl')
      args.push(drm_server)
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url, drm_scheme, drm_server))
  }
  else {
    // running in standard web browser: add URL links to tools on Webcast Reloaded website

    insert_webcast_reloaded_div(unsafeWindow.document.body, video_url, vtt_url, referer_url, drm_scheme, drm_server)
  }
}

// ----------------------------------------------------------------------------- DOM: static skeleton

var reinitialize_dom = function() {
  var episodes_list = unsafeWindow.document.getElementById(constants.dom_ids.episodes_list)
  if (episodes_list) {
    // apply minor css tweaks
    add_style_element(function(){
      return [
        'body, body > #' + constants.dom_ids.episodes_list + ' {',
        '  margin:  0px;',
        '  padding: 0px;',
        '}'
      ]
    })

    unsafeWindow.document.body.innerHTML = ''
    unsafeWindow.document.body.appendChild(episodes_list)
  }

  if ((typeof GM_startIntent !== 'function') && !user_options.greasemonkey.redirect_to_webcast_reloaded) {
    add_style_element(function(){
      return [
        'div.icons-container {',
        '  display: block;',
        '  position: absolute;',
        '  z-index: 999;',
        '  top:    10px;',
        '  right:  10px;',
        '  width:  60px;',
        '  height: 60px;',
        '  max-height: 60px;',
        '  background-color: #d7ecf5;',
        '  border: 5px solid #d7ecf5;',
        '  border-radius: 14px;',
        '}',

        'div.icons-container > a,',
        'div.icons-container > a:focus {',
        '  outline: none !important;',
        '}',

        'div.icons-container > a.chromecast,',
        'div.icons-container > a.chromecast > img,',
        'div.icons-container > a.airplay,',
        'div.icons-container > a.airplay > img,',
        'div.icons-container > a.proxy,',
        'div.icons-container > a.proxy > img,',
        'div.icons-container > a.video-link,',
        'div.icons-container > a.video-link > img {',
        '  display: block;',
        '  width: 25px;',
        '  height: 25px;',
        '}',

        'div.icons-container > a.chromecast,',
        'div.icons-container > a.airplay,',
        'div.icons-container > a.proxy,',
        'div.icons-container > a.video-link {',
        '  position: absolute;',
        '  z-index: 1;',
        '  text-decoration: none;',
        '}',

        'div.icons-container > a.chromecast,',
        'div.icons-container > a.airplay {',
        '  top: 0;',
        '}',
        'div.icons-container > a.proxy,',
        'div.icons-container > a.video-link {',
        '  bottom: 0;',
        '}',

        'div.icons-container > a.chromecast,',
        'div.icons-container > a.proxy {',
        '  left: 0;',
        '}',
        'div.icons-container > a.airplay,',
        'div.icons-container > a.video-link {',
        '  right: 0;',
        '}',
        'div.icons-container > a.airplay + a.video-link {',
        '  right: 17px; /* (60 - 25)/2 to center when there is no proxy icon */',
        '}'
      ]
    })
  }
}

// ----------------------------------------------------------------------------- DOM: dynamic elements - URL links to tools on Webcast Reloaded website

var make_webcast_reloaded_div = function(video_url, vtt_url, referer_url, drm_scheme, drm_server) {
  var webcast_reloaded_urls = {
//  "index":             get_webcast_reloaded_url(                  video_url, vtt_url, referer_url, drm_scheme, drm_server),
    "chromecast_sender": get_webcast_reloaded_url_chromecast_sender(video_url, vtt_url, referer_url, drm_scheme, drm_server),
    "airplay_sender":    get_webcast_reloaded_url_airplay_sender(   video_url, vtt_url, referer_url, drm_scheme, drm_server),
    "proxy":             get_webcast_reloaded_url_proxy(            video_url, vtt_url, referer_url, drm_scheme, drm_server)
  }

  var div = make_element('div')

  var html = [
    '<a target="_blank" class="chromecast" href="' + webcast_reloaded_urls.chromecast_sender   + '" title="Chromecast Sender"><img src="'       + constants.img_urls.base_webcast_reloaded_icons + 'chromecast.png"></a>',
    '<a target="_blank" class="airplay" href="'    + webcast_reloaded_urls.airplay_sender      + '" title="ExoAirPlayer Sender"><img src="'     + constants.img_urls.base_webcast_reloaded_icons + 'airplay.png"></a>',
    '<a target="_blank" class="proxy" href="'      + webcast_reloaded_urls.proxy               + '" title="HLS-Proxy Configuration"><img src="' + constants.img_urls.base_webcast_reloaded_icons + 'proxy.png"></a>',
    '<a target="_blank" class="video-link" href="' + video_url                                 + '" title="direct link to video"><img src="'    + constants.img_urls.base_webcast_reloaded_icons + 'video_link.png"></a>'
  ]

  div.setAttribute('class', constants.dom_classes.div_webcast_icons)
  div.innerHTML = html.join("\n")

  return div
}

var insert_webcast_reloaded_div = function(block_element, video_url, vtt_url, referer_url, drm_scheme, drm_server) {
  var webcast_reloaded_div = make_webcast_reloaded_div(video_url, vtt_url, referer_url, drm_scheme, drm_server)

  if (block_element.childNodes.length)
    block_element.insertBefore(webcast_reloaded_div, block_element.childNodes[0])
  else
    block_element.appendChild(webcast_reloaded_div)
}

// ----------------------------------------------------------------------------- XHR

var get_mpx_url = function(callback) {
//var qs_params = '?format=SMIL&formats=M3U&tracking=true&mbr=false'
  var qs_params = '?format=SMIL&formats=MPEG-DASH,M3U&tracking=true&mbr=false&assetType=drm|clear'

  download_text(
    ('https://images.cwtv.com/feed/app-2/video-meta/apiversion_22/device_web/guid_' + state.guid),
    null,
    function(text) {
      var data, mpx_url
      try {
        data    = JSON.parse(text)
        mpx_url = data.video.mpx_url
        mpx_url = mpx_url.replace(/^http:/, 'https:').replace(/\?.*$/, qs_params)
      }
      catch(e) {}

      if (!mpx_url)
        mpx_url = 'https://link.theplatform.com/s/cwtv/media/guid/2703454149/' + state.guid + qs_params

      callback(mpx_url)
    }
  )
}

var get_drm_url = function(pid, callback) {
  download_text(
    ('https://images.cwtv.com/video/get-user-cred/' + state.guid + '/?' + Math.floor(Date.now() / 1000)),
    null,
    function(text) {
      var data, token, drm_url
      try {
        data    = JSON.parse(text)
        token   = data.signInResponse.token
        drm_url = 'https://widevine.entitlement.theplatform.com/wv/web/ModularDrm/getRawWidevineLicense?form=json&schema=1.0&account=http%3A%2F%2Faccess.auth.theplatform.com%2Fdata%2FAccount%2F2703454149&releasePid=' + pid + '&token=' + token
      }
      catch(e) {}

      callback(drm_url)
    }
  )
}

var get_video_data = function(callback) {
  get_mpx_url(function(mpx_url) {
    download_text(
      mpx_url,
      null,
      function(text) {
        var regexs = {
          "whitespace": /[\t\r\n]+/g,
          "video":      /<video[^>]*src="([^"]+)"[^>]*type="([^"]+)"/,
          "captions":   /<textstream[^>]*src="([^"]+\.vtt)"/,
          "is_drm":     /<param\s+name="isDRM"\s+value="([^"]+)"/,
          "pid":        /\|pid=([^\|]+)\|/
        }
        var video_url, video_type, vtt_url, is_drm, pid
        var match

        text = text.replace(regexs.whitespace, ' ')

        match = regexs.video.exec(text)
        if (match) {
          video_url  = match[1]
          video_type = match[2]

          match = regexs.captions.exec(text)
          if (match) {
            vtt_url = match[1]
          }

          match = regexs.is_drm.exec(text)
          is_drm = match && (match[1].toLowerCase() === 'true')

          if (is_drm) {
            match = regexs.pid.exec(text)
            if (match) {
              pid = match[1]
            }
          }

          if (is_drm && pid) {
            get_drm_url(pid, function(drm_url) {
              if (drm_url)
                callback(video_url, video_type, /* vtt_url= */ null, /* referer_url= */ null, /* drm_scheme= */ 'widevine', drm_url)
              else
                callback(video_url, video_type, vtt_url)
            })
          }
          else {
            callback(video_url, video_type, vtt_url)
          }
        }
      }
    )
  })
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  var gmUrl, pgUrl
  if ('function' === (typeof GM_getUrl)) {
    gmUrl = GM_getUrl()
    pgUrl = unsafeWindow.location.href.replace(unsafeWindow.location.hash, '')
    if (gmUrl && (gmUrl !== pgUrl)) return
  }

  if (unsafeWindow.location.hostname.indexOf('cwtv.com') >= 0) {
    if (unsafeWindow.CWTV && ('object' === (typeof unsafeWindow.CWTV)) && unsafeWindow.CWTV.Site && ('object' === (typeof unsafeWindow.CWTV.Site)) && ('full' === unsafeWindow.CWTV.Site.curPlayingFormat) && unsafeWindow.CWTV.Site.curPlayingGUID) {
      state.guid = unsafeWindow.CWTV.Site.curPlayingGUID

      reinitialize_dom()
      get_video_data(process_video_url)
    }
  }
}

init()

// -----------------------------------------------------------------------------
