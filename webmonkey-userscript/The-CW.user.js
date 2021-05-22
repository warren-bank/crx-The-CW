// ==UserScript==
// @name         The CW
// @description  Watch videos in external player.
// @version      1.0.3
// @match        *://cwtv.com/*
// @match        *://*.cwtv.com/*
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
  "redirect_to_webcast_reloaded":  false,
  "force_http":                    true,
  "force_https":                   false
}

var constants = {
  "dom_ids": {
    "episodes_list":               "videosandtouts"
  },
  "dom_classes": {
    "div_webcast_icons":           "icons-container",
    "is_new":                      "is-new"
  },
  "img_urls": {
    "base_webcast_reloaded_icons": "https://github.com/warren-bank/crx-webcast-reloaded/raw/gh-pages/chrome_extension/2-release/popup/img/"
  }
}

var strings = {
  "labels": {
    "now_playing":                 "Now Playing"
  }
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

var get_webcast_reloaded_url_chromecast_sender = function(video_url, vtt_url, referer_url) {
  return get_webcast_reloaded_url(video_url, vtt_url, referer_url, /* force_http= */ null, /* force_https= */ null).replace('/index.html', '/chromecast_sender.html')
}

var get_webcast_reloaded_url_airplay_sender = function(video_url, vtt_url, referer_url) {
  return get_webcast_reloaded_url(video_url, vtt_url, referer_url, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/airplay_sender.es5.html')
}

var get_webcast_reloaded_url_proxy = function(hls_url, vtt_url, referer_url) {
  return get_webcast_reloaded_url(hls_url, vtt_url, referer_url, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/proxy.html')
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
  }
  else if (user_options.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
  }
  else {
    // running in standard web browser: add URL links to tools on Webcast Reloaded website

    insert_webcast_reloaded_div(unsafeWindow.document.body, video_url, vtt_url, referer_url)
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- DOM: static skeleton

var add_now_playing_label = function(episodes_list) {
  var parent_element = episodes_list.querySelector('li.isplaying .videoimage')
  if (!parent_element) return

  var span = make_element('span', strings.labels.now_playing)
  span.className = constants.dom_classes.is_new

  parent_element.appendChild(span)

  // apply minor css tweaks
  add_style_element(function(){
    return [
      'body > #' + constants.dom_ids.episodes_list + ' li.isplaying .videoimage span.is-new {',
      '  left: initial;',
      '  right: 22px;',
      '  bottom: 0px !important;',
      '  font-size: 0.65em;',
      '}'
    ]
  })
}

var reinitialize_dom = function() {
  var episodes_list = unsafeWindow.document.getElementById(constants.dom_ids.episodes_list)
  if (episodes_list) {
    // remove bad elements
    remove_elements(episodes_list.querySelectorAll('script'))
    remove_elements(episodes_list.querySelectorAll('#show-seasons'))
    remove_elements(episodes_list.querySelectorAll('a[href^="#"]'))
    remove_elements(episodes_list.querySelectorAll('div.videoimage > span.' + constants.dom_classes.is_new))

    // add label to thumbnail of video that is currently active
    add_now_playing_label(episodes_list)

    // apply minor css tweaks
    add_style_element(function(){
      return [
        'body, body > #' + constants.dom_ids.episodes_list + ' {',
        '  margin:  0px;',
        '  padding: 0px;',
        '  background-color: #eeeeee;',
        '}'
      ]
    })

    unsafeWindow.document.body.innerHTML = ''
    unsafeWindow.document.body.appendChild(episodes_list)
  }

  if ((typeof GM_startIntent !== 'function') && !user_options.redirect_to_webcast_reloaded) {
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
        '  border: 1px solid #000;',
        '  border-radius: 14px;',
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

var make_webcast_reloaded_div = function(video_url, vtt_url, referer_url) {
  var webcast_reloaded_urls = {
//  "index":             get_webcast_reloaded_url(                  video_url, vtt_url, referer_url),
    "chromecast_sender": get_webcast_reloaded_url_chromecast_sender(video_url, vtt_url, referer_url),
    "airplay_sender":    get_webcast_reloaded_url_airplay_sender(   video_url, vtt_url, referer_url),
    "proxy":             get_webcast_reloaded_url_proxy(            video_url, vtt_url, referer_url)
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

var insert_webcast_reloaded_div = function(block_element, video_url, vtt_url, referer_url) {
  var webcast_reloaded_div = make_webcast_reloaded_div(video_url, vtt_url, referer_url)

  if (block_element.childNodes.length)
    block_element.insertBefore(webcast_reloaded_div, block_element.childNodes[0])
  else
    block_element.appendChild(webcast_reloaded_div)
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  var regexs = {
    "whitespace": /[\t\r\n]+/g,
    "html_link":  /^.*?<link [^>]*rel=['"]alternate['"][^>]*href=['"]([^'"]+)['"][^>]*type=['"]application\/smil\+xml['"][^>]*>.*$/,
    "smil_video": /^.*?<video [^>]*src=['"]([^'"]+)['"][^>]*>.*$/
  }

  var url, headers, callback

  if (unsafeWindow.location.hostname.indexOf('cwtv.com') >= 0) {
    if (unsafeWindow.CWTV && ('object' === (typeof unsafeWindow.CWTV)) && unsafeWindow.CWTV.Site && ('object' === (typeof unsafeWindow.CWTV.Site)) && ('full' === CWTV.Site.curPlayingFormat) && CWTV.Site.mpx_player_url) {
      url      = CWTV.Site.mpx_player_url
      headers  = null
      callback = function(text) { //html (video player)
        text = text.replace(regexs.whitespace, ' ')

        if (regexs.html_link.test(text)) {
          url      = text.replace(regexs.html_link, '$1') + '&format=SMIL&tracking=true&formats=MPEG-DASH+widevine,M3U+appleHlsEncryption,M3U+none,MPEG-DASH+none,MPEG4,MP3&vpaid=script&schema=2.0&sdk=PDK+6.4.2'
          headers  = null
          callback = function(text) { //smil (video metadata)
            text = text.replace(regexs.whitespace, ' ')

            if (regexs.smil_video.test(text)) {
              var hls_url = text.replace(regexs.smil_video, '$1')

              process_hls_url(hls_url)
            }
          }

          download_text(url, headers, callback)
        }
      }

      download_text(url, headers, callback)
      reinitialize_dom()
    }
  }
}

init()

// -----------------------------------------------------------------------------
