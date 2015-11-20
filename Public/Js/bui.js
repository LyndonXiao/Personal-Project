/**
 * Sea.js 2.2.1 | seajs.org/LICENSE.md
 */
(function(global, undefined) {

// Avoid conflicting when `sea.js` is loaded multiple times
if (global.seajs) {
  return
}

var seajs = global.seajs = {
  // The current version of Sea.js being used
  version: "2.2.1"
}

var data = seajs.data = {}


/**
 * util-lang.js - The minimal language enhancement
 */

function isType(type) {
  return function(obj) {
    return {}.toString.call(obj) == "[object " + type + "]"
  }
}

var isObject = isType("Object")
var isString = isType("String")
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")

var _cid = 0
function cid() {
  return _cid++
}


/**
 * util-events.js - The minimal events support
 */

var events = data.events = {}

// Bind event
seajs.on = function(name, callback) {
  var list = events[name] || (events[name] = [])
  list.push(callback)
  return seajs
}

// Remove event. If `callback` is undefined, remove all callbacks for the
// event. If `event` and `callback` are both undefined, remove all callbacks
// for all events
seajs.off = function(name, callback) {
  // Remove *all* events
  if (!(name || callback)) {
    events = data.events = {}
    return seajs
  }

  var list = events[name]
  if (list) {
    if (callback) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
          list.splice(i, 1)
        }
      }
    }
    else {
      delete events[name]
    }
  }

  return seajs
}

// Emit event, firing all bound callbacks. Callbacks receive the same
// arguments as `emit` does, apart from the event name
var emit = seajs.emit = function(name, data) {
  var list = events[name], fn

  if (list) {
    // Copy callback lists to prevent modification
    list = list.slice()

    // Execute event callbacks
    while ((fn = list.shift())) {
      fn(data)
    }
  }

  return seajs
}


/**
 * util-path.js - The utilities for operating path such as id, uri
 */

var DIRNAME_RE = /[^?#]*\//

var DOT_RE = /\/\.\//g
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//
var DOUBLE_SLASH_RE = /([^:/])\/\//g

// Extract the directory portion of a path
// dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
// ref: http://jsperf.com/regex-vs-split/2
function dirname(path) {
  return path.match(DIRNAME_RE)[0]
}

// Canonicalize a path
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
function realpath(path) {
  // /a/b/./c/./d ==> /a/b/c/d
  path = path.replace(DOT_RE, "/")

  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/")
  }

  // a//b/c  ==>  a/b/c
  path = path.replace(DOUBLE_SLASH_RE, "$1/")

  return path
}

// Normalize an id
// normalize("path/to/a") ==> "path/to/a.js"
// NOTICE: substring is faster than negative slice and RegExp
function normalize(path) {
  var last = path.length - 1
  var lastC = path.charAt(last)

  // If the uri ends with `#`, just return it without '#'
  if (lastC === "#") {
    return path.substring(0, last)
  }

  return (path.substring(last - 2) === ".js" ||
      path.indexOf("?") > 0 ||
      path.substring(last - 3) === ".css" ||
      lastC === "/") ? path : path + ".js"
}


var PATHS_RE = /^([^/:]+)(\/.+)$/
var VARS_RE = /{([^{]+)}/g

function parseAlias(id) {
  var alias = data.alias
  return alias && isString(alias[id]) ? alias[id] : id
}

function parsePaths(id) {
  var paths = data.paths
  var m

  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
    id = paths[m[1]] + m[2]
  }

  return id
}

function parseVars(id) {
  var vars = data.vars

  if (vars && id.indexOf("{") > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

function parseMap(uri) {
  var map = data.map
  var ret = uri

  if (map) {
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          (rule(uri) || uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }
  }

  return ret
}


var ABSOLUTE_RE = /^\/\/.|:\//
var ROOT_DIR_RE = /^.*?\/\/.*?\//

function addBase(id, refUri) {
  var ret
  var first = id.charAt(0)

  // Absolute
  if (ABSOLUTE_RE.test(id)) {
    ret = id
  }
  // Relative
  else if (first === ".") {
    ret = realpath((refUri ? dirname(refUri) : data.cwd) + id)
  }
  // Root
  else if (first === "/") {
    var m = data.cwd.match(ROOT_DIR_RE)
    ret = m ? m[0] + id.substring(1) : id
  }
  // Top-level
  else {
    ret = data.base + id
  }

  // Add default protocol when uri begins with "//"
  if (ret.indexOf("//") === 0) {
    ret = location.protocol + ret
  }

  return ret
}

function id2Uri(id, refUri) {
  if (!id) return ""

  id = parseAlias(id)
  id = parsePaths(id)
  id = parseVars(id)
  id = normalize(id)

  var uri = addBase(id, refUri)
  uri = parseMap(uri)

  return uri
}


var doc = document
var cwd = dirname(doc.URL)
var scripts = doc.scripts

// Recommend to add `seajsnode` id for the `sea.js` script element
var loaderScript = doc.getElementById("seajsnode") ||
    scripts[scripts.length - 1]

// When `sea.js` is inline, set loaderDir to current working directory
var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd)

function getScriptAbsoluteSrc(node) {
  return node.hasAttribute ? // non-IE6/7
      node.src :
    // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute("src", 4)
}


// For Developers
seajs.resolve = id2Uri


/**
 * util-request.js - The utilities for requesting script and style files
 * ref: tests/research/load-js-css/test.html
 */

var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement
var baseElement = head.getElementsByTagName("base")[0]

var IS_CSS_RE = /\.css(?:\?|$)/i
var currentlyAddingScript
var interactiveScript

// `onload` event is not supported in WebKit < 535.23 and Firefox < 9.0
// ref:
//  - https://bugs.webkit.org/show_activity.cgi?id=38995
//  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
//  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
var isOldWebKit = +navigator.userAgent
    .replace(/.*(?:AppleWebKit|AndroidWebKit)\/(\d+).*/, "$1") < 536


function request(url, callback, charset) {
  var isCSS = IS_CSS_RE.test(url)
  var node = doc.createElement(isCSS ? "link" : "script")

  if (charset) {
    var cs = isFunction(charset) ? charset(url) : charset
    if (cs) {
      node.charset = cs
    }
  }

  addOnload(node, callback, isCSS, url)

  if (isCSS) {
    node.rel = "stylesheet"
    node.href = url
  }
  else {
    node.async = true
    node.src = url
  }

  // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
  // the end of the insert execution, so use `currentlyAddingScript` to
  // hold current node, for deriving url in `define` call
  currentlyAddingScript = node

  // ref: #185 & http://dev.jquery.com/ticket/2709
  baseElement ?
      head.insertBefore(node, baseElement) :
      head.appendChild(node)

  currentlyAddingScript = null
}

function addOnload(node, callback, isCSS, url) {
  var supportOnload = "onload" in node

  // for Old WebKit and Old Firefox
  if (isCSS && (isOldWebKit || !supportOnload)) {
    setTimeout(function() {
      pollCss(node, callback)
    }, 1) // Begin after node insertion
    return
  }

  if (supportOnload) {
    node.onload = onload
    node.onerror = function() {
      emit("error", { uri: url, node: node })
      onload()
    }
  }
  else {
    node.onreadystatechange = function() {
      if (/loaded|complete/.test(node.readyState)) {
        onload()
      }
    }
  }

  function onload() {
    // Ensure only run once and handle memory leak in IE
    node.onload = node.onerror = node.onreadystatechange = null

    // Remove the script to reduce memory leak
    if (!isCSS && !data.debug) {
      head.removeChild(node)
    }

    // Dereference the node
    node = null

    callback()
  }
}

function pollCss(node, callback) {
  var sheet = node.sheet
  var isLoaded

  // for WebKit < 536
  if (isOldWebKit) {
    if (sheet) {
      isLoaded = true
    }
  }
  // for Firefox < 9.0
  else if (sheet) {
    try {
      if (sheet.cssRules) {
        isLoaded = true
      }
    } catch (ex) {
      // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
      // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
      // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
      if (ex.name === "NS_ERROR_DOM_SECURITY_ERR") {
        isLoaded = true
      }
    }
  }

  setTimeout(function() {
    if (isLoaded) {
      // Place callback here to give time for style rendering
      callback()
    }
    else {
      pollCss(node, callback)
    }
  }, 20)
}

function getCurrentScript() {
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName("script")

  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}


// For Developers
seajs.request = request


/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 */

var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g
var SLASH_RE = /\\\\/g

function parseDependencies(code) {
  var ret = []

  code.replace(SLASH_RE, "")
      .replace(REQUIRE_RE, function(m, m1, m2) {
        if (m2) {
          ret.push(m2)
        }
      })

  return ret
}


/**
 * module.js - The core of module loader
 */

var cachedMods = seajs.cache = {}
var anonymousMeta

var fetchingList = {}
var fetchedList = {}
var callbackList = {}

var STATUS = Module.STATUS = {
  // 1 - The `module.uri` is being fetched
  FETCHING: 1,
  // 2 - The meta data has been saved to cachedMods
  SAVED: 2,
  // 3 - The `module.dependencies` are being loaded
  LOADING: 3,
  // 4 - The module are ready to execute
  LOADED: 4,
  // 5 - The module is being executed
  EXECUTING: 5,
  // 6 - The `module.exports` is available
  EXECUTED: 6
}


function Module(uri, deps) {
  this.uri = uri
  this.dependencies = deps || []
  this.exports = null
  this.status = 0

  // Who depends on me
  this._waitings = {}

  // The number of unloaded dependencies
  this._remain = 0
}

// Resolve module.dependencies
Module.prototype.resolve = function() {
  var mod = this
  var ids = mod.dependencies
  var uris = []

  for (var i = 0, len = ids.length; i < len; i++) {
    uris[i] = Module.resolve(ids[i], mod.uri)
  }
  return uris
}

// Load module.dependencies and fire onload when all done
Module.prototype.load = function() {
  var mod = this

  // If the module is being loaded, just wait it onload call
  if (mod.status >= STATUS.LOADING) {
    return
  }

  mod.status = STATUS.LOADING

  // Emit `load` event for plugins such as combo plugin
  var uris = mod.resolve()
  emit("load", uris)

  var len = mod._remain = uris.length
  var m

  // Initialize modules and register waitings
  for (var i = 0; i < len; i++) {
    m = Module.get(uris[i])

    if (m.status < STATUS.LOADED) {
      // Maybe duplicate: When module has dupliate dependency, it should be it's count, not 1
      m._waitings[mod.uri] = (m._waitings[mod.uri] || 0) + 1
    }
    else {
      mod._remain--
    }
  }

  if (mod._remain === 0) {
    mod.onload()
    return
  }

  // Begin parallel loading
  var requestCache = {}

  for (i = 0; i < len; i++) {
    m = cachedMods[uris[i]]

    if (m.status < STATUS.FETCHING) {
      m.fetch(requestCache)
    }
    else if (m.status === STATUS.SAVED) {
      m.load()
    }
  }

  // Send all requests at last to avoid cache bug in IE6-9. Issues#808
  for (var requestUri in requestCache) {
    if (requestCache.hasOwnProperty(requestUri)) {
      requestCache[requestUri]()
    }
  }
}

// Call this method when module is loaded
Module.prototype.onload = function() {
  var mod = this
  mod.status = STATUS.LOADED

  if (mod.callback) {
    mod.callback()
  }

  // Notify waiting modules to fire onload
  var waitings = mod._waitings
  var uri, m

  for (uri in waitings) {
    if (waitings.hasOwnProperty(uri)) {
      m = cachedMods[uri]
      m._remain -= waitings[uri]
      if (m._remain === 0) {
        m.onload()
      }
    }
  }

  // Reduce memory taken
  delete mod._waitings
  delete mod._remain
}

// Fetch a module
Module.prototype.fetch = function(requestCache) {
  var mod = this
  var uri = mod.uri

  mod.status = STATUS.FETCHING

  // Emit `fetch` event for plugins such as combo plugin
  var emitData = { uri: uri }
  emit("fetch", emitData)
  var requestUri = emitData.requestUri || uri

  // Empty uri or a non-CMD module
  if (!requestUri || fetchedList[requestUri]) {
    mod.load()
    return
  }

  if (fetchingList[requestUri]) {
    callbackList[requestUri].push(mod)
    return
  }

  fetchingList[requestUri] = true
  callbackList[requestUri] = [mod]

  // Emit `request` event for plugins such as text plugin
  emit("request", emitData = {
    uri: uri,
    requestUri: requestUri,
    onRequest: onRequest,
    charset: data.charset
  })

  if (!emitData.requested) {
    requestCache ?
        requestCache[emitData.requestUri] = sendRequest :
        sendRequest()
  }

  function sendRequest() {
    seajs.request(emitData.requestUri, emitData.onRequest, emitData.charset)
  }

  function onRequest() {
    delete fetchingList[requestUri]
    fetchedList[requestUri] = true

    // Save meta data of anonymous module
    if (anonymousMeta) {
      Module.save(uri, anonymousMeta)
      anonymousMeta = null
    }

    // Call callbacks
    var m, mods = callbackList[requestUri]
    delete callbackList[requestUri]
    while ((m = mods.shift())) m.load()
  }
}

// Execute a module
Module.prototype.exec = function () {
  var mod = this

  // When module is executed, DO NOT execute it again. When module
  // is being executed, just return `module.exports` too, for avoiding
  // circularly calling
  if (mod.status >= STATUS.EXECUTING) {
    return mod.exports
  }

  mod.status = STATUS.EXECUTING

  // Create require
  var uri = mod.uri

  function require(id) {
    return Module.get(require.resolve(id)).exec()
  }

  require.resolve = function(id) {
    return Module.resolve(id, uri)
  }

  require.async = function(ids, callback) {
    Module.use(ids, callback, uri + "_async_" + cid())
    return require
  }

  // Exec factory
  var factory = mod.factory

  var exports = isFunction(factory) ?
      factory(require, mod.exports = {}, mod) :
      factory

  if (exports === undefined) {
    exports = mod.exports
  }

  // Reduce memory leak
  delete mod.factory

  mod.exports = exports
  mod.status = STATUS.EXECUTED

  // Emit `exec` event
  emit("exec", mod)

  return exports
}

// Resolve id to uri
Module.resolve = function(id, refUri) {
  // Emit `resolve` event for plugins such as text plugin
  var emitData = { id: id, refUri: refUri }
  emit("resolve", emitData)

  return emitData.uri || seajs.resolve(emitData.id, refUri)
}

// Define a module
Module.define = function (id, deps, factory) {
  var argsLen = arguments.length

  // define(factory)
  if (argsLen === 1) {
    factory = id
    id = undefined
  }
  else if (argsLen === 2) {
    factory = deps

    // define(deps, factory)
    if (isArray(id)) {
      deps = id
      id = undefined
    }
    // define(id, factory)
    else {
      deps = undefined
    }
  }

  // Parse dependencies according to the module factory code
  if (!isArray(deps) && isFunction(factory)) {
    deps = parseDependencies(factory.toString())
  }

  var meta = {
    id: id,
    uri: Module.resolve(id),
    deps: deps,
    factory: factory
  }

  // Try to derive uri in IE6-9 for anonymous modules
  if (!meta.uri && doc.attachEvent) {
    var script = getCurrentScript()

    if (script) {
      meta.uri = script.src
    }

    // NOTE: If the id-deriving methods above is failed, then falls back
    // to use onload event to get the uri
  }

  // Emit `define` event, used in nocache plugin, seajs node version etc
  emit("define", meta)

  meta.uri ? Module.save(meta.uri, meta) :
      // Save information for "saving" work in the script onload event
      anonymousMeta = meta
}

// Save meta data to cachedMods
Module.save = function(uri, meta) {
  var mod = Module.get(uri)

  // Do NOT override already saved modules
  if (mod.status < STATUS.SAVED) {
    mod.id = meta.id || uri
    mod.dependencies = meta.deps || []
    mod.factory = meta.factory
    mod.status = STATUS.SAVED
  }
}

// Get an existed module or create a new one
Module.get = function(uri, deps) {
  return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
}

// Use function is equal to load a anonymous module
Module.use = function (ids, callback, uri) {
  var mod = Module.get(uri, isArray(ids) ? ids : [ids])

  mod.callback = function() {
    var exports = []
    var uris = mod.resolve()

    for (var i = 0, len = uris.length; i < len; i++) {
      exports[i] = cachedMods[uris[i]].exec()
    }

    if (callback) {
      callback.apply(global, exports)
    }

    delete mod.callback
  }

  mod.load()
}

// Load preload modules before all other modules
Module.preload = function(callback) {
  var preloadMods = data.preload
  var len = preloadMods.length

  if (len) {
    Module.use(preloadMods, function() {
      // Remove the loaded preload modules
      preloadMods.splice(0, len)

      // Allow preload modules to add new preload modules
      Module.preload(callback)
    }, data.cwd + "_preload_" + cid())
  }
  else {
    callback()
  }
}


// Public API

seajs.use = function(ids, callback) {
  Module.preload(function() {
    Module.use(ids, callback, data.cwd + "_use_" + cid())
  })
  return seajs
}

Module.define.cmd = {}
global.define = Module.define


// For Developers

seajs.Module = Module
data.fetchedList = fetchedList
data.cid = cid

seajs.require = function(id) {
  var mod = Module.get(Module.resolve(id))
  if (mod.status < STATUS.EXECUTING) {
    mod.onload()
    mod.exec()
  }
  return mod.exports
}


/**
 * config.js - The configuration for the loader
 */

var BASE_RE = /^(.+?\/)(\?\?)?(seajs\/)+/

// The root path to use for id2uri parsing
// If loaderUri is `http://test.com/libs/seajs/[??][seajs/1.2.3/]sea.js`, the
// baseUri should be `http://test.com/libs/`
data.base = (loaderDir.match(BASE_RE) || ["", loaderDir])[1]

// The loader directory
data.dir = loaderDir

// The current working directory
data.cwd = cwd

// The charset for requesting files
data.charset = "utf-8"

// Modules that are needed to load before all other modules
data.preload = (function() {
  var plugins = []

  // Convert `seajs-xxx` to `seajs-xxx=1`
  // NOTE: use `seajs-xxx=1` flag in uri or cookie to preload `seajs-xxx`
  var str = location.search.replace(/(seajs-\w+)(&|$)/g, "$1=1$2")

  // Add cookie string
  str += " " + doc.cookie

  // Exclude seajs-xxx=0
  str.replace(/(seajs-\w+)=1/g, function(m, name) {
    plugins.push(name)
  })

  return plugins
})()

// data.alias - An object containing shorthands of module id
// data.paths - An object containing path shorthands in module id
// data.vars - The {xxx} variables in module id
// data.map - An array containing rules to map module uri
// data.debug - Debug mode. The default value is false

seajs.config = function(configData) {

  for (var key in configData) {
    var curr = configData[key]
    var prev = data[key]

    // Merge object config such as alias, vars
    if (prev && isObject(prev)) {
      for (var k in curr) {
        prev[k] = curr[k]
      }
    }
    else {
      // Concat array config such as map, preload
      if (isArray(prev)) {
        curr = prev.concat(curr)
      }
      // Make sure that `data.base` is an absolute path
      else if (key === "base") {
        // Make sure end with "/"
        if (curr.slice(-1) !== "/") {
          curr += "/"
        }
        curr = addBase(curr)
      }

      // Set config
      data[key] = curr
    }
  }

  emit("config", configData)
  return seajs
}

})(this);

;(function() {
var bui_config_110_config_debug;
bui_config_110_config_debug = function () {
  //from seajs
  function getScriptAbsoluteSrc(node) {
    return node.hasAttribute ? // non-IE6/7
    node.src : // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
    node.getAttribute('src', 4);
  }
  var BUI = window.BUI = window.BUI || {};
  BUI.use = seajs.use;
  BUI.config = seajs.config;
  var scripts = document.getElementsByTagName('script'), loaderScript = scripts[scripts.length - 1], src = getScriptAbsoluteSrc(loaderScript), loaderPath = src.substring(0, src.lastIndexOf('/')),
    // 涓嶈兘鐢╠ata 鍥犱负鍦ㄦ妸鍖呯殑鏃跺€欎細鎶奷ata鏇挎崲鎴恉ata
    debug = loaderScript.getAttribute('debug') === 'true' ? true : false;
  BUI.loaderScript = loaderScript;
  //閰嶇疆bui鐨勮矾寰�
  seajs.config({ paths: { 'bui': loaderPath } });
  BUI.setDebug = function (debug) {
    BUI.debug = debug;
    //鍙湁bui鐩綍涓嬮潰鐨勬枃浠朵娇鐢�-min.js
    var regexp = new RegExp('^(' + loaderPath + '\\S*).js$');
    if (!debug) {
      seajs.config({
        map: [[
            regexp,
            '$1-min.js'
          ]]
      });
    } else {
      var map = seajs.data.map;
      var mapReg;
      if (!map) {
        return;
      }
      for (var i = map.length - 1; i >= 0; i--) {
        mapReg = map[i][0];
        if (Object.prototype.toString.call(mapReg) === '[object RegExp]' && mapReg.toString() === regexp.toString()) {
          map.splice(i, 1);
        }
      }
    }
  };
  BUI.setDebug(debug);
  // 鎵€鏈夌殑妯″潡閮芥槸渚濊禆浜巎query, 鎵€浠ュ畾涔変竴涓猨query鐨勬ā鍧楋紝骞剁洿鎺ヨ繑鍥�
  if (window.jQuery) {
    window.define('jquery', [], function () {
      return window.jQuery;
    });
  }
}();
}());
define("bui/common", ["jquery"], function(require, exports, module){
var BUI = require("bui/common/util");

BUI.mix(BUI, {
  UA: require("bui/common/ua"),
  JSON: require("bui/common/json"),
  Date: require("bui/common/date"),
  Array: require("bui/common/array"),
  KeyCode: require("bui/common/keycode"),
  Observable: require("bui/common/observable"),
  Base: require("bui/common/base"),
  Component: require("bui/common/component/component")
});

module.exports = BUI;

});
define("bui/common/util", ["jquery"], function(require, exports, module){
/**
 * @class BUI
 * 鎺т欢搴撶殑宸ュ叿鏂规硶锛岃繖浜涘伐鍏锋柟娉曠洿鎺ョ粦瀹氬埌BUI瀵硅薄涓�
 * <pre><code>
 *   BUI.isString(str);
 *
 *   BUI.extend(A,B);
 *
 *   BUI.mix(A,{a:'a'});
 * </code></pre>
 * @singleton
 */

var $ = require("jquery");

//鍏煎jquery 1.6浠ヤ笅
(function($) {
  if ($.fn) {
    $.fn.on = $.fn.on || $.fn.bind;
    $.fn.off = $.fn.off || $.fn.unbind;
  }
})($);
/**
 * @ignore
 * 澶勪簬鏁堢巼鐨勭洰鐨勶紝澶嶅埗灞炴€�
 */
function mixAttrs(to, from) {

  for (var c in from) {
    if (from.hasOwnProperty(c)) {
      to[c] = to[c] || {};
      mixAttr(to[c], from[c]);
    }
  }

}
//鍚堝苟灞炴€�
function mixAttr(attr, attrConfig) {
  for (var p in attrConfig) {
    if (attrConfig.hasOwnProperty(p)) {
      if (p == 'value') {
        if (BUI.isObject(attrConfig[p])) {
          attr[p] = attr[p] || {};
          BUI.mix( /*true,*/ attr[p], attrConfig[p]);
        } else if (BUI.isArray(attrConfig[p])) {
          attr[p] = attr[p] || [];
          //BUI.mix(/*true,*/attr[p], attrConfig[p]);
          attr[p] = attr[p].concat(attrConfig[p]);
        } else {
          attr[p] = attrConfig[p];
        }
      } else {
        attr[p] = attrConfig[p];
      }
    }
  };
}

var win = window,
  doc = document,
  objectPrototype = Object.prototype,
  toString = objectPrototype.toString,
  BODY = 'body',
  DOC_ELEMENT = 'documentElement',
  SCROLL = 'scroll',
  SCROLL_WIDTH = SCROLL + 'Width',
  SCROLL_HEIGHT = SCROLL + 'Height',
  ATTRS = 'ATTRS',
  PARSER = 'PARSER',
  GUID_DEFAULT = 'guid';

window.BUI = window.BUI || {};

$.extend(BUI, {
  /**
   * 鐗堟湰鍙�
   * @memberOf BUI
   * @type {Number}
   */
  version: '1.1.0',
  /**
   * 鏄惁涓哄嚱鏁�
   * @param  {*} fn 瀵硅薄
   * @return {Boolean}  鏄惁鍑芥暟
   */
  isFunction: function(fn) {
    return typeof(fn) === 'function';
  },
  /**
   * 鏄惁鏁扮粍
   * @method
   * @param  {*}  obj 鏄惁鏁扮粍
   * @return {Boolean}  鏄惁鏁扮粍
   */
  isArray: ('isArray' in Array) ? Array.isArray : function(value) {
    return toString.call(value) === '[object Array]';
  },
  /**
   * 鏄惁鏃ユ湡
   * @param  {*}  value 瀵硅薄
   * @return {Boolean}  鏄惁鏃ユ湡
   */
  isDate: function(value) {
    return toString.call(value) === '[object Date]';
  },
  /**
   * 鏄惁鏄痡avascript瀵硅薄
   * @param {Object} value The value to test
   * @return {Boolean}
   * @method
   */
  isObject: (toString.call(null) === '[object Object]') ?
    function(value) {
      // check ownerDocument here as well to exclude DOM nodes
      return value !== null && value !== undefined && toString.call(value) === '[object Object]' && value.ownerDocument === undefined;
  } : function(value) {
    return toString.call(value) === '[object Object]';
  },
  /**
   * 鏄惁鏄暟瀛楁垨鑰呮暟瀛楀瓧绗︿覆
   * @param  {String}  value 鏁板瓧瀛楃涓�
   * @return {Boolean}  鏄惁鏄暟瀛楁垨鑰呮暟瀛楀瓧绗︿覆
   */
  isNumeric: function(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
  },
  /**
   * 灏嗘寚瀹氱殑鏂规硶鎴栧睘鎬ф斁鍒版瀯閫犲嚱鏁扮殑鍘熷瀷閾句笂锛�
   * 鍑芥暟鏀寔澶氫簬2涓彉閲忥紝鍚庨潰鐨勫彉閲忓悓s1涓€鏍峰皢鍏舵垚鍛樺鍒跺埌鏋勯€犲嚱鏁扮殑鍘熷瀷閾句笂銆�
   * @param  {Function} r  鏋勯€犲嚱鏁�
   * @param  {Object} s1 灏唖1 鐨勬垚鍛樺鍒跺埌鏋勯€犲嚱鏁扮殑鍘熷瀷閾句笂
   *      @example
   *      BUI.augment(class1,{
   *        method1: function(){
   *
   *        }
   *      });
   */
  augment: function(r, s1) {
    if (!BUI.isFunction(r)) {
      return r;
    }
    for (var i = 1; i < arguments.length; i++) {
      BUI.mix(r.prototype, arguments[i].prototype || arguments[i]);
    };
    return r;
  },
  /**
   * 鎷疯礉瀵硅薄
   * @param  {Object} obj 瑕佹嫹璐濈殑瀵硅薄
   * @return {Object} 鎷疯礉鐢熸垚鐨勫璞�
   */
  cloneObject: function(obj) {
    var result = BUI.isArray(obj) ? [] : {};

    return BUI.mix(true, result, obj);
  },
  /**
   * 鎶涘嚭閿欒
   */
  error: function(msg) {
    if (BUI.debug) {
      throw msg;
    }
  },

  /**
   * 瀹炵幇绫荤殑缁ф壙锛岄€氳繃鐖剁被鐢熸垚瀛愮被
   * @param  {Function} subclass
   * @param  {Function} superclass 鐖剁被鏋勯€犲嚱鏁�
   * @param  {Object} overrides  瀛愮被鐨勫睘鎬ф垨鑰呮柟娉�
   * @return {Function} 杩斿洖鐨勫瓙绫绘瀯閫犲嚱鏁�
   * 绀轰緥:
   *    @example
   *    //鐖剁被
   *    function base(){
   *
   *    }
   *
   *    function sub(){
   *
   *    }
   *    //瀛愮被
   *    BUI.extend(sub,base,{
   *      method : function(){
   *
   *      }
   *    });
   *
   *    //鎴栬€�
   *    var sub = BUI.extend(base,{});
   */
  extend: function(subclass, superclass, overrides, staticOverrides) {
    //濡傛灉鍙彁渚涚埗绫绘瀯閫犲嚱鏁帮紝鍒欒嚜鍔ㄧ敓鎴愬瓙绫绘瀯閫犲嚱鏁�
    if (!BUI.isFunction(superclass)) {

      overrides = superclass;
      superclass = subclass;
      subclass = function() {};
    }

    var create = Object.create ?
      function(proto, c) {
        return Object.create(proto, {
          constructor: {
            value: c
          }
        });
      } :
      function(proto, c) {
        function F() {}

        F.prototype = proto;

        var o = new F();
        o.constructor = c;
        return o;
      };
    var superObj = create(superclass.prototype, subclass); //new superclass(),//瀹炰緥鍖栫埗绫讳綔涓哄瓙绫荤殑prototype
    subclass.prototype = BUI.mix(superObj, subclass.prototype); //鎸囧畾瀛愮被鐨刾rototype
    subclass.superclass = create(superclass.prototype, superclass);
    BUI.mix(superObj, overrides);
    BUI.mix(subclass, staticOverrides);
    return subclass;
  },
  /**
   * 鐢熸垚鍞竴鐨処d
   * @method
   * @param {String} prefix 鍓嶇紑
   * @default 'bui-guid'
   * @return {String} 鍞竴鐨勭紪鍙�
   */
  guid: (function() {
    var map = {};
    return function(prefix) {
      prefix = prefix || BUI.prefix + GUID_DEFAULT;
      if (!map[prefix]) {
        map[prefix] = 1;
      } else {
        map[prefix] += 1;
      }
      return prefix + map[prefix];
    };
  })(),
  /**
   * 鍒ゆ柇鏄惁鏄瓧绗︿覆
   * @return {Boolean} 鏄惁鏄瓧绗︿覆
   */
  isString: function(value) {
    return typeof value === 'string';
  },
  /**
   * 鍒ゆ柇鏄惁鏁板瓧锛岀敱浜�$.isNumberic鏂规硶浼氭妸 '123'璁や负鏁板瓧
   * @return {Boolean} 鏄惁鏁板瓧
   */
  isNumber: function(value) {
    return typeof value === 'number';
  },
  /**
   * 鏄惁鏄竷灏旂被鍨�
   *
   * @param {Object} value 娴嬭瘯鐨勫€�
   * @return {Boolean}
   */
  isBoolean: function(value) {
    return typeof value === 'boolean';
  },
  /**
   * 鎺у埗鍙拌緭鍑烘棩蹇�
   * @param  {Object} obj 杈撳嚭鐨勬暟鎹�
   */
  log: function(obj) {
    if (BUI.debug && win.console && win.console.log) {
      win.console.log(obj);
    }
  },
  /**
   * 灏嗗涓璞＄殑灞炴€у鍒跺埌涓€涓柊鐨勫璞�
   */
  merge: function() {
    var args = $.makeArray(arguments),
      first = args[0];
    if (BUI.isBoolean(first)) {
      args.shift();
      args.unshift({});
      args.unshift(first);
    } else {
      args.unshift({});
    }

    return BUI.mix.apply(null, args);

  },
  /**
   * 灏佽 jQuery.extend 鏂规硶锛屽皢澶氫釜瀵硅薄鐨勫睘鎬erge鍒扮涓€涓璞′腑
   * @return {Object}
   */
  mix: function() {
    return $.extend.apply(null, arguments);
  },
  /**
   * 鍒涢€犻《灞傜殑鍛藉悕绌洪棿锛岄檮鍔犲埌window瀵硅薄涓�,
   * 鍖呭惈namespace鏂规硶
   */
  app: function(name) {
    if (!window[name]) {
      window[name] = {
        namespace: function(nsName) {
          return BUI.namespace(nsName, window[name]);
        }
      };
    }
    return window[name];
  },

  mixAttrs: mixAttrs,

  mixAttr: mixAttr,

  /**
   * 灏嗗叾浠栫被浣滀负mixin闆嗘垚鍒版寚瀹氱被涓婇潰
   * @param {Function} c 鏋勯€犲嚱鏁�
   * @param {Array} mixins 鎵╁睍绫�
   * @param {Array} attrs 鎵╁睍鐨勯潤鎬佸睘鎬э紝榛樿涓篬'ATTRS']
   * @return {Function} 浼犲叆鐨勬瀯閫犲嚱鏁�
   */
  mixin: function(c, mixins, attrs) {
    attrs = attrs || [ATTRS, PARSER];
    var extensions = mixins;
    if (extensions) {
      c.mixins = extensions;

      var desc = {
          // ATTRS:
          // HTML_PARSER:
        },
        constructors = extensions['concat'](c);

      // [ex1,ex2]锛屾墿灞曠被鍚庨潰鐨勪紭鍏堬紝ex2 瀹氫箟鐨勮鐩� ex1 瀹氫箟鐨�
      // 涓荤被鏈€浼樺厛
      BUI.each(constructors, function(ext) {
        if (ext) {
          // 鍚堝苟 ATTRS/HTML_PARSER 鍒颁富绫�
          BUI.each(attrs, function(K) {
            if (ext[K]) {
              desc[K] = desc[K] || {};
              // 涓嶈鐩栦富绫讳笂鐨勫畾涔夛紝鍥犱负缁ф壙灞傛涓婃墿灞曠被姣斾富绫诲眰娆￠珮
              // 浣嗘槸鍊兼槸瀵硅薄鐨勮瘽浼氭繁搴﹀悎骞�
              // 娉ㄦ剰锛氭渶濂藉€兼槸绠€鍗曞璞★紝鑷畾涔� new 鍑烘潵鐨勫璞″氨浼氭湁闂(鐢� function return 鍑烘潵)!
              if (K == 'ATTRS') {
                //BUI.mix(true,desc[K], ext[K]);
                mixAttrs(desc[K], ext[K]);
              } else {
                BUI.mix(desc[K], ext[K]);
              }

            }
          });
        }
      });

      BUI.each(desc, function(v, k) {
        c[k] = v;
      });

      var prototype = {};

      // 涓荤被鏈€浼樺厛
      BUI.each(constructors, function(ext) {
        if (ext) {
          var proto = ext.prototype;
          // 鍚堝苟鍔熻兘浠ｇ爜鍒颁富绫伙紝涓嶈鐩�
          for (var p in proto) {
            // 涓嶈鐩栦富绫伙紝浣嗘槸涓荤被鐨勭埗绫昏繕鏄鐩栧惂
            if (proto.hasOwnProperty(p)) {
              prototype[p] = proto[p];
            }
          }
        }
      });

      BUI.each(prototype, function(v, k) {
        c.prototype[k] = v;
      });
    }
    return c;
  },
  /**
   * 鐢熸垚鍛藉悕绌洪棿
   * @param  {String} name 鍛藉悕绌洪棿鐨勫悕绉�
   * @param  {Object} baseNS 鍦ㄥ凡鏈夌殑鍛藉悕绌洪棿涓婂垱寤哄懡鍚嶇┖闂达紝榛樿鈥淏UI鈥�
   * @return {Object} 杩斿洖鐨勫懡鍚嶇┖闂村璞�
   *    @example
   *    BUI.namespace("Grid"); // BUI.Grid
   */
  namespace: function(name, baseNS) {
    baseNS = baseNS || BUI;
    if (!name) {
      return baseNS;
    }
    var list = name.split('.'),
      //firstNS = win[list[0]],
      curNS = baseNS;

    for (var i = 0; i < list.length; i++) {
      var nsName = list[i];
      if (!curNS[nsName]) {
        curNS[nsName] = {};
      }
      curNS = curNS[nsName];
    };
    return curNS;
  },
  /**
   * BUI 鎺т欢鐨勫叕鐢ㄥ墠缂€
   * @type {String}
   */
  prefix: 'bui-',
  /**
   * 鏇挎崲瀛楃涓蹭腑鐨勫瓧娈�.
   * @param {String} str 妯＄増瀛楃涓�
   * @param {Object} o json data
   * @param {RegExp} [regexp] 鍖归厤瀛楃涓茬殑姝ｅ垯琛ㄨ揪寮�
   */
  substitute: function(str, o, regexp) {
    if (!BUI.isString(str) || (!BUI.isObject(o)) && !BUI.isArray(o)) {
      return str;
    }

    return str.replace(regexp || /\\?\{([^{}]+)\}/g, function(match, name) {
      if (match.charAt(0) === '\\') {
        return match.slice(1);
      }
      return (o[name] === undefined) ? '' : o[name];
    });
  },
  /**
   * 灏�$.param鐨勫弽鎿嶄綔
   * jquery鍙彁渚沺aram鏂规硶
   * @return {[type]} [description]
   */
  unparam: function(str){
    if (typeof str != 'string' || !(str = $.trim(str))) {
      return {};
    }
    var pairs = str.split('&'),
      pairsArr,
      rst = {};
    for(var i = pairs.length - 1; i >= 0; i--) {
      pairsArr = pairs[i].split('=');
      rst[pairsArr[0]] = decodeURIComponent(pairsArr[1]);
    }
    return rst;
  },
  /**
   * 浣跨涓€涓瓧姣嶅彉鎴愬ぇ鍐�
   * @param  {String} s 瀛楃涓�
   * @return {String} 棣栧瓧姣嶅ぇ鍐欏悗鐨勫瓧绗︿覆
   */
  ucfirst: function(s) {
    s += '';
    return s.charAt(0).toUpperCase() + s.substring(1);
  },
  /**
   * 椤甸潰涓婄殑涓€鐐规槸鍚﹀湪鐢ㄦ埛鐨勮鍥惧唴
   * @param {Object} offset 鍧愭爣锛宭eft,top
   * @return {Boolean} 鏄惁鍦ㄨ鍥惧唴
   */
  isInView: function(offset) {
    var left = offset.left,
      top = offset.top,
      viewWidth = BUI.viewportWidth(),
      wiewHeight = BUI.viewportHeight(),
      scrollTop = BUI.scrollTop(),
      scrollLeft = BUI.scrollLeft();
    //鍒ゆ柇妯潗鏍�
    if (left < scrollLeft || left > scrollLeft + viewWidth) {
      return false;
    }
    //鍒ゆ柇绾靛潗鏍�
    if (top < scrollTop || top > scrollTop + wiewHeight) {
      return false;
    }
    return true;
  },
  /**
   * 椤甸潰涓婄殑涓€鐐圭旱鍚戝潗鏍囨槸鍚﹀湪鐢ㄦ埛鐨勮鍥惧唴
   * @param {Object} top  绾靛潗鏍�
   * @return {Boolean} 鏄惁鍦ㄨ鍥惧唴
   */
  isInVerticalView: function(top) {
    var wiewHeight = BUI.viewportHeight(),
      scrollTop = BUI.scrollTop();

    //鍒ゆ柇绾靛潗鏍�
    if (top < scrollTop || top > scrollTop + wiewHeight) {
      return false;
    }
    return true;
  },
  /**
   * 椤甸潰涓婄殑涓€鐐规í鍚戝潗鏍囨槸鍚﹀湪鐢ㄦ埛鐨勮鍥惧唴
   * @param {Object} left 妯潗鏍�
   * @return {Boolean} 鏄惁鍦ㄨ鍥惧唴
   */
  isInHorizontalView: function(left) {
    var viewWidth = BUI.viewportWidth(),
      scrollLeft = BUI.scrollLeft();
    //鍒ゆ柇妯潗鏍�
    if (left < scrollLeft || left > scrollLeft + viewWidth) {
      return false;
    }
    return true;
  },
  /**
   * 鑾峰彇绐楀彛鍙鑼冨洿瀹藉害
   * @return {Number} 鍙鍖哄搴�
   */
  viewportWidth: function() {
    return $(window).width();
  },
  /**
   * 鑾峰彇绐楀彛鍙鑼冨洿楂樺害
   * @return {Number} 鍙鍖洪珮搴�
   */
  viewportHeight: function() {
    return $(window).height();
  },
  /**
   * 婊氬姩鍒扮獥鍙ｇ殑left浣嶇疆
   */
  scrollLeft: function() {
    return $(window).scrollLeft();
  },
  /**
   * 婊氬姩鍒版í鍚戜綅缃�
   */
  scrollTop: function() {
    return $(window).scrollTop();
  },
  /**
   * 绐楀彛瀹藉害
   * @return {Number} 绐楀彛瀹藉害
   */
  docWidth: function() {
    return Math.max(this.viewportWidth(), doc[DOC_ELEMENT][SCROLL_WIDTH], doc[BODY][SCROLL_WIDTH]);
  },
  /**
   * 绐楀彛楂樺害
   * @return {Number} 绐楀彛楂樺害
   */
  docHeight: function() {
    return Math.max(this.viewportHeight(), doc[DOC_ELEMENT][SCROLL_HEIGHT], doc[BODY][SCROLL_HEIGHT]);
  },
  /**
   * 閬嶅巻鏁扮粍鎴栬€呭璞�
   * @param {Object|Array} element/Object 鏁扮粍涓殑鍏冪礌鎴栬€呭璞＄殑鍊�
   * @param {Function} func 閬嶅巻鐨勫嚱鏁� function(elememt,index){} 鎴栬€� function(value,key){}
   */
  each: function(elements, func) {
    if (!elements) {
      return;
    }
    $.each(elements, function(k, v) {
      return func(v, k);
    });
  },
  /**
   * 灏佽浜嬩欢锛屼究浜庝娇鐢ㄤ笂涓嬫枃this,鍜屼究浜庤В闄や簨浠舵椂浣跨敤
   * @protected
   * @param  {Object} self   瀵硅薄
   * @param  {String} action 浜嬩欢鍚嶇О
   */
  wrapBehavior: function(self, action) {
    return self['__bui_wrap_' + action] = function(e) {
      if (!self.get('disabled')) {
        self[action](e);
      }
    };
  },
  /**
   * 鑾峰彇灏佽鐨勪簨浠�
   * @protected
   * @param  {Object} self   瀵硅薄
   * @param  {String} action 浜嬩欢鍚嶇О
   */
  getWrapBehavior: function(self, action) {
    return self['__bui_wrap_' + action];
  },
  /**
   * 鑾峰彇椤甸潰涓婁娇鐢ㄤ簡姝d鐨勬帶浠�
   * @param  {String} id 鎺т欢id
   * @return {BUI.Component.Controller}  鏌ユ壘鐨勬帶浠�
   */
  getControl: function(id) {
    return BUI.Component.Manager.getComponent(id);
  },
  /**
   * 璁剧疆瀵硅薄鐨勫睘鎬э紝鏀寔娣卞害璁剧疆灞炴€у€�
   *
   *   @example
   *   BUI.setValue(obj,'a.b.c',value) //obj.a.b.c = value;
   * @param {Object} obj   瀵硅薄
   * @param {String} name  鍚嶇О
   * @param {String} value 鍊�
   */
  setValue: function(obj,name,value){
    if(!obj && !name){
      return obj;
    }
    var arr = name.split('.'),
      curObj = obj,
      len = arr.length;

    for (var i = 0; i < len; i++){
      if(!curObj || !BUI.isObject(curObj)){
        break;
      }
      var subName = arr[i];
      if (i === len - 1){
        curObj[subName] = value;
        break;
      }
      if (!curObj[subName]) {
        curObj[subName] = {};
      }
      curObj = curObj[subName];
    }

    return obj;
  },
  /**
   * 璁剧疆瀵硅薄鐨勫睘鎬э紝鏀寔娣卞害璁剧疆灞炴€у€�
   *
   *   @example
   *   BUI.getValue(obj,'a.b.c') //return obj.a.b.c;
   * @param {Object} obj   瀵硅薄
   * @param {String} name  鍚嶇О
   * @param {String} value 鍊�
   */
  getValue: function(obj,name){
    if(!obj && !name){
      return null;
    }

    var arr = name.split('.'),
      curObj = obj,
      len = arr.length,
      value = null;

    for (var i = 0; i < len; i++){
      if(!curObj || !BUI.isObject(curObj)){
        break;
      }
      var subName = arr[i];
      if (i === len - 1){
        value = curObj[subName];
        break;
      }
      if (!curObj[subName]) {
        break;
      }
      curObj = curObj[subName];
    }

    return value;
  }

});

/**
 * 琛ㄥ崟甯姪绫伙紝搴忓垪鍖栥€佸弽搴忓垪鍖栵紝璁剧疆鍊�
 * @class BUI.FormHelper
 * @singleton
 */
var FormHelper = {
  /**
   * 灏嗚〃鍗曟牸寮忓寲鎴愰敭鍊煎褰㈠紡
   * @param {HTMLElement} form 琛ㄥ崟
   * @return {Object} 閿€煎鐨勫璞�
   */
  serializeToObject: function(form) {
    var array = $(form).serializeArray(),
      result = {};
    BUI.each(array, function(item) {
      var name = item.name;
      if (!result[name]) { //濡傛灉鏄崟涓€硷紝鐩存帴璧嬪€�
        result[name] = item.value;
      } else { //澶氬€间娇鐢ㄦ暟缁�
        if (!BUI.isArray(result[name])) {
          result[name] = [result[name]];
        }
        result[name].push(item.value);
      }
    });
    return result;
  },
  /**
   * 璁剧疆琛ㄥ崟鐨勫€�
   * @param {HTMLElement} form 琛ㄥ崟
   * @param {Object} obj  閿€煎
   */
  setFields: function(form, obj) {
    for (var name in obj) {
      if (obj.hasOwnProperty(name)) {
        BUI.FormHelper.setField(form, name, obj[name]);
      }
    }
  },
  /**
   * 娓呯┖琛ㄥ崟
   * @param  {HTMLElement} form 琛ㄥ崟鍏冪礌
   */
  clear: function(form) {
    var elements = $.makeArray(form.elements);

    BUI.each(elements, function(element) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        $(element).attr('checked', false);
      } else {
        $(element).val('');
      }
      $(element).change();
    });
  },
  /**
   * 璁剧疆琛ㄥ崟瀛楁
   * @param {HTMLElement} form 琛ㄥ崟鍏冪礌
   * @param {string} field 瀛楁鍚�
   * @param {string} value 瀛楁鍊�
   */
  setField: function(form, fieldName, value) {
    var fields = form.elements[fieldName];
    if (fields && fields.type) {
      FormHelper._setFieldValue(fields, value);
    } else if (BUI.isArray(fields) || (fields && fields.length)) {
      BUI.each(fields, function(field) {
        FormHelper._setFieldValue(field, value);
      });
    }
  },
  //璁剧疆瀛楁鐨勫€�
  _setFieldValue: function(field, value) {
    if (field.type === 'checkbox') {
      if (field.value == '' + value || (BUI.isArray(value) && BUI.Array.indexOf(field.value, value) !== -1)) {
        $(field).attr('checked', true);
      } else {
        $(field).attr('checked', false);
      }
    } else if (field.type === 'radio') {
      if (field.value == '' + value) {
        $(field).attr('checked', true);
      } else {
        $(field).attr('checked', false);
      }
    } else {
      $(field).val(value);
    }
  },
  /**
   * 鑾峰彇琛ㄥ崟瀛楁鍊�
   * @param {HTMLElement} form 琛ㄥ崟鍏冪礌
   * @param {string} field 瀛楁鍚�
   * @return {String}   瀛楁鍊�
   */
  getField: function(form, fieldName) {
    return BUI.FormHelper.serializeToObject(form)[fieldName];
  }
};


BUI.FormHelper = FormHelper;

module.exports = BUI;

});
define("bui/common/ua", ["jquery"], function(require, exports, module){
/**
 * @fileOverview UA,jQuery鐨� $.browser 瀵硅薄闈炲父闅句娇鐢�
 * @ignore
 * @author dxq613@gmail.com
 */

var $ = require("jquery");

function numberify(s) {
  var c = 0;
  // convert '1.2.3.4' to 1.234
  return parseFloat(s.replace(/\./g, function() {
    return (c++ === 0) ? '.' : '';
  }));
};

function uaMatch(s) {
  s = s.toLowerCase();
  var r = /(chrome)[ \/]([\w.]+)/.exec(s) || /(webkit)[ \/]([\w.]+)/.exec(s) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(s) || /(msie) ([\w.]+)/.exec(s) || s.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(s) || [],
    a = {
      browser: r[1] || "",
      version: r[2] || "0"
    },
    b = {};
  a.browser && (b[a.browser] = !0, b.version = a.version),
  b.chrome ? b.webkit = !0 : b.webkit && (b.safari = !0);
  return b;
}

var UA = $.UA || (function() {
  var browser = $.browser || uaMatch(navigator.userAgent),
    versionNumber = numberify(browser.version),
    /**
     * 娴忚鍣ㄧ増鏈娴�
     * @class BUI.UA
     * @singleton
     */
    ua = {
      /**
       * ie 鐗堟湰
       * @type {Number}
       */
      ie: browser.msie && versionNumber,

      /**
       * webkit 鐗堟湰
       * @type {Number}
       */
      webkit: browser.webkit && versionNumber,
      /**
       * opera 鐗堟湰
       * @type {Number}
       */
      opera: browser.opera && versionNumber,
      /**
       * mozilla 鐏嫄鐗堟湰
       * @type {Number}
       */
      mozilla: browser.mozilla && versionNumber
    };
  return ua;
})();

module.exports = UA;

});
define("bui/common/json", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鐢变簬jQuery鍙湁 parseJSON 锛屾病鏈塻tringify鎵€浠ヤ娇鐢ㄨ繃绋嬩笉鏂逛究
 * @ignore
 */

var $ = require("jquery"),
  UA = require("bui/common/ua"),
  win = window,
  JSON = win.JSON;

// ie 8.0.7600.16315@win7 json 鏈夐棶棰�
if (!JSON || UA['ie'] < 9) {
  JSON = win.JSON = {};
}

function f(n) {
  // Format integers to have at least two digits.
  return n < 10 ? '0' + n : n;
}

if (typeof Date.prototype.toJSON !== 'function') {

  Date.prototype.toJSON = function(key) {

    return isFinite(this.valueOf()) ?
      this.getUTCFullYear() + '-' +
      f(this.getUTCMonth() + 1) + '-' +
      f(this.getUTCDate()) + 'T' +
      f(this.getUTCHours()) + ':' +
      f(this.getUTCMinutes()) + ':' +
      f(this.getUTCSeconds()) + 'Z' : null;
  };

  String.prototype.toJSON =
    Number.prototype.toJSON =
    Boolean.prototype.toJSON = function(key) {
      return this.valueOf();
  };
}


var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
  escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
  gap,
  indent,
  meta = { // table of character substitutions
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '"': '\\"',
    '\\': '\\\\'
  },
  rep;

function quote(string) {

  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

  escapable['lastIndex'] = 0;
  return escapable.test(string) ?
    '"' + string.replace(escapable, function(a) {
      var c = meta[a];
      return typeof c === 'string' ? c :
        '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' :
    '"' + string + '"';
}

function str(key, holder) {

  // Produce a string from holder[key].

  var i, // The loop counter.
    k, // The member key.
    v, // The member value.
    length,
    mind = gap,
    partial,
    value = holder[key];

  // If the value has a toJSON method, call it to obtain a replacement value.

  if (value && typeof value === 'object' &&
    typeof value.toJSON === 'function') {
    value = value.toJSON(key);
  }

  // If we were called with a replacer function, then call the replacer to
  // obtain a replacement value.

  if (typeof rep === 'function') {
    value = rep.call(holder, key, value);
  }

  // What happens next depends on the value's type.

  switch (typeof value) {
    case 'string':
      return quote(value);

    case 'number':

      // JSON numbers must be finite. Encode non-finite numbers as null.

      return isFinite(value) ? String(value) : 'null';

    case 'boolean':
    case 'null':

      // If the value is a boolean or null, convert it to a string. Note:
      // typeof null does not produce 'null'. The case is included here in
      // the remote chance that this gets fixed someday.

      return String(value);

      // If the type is 'object', we might be dealing with an object or an array or
      // null.

    case 'object':

      // Due to a specification blunder in ECMAScript, typeof null is 'object',
      // so watch out for that case.

      if (!value) {
        return 'null';
      }

      // Make an array to hold the partial results of stringifying this object value.

      gap += indent;
      partial = [];

      // Is the value an array?

      if (Object.prototype.toString.apply(value) === '[object Array]') {

        // The value is an array. Stringify every element. Use null as a placeholder
        // for non-JSON values.

        length = value.length;
        for (i = 0; i < length; i += 1) {
          partial[i] = str(i, value) || 'null';
        }

        // Join all of the elements together, separated with commas, and wrap them in
        // brackets.

        v = partial.length === 0 ? '[]' :
          gap ? '[\n' + gap +
          partial.join(',\n' + gap) + '\n' +
          mind + ']' :
          '[' + partial.join(',') + ']';
        gap = mind;
        return v;
      }

      // If the replacer is an array, use it to select the members to be stringified.

      if (rep && typeof rep === 'object') {
        length = rep.length;
        for (i = 0; i < length; i += 1) {
          k = rep[i];
          if (typeof k === 'string') {
            v = str(k, value);
            if (v) {
              partial.push(quote(k) + (gap ? ': ' : ':') + v);
            }
          }
        }
      } else {

        // Otherwise, iterate through all of the keys in the object.

        for (k in value) {
          if (Object.hasOwnProperty.call(value, k)) {
            v = str(k, value);
            if (v) {
              partial.push(quote(k) + (gap ? ': ' : ':') + v);
            }
          }
        }
      }

      // Join all of the member texts together, separated with commas,
      // and wrap them in braces.

      v = partial.length === 0 ? '{}' :
        gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
        mind + '}' : '{' + partial.join(',') + '}';
      gap = mind;
      return v;
  }
}

if (typeof JSON.stringify !== 'function') {
  JSON.stringify = function(value, replacer, space) {

    // The stringify method takes a value and an optional replacer, and an optional
    // space parameter, and returns a JSON text. The replacer can be a function
    // that can replace values, or an array of strings that will select the keys.
    // A default replacer method can be provided. Use of the space parameter can
    // produce text that is more easily readable.

    var i;
    gap = '';
    indent = '';

    // If the space parameter is a number, make an indent string containing that
    // many spaces.

    if (typeof space === 'number') {
      for (i = 0; i < space; i += 1) {
        indent += ' ';
      }

      // If the space parameter is a string, it will be used as the indent string.

    } else if (typeof space === 'string') {
      indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.

    rep = replacer;
    if (replacer && typeof replacer !== 'function' &&
      (typeof replacer !== 'object' ||
        typeof replacer.length !== 'number')) {
      throw new Error('JSON.stringify');
    }

    // Make a fake root object containing our value under the key of ''.
    // Return the result of stringifying the value.

    return str('', {
      '': value
    });
  };
}

function looseParse(data) {
  try {
    return new Function('return ' + data + ';')();
  } catch (e) {
    throw 'Json parse error!';
  }
}
/**
 * JSON 鏍煎紡鍖�
 * @class BUI.JSON
 * @singleton
 */
var JSON = {
  /**
   * 杞垚json 绛夊悓浜�$.parseJSON
   * @method
   * @param {String} jsonstring 鍚堟硶鐨刯son 瀛楃涓�
   */
  parse: $.parseJSON,
  /**
   * 涓氬姟涓湁浜涘瓧绗︿覆缁勬垚鐨刯son鏁版嵁涓嶆槸涓ユ牸鐨刯son鏁版嵁锛屽浣跨敤鍗曞紩鍙凤紝鎴栬€呭睘鎬у悕涓嶆槸瀛楃涓�
   * 濡� 锛� {a:'abc'}
   * @method
   * @param {String} jsonstring
   */
  looseParse: looseParse,
  /**
   * 灏咼son杞垚瀛楃涓�
   * @method
   * @param {Object} json json 瀵硅薄
   */
  stringify: JSON.stringify
}

module.exports = JSON;

});
define("bui/common/date", [], function(require, exports, module){
/*
 * @fileOverview Date Format 1.2.3
 * @ignore
 * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
 * MIT license
 *
 * Includes enhancements by Scott Trenda <scott.trenda.net>
 * and Kris Kowal <cixar.com/~kris.kowal/>
 *
 * Accepts a date, a mask, or a date and a mask.
 * Returns a formatted version of the given date.
 * The date defaults to the current date/time.
 * The mask defaults to dateFormat.masks.default.
 *
 * Last modified by jayli 鎷旇丹 2010-09-09
 * - 澧炲姞涓枃鐨勬敮鎸�
 * - 绠€鍗曠殑鏈湴鍖栵紝瀵箇锛堟槦鏈焫锛夌殑鏀寔
 *
 */

var dateRegex = /^(?:(?!0000)[0-9]{4}([-/.]+)(?:(?:0?[1-9]|1[0-2])\1(?:0?[1-9]|1[0-9]|2[0-8])|(?:0?[13-9]|1[0-2])\1(?:29|30)|(?:0?[13578]|1[02])\1(?:31))|(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:0[48]|[2468][048]|[13579][26])00)([-/.]?)0?2\2(?:29))(\s+([01]|([01][0-9]|2[0-3])):([0-9]|[0-5][0-9]):([0-9]|[0-5][0-9]))?$/;

function dateParse(val, format) {
  if (val instanceof Date) {
    return val;
  }
  if (typeof(format) == "undefined" || format == null || format == "") {
    var checkList = new Array('y-m-d', 'yyyy-mm-dd', 'yyyy-mm-dd HH:MM:ss', 'H:M:s');
    for (var i = 0; i < checkList.length; i++) {
      var d = dateParse(val, checkList[i]);
      if (d != null) {
        return d;
      }
    }
    return null;
  };
  val = val + "";
  var i_val = 0;
  var i_format = 0;
  var c = "";
  var token = "";
  var x, y;
  var now = new Date();
  var year = now.getYear();
  var month = now.getMonth() + 1;
  var date = 1;
  var hh = 00;
  var mm = 00;
  var ss = 00;
  this.isInteger = function(val) {
    return /^\d*$/.test(val);
  };
  this.getInt = function(str, i, minlength, maxlength) {
    for (var x = maxlength; x >= minlength; x--) {
      var token = str.substring(i, i + x);
      if (token.length < minlength) {
        return null;
      }
      if (this.isInteger(token)) {
        return token;
      }
    }
    return null;
  };

  while (i_format < format.length) {
    c = format.charAt(i_format);
    token = "";
    while ((format.charAt(i_format) == c) && (i_format < format.length)) {
      token += format.charAt(i_format++);
    }
    if (token == "yyyy" || token == "yy" || token == "y") {
      if (token == "yyyy") {
        x = 4;
        y = 4;
      }
      if (token == "yy") {
        x = 2;
        y = 2;
      }
      if (token == "y") {
        x = 2;
        y = 4;
      }
      year = this.getInt(val, i_val, x, y);
      if (year == null) {
        return null;
      }
      i_val += year.length;
      if (year.length == 2) {
        year = year > 70 ? 1900 + (year - 0) : 2000 + (year - 0);
      }
    } else if (token == "mm" || token == "m") {
      month = this.getInt(val, i_val, token.length, 2);
      if (month == null || (month < 1) || (month > 12)) {
        return null;
      }
      i_val += month.length;
    } else if (token == "dd" || token == "d") {
      date = this.getInt(val, i_val, token.length, 2);
      if (date == null || (date < 1) || (date > 31)) {
        return null;
      }
      i_val += date.length;
    } else if (token == "hh" || token == "h") {
      hh = this.getInt(val, i_val, token.length, 2);
      if (hh == null || (hh < 1) || (hh > 12)) {
        return null;
      }
      i_val += hh.length;
    } else if (token == "HH" || token == "H") {
      hh = this.getInt(val, i_val, token.length, 2);
      if (hh == null || (hh < 0) || (hh > 23)) {
        return null;
      }
      i_val += hh.length;
    } else if (token == "MM" || token == "M") {
      mm = this.getInt(val, i_val, token.length, 2);
      if (mm == null || (mm < 0) || (mm > 59)) {
        return null;
      }
      i_val += mm.length;
    } else if (token == "ss" || token == "s") {
      ss = this.getInt(val, i_val, token.length, 2);
      if (ss == null || (ss < 0) || (ss > 59)) {
        return null;
      }
      i_val += ss.length;
    } else {
      if (val.substring(i_val, i_val + token.length) != token) {
        return null;
      } else {
        i_val += token.length;
      }
    }
  }
  if (i_val != val.length) {
    return null;
  }
  if (month == 2) {
    if (((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)) { // leap year
      if (date > 29) {
        return null;
      }
    } else {
      if (date > 28) {
        return null;
      }
    }
  }
  if ((month == 4) || (month == 6) || (month == 9) || (month == 11)) {
    if (date > 30) {
      return null;
    }
  }
  return new Date(year, month - 1, date, hh, mm, ss);
}

function DateAdd(strInterval, NumDay, dtDate) {
  var dtTmp = new Date(dtDate);
  if (isNaN(dtTmp)) {
    dtTmp = new Date();
  }
  NumDay = parseInt(NumDay, 10);
  switch (strInterval) {
    case 's':
      dtTmp = new Date(dtTmp.getTime() + (1000 * NumDay));
      break;
    case 'n':
      dtTmp = new Date(dtTmp.getTime() + (60000 * NumDay));
      break;
    case 'h':
      dtTmp = new Date(dtTmp.getTime() + (3600000 * NumDay));
      break;
    case 'd':
      dtTmp = new Date(dtTmp.getTime() + (86400000 * NumDay));
      break;
    case 'w':
      dtTmp = new Date(dtTmp.getTime() + ((86400000 * 7) * NumDay));
      break;
    case 'm':
      dtTmp = new Date(dtTmp.getFullYear(), (dtTmp.getMonth()) + NumDay, dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds());
      break;
    case 'y':
      //alert(dtTmp.getFullYear());
      dtTmp = new Date(dtTmp.getFullYear() + NumDay, dtTmp.getMonth(), dtTmp.getDate(), dtTmp.getHours(), dtTmp.getMinutes(), dtTmp.getSeconds());
      //alert(dtTmp);
      break;
  }
  return dtTmp;
}

var dateFormat = function() {
  var token = /w{1}|d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
    timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
    timezoneClip = /[^-+\dA-Z]/g,
    pad = function(val, len) {
      val = String(val);
      len = len || 2;
      while (val.length < len) {
        val = '0' + val;
      }
      return val;
    },
    // Some common format strings
    masks = {
      'default': 'ddd mmm dd yyyy HH:MM:ss',
      shortDate: 'm/d/yy',
      //mediumDate:   'mmm d, yyyy',
      longDate: 'mmmm d, yyyy',
      fullDate: 'dddd, mmmm d, yyyy',
      shortTime: 'h:MM TT',
      //mediumTime:   'h:MM:ss TT',
      longTime: 'h:MM:ss TT Z',
      isoDate: 'yyyy-mm-dd',
      isoTime: 'HH:MM:ss',
      isoDateTime: "yyyy-mm-dd'T'HH:MM:ss",
      isoUTCDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'",

      //added by jayli
      localShortDate: 'yy骞磎m鏈坉d鏃�',
      localShortDateTime: 'yy骞磎m鏈坉d鏃� hh:MM:ss TT',
      localLongDate: 'yyyy骞磎m鏈坉d鏃�',
      localLongDateTime: 'yyyy骞磎m鏈坉d鏃� hh:MM:ss TT',
      localFullDate: 'yyyy骞磎m鏈坉d鏃� w',
      localFullDateTime: 'yyyy骞磎m鏈坉d鏃� w hh:MM:ss TT'

    },

    // Internationalization strings
    i18n = {
      dayNames: [
        'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
        '鏄熸湡鏃�', '鏄熸湡涓€', '鏄熸湡浜�', '鏄熸湡涓�', '鏄熸湡鍥�', '鏄熸湡浜�', '鏄熸湡鍏�'
      ],
      monthNames: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
      ]
    };

  // Regexes and supporting functions are cached through closure
  return function(date, mask, utc) {

    // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
    if (arguments.length === 1 && Object.prototype.toString.call(date) === '[object String]' && !/\d/.test(date)) {
      mask = date;
      date = undefined;
    }

    // Passing date through Date applies Date.parse, if necessary
    date = date ? new Date(date) : new Date();
    if (isNaN(date)) {
      throw SyntaxError('invalid date');
    }

    mask = String(masks[mask] || mask || masks['default']);

    // Allow setting the utc argument via the mask
    if (mask.slice(0, 4) === 'UTC:') {
      mask = mask.slice(4);
      utc = true;
    }

    var _ = utc ? 'getUTC' : 'get',
      d = date[_ + 'Date'](),
      D = date[_ + 'Day'](),
      m = date[_ + 'Month'](),
      y = date[_ + 'FullYear'](),
      H = date[_ + 'Hours'](),
      M = date[_ + 'Minutes'](),
      s = date[_ + 'Seconds'](),
      L = date[_ + 'Milliseconds'](),
      o = utc ? 0 : date.getTimezoneOffset(),
      flags = {
        d: d,
        dd: pad(d, undefined),
        ddd: i18n.dayNames[D],
        dddd: i18n.dayNames[D + 7],
        w: i18n.dayNames[D + 14],
        m: m + 1,
        mm: pad(m + 1, undefined),
        mmm: i18n.monthNames[m],
        mmmm: i18n.monthNames[m + 12],
        yy: String(y).slice(2),
        yyyy: y,
        h: H % 12 || 12,
        hh: pad(H % 12 || 12, undefined),
        H: H,
        HH: pad(H, undefined),
        M: M,
        MM: pad(M, undefined),
        s: s,
        ss: pad(s, undefined),
        l: pad(L, 3),
        L: pad(L > 99 ? Math.round(L / 10) : L, undefined),
        t: H < 12 ? 'a' : 'p',
        tt: H < 12 ? 'am' : 'pm',
        T: H < 12 ? 'A' : 'P',
        TT: H < 12 ? 'AM' : 'PM',
        Z: utc ? 'UTC' : (String(date).match(timezone) || ['']).pop().replace(timezoneClip, ''),
        o: (o > 0 ? '-' : '+') + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
        S: ['th', 'st', 'nd', 'rd'][d % 10 > 3 ? 0 : (d % 100 - d % 10 !== 10) * d % 10]
      };

    return mask.replace(token, function($0) {
      return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
    });
  };
}();

/**
 * 鏃ユ湡鐨勫伐鍏锋柟娉�
 * @class BUI.Date
 */
var DateUtil = {
  /**
   * 鏃ユ湡鍔犳硶
   * @param {String} strInterval 鍔犳硶鐨勭被鍨嬶紝s(绉�),n(鍒�),h(鏃�),d(澶�),w(鍛�),m(鏈�),y(骞�)
   * @param {Number} Num     鏁伴噺锛屽鏋滀负璐熸暟锛屽垯涓哄噺娉�
   * @param {Date} dtDate    璧峰鏃ユ湡锛岄粯璁や负姝ゆ椂
   */
  add: function(strInterval, Num, dtDate) {
    return DateAdd(strInterval, Num, dtDate);
  },
  /**
   * 灏忔椂鐨勫姞娉�
   * @param {Number} hours 灏忔椂
   * @param {Date} date 璧峰鏃ユ湡
   */
  addHour: function(hours, date) {
    return DateAdd('h', hours, date);
  },
  /**
   * 鍒嗙殑鍔犳硶
   * @param {Number} minutes 鍒�
   * @param {Date} date 璧峰鏃ユ湡
   */
  addMinute: function(minutes, date) {
    return DateAdd('n', minutes, date);
  },
  /**
   * 绉掔殑鍔犳硶
   * @param {Number} seconds 绉�
   * @param {Date} date 璧峰鏃ユ湡
   */
  addSecond: function(seconds, date) {
    return DateAdd('s', seconds, date);
  },
  /**
   * 澶╃殑鍔犳硶
   * @param {Number} days 澶╂暟
   * @param {Date} date 璧峰鏃ユ湡
   */
  addDay: function(days, date) {
    return DateAdd('d', days, date);
  },
  /**
   * 澧炲姞鍛�
   * @param {Number} weeks 鍛ㄦ暟
   * @param {Date} date  璧峰鏃ユ湡
   */
  addWeek: function(weeks, date) {
    return DateAdd('w', weeks, date);
  },
  /**
   * 澧炲姞鏈�
   * @param {Number} months 鏈堟暟
   * @param {Date} date  璧峰鏃ユ湡
   */
  addMonths: function(months, date) {
    return DateAdd('m', months, date);
  },
  /**
   * 澧炲姞骞�
   * @param {Number} years 骞存暟
   * @param {Date} date  璧峰鏃ユ湡
   */
  addYear: function(years, date) {
    return DateAdd('y', years, date);
  },
  /**
   * 鏃ユ湡鏄惁鐩哥瓑锛屽拷鐣ユ椂闂�
   * @param  {Date}  d1 鏃ユ湡瀵硅薄
   * @param  {Date}  d2 鏃ユ湡瀵硅薄
   * @return {Boolean}  鏄惁鐩哥瓑
   */
  isDateEquals: function(d1, d2) {

    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  },
  /**
   * 鏃ユ湡鏃堕棿鏄惁鐩哥瓑锛屽寘鍚椂闂�
   * @param  {Date}  d1 鏃ユ湡瀵硅薄
   * @param  {Date}  d2 鏃ユ湡瀵硅薄
   * @return {Boolean}  鏄惁鐩哥瓑
   */
  isEquals: function(d1, d2) {
    if (d1 == d2) {
      return true;
    }
    if (!d1 || !d2) {
      return false;
    }
    if (!d1.getTime || !d2.getTime) {
      return false;
    }
    return d1.getTime() == d2.getTime();
  },
  /**
   * 瀛楃涓叉槸鍚︽槸鏈夋晥鐨勬棩鏈熺被鍨�
   * @param {String} str 瀛楃涓�
   * @return 瀛楃涓叉槸鍚﹁兘杞崲鎴愭棩鏈�
   */
  isDateString: function(str) {
    return dateRegex.test(str);
  },
  /**
   * 灏嗘棩鏈熸牸寮忓寲鎴愬瓧绗︿覆
   * @param  {Date} date 鏃ユ湡
   * @param  {String} mask 鏍煎紡鍖栨柟寮�
   * @param  {Date} utc  鏄惁utc鏃堕棿
   * @return {String}    鏃ユ湡鐨勫瓧绗︿覆
   */
  format: function(date, mask, utc) {
    return dateFormat(date, mask, utc);
  },
  /**
   * 杞崲鎴愭棩鏈�
   * @param  {String|Date} date 瀛楃涓叉垨鑰呮棩鏈�
   * @param  {String} dateMask  鏃ユ湡鐨勬牸寮�,濡�:yyyy-MM-dd
   * @return {Date}    鏃ユ湡瀵硅薄
   */
  parse: function(date, s) {
    if (BUI.isString(date)) {
      date = date.replace('\/', '-');
    }
    return dateParse(date, s);
  },
  /**
   * 褰撳墠澶�
   * @return {Date} 褰撳墠澶� 00:00:00
   */
  today: function() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  },
  /**
   * 杩斿洖褰撳墠鏃ユ湡
   * @return {Date} 鏃ユ湡鐨� 00:00:00
   */
  getDate: function(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
};

module.exports = DateUtil;

});
define("bui/common/array", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鏁扮粍甯姪绫�
 * @ignore
 */

/**
 * @class BUI
 * 鎺т欢搴撶殑鍩虹鍛藉悕绌洪棿
 * @singleton
 */


var BUI = require("bui/common/util");
/**
 * @class BUI.Array
 * 鏁扮粍甯姪绫�
 */
var ArrayUtil = {
  /**
   * 杩斿洖鏁扮粍鐨勬渶鍚庝竴涓璞�
   * @param {Array} array 鏁扮粍鎴栬€呯被浼间簬鏁扮粍鐨勫璞�.
   * @return {*} 鏁扮粍鐨勬渶鍚庝竴椤�.
   */
  peek: function(array) {
    return array[array.length - 1];
  },
  /**
   * 鏌ユ壘璁板綍鎵€鍦ㄧ殑浣嶇疆
   * @param  {*} value 鍊�
   * @param  {Array} array 鏁扮粍鎴栬€呯被浼间簬鏁扮粍鐨勫璞�
   * @param  {Number} [fromIndex=0] 璧峰椤癸紝榛樿涓�0
   * @return {Number} 浣嶇疆锛屽鏋滀负 -1鍒欎笉鍦ㄦ暟缁勫唴
   */
  indexOf: function(value, array, opt_fromIndex) {
    var fromIndex = opt_fromIndex == null ?
      0 : (opt_fromIndex < 0 ?
        Math.max(0, array.length + opt_fromIndex) : opt_fromIndex);

    for (var i = fromIndex; i < array.length; i++) {
      if (i in array && array[i] === value)
        return i;
    }
    return -1;
  },
  /**
   * 鏁扮粍鏄惁瀛樺湪鎸囧畾鍊�
   * @param  {*} value 鍊�
   * @param  {Array} array 鏁扮粍鎴栬€呯被浼间簬鏁扮粍鐨勫璞�
   * @return {Boolean} 鏄惁瀛樺湪浜庢暟缁勪腑
   */
  contains: function(value, array) {
    return ArrayUtil.indexOf(value, array) >= 0;
  },
  /**
   * 閬嶅巻鏁扮粍鎴栬€呭璞�
   * @method
   * @param {Object|Array} element/Object 鏁扮粍涓殑鍏冪礌鎴栬€呭璞＄殑鍊�
   * @param {Function} func 閬嶅巻鐨勫嚱鏁� function(elememt,index){} 鎴栬€� function(value,key){}
   */
  each: BUI.each,
  /**
   * 2涓暟缁勫唴閮ㄧ殑鍊兼槸鍚︾浉绛�
   * @param  {Array} a1 鏁扮粍1
   * @param  {Array} a2 鏁扮粍2
   * @return {Boolean} 2涓暟缁勭浉绛夋垨鑰呭唴閮ㄥ厓绱犳槸鍚︾浉绛�
   */
  equals: function(a1, a2) {
    if (a1 == a2) {
      return true;
    }
    if (!a1 || !a2) {
      return false;
    }

    if (a1.length != a2.length) {
      return false;
    }
    var rst = true;
    for (var i = 0; i < a1.length; i++) {
      if (a1[i] !== a2[i]) {
        rst = false;
        break;
      }
    }
    return rst;
  },

  /**
   * 杩囨护鏁扮粍
   * @param {Object|Array} element/Object 鏁扮粍涓殑鍏冪礌鎴栬€呭璞＄殑鍊�
   * @param {Function} func 閬嶅巻鐨勫嚱鏁� function(elememt,index){} 鎴栬€� function(value,key){},濡傛灉杩斿洖true鍒欐坊鍔犲埌缁撴灉闆�
   * @return {Array} 杩囨护鐨勭粨鏋滈泦
   */
  filter: function(array, func) {
    var result = [];
    ArrayUtil.each(array, function(value, index) {
      if (func(value, index)) {
        result.push(value);
      }
    });
    return result;
  },
  /**
   * 杞崲鏁扮粍鏁扮粍
   * @param {Object|Array} element/Object 鏁扮粍涓殑鍏冪礌鎴栬€呭璞＄殑鍊�
   * @param {Function} func 閬嶅巻鐨勫嚱鏁� function(elememt,index){} 鎴栬€� function(value,key){},灏嗚繑鍥炵殑缁撴灉娣诲姞鍒扮粨鏋滈泦
   * @return {Array} 杩囨护鐨勭粨鏋滈泦
   */
  map: function(array, func) {
    var result = [];
    ArrayUtil.each(array, function(value, index) {
      result.push(func(value, index));
    });
    return result;
  },
  /**
   * 鑾峰彇绗竴涓鍚堟潯浠剁殑鏁版嵁
   * @param  {Array} array 鏁扮粍
   * @param  {Function} func  鍖归厤鍑芥暟
   * @return {*}  绗﹀悎鏉′欢鐨勬暟鎹�
   */
  find: function(array, func) {
    var i = ArrayUtil.findIndex(array, func);
    return i < 0 ? null : array[i];
  },
  /**
   * 鑾峰彇绗竴涓鍚堟潯浠剁殑鏁版嵁鐨勭储寮曞€�
   * @param  {Array} array 鏁扮粍
   * @param  {Function} func  鍖归厤鍑芥暟
   * @return {Number} 绗﹀悎鏉′欢鐨勬暟鎹殑绱㈠紩鍊�
   */
  findIndex: function(array, func) {
    var result = -1;
    ArrayUtil.each(array, function(value, index) {
      if (func(value, index)) {
        result = index;
        return false;
      }
    });
    return result;
  },
  /**
   * 鏁扮粍鏄惁涓虹┖
   * @param  {Array}  array 鏁扮粍
   * @return {Boolean}  鏄惁涓虹┖
   */
  isEmpty: function(array) {
    return array.length == 0;
  },
  /**
   * 鎻掑叆鏁扮粍
   * @param  {Array} array 鏁扮粍
   * @param  {Number} index 浣嶇疆
   * @param {*} value 鎻掑叆鐨勬暟鎹�
   */
  add: function(array, value) {
    array.push(value);
  },
  /**
   * 灏嗘暟鎹彃鍏ユ暟缁勬寚瀹氱殑浣嶇疆
   * @param  {Array} array 鏁扮粍
   * @param {*} value 鎻掑叆鐨勬暟鎹�
   * @param  {Number} index 浣嶇疆
   */
  addAt: function(array, value, index) {
    ArrayUtil.splice(array, index, 0, value);
  },
  /**
   * 娓呯┖鏁扮粍
   * @param  {Array} array 鏁扮粍
   * @return {Array}  娓呯┖鍚庣殑鏁扮粍
   */
  empty: function(array) {
    if (!(array instanceof(Array))) {
      for (var i = array.length - 1; i >= 0; i--) {
        delete array[i];
      }
    }
    array.length = 0;
  },
  /**
   * 绉婚櫎璁板綍
   * @param  {Array} array 鏁扮粍
   * @param  {*} value 璁板綍
   * @return {Boolean}   鏄惁绉婚櫎鎴愬姛
   */
  remove: function(array, value) {
    var i = ArrayUtil.indexOf(value, array);
    var rv;
    if ((rv = i >= 0)) {
      ArrayUtil.removeAt(array, i);
    }
    return rv;
  },
  /**
   * 绉婚櫎鎸囧畾浣嶇疆鐨勮褰�
   * @param  {Array} array 鏁扮粍
   * @param  {Number} index 绱㈠紩鍊�
   * @return {Boolean}   鏄惁绉婚櫎鎴愬姛
   */
  removeAt: function(array, index) {
    return ArrayUtil.splice(array, index, 1).length == 1;
  },
  /**
   * @private
   */
  slice: function(arr, start, opt_end) {
    if (arguments.length <= 2) {
      return Array.prototype.slice.call(arr, start);
    } else {
      return Array.prototype.slice.call(arr, start, opt_end);
    }
  },
  /**
   * @private
   */
  splice: function(arr, index, howMany, var_args) {
    return Array.prototype.splice.apply(arr, ArrayUtil.slice(arguments, 1))
  }

};

module.exports = ArrayUtil;

});
define("bui/common/keycode", [], function(require, exports, module){
/**
 * @fileOverview 閿洏鍊�
 * @ignore
 */

/**
 * 閿洏鎸夐敭瀵瑰簲鐨勬暟瀛楀€�
 * @class BUI.KeyCode
 * @singleton
 */
var keyCode = {
  /** Key constant @type Number */
  BACKSPACE: 8,
  /** Key constant @type Number */
  TAB: 9,
  /** Key constant @type Number */
  NUM_CENTER: 12,
  /** Key constant @type Number */
  ENTER: 13,
  /** Key constant @type Number */
  RETURN: 13,
  /** Key constant @type Number */
  SHIFT: 16,
  /** Key constant @type Number */
  CTRL: 17,
  /** Key constant @type Number */
  ALT: 18,
  /** Key constant @type Number */
  PAUSE: 19,
  /** Key constant @type Number */
  CAPS_LOCK: 20,
  /** Key constant @type Number */
  ESC: 27,
  /** Key constant @type Number */
  SPACE: 32,
  /** Key constant @type Number */
  PAGE_UP: 33,
  /** Key constant @type Number */
  PAGE_DOWN: 34,
  /** Key constant @type Number */
  END: 35,
  /** Key constant @type Number */
  HOME: 36,
  /** Key constant @type Number */
  LEFT: 37,
  /** Key constant @type Number */
  UP: 38,
  /** Key constant @type Number */
  RIGHT: 39,
  /** Key constant @type Number */
  DOWN: 40,
  /** Key constant @type Number */
  PRINT_SCREEN: 44,
  /** Key constant @type Number */
  INSERT: 45,
  /** Key constant @type Number */
  DELETE: 46,
  /** Key constant @type Number */
  ZERO: 48,
  /** Key constant @type Number */
  ONE: 49,
  /** Key constant @type Number */
  TWO: 50,
  /** Key constant @type Number */
  THREE: 51,
  /** Key constant @type Number */
  FOUR: 52,
  /** Key constant @type Number */
  FIVE: 53,
  /** Key constant @type Number */
  SIX: 54,
  /** Key constant @type Number */
  SEVEN: 55,
  /** Key constant @type Number */
  EIGHT: 56,
  /** Key constant @type Number */
  NINE: 57,
  /** Key constant @type Number */
  A: 65,
  /** Key constant @type Number */
  B: 66,
  /** Key constant @type Number */
  C: 67,
  /** Key constant @type Number */
  D: 68,
  /** Key constant @type Number */
  E: 69,
  /** Key constant @type Number */
  F: 70,
  /** Key constant @type Number */
  G: 71,
  /** Key constant @type Number */
  H: 72,
  /** Key constant @type Number */
  I: 73,
  /** Key constant @type Number */
  J: 74,
  /** Key constant @type Number */
  K: 75,
  /** Key constant @type Number */
  L: 76,
  /** Key constant @type Number */
  M: 77,
  /** Key constant @type Number */
  N: 78,
  /** Key constant @type Number */
  O: 79,
  /** Key constant @type Number */
  P: 80,
  /** Key constant @type Number */
  Q: 81,
  /** Key constant @type Number */
  R: 82,
  /** Key constant @type Number */
  S: 83,
  /** Key constant @type Number */
  T: 84,
  /** Key constant @type Number */
  U: 85,
  /** Key constant @type Number */
  V: 86,
  /** Key constant @type Number */
  W: 87,
  /** Key constant @type Number */
  X: 88,
  /** Key constant @type Number */
  Y: 89,
  /** Key constant @type Number */
  Z: 90,
  /** Key constant @type Number */
  CONTEXT_MENU: 93,
  /** Key constant @type Number */
  NUM_ZERO: 96,
  /** Key constant @type Number */
  NUM_ONE: 97,
  /** Key constant @type Number */
  NUM_TWO: 98,
  /** Key constant @type Number */
  NUM_THREE: 99,
  /** Key constant @type Number */
  NUM_FOUR: 100,
  /** Key constant @type Number */
  NUM_FIVE: 101,
  /** Key constant @type Number */
  NUM_SIX: 102,
  /** Key constant @type Number */
  NUM_SEVEN: 103,
  /** Key constant @type Number */
  NUM_EIGHT: 104,
  /** Key constant @type Number */
  NUM_NINE: 105,
  /** Key constant @type Number */
  NUM_MULTIPLY: 106,
  /** Key constant @type Number */
  NUM_PLUS: 107,
  /** Key constant @type Number */
  NUM_MINUS: 109,
  /** Key constant @type Number */
  NUM_PERIOD: 110,
  /** Key constant @type Number */
  NUM_DIVISION: 111,
  /** Key constant @type Number */
  F1: 112,
  /** Key constant @type Number */
  F2: 113,
  /** Key constant @type Number */
  F3: 114,
  /** Key constant @type Number */
  F4: 115,
  /** Key constant @type Number */
  F5: 116,
  /** Key constant @type Number */
  F6: 117,
  /** Key constant @type Number */
  F7: 118,
  /** Key constant @type Number */
  F8: 119,
  /** Key constant @type Number */
  F9: 120,
  /** Key constant @type Number */
  F10: 121,
  /** Key constant @type Number */
  F11: 122,
  /** Key constant @type Number */
  F12: 123
};

module.exports = keyCode;

});
define("bui/common/observable", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 瑙傚療鑰呮ā寮忓疄鐜颁簨浠�
 * @ignore
 */

var $ = require("jquery");

var BUI = require("bui/common/util"),
  ArrayUtil = require("bui/common/array");
/**
 * @private
 * @class BUI.Observable.Callbacks
 * jquery 1.7 鏃跺瓨鍦� $.Callbacks,浣嗘槸fireWith鐨勮繑鍥炵粨鏋滄槸$.Callbacks 瀵硅薄锛�
 * 鑰屾垜浠兂瑕佺殑鏁堟灉鏄細褰撳叾涓湁涓€涓嚱鏁拌繑鍥炰负false鏃讹紝闃绘鍚庨潰鐨勬墽琛岋紝骞惰繑鍥瀎alse
 */
var Callbacks = function() {
  this._init();
};

BUI.augment(Callbacks, {

  _functions: null,

  _init: function() {
    var _self = this;

    _self._functions = [];
  },
  /**
   * 娣诲姞鍥炶皟鍑芥暟
   * @param {Function} fn 鍥炶皟鍑芥暟
   */
  add: function(fn) {
    this._functions.push(fn);
  },
  /**
   * 绉婚櫎鍥炶皟鍑芥暟
   * @param  {Function} fn 鍥炶皟鍑芥暟
   */
  remove: function(fn) {
    var functions = this._functions;
    index = ArrayUtil.indexOf(fn, functions);
    if (index >= 0) {
      functions.splice(index, 1);
    }
  },
  /**
   * 娓呯┖浜嬩欢
   */
  empty: function() {
    var length = this._functions.length; //ie6,7涓嬶紝蹇呴』鎸囧畾闇€瑕佸垹闄ょ殑鏁伴噺
    this._functions.splice(0, length);
  },
  /**
   * 鏆傚仠浜嬩欢
   */
  pause: function() {
    this._paused = true;
  },
  /**
   * 鍞ら啋浜嬩欢
   */
  resume: function() {
    this._paused = false;
  },
  /**
   * 瑙﹀彂鍥炶皟
   * @param  {Object} scope 涓婁笅鏂�
   * @param  {Array} args  鍥炶皟鍑芥暟鐨勫弬鏁�
   * @return {Boolean|undefined} 褰撳叾涓湁涓€涓嚱鏁拌繑鍥炰负false鏃讹紝闃绘鍚庨潰鐨勬墽琛岋紝骞惰繑鍥瀎alse
   */
  fireWith: function(scope, args) {
    var _self = this,
      rst;
    if (_self._paused) {
      return;
    }
    BUI.each(_self._functions, function(fn) {
      rst = fn.apply(scope, args);
      if (rst === false) {
        return false;
      }
    });
    return rst;
  }
});

function getCallbacks() {
  return new Callbacks();
}
/**
 * 鏀寔浜嬩欢鐨勫璞★紝鍙傝€冭瀵熻€呮ā寮�
 *  - 姝ょ被鎻愪緵浜嬩欢缁戝畾
 *  - 鎻愪緵浜嬩欢鍐掓场鏈哄埗
 *
 * <pre><code>
 *   var control = new Control();
 *   control.on('click',function(ev){
 *
 *   });
 *
 *   control.off();  //绉婚櫎鎵€鏈変簨浠�
 * </code></pre>
 * @class BUI.Observable
 * @abstract
 * @param {Object} config 閰嶇疆椤归敭鍊煎
 */
var Observable = function(config) {
  this._events = [];
  this._eventMap = {};
  this._bubblesEvents = [];
  this._initEvents(config);
};

BUI.augment(Observable, {

  /**
   * @cfg {Object} listeners
   *  鍒濆鍖栦簨浠�,蹇€熸敞鍐屼簨浠�
   *  <pre><code>
   *    var list = new BUI.List.SimpleList({
   *      listeners : {
   *        itemclick : function(ev){},
   *        itemrendered : function(ev){}
   *      },
   *      items : []
   *    });
   *    list.render();
   *  </code></pre>
   */

  /**
   * @cfg {Function} handler
   * 鐐瑰嚮浜嬩欢鐨勫鐞嗗嚱鏁帮紝蹇€熼厤缃偣鍑讳簨浠惰€屼笉闇€瑕佸啓listeners灞炴€�
   * <pre><code>
   *    var list = new BUI.List.SimpleList({
   *      handler : function(ev){} //click 浜嬩欢
   *    });
   *    list.render();
   *  </code></pre>
   */

  /**
   * 鏀寔鐨勪簨浠跺悕鍒楄〃
   * @private
   */
  _events: [],

  /**
   * 缁戝畾鐨勪簨浠�
   * @private
   */
  _eventMap: {},

  _bubblesEvents: [],

  _bubbleTarget: null,

  //鑾峰彇鍥炶皟闆嗗悎
  _getCallbacks: function(eventType) {
    var _self = this,
      eventMap = _self._eventMap;
    return eventMap[eventType];
  },
  //鍒濆鍖栦簨浠跺垪琛�
  _initEvents: function(config) {
    var _self = this,
      listeners = null;

    if (!config) {
      return;
    }
    listeners = config.listeners || {};
    if (config.handler) {
      listeners.click = config.handler;
    }
    if (listeners) {
      for (var name in listeners) {
        if (listeners.hasOwnProperty(name)) {
          _self.on(name, listeners[name]);
        }
      };
    }
  },
  //浜嬩欢鏄惁鏀寔鍐掓场
  _isBubbles: function(eventType) {
    return ArrayUtil.indexOf(eventType, this._bubblesEvents) >= 0;
  },
  /**
   * 娣诲姞鍐掓场鐨勫璞�
   * @protected
   * @param {Object} target  鍐掓场鐨勪簨浠舵簮
   */
  addTarget: function(target) {
    this._bubbleTarget = target;
  },
  /**
   * 娣诲姞鏀寔鐨勪簨浠�
   * @protected
   * @param {String|String[]} events 浜嬩欢
   */
  addEvents: function(events) {
    var _self = this,
      existEvents = _self._events,
      eventMap = _self._eventMap;

    function addEvent(eventType) {
      if (ArrayUtil.indexOf(eventType, existEvents) === -1) {
        eventMap[eventType] = getCallbacks();
        existEvents.push(eventType);
      }
    }
    if (BUI.isArray(events)) {
      BUI.each(events, function(eventType) {
        addEvent(eventType);
      });
    } else {
      addEvent(events);
    }
  },
  /**
   * 绉婚櫎鎵€鏈夌粦瀹氱殑浜嬩欢
   * @protected
   */
  clearListeners: function() {
    var _self = this,
      eventMap = _self._eventMap;
    for (var name in eventMap) {
      if (eventMap.hasOwnProperty(name)) {
        eventMap[name].empty();
      }
    }
  },
  /**
   * 瑙﹀彂浜嬩欢
   * <pre><code>
   *   //缁戝畾浜嬩欢
   *   list.on('itemclick',function(ev){
   *     alert('21');
   *   });
   *   //瑙﹀彂浜嬩欢
   *   list.fire('itemclick');
   * </code></pre>
   * @param  {String} eventType 浜嬩欢绫诲瀷
   * @param  {Object} eventData 浜嬩欢瑙﹀彂鏃朵紶閫掔殑鏁版嵁
   * @return {Boolean|undefined}  濡傛灉鍏朵腑涓€涓簨浠跺鐞嗗櫒杩斿洖 false , 鍒欒繑鍥� false, 鍚﹀垯杩斿洖鏈€鍚庝竴涓簨浠跺鐞嗗櫒鐨勮繑鍥炲€�
   */
  fire: function(eventType, eventData) {
    var _self = this,
      callbacks = _self._getCallbacks(eventType),
      args = $.makeArray(arguments),
      result;
    if (!eventData) {
      eventData = {};
      args.push(eventData);
    }
    if (!eventData.target) {
      eventData.target = _self;
    }
    if (callbacks) {
      result = callbacks.fireWith(_self, Array.prototype.slice.call(args, 1));
    }
    if (_self._isBubbles(eventType)) {
      var bubbleTarget = _self._bubbleTarget;
      if (bubbleTarget && bubbleTarget.fire) {
        bubbleTarget.fire(eventType, eventData);
      }
    }
    return result;
  },
  /**
   * 鏆傚仠浜嬩欢鐨勬墽琛�
   * <pre><code>
   *  list.pauseEvent('itemclick');
   * </code></pre>
   * @param  {String} eventType 浜嬩欢绫诲瀷
   */
  pauseEvent: function(eventType) {
    var _self = this,
      callbacks = _self._getCallbacks(eventType);
    callbacks && callbacks.pause();
  },
  /**
   * 鍞ら啋浜嬩欢
   * <pre><code>
   *  list.resumeEvent('itemclick');
   * </code></pre>
   * @param  {String} eventType 浜嬩欢绫诲瀷
   */
  resumeEvent: function(eventType) {
    var _self = this,
      callbacks = _self._getCallbacks(eventType);
    callbacks && callbacks.resume();
  },
  /**
   * 娣诲姞缁戝畾浜嬩欢
   * <pre><code>
   *   //缁戝畾鍗曚釜浜嬩欢
   *   list.on('itemclick',function(ev){
   *     alert('21');
   *   });
   *   //缁戝畾澶氫釜浜嬩欢
   *   list.on('itemrendered itemupdated',function(){
   *     //鍒楄〃椤瑰垱寤恒€佹洿鏂版椂瑙﹀彂鎿嶄綔
   *   });
   * </code></pre>
   * @param  {String}   eventType 浜嬩欢绫诲瀷
   * @param  {Function} fn        鍥炶皟鍑芥暟
   */
  on: function(eventType, fn) {
    //涓€娆＄洃鍚涓簨浠�
    var arr = eventType.split(' '),
      _self = this,
      callbacks = null;
    if (arr.length > 1) {
      BUI.each(arr, function(name) {
        _self.on(name, fn);
      });
    } else {
      callbacks = _self._getCallbacks(eventType);
      if (callbacks) {
        callbacks.add(fn);
      } else {
        _self.addEvents(eventType);
        _self.on(eventType, fn);
      }
    }
    return _self;
  },
  /**
   * 绉婚櫎缁戝畾鐨勪簨浠�
   * <pre><code>
   *  //绉婚櫎鎵€鏈変簨浠�
   *  list.off();
   *
   *  //绉婚櫎鐗瑰畾浜嬩欢
   *  function callback(ev){}
   *  list.on('click',callback);
   *
   *  list.off('click',callback);//闇€瑕佷繚瀛樺洖璋冨嚱鏁扮殑寮曠敤
   *
   * </code></pre>
   * @param  {String}   eventType 浜嬩欢绫诲瀷
   * @param  {Function} fn        鍥炶皟鍑芥暟
   */
  off: function(eventType, fn) {
    if (!eventType && !fn) {
      this.clearListeners();
      return this;
    }
    var _self = this,
      callbacks = _self._getCallbacks(eventType);
    if (callbacks) {
      if (fn) {
        callbacks.remove(fn);
      } else {
        callbacks.empty();
      }

    }
    return _self;
  },
  /**
   * 閰嶇疆浜嬩欢鏄惁鍏佽鍐掓场
   * @protected
   * @param  {String} eventType 鏀寔鍐掓场鐨勪簨浠�
   * @param  {Object} cfg 閰嶇疆椤�
   * @param {Boolean} cfg.bubbles 鏄惁鏀寔鍐掓场
   */
  publish: function(eventType, cfg) {
    var _self = this,
      bubblesEvents = _self._bubblesEvents;

    if (cfg.bubbles) {
      if (BUI.Array.indexOf(eventType, bubblesEvents) === -1) {
        bubblesEvents.push(eventType);
      }
    } else {
      var index = BUI.Array.indexOf(eventType, bubblesEvents);
      if (index !== -1) {
        bubblesEvents.splice(index, 1);
      }
    }
  }
});

module.exports = Observable;

});
define("bui/common/base", ["jquery"], function(require, exports, module){
/**
 * @fileOverview  Base UI鎺т欢鐨勬渶鍩虹鐨勭被
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery");

var INVALID = {},
  Observable = require("bui/common/observable");

function ensureNonEmpty(obj, name, create) {
  var ret = obj[name] || {};
  if (create) {
    obj[name] = ret;
  }
  return ret;
}

function normalFn(host, method) {
  if (BUI.isString(method)) {
    return host[method];
  }
  return method;
}

function __fireAttrChange(self, when, name, prevVal, newVal) {
  var attrName = name;
  return self.fire(when + BUI.ucfirst(name) + 'Change', {
    attrName: attrName,
    prevVal: prevVal,
    newVal: newVal
  });
}

function setInternal(self, name, value, opts, attrs) {
  opts = opts || {};

  var ret,
    subVal,
    prevVal;

  prevVal = self.get(name);

  //濡傛灉鏈敼鍙樺€间笉杩涜淇敼
  if (!$.isPlainObject(value) && !BUI.isArray(value) && prevVal === value) {
    return undefined;
  }
  // check before event
  if (!opts['silent']) {
    if (false === __fireAttrChange(self, 'before', name, prevVal, value)) {
      return false;
    }
  }
  // set it
  ret = self._set(name, value, opts);

  if (ret === false) {
    return ret;
  }

  // fire after event
  if (!opts['silent']) {
    value = self.__attrVals[name];
    __fireAttrChange(self, 'after', name, prevVal, value);
  }
  return self;
}

function initClassAttrs(c) {
  if (c._attrs || c == Base) {
    return;
  }

  var superCon = c.superclass.constructor;
  if (superCon && !superCon._attrs) {
    initClassAttrs(superCon);
  }
  c._attrs = {};

  BUI.mixAttrs(c._attrs, superCon._attrs);
  BUI.mixAttrs(c._attrs, c.ATTRS);
}
/**
 * 鍩虹绫伙紝姝ょ被鎻愪緵浠ヤ笅鍔熻兘
 *  - 鎻愪緵璁剧疆鑾峰彇灞炴€�
 *  - 鎻愪緵浜嬩欢鏀寔
 *  - 灞炴€у彉鍖栨椂浼氳Е鍙戝搴旂殑浜嬩欢
 *  - 灏嗛厤缃」鑷姩杞崲鎴愬睘鎬�
 *
 * ** 鍒涘缓绫伙紝缁ф壙BUI.Base绫� **
 * <pre><code>
 *   var Control = function(cfg){
 *     Control.superclass.constructor.call(this,cfg); //璋冪敤BUI.Base鐨勬瀯閫犳柟娉曪紝灏嗛厤缃」鍙樻垚灞炴€�
 *   };
 *
 *   BUI.extend(Control,BUI.Base);
 * </code></pre>
 *
 * ** 澹版槑榛樿灞炴€� **
 * <pre><code>
 *   Control.ATTRS = {
 *     id : {
 *       value : 'id' //value 鏄灞炴€х殑榛樿鍊�
 *     },
 *     renderTo : {
 *
 *     },
 *     el : {
 *       valueFn : function(){                 //绗竴娆¤皟鐢ㄧ殑鏃跺€欏皢renderTo鐨凞OM杞崲鎴恊l灞炴€�
 *         return $(this.get('renderTo'));
 *       }
 *     },
 *     text : {
 *       getter : function(){ //getter 鐢ㄤ簬鑾峰彇鍊硷紝鑰屼笉鏄缃殑鍊�
 *         return this.get('el').val();
 *       },
 *       setter : function(v){ //涓嶄粎浠呮槸璁剧疆鍊硷紝鍙互杩涜鐩稿簲鐨勬搷浣�
 *         this.get('el').val(v);
 *       }
 *     }
 *   };
 * </code></pre>
 *
 * ** 澹版槑绫荤殑鏂规硶 **
 * <pre><code>
 *   BUI.augment(Control,{
 *     getText : function(){
 *       return this.get('text');   //鍙互鐢╣et鏂规硶鑾峰彇灞炴€у€�
 *     },
 *     setText : function(txt){
 *       this.set('text',txt);      //浣跨敤set 璁剧疆灞炴€у€�
 *     }
 *   });
 * </code></pre>
 *
 * ** 鍒涘缓瀵硅薄 **
 * <pre><code>
 *   var c = new Control({
 *     id : 'oldId',
 *     text : '娴嬭瘯鏂囨湰',
 *     renderTo : '#t1'
 *   });
 *
 *   var el = c.get(el); //$(#t1);
 *   el.val(); //text鐨勫€� 锛� '娴嬭瘯鏂囨湰'
 *   c.set('text','淇敼鐨勫€�');
 *   el.val();  //'淇敼鐨勫€�'
 *
 *   c.set('id','newId') //浼氳Е鍙�2涓簨浠讹細 beforeIdChange,afterIdChange 2涓簨浠� ev.newVal 鍜宔v.prevVal鏍囩ず鏂版棫鍊�
 * </code></pre>
 * @class BUI.Base
 * @abstract
 * @extends BUI.Observable
 * @param {Object} config 閰嶇疆椤�
 */
var Base = function(config) {
  var _self = this,
    c = _self.constructor,
    constructors = [];
  this.__attrs = {};
  this.__attrVals = {};
  Observable.apply(this, arguments);
  // define
  while (c) {
    constructors.push(c);
    if (c.extensions) { //寤惰繜鎵цmixin
      BUI.mixin(c, c.extensions);
      delete c.extensions;
    }
    //_self.addAttrs(c['ATTRS']);
    c = c.superclass ? c.superclass.constructor : null;
  }
  //浠ュ綋鍓嶅璞＄殑灞炴€ф渶缁堟坊鍔犲埌灞炴€т腑锛岃鐩栦箣鍓嶇殑灞炴€�
  /*for (var i = constructors.length - 1; i >= 0; i--) {
        _self.addAttrs(constructors[i]['ATTRS'],true);
      };*/
  var con = _self.constructor;
  initClassAttrs(con);
  _self._initStaticAttrs(con._attrs);
  _self._initAttrs(config);
};

Base.INVALID = INVALID;

BUI.extend(Base, Observable);

BUI.augment(Base, {
  _initStaticAttrs: function(attrs) {
    var _self = this,
      __attrs;

    __attrs = _self.__attrs = {};
    for (var p in attrs) {
      if (attrs.hasOwnProperty(p)) {
        var attr = attrs[p];
        /*if(BUI.isObject(attr.value) || BUI.isArray(attr.value) || attr.valueFn){*/
        if (attr.shared === false || attr.valueFn) {
          __attrs[p] = {};
          BUI.mixAttr(__attrs[p], attrs[p]);
        } else {
          __attrs[p] = attrs[p];
        }
      }
    };
  },
  /**
   * 娣诲姞灞炴€у畾涔�
   * @protected
   * @param {String} name       灞炴€у悕
   * @param {Object} attrConfig 灞炴€у畾涔�
   * @param {Boolean} overrides 鏄惁瑕嗙洊瀛楁
   */
  addAttr: function(name, attrConfig, overrides) {
    var _self = this,
      attrs = _self.__attrs,
      attr = attrs[name];

    if (!attr) {
      attr = attrs[name] = {};
    }
    for (var p in attrConfig) {
      if (attrConfig.hasOwnProperty(p)) {
        if (p == 'value') {
          if (BUI.isObject(attrConfig[p])) {
            attr[p] = attr[p] || {};
            BUI.mix( /*true,*/ attr[p], attrConfig[p]);
          } else if (BUI.isArray(attrConfig[p])) {
            attr[p] = attr[p] || [];
            BUI.mix( /*true,*/ attr[p], attrConfig[p]);
          } else {
            attr[p] = attrConfig[p];
          }
        } else {
          attr[p] = attrConfig[p];
        }
      }

    };
    return _self;
  },
  /**
   * 娣诲姞灞炴€у畾涔�
   * @protected
   * @param {Object} attrConfigs  An object with attribute name/configuration pairs.
   * @param {Object} initialValues user defined initial values
   * @param {Boolean} overrides 鏄惁瑕嗙洊瀛楁
   */
  addAttrs: function(attrConfigs, initialValues, overrides) {
    var _self = this;
    if (!attrConfigs) {
      return _self;
    }
    if (typeof(initialValues) === 'boolean') {
      overrides = initialValues;
      initialValues = null;
    }
    BUI.each(attrConfigs, function(attrConfig, name) {
      _self.addAttr(name, attrConfig, overrides);
    });
    if (initialValues) {
      _self.set(initialValues);
    }
    return _self;
  },
  /**
   * 鏄惁鍖呭惈姝ゅ睘鎬�
   * @protected
   * @param  {String}  name 鍊�
   * @return {Boolean} 鏄惁鍖呭惈
   */
  hasAttr: function(name) {
    return name && this.__attrs.hasOwnProperty(name);
  },
  /**
   * 鑾峰彇榛樿鐨勫睘鎬у€�
   * @protected
   * @return {Object} 灞炴€у€肩殑閿€煎
   */
  getAttrs: function() {
    return this.__attrs; //ensureNonEmpty(this, '__attrs', true);
  },
  /**
   * 鑾峰彇灞炴€у悕/灞炴€у€奸敭鍊煎
   * @protected
   * @return {Object} 灞炴€у璞�
   */
  getAttrVals: function() {
    return this.__attrVals; //ensureNonEmpty(this, '__attrVals', true);
  },
  /**
   * 鑾峰彇灞炴€у€硷紝鎵€鏈夌殑閰嶇疆椤瑰拰灞炴€ч兘鍙互閫氳繃get鏂规硶鑾峰彇
   * <pre><code>
   *  var control = new Control({
   *   text : 'control text'
   *  });
   *  control.get('text'); //control text
   *
   *  control.set('customValue','value'); //涓存椂鍙橀噺
   *  control.get('customValue'); //value
   * </code></pre>
   * ** 灞炴€у€�/閰嶇疆椤� **
   * <pre><code>
   *   Control.ATTRS = { //澹版槑灞炴€у€�
   *     text : {
   *       valueFn : function(){},
   *       value : 'value',
   *       getter : function(v){}
   *     }
   *   };
   *   var c = new Control({
   *     text : 'text value'
   *   });
   *   //get 鍑芥暟鍙栫殑椤哄簭涓猴細鏄惁鏈変慨鏀瑰€硷紙閰嶇疆椤广€乻et)銆侀粯璁ゅ€硷紙绗竴娆¤皟鐢ㄦ墽琛寁alueFn)锛屽鏋滄湁getter锛屽垯灏嗗€间紶鍏etter杩斿洖
   *
   *   c.get('text') //text value
   *   c.set('text','new text');//淇敼鍊�
   *   c.get('text');//new text
   * </code></pre>
   * @param  {String} name 灞炴€у悕
   * @return {Object} 灞炴€у€�
   */
  get: function(name) {
    var _self = this,
      //declared = _self.hasAttr(name),
      attrVals = _self.__attrVals,
      attrConfig,
      getter,
      ret;

    attrConfig = ensureNonEmpty(_self.__attrs, name);
    getter = attrConfig['getter'];

    // get user-set value or default value
    //user-set value takes privilege
    ret = name in attrVals ?
      attrVals[name] :
      _self._getDefAttrVal(name);

    // invoke getter for this attribute
    if (getter && (getter = normalFn(_self, getter))) {
      ret = getter.call(_self, ret, name);
    }

    return ret;
  },
  /**
   * @娓呯悊鎵€鏈夊睘鎬у€�
   * @protected
   */
  clearAttrVals: function() {
    this.__attrVals = {};
  },
  /**
   * 绉婚櫎灞炴€у畾涔�
   * @protected
   */
  removeAttr: function(name) {
    var _self = this;

    if (_self.hasAttr(name)) {
      delete _self.__attrs[name];
      delete _self.__attrVals[name];
    }

    return _self;
  },
  /**
   * 璁剧疆灞炴€у€硷紝浼氳Е鍙慴efore+Name+Change,鍜� after+Name+Change浜嬩欢
   * <pre><code>
   *  control.on('beforeTextChange',function(ev){
   *    var newVal = ev.newVal,
   *      attrName = ev.attrName,
   *      preVal = ev.prevVal;
   *
   *    //TO DO
   *  });
   *  control.set('text','new text');  //姝ゆ椂瑙﹀彂 beforeTextChange,afterTextChange
   *  control.set('text','modify text',{silent : true}); //姝ゆ椂涓嶈Е鍙戜簨浠�
   * </code></pre>
   * @param {String|Object} name  灞炴€у悕
   * @param {Object} value 鍊�
   * @param {Object} opts 閰嶇疆椤�
   * @param {Boolean} opts.silent  閰嶇疆灞炴€ф椂锛屾槸鍚︿笉瑙﹀彂浜嬩欢
   */
  set: function(name, value, opts) {
    var _self = this;
    if ($.isPlainObject(name)) {
      opts = value;
      var all = Object(name),
        attrs = [];

      for (name in all) {
        if (all.hasOwnProperty(name)) {
          setInternal(_self, name, all[name], opts);
        }
      }
      return _self;
    }
    return setInternal(_self, name, value, opts);
  },
  /**
   * 璁剧疆灞炴€э紝涓嶈Е鍙戜簨浠�
   * <pre><code>
   *  control.setInternal('text','text');//姝ゆ椂涓嶈Е鍙戜簨浠�
   * </code></pre>
   * @param  {String} name  灞炴€у悕
   * @param  {Object} value 灞炴€у€�
   * @return {Boolean|undefined}   濡傛灉鍊兼棤鏁堝垯杩斿洖false,鍚﹀垯杩斿洖undefined
   */
  setInternal: function(name, value, opts) {
    return this._set(name, value, opts);
  },
  //鑾峰彇灞炴€ч粯璁ゅ€�
  _getDefAttrVal: function(name) {
    var _self = this,
      attrs = _self.__attrs,
      attrConfig = ensureNonEmpty(attrs, name),
      valFn = attrConfig.valueFn,
      val;

    if (valFn && (valFn = normalFn(_self, valFn))) {
      val = valFn.call(_self);
      if (val !== undefined) {
        attrConfig.value = val;
      }
      delete attrConfig.valueFn;
      attrs[name] = attrConfig;
    }

    return attrConfig.value;
  },
  //浠呬粎璁剧疆灞炴€у€�
  _set: function(name, value, opts) {
    var _self = this,
      setValue,
      // if host does not have meta info corresponding to (name,value)
      // then register on demand in order to collect all data meta info
      // 涓€瀹氳娉ㄥ唽灞炴€у厓鏁版嵁锛屽惁鍒欏叾浠栨ā鍧楅€氳繃 _attrs 涓嶈兘鏋氫妇鍒版墍鏈夋湁鏁堝睘鎬�
      // 鍥犱负灞炴€у湪澹版槑娉ㄥ唽鍓嶅彲浠ョ洿鎺ヨ缃€�
      attrConfig = ensureNonEmpty(_self.__attrs, name, true),
      setter = attrConfig['setter'];

    // if setter has effect
    if (setter && (setter = normalFn(_self, setter))) {
      setValue = setter.call(_self, value, name);
    }

    if (setValue === INVALID) {
      return false;
    }

    if (setValue !== undefined) {
      value = setValue;
    }

    // finally set
    _self.__attrVals[name] = value;
    return _self;
  },
  //鍒濆鍖栧睘鎬�
  _initAttrs: function(config) {
    var _self = this;
    if (config) {
      for (var attr in config) {
        if (config.hasOwnProperty(attr)) {
          // 鐢ㄦ埛璁剧疆浼氳皟鐢� setter/validator 鐨勶紝浣嗕笉浼氳Е鍙戝睘鎬у彉鍖栦簨浠�
          _self._set(attr, config[attr]);
        }

      }
    }
  }
});
module.exports = Base;

});
define("bui/common/component/component", ["jquery"], function(require, exports, module){
/**
 * @fileOverview Component鍛藉悕绌洪棿鐨勫叆鍙ｆ枃浠�
 * @ignore
 */

/**
 * @class BUI.Component
 * <p>
 * <img src="../assets/img/class-common.jpg"/>
 * </p>
 * 鎺т欢鍩虹被鐨勫懡鍚嶇┖闂�
 */
var Component = {};

BUI.mix(Component, {
  Manager: require("bui/common/component/manage"),
  UIBase: require("bui/common/component/uibase/uibase"),
  View: require("bui/common/component/view"),
  Controller: require("bui/common/component/controller")
});

function create(component, self) {
  var childConstructor, xclass;
  if (component && (xclass = component.xclass)) {
    if (self && !component.prefixCls) {
      component.prefixCls = self.get('prefixCls');
    }
    childConstructor = Component.Manager.getConstructorByXClass(xclass);
    if (!childConstructor) {
      BUI.error('can not find class by xclass desc : ' + xclass);
    }
    component = new childConstructor(component);
  }
  return component;
}

/**
 * 鏍规嵁Xclass鍒涘缓瀵硅薄
 * @method
 * @static
 * @param  {Object} component 鎺т欢鐨勯厤缃」鎴栬€呮帶浠�
 * @param  {Object} self      鐖剁被瀹炰緥
 * @return {Object} 瀹炰緥瀵硅薄
 */
Component.create = create;

module.exports = Component;

});
define("bui/common/component/manage", ["jquery"], function(require, exports, module){
/**
 * @fileOverview  Base UI鎺т欢鐨勭鐞嗙被
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */



//鎺т欢绫荤殑绠＄悊鍣�


var $ = require("jquery");

var uis = {
  // 涓嶅甫鍓嶇紑 prefixCls
  /*
         "menu" :{
         priority:0,
         constructor:Menu
         }
         */
};

function getConstructorByXClass(cls) {
  var cs = cls.split(/\s+/),
    p = -1,
    t,
    ui = null;
  for (var i = 0; i < cs.length; i++) {
    var uic = uis[cs[i]];
    if (uic && (t = uic.priority) > p) {
      p = t;
      ui = uic.constructor;
    }
  }
  return ui;
}

function getXClassByConstructor(constructor) {
  for (var u in uis) {
    var ui = uis[u];
    if (ui.constructor == constructor) {
      return u;
    }
  }
  return 0;
}

function setConstructorByXClass(cls, uic) {
  if (BUI.isFunction(uic)) {
    uis[cls] = {
      constructor: uic,
      priority: 0
    };
  } else {
    uic.priority = uic.priority || 0;
    uis[cls] = uic;
  }
}


function getCssClassWithPrefix(cls) {
  var cs = $.trim(cls).split(/\s+/);
  for (var i = 0; i < cs.length; i++) {
    if (cs[i]) {
      cs[i] = this.get('prefixCls') + cs[i];
    }
  }
  return cs.join(' ');
}



var componentInstances = {};

/**
 * Manage component metadata.
 * @class BUI.Component.Manager
 * @singleton
 */
var Manager = {

  __instances: componentInstances,
  /**
   * 姣忓疄渚嬪寲涓€涓帶浠讹紝灏辨敞鍐屽埌绠＄悊鍣ㄤ笂
   * @param {String} id  鎺т欢 id
   * @param {BUI.Component.Controller} component 鎺т欢瀵硅薄
   */
  addComponent: function(id, component) {
    componentInstances[id] = component;
  },
  /**
   * 绉婚櫎娉ㄥ唽鐨勬帶浠�
   * @param  {String} id 鎺т欢 id
   */
  removeComponent: function(id) {
    delete componentInstances[id];
  },
  /**
   * 閬嶅巻鎵€鏈夌殑鎺т欢
   * @param  {Function} fn 閬嶅巻鍑芥暟
   */
  eachComponent: function(fn) {
    BUI.each(componentInstances, fn);
  },
  /**
   * 鏍规嵁Id鑾峰彇鎺т欢
   * @param  {String} id 缂栧彿
   * @return {BUI.Component.UIBase}   缁ф壙 UIBase鐨勭被瀵硅薄
   */
  getComponent: function(id) {
    return componentInstances[id];
  },

  getCssClassWithPrefix: getCssClassWithPrefix,
  /**
   * 閫氳繃鏋勯€犲嚱鏁拌幏鍙杧class.
   * @param {Function} constructor 鎺т欢鐨勬瀯閫犲嚱鏁�.
   * @type {Function}
   * @return {String}
   * @method
   */
  getXClassByConstructor: getXClassByConstructor,
  /**
   * 閫氳繃xclass鑾峰彇鎺т欢鐨勬瀯閫犲嚱鏁�
   * @param {String} classNames Class names separated by space.
   * @type {Function}
   * @return {Function}
   * @method
   */
  getConstructorByXClass: getConstructorByXClass,
  /**
   * 灏� xclass 鍚屾瀯閫犲嚱鏁扮浉鍏宠仈.
   * @type {Function}
   * @param {String} className 鎺т欢鐨剎class鍚嶇О.
   * @param {Function} componentConstructor 鏋勯€犲嚱鏁�
   * @method
   */
  setConstructorByXClass: setConstructorByXClass
};

module.exports = Manager;

});
define("bui/common/component/uibase/uibase", ["jquery"], function(require, exports, module){
/**
 * @fileOverview uibase鐨勫叆鍙ｆ枃浠�
 * @ignore
 */
var UIBase = require("bui/common/component/uibase/base");

BUI.mix(UIBase, {
  Align: require("bui/common/component/uibase/align"),
  AutoShow: require("bui/common/component/uibase/autoshow"),
  AutoHide: require("bui/common/component/uibase/autohide"),
  Close: require("bui/common/component/uibase/close"),
  Collapsable: require("bui/common/component/uibase/collapsable"),
  Drag: require("bui/common/component/uibase/drag"),
  KeyNav: require("bui/common/component/uibase/keynav"),
  List: require("bui/common/component/uibase/list"),
  ListItem: require("bui/common/component/uibase/listitem"),
  Mask: require("bui/common/component/uibase/mask"),
  Position: require("bui/common/component/uibase/position"),
  Selection: require("bui/common/component/uibase/selection"),
  StdMod: require("bui/common/component/uibase/stdmod"),
  Decorate: require("bui/common/component/uibase/decorate"),
  Tpl: require("bui/common/component/uibase/tpl"),
  ChildCfg: require("bui/common/component/uibase/childCfg"),
  Bindable: require("bui/common/component/uibase/bindable"),
  Depends: require("bui/common/component/uibase/depends")
});

BUI.mix(UIBase, {
  CloseView: UIBase.Close.View,
  CollapsableView: UIBase.Collapsable.View,
  ChildList: UIBase.List.ChildList,
  /*DomList : UIBase.List.DomList,
  DomListView : UIBase.List.DomList.View,*/
  ListItemView: UIBase.ListItem.View,
  MaskView: UIBase.Mask.View,
  PositionView: UIBase.Position.View,
  StdModView: UIBase.StdMod.View,
  TplView: UIBase.Tpl.View
});

module.exports = UIBase;

});
define("bui/common/component/uibase/base", ["jquery"], function(require, exports, module){
/**
 * @fileOverview  UI鎺т欢鐨勬祦绋嬫帶鍒�
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery");

var Manager = require("bui/common/component/manage"),

  UI_SET = '_uiSet',
  ATTRS = 'ATTRS',
  ucfirst = BUI.ucfirst,
  noop = $.noop,
  Base = require("bui/common/base");
/**
 * 妯℃嫙澶氱户鎵�
 * init attr using constructors ATTRS meta info
 * @ignore
 */
function initHierarchy(host, config) {
  callMethodByHierarchy(host, 'initializer', 'constructor');
}

function callMethodByHierarchy(host, mainMethod, extMethod) {
  var c = host.constructor,
    extChains = [],
    ext,
    main,
    exts,
    t;

  // define
  while (c) {

    // 鏀堕泦鎵╁睍绫�
    t = [];
    if (exts = c.mixins) {
      for (var i = 0; i < exts.length; i++) {
        ext = exts[i];
        if (ext) {
          if (extMethod != 'constructor') {
            //鍙皟鐢ㄧ湡姝ｈ嚜宸辨瀯閫犲櫒鍘熷瀷鐨勫畾涔夛紝缁ф壙鍘熷瀷閾句笂鐨勪笉瑕佺
            if (ext.prototype.hasOwnProperty(extMethod)) {
              ext = ext.prototype[extMethod];
            } else {
              ext = null;
            }
          }
          ext && t.push(ext);
        }
      }
    }

    // 鏀堕泦涓荤被
    // 鍙皟鐢ㄧ湡姝ｈ嚜宸辨瀯閫犲櫒鍘熷瀷鐨勫畾涔夛紝缁ф壙鍘熷瀷閾句笂鐨勪笉瑕佺 !important
    // 鎵€浠ヤ笉鐢ㄨ嚜宸卞湪 renderUI 涓皟鐢� superclass.renderUI 浜嗭紝UIBase 鏋勯€犲櫒鑷姩鎼滃
    // 浠ュ強 initializer 绛夊悓鐞�
    if (c.prototype.hasOwnProperty(mainMethod) && (main = c.prototype[mainMethod])) {
      t.push(main);
    }

    // 鍘熷湴 reverse
    if (t.length) {
      extChains.push.apply(extChains, t.reverse());
    }

    c = c.superclass && c.superclass.constructor;
  }

  // 鍒濆鍖栧嚱鏁�
  // 椤哄簭锛氱埗绫荤殑鎵€鏈夋墿灞曠被鍑芥暟 -> 鐖剁被瀵瑰簲鍑芥暟 -> 瀛愮被鐨勬墍鏈夋墿灞曞嚱鏁� -> 瀛愮被瀵瑰簲鍑芥暟
  for (i = extChains.length - 1; i >= 0; i--) {
    extChains[i] && extChains[i].call(host);
  }
}

/**
 * 閿€姣佺粍浠堕『搴忥細 瀛愮被 destructor -> 瀛愮被鎵╁睍 destructor -> 鐖剁被 destructor -> 鐖剁被鎵╁睍 destructor
 * @ignore
 */
function destroyHierarchy(host) {
  var c = host.constructor,
    extensions,
    d,
    i;

  while (c) {
    // 鍙Е鍙戣绫荤湡姝ｇ殑鏋愭瀯鍣紝鍜岀埗浜叉病鍏崇郴锛屾墍浠ヤ笉瑕佸湪瀛愮被鏋愭瀯鍣ㄤ腑璋冪敤 superclass
    if (c.prototype.hasOwnProperty('destructor')) {
      c.prototype.destructor.apply(host);
    }

    if ((extensions = c.mixins)) {
      for (i = extensions.length - 1; i >= 0; i--) {
        d = extensions[i] && extensions[i].prototype.__destructor;
        d && d.apply(host);
      }
    }

    c = c.superclass && c.superclass.constructor;
  }
}

/**
 * 鏋勫缓 鎻掍欢
 * @ignore
 */
function constructPlugins(plugins) {
  if (!plugins) {
    return;
  }
  BUI.each(plugins, function(plugin, i) {
    if (BUI.isFunction(plugin)) {
      plugins[i] = new plugin();
    }
  });
}

/**
 * 璋冪敤鎻掍欢鐨勬柟娉�
 * @ignore
 */
function actionPlugins(self, plugins, action) {
  if (!plugins) {
    return;
  }
  BUI.each(plugins, function(plugin, i) {
    if (plugin[action]) {
      plugin[action](self);
    }
  });
}

/**
 * 鏍规嵁灞炴€у彉鍖栬缃� UI
 * @ignore
 */
function bindUI(self) {
  /*var attrs = self.getAttrs(),
          attr,
          m;

      for (attr in attrs) {
          if (attrs.hasOwnProperty(attr)) {
              m = UI_SET + ucfirst(attr);
              if (self[m]) {
                  // 鑷姩缁戝畾浜嬩欢鍒板搴斿嚱鏁�
                  (function (attr, m) {
                      self.on('after' + ucfirst(attr) + 'Change', function (ev) {
                          // fix! 闃叉鍐掓场杩囨潵鐨�
                          if (ev.target === self) {
                              self[m](ev.newVal, ev);
                          }
                      });
                  })(attr, m);
              }
          }
      }
      */
}

/**
 * 鏍规嵁褰撳墠锛堝垵濮嬪寲锛夌姸鎬佹潵璁剧疆 UI
 * @ignore
 */
function syncUI(self) {
  var v,
    f,
    attrs = self.getAttrs();
  for (var a in attrs) {
    if (attrs.hasOwnProperty(a)) {
      var m = UI_SET + ucfirst(a);
      //瀛樺湪鏂规硶锛屽苟涓旂敤鎴疯缃簡鍒濆鍊兼垨鑰呭瓨鍦ㄩ粯璁ゅ€硷紝灏卞悓姝ョ姸鎬�
      if ((f = self[m])
        // 鐢ㄦ埛濡傛灉璁剧疆浜嗘樉寮忎笉鍚屾锛屽氨涓嶅悓姝ワ紝姣斿涓€浜涘€间粠 html 涓鍙栵紝涓嶉渶瑕佸悓姝ュ啀娆¤缃�
        && attrs[a].sync !== false && (v = self.get(a)) !== undefined) {
        f.call(self, v);
      }
    }
  }
}

/**
 * 鎺т欢搴撶殑鍩虹被锛屽寘鎷帶浠剁殑鐢熷懡鍛ㄦ湡,涓嬮潰鏄熀鏈殑鎵╁睍绫�
 * <p>
 * <img src="https://dxq613.github.io/assets/img/class-mixins.jpg"/>
 * </p>
 * @class BUI.Component.UIBase
 * @extends BUI.Base
 * @param  {Object} config 閰嶇疆椤�
 */
var UIBase = function(config) {

  var _self = this,
    id;

  // 璇诲彇鐢ㄦ埛璁剧疆鐨勫睘鎬у€煎苟璁剧疆鍒拌嚜韬�
  Base.apply(_self, arguments);

  //淇濆瓨鐢ㄦ埛浼犲叆鐨勯厤缃」
  _self.setInternal('userConfig', config);
  // 鎸夌収绫诲眰娆℃墽琛屽垵濮嬪嚱鏁帮紝涓荤被鎵ц initializer 鍑芥暟锛屾墿灞曠被鎵ц鏋勯€犲櫒鍑芥暟
  initHierarchy(_self, config);

  var listener,
    n,
    plugins = _self.get('plugins')
    /*,
          listeners = _self.get('listeners')*/
  ;

  constructPlugins(plugins);

  var xclass = _self.get('xclass');
  if (xclass) {
    _self.__xclass = xclass; //debug 鏂逛究
  }
  actionPlugins(_self, plugins, 'initializer');

  // 鏄惁鑷姩娓叉煋
  config && config.autoRender && _self.render();

};

UIBase.ATTRS = {


  /**
   * 鐢ㄦ埛浼犲叆鐨勯厤缃」
   * @type {Object}
   * @readOnly
   * @protected
   */
  userConfig: {

  },
  /**
   * 鏄惁鑷姩娓叉煋,濡傛灉涓嶈嚜鍔ㄦ覆鏌擄紝闇€瑕佺敤鎴疯皟鐢� render()鏂规硶
   * <pre><code>
   *  //榛樿鐘舵€佷笅鍒涘缓瀵硅薄锛屽苟娌℃湁杩涜render
   *  var control = new Control();
   *  control.render(); //闇€瑕佽皟鐢╮ender鏂规硶
   *
   *  //璁剧疆autoRender鍚庯紝涓嶉渶瑕佽皟鐢╮ender鏂规硶
   *  var control = new Control({
   *   autoRender : true
   *  });
   * </code></pre>
   * @cfg {Boolean} autoRender
   */
  /**
   * 鏄惁鑷姩娓叉煋,濡傛灉涓嶈嚜鍔ㄦ覆鏌擄紝闇€瑕佺敤鎴疯皟鐢� render()鏂规硶
   * @type {Boolean}
   * @ignore
   */
  autoRender: {
    value: false
  },
  /**
   * @type {Object}
   * 浜嬩欢澶勭悊鍑芥暟:
   *      {
   *        'click':function(e){}
   *      }
   *  @ignore
   */
  listeners: {
    value: {}
  },
  /**
   * 鎻掍欢闆嗗悎
   * <pre><code>
   *  var grid = new Grid({
   *    columns : [{},{}],
   *    plugins : [Grid.Plugins.RadioSelection]
   *  });
   * </code></pre>
   * @cfg {Array} plugins
   */
  /**
   * 鎻掍欢闆嗗悎
   * @type {Array}
   * @readOnly
   */
  plugins: {
    //value : []
  },
  /**
   * 鏄惁宸茬粡娓叉煋瀹屾垚
   * @type {Boolean}
   * @default  false
   * @readOnly
   */
  rendered: {
    value: false
  },
  /**
   * 鑾峰彇鎺т欢鐨� xclass
   * @readOnly
   * @type {String}
   * @protected
   */
  xclass: {
    valueFn: function() {
      return Manager.getXClassByConstructor(this.constructor);
    }
  }
};

BUI.extend(UIBase, Base);

BUI.augment(UIBase, {
  /**
   * 鍒涘缓DOM缁撴瀯
   * @protected
   */
  create: function() {
    var self = this;
    // 鏄惁鐢熸垚杩囪妭鐐�
    if (!self.get('created')) {
      /**
       * @event beforeCreateDom
       * fired before root node is created
       * @param e
       */
      self.fire('beforeCreateDom');
      callMethodByHierarchy(self, 'createDom', '__createDom');
      self._set('created', true);
      /**
       * @event afterCreateDom
       * fired when root node is created
       * @param e
       */
      self.fire('afterCreateDom');
      actionPlugins(self, self.get('plugins'), 'createDom');
    }
    return self;
  },
  /**
   * 娓叉煋
   */
  render: function() {
    var _self = this;
    // 鏄惁宸茬粡娓叉煋杩�
    if (!_self.get('rendered')) {
      var plugins = _self.get('plugins');
      _self.create(undefined);
      _self.set('created', true);
      /**
       * @event beforeRenderUI
       * fired when root node is ready
       * @param e
       */
      _self.fire('beforeRenderUI');
      callMethodByHierarchy(_self, 'renderUI', '__renderUI');

      /**
       * @event afterRenderUI
       * fired after root node is rendered into dom
       * @param e
       */

      _self.fire('afterRenderUI');
      actionPlugins(_self, plugins, 'renderUI');

      /**
       * @event beforeBindUI
       * fired before UIBase 's internal event is bind.
       * @param e
       */

      _self.fire('beforeBindUI');
      bindUI(_self);
      callMethodByHierarchy(_self, 'bindUI', '__bindUI');
      _self.set('binded', true);
      /**
       * @event afterBindUI
       * fired when UIBase 's internal event is bind.
       * @param e
       */

      _self.fire('afterBindUI');
      actionPlugins(_self, plugins, 'bindUI');

      /**
       * @event beforeSyncUI
       * fired before UIBase 's internal state is synchronized.
       * @param e
       */

      _self.fire('beforeSyncUI');

      syncUI(_self);
      callMethodByHierarchy(_self, 'syncUI', '__syncUI');

      /**
       * @event afterSyncUI
       * fired after UIBase 's internal state is synchronized.
       * @param e
       */

      _self.fire('afterSyncUI');
      actionPlugins(_self, plugins, 'syncUI');
      _self._set('rendered', true);
    }
    return _self;
  },
  /**
   * 瀛愮被鍙户鎵挎鏂规硶锛屽綋DOM鍒涘缓鏃惰皟鐢�
   * @protected
   * @method
   */
  createDom: noop,
  /**
   * 瀛愮被鍙户鎵挎鏂规硶锛屾覆鏌揢I鏃惰皟鐢�
   * @protected
   *  @method
   */
  renderUI: noop,
  /**
   * 瀛愮被鍙户鎵挎鏂规硶,缁戝畾浜嬩欢鏃惰皟鐢�
   * @protected
   * @method
   */
  bindUI: noop,
  /**
   * 鍚屾灞炴€у€煎埌UI涓�
   * @protected
   * @method
   */
  syncUI: noop,

  /**
   * 鏋愭瀯鍑芥暟
   */
  destroy: function() {
    var _self = this;
    if (_self.destroyed) { //闃叉杩斿洖閿€姣�
      return _self;
    }
    /**
     * @event beforeDestroy
     * fired before UIBase 's destroy.
     * @param e
     */
    _self.fire('beforeDestroy');

    actionPlugins(_self, _self.get('plugins'), 'destructor');
    destroyHierarchy(_self);
    /**
     * @event afterDestroy
     * fired before UIBase 's destroy.
     * @param e
     */
    _self.fire('afterDestroy');
    _self.off();
    _self.clearAttrVals();
    _self.destroyed = true;
    return _self;
  }
});

//寤舵椂澶勭悊鏋勯€犲嚱鏁�
function initConstuctor(c) {
  var constructors = [];
  while (c.base) {
    constructors.push(c);
    c = c.base;
  }
  for (var i = constructors.length - 1; i >= 0; i--) {
    var C = constructors[i];
    //BUI.extend(C,C.base,C.px,C.sx);
    BUI.mix(C.prototype, C.px);
    BUI.mix(C, C.sx);
    C.base = null;
    C.px = null;
    C.sx = null;
  }
}

BUI.mix(UIBase, {
  /**
   * 瀹氫箟涓€涓被
   * @static
   * @param  {Function} base   鍩虹被鏋勯€犲嚱鏁�
   * @param  {Array} extensions 鎵╁睍
   * @param  {Object} px  鍘熷瀷閾句笂鐨勬墿灞�
   * @param  {Object} sx
   * @return {Function} 缁ф壙涓庡熀绫荤殑鏋勯€犲嚱鏁�
   */
  define: function(base, extensions, px, sx) {
    if ($.isPlainObject(extensions)) {
      sx = px;
      px = extensions;
      extensions = [];
    }

    function C() {
      var c = this.constructor;
      if (c.base) {
        initConstuctor(c);
      }
      UIBase.apply(this, arguments);
    }

    BUI.extend(C, base); //鏃犳硶寤惰繜
    C.base = base;
    C.px = px; //寤惰繜澶嶅埗鍘熷瀷閾句笂鐨勫嚱鏁�
    C.sx = sx; //寤惰繜澶嶅埗闈欐€佸睘鎬�

    //BUI.mixin(C,extensions);
    if (extensions.length) { //寤惰繜鎵цmixin
      C.extensions = extensions;
    }

    return C;
  },
  /**
   * 鎵╁睍涓€涓被锛屽熀绫诲氨鏄被鏈韩
   * @static
   * @param  {Array} extensions 鎵╁睍
   * @param  {Object} px  鍘熷瀷閾句笂鐨勬墿灞�
   * @param  {Object} sx
   * @return {Function} 缁ф壙涓庡熀绫荤殑鏋勯€犲嚱鏁�
   */
  extend: function extend(extensions, px, sx) {
    var args = $.makeArray(arguments),
      ret,
      last = args[args.length - 1];
    args.unshift(this);
    if (last.xclass) {
      args.pop();
      args.push(last.xclass);
    }
    ret = UIBase.define.apply(UIBase, args);
    if (last.xclass) {
      var priority = last.priority || (this.priority ? (this.priority + 1) : 1);

      Manager.setConstructorByXClass(last.xclass, {
        constructor: ret,
        priority: priority
      });
      //鏂逛究璋冭瘯
      ret.__xclass = last.xclass;
      ret.priority = priority;
      ret.toString = function() {
        return last.xclass;
      }
    }
    ret.extend = extend;
    return ret;
  }
});

module.exports = UIBase;

});
define("bui/common/component/uibase/align", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 璺熸寚瀹氱殑鍏冪礌椤瑰榻愮殑鏂瑰紡
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery"),
  UA = require("bui/common/ua"),
  CLS_ALIGN_PREFIX ='x-align-',
  win = window;

// var ieMode = document.documentMode || UA.ie;

/*
 inspired by closure library by Google
 see http://yiminghe.iteye.com/blog/1124720
 */

/**
 * 寰楀埌浼氬鑷村厓绱犳樉绀轰笉鍏ㄧ殑绁栧厛鍏冪礌
 * @ignore
 */
function getOffsetParent(element) {
  // ie 杩欎釜涔熶笉鏄畬鍏ㄥ彲琛�
  /**
   <div style="width: 50px;height: 100px;overflow: hidden">
   <div style="width: 50px;height: 100px;position: relative;" id="d6">
   鍏冪礌 6 楂� 100px 瀹� 50px<br/>
   </div>
   </div>
   @ignore
   **/
  // element.offsetParent does the right thing in ie7 and below. Return parent with layout!
  //  In other browsers it only includes elements with position absolute, relative or
  // fixed, not elements with overflow set to auto or scroll.
  //    if (UA.ie && ieMode < 8) {
  //      return element.offsetParent;
  //    }
      // 缁熶竴鐨� offsetParent 鏂规硶
  var doc = element.ownerDocument,
    body = doc.body,
    parent,
    positionStyle = $(element).css('position'),
    skipStatic = positionStyle == 'fixed' || positionStyle == 'absolute';

  if (!skipStatic) {
    return element.nodeName.toLowerCase() == 'html' ? null : element.parentNode;
  }

  for (parent = element.parentNode; parent && parent != body; parent = parent.parentNode) {
    positionStyle = $(parent).css('position');
    if (positionStyle != 'static') {
      return parent;
    }
  }
  return null;
}

/**
 * 鑾峰緱鍏冪礌鐨勬樉绀洪儴鍒嗙殑鍖哄煙
 * @private
 * @ignore
 */
function getVisibleRectForElement(element) {
  var visibleRect = {
      left:0,
      right:Infinity,
      top:0,
      bottom:Infinity
    },
    el,
    scrollX,
    scrollY,
    winSize,
    doc = element.ownerDocument,
    body = doc.body,
    documentElement = doc.documentElement;

  // Determine the size of the visible rect by climbing the dom accounting for
  // all scrollable containers.
  for (el = element; el = getOffsetParent(el);) {
    // clientWidth is zero for inline block elements in ie.
    if ((!UA.ie || el.clientWidth != 0) &&
      // body may have overflow set on it, yet we still get the entire
      // viewport. In some browsers, el.offsetParent may be
      // document.documentElement, so check for that too.
      (el != body && el != documentElement && $(el).css('overflow') != 'visible')) {
      var pos = $(el).offset();
      // add border
      pos.left += el.clientLeft;
      pos.top += el.clientTop;

      visibleRect.top = Math.max(visibleRect.top, pos.top);
      visibleRect.right = Math.min(visibleRect.right,
        // consider area without scrollBar
        pos.left + el.clientWidth);
      visibleRect.bottom = Math.min(visibleRect.bottom,
        pos.top + el.clientHeight);
      visibleRect.left = Math.max(visibleRect.left, pos.left);
    }
  }

  // Clip by window's viewport.
  scrollX = $(win).scrollLeft();
  scrollY = $(win).scrollTop();
  visibleRect.left = Math.max(visibleRect.left, scrollX);
  visibleRect.top = Math.max(visibleRect.top, scrollY);
  winSize = {
    width:BUI.viewportWidth(),
    height:BUI.viewportHeight()
  };
  visibleRect.right = Math.min(visibleRect.right, scrollX + winSize.width);
  visibleRect.bottom = Math.min(visibleRect.bottom, scrollY + winSize.height);
  return visibleRect.top >= 0 && visibleRect.left >= 0 &&
    visibleRect.bottom > visibleRect.top &&
    visibleRect.right > visibleRect.left ?
    visibleRect : null;
}

function getElFuturePos(elRegion, refNodeRegion, points, offset) {
  var xy,
    diff,
    p1,
    p2;

  xy = {
    left:elRegion.left,
    top:elRegion.top
  };

  p1 = getAlignOffset(refNodeRegion, points[0]);
  p2 = getAlignOffset(elRegion, points[1]);

  diff = [p2.left - p1.left, p2.top - p1.top];

  return {
    left:xy.left - diff[0] + (+offset[0]),
    top:xy.top - diff[1] + (+offset[1])
  };
}

function isFailX(elFuturePos, elRegion, visibleRect) {
  return elFuturePos.left < visibleRect.left ||
    elFuturePos.left + elRegion.width > visibleRect.right;
}

function isFailY(elFuturePos, elRegion, visibleRect) {
  return elFuturePos.top < visibleRect.top ||
    elFuturePos.top + elRegion.height > visibleRect.bottom;
}

function adjustForViewport(elFuturePos, elRegion, visibleRect, overflow) {
  var pos = BUI.cloneObject(elFuturePos),
    size = {
      width:elRegion.width,
      height:elRegion.height
    };

  if (overflow.adjustX && pos.left < visibleRect.left) {
    pos.left = visibleRect.left;
  }

  // Left edge inside and right edge outside viewport, try to resize it.
  if (overflow['resizeWidth'] &&
    pos.left >= visibleRect.left &&
    pos.left + size.width > visibleRect.right) {
    size.width -= (pos.left + size.width) - visibleRect.right;
  }

  // Right edge outside viewport, try to move it.
  if (overflow.adjustX && pos.left + size.width > visibleRect.right) {
    // 淇濊瘉宸﹁竟鐣屽拰鍙鍖哄煙宸﹁竟鐣屽榻�
    pos.left = Math.max(visibleRect.right - size.width, visibleRect.left);
  }

  // Top edge outside viewport, try to move it.
  if (overflow.adjustY && pos.top < visibleRect.top) {
    pos.top = visibleRect.top;
  }

  // Top edge inside and bottom edge outside viewport, try to resize it.
  if (overflow['resizeHeight'] &&
    pos.top >= visibleRect.top &&
    pos.top + size.height > visibleRect.bottom) {
    size.height -= (pos.top + size.height) - visibleRect.bottom;
  }

  // Bottom edge outside viewport, try to move it.
  if (overflow.adjustY && pos.top + size.height > visibleRect.bottom) {
    // 淇濊瘉涓婅竟鐣屽拰鍙鍖哄煙涓婅竟鐣屽榻�
    pos.top = Math.max(visibleRect.bottom - size.height, visibleRect.top);
  }

  return BUI.mix(pos, size);
}


function flip(points, reg, map) {
  var ret = [];
  $.each(points, function (index,p) {
    ret.push(p.replace(reg, function (m) {
      return map[m];
    }));
  });
  return ret;
}

function flipOffset(offset, index) {
  offset[index] = -offset[index];
  return offset;
}


/**
 * @class BUI.Component.UIBase.Align
 * Align extension class.
 * Align component with specified element.
 * <img src="http://images.cnitblog.com/blog/111279/201304/09180221-201343d4265c46e7987e6b1c46d5461a.jpg"/>
 */
function Align() {
}


Align.__getOffsetParent = getOffsetParent;

Align.__getVisibleRectForElement = getVisibleRectForElement;

Align.ATTRS =
{
  /**
   * 瀵归綈閰嶇疆锛岃缁嗚鏄庤鍙傜湅锛� <a href="http://www.cnblogs.com/zaohe/archive/2013/04/09/3010651.html">JS鎺т欢 瀵归綈</a>
   * @cfg {Object} align
   * <pre><code>
   *  var overlay = new Overlay( {  
   *     align :{
   *     node: null,     // 鍙傝€冨厓绱�, falsy 鎴� window 涓哄彲瑙嗗尯鍩�, 'trigger' 涓鸿Е鍙戝厓绱�, 鍏朵粬涓烘寚瀹氬厓绱�
   *     points: ['cc','cc'], // ['tr', 'tl'] 琛ㄧず overlay 鐨� tl 涓庡弬鑰冭妭鐐圭殑 tr 瀵归綈
   *     offset: [0, 0]    // 鏈夋晥鍊间负 [n, m]
   *     }
   *   }); 
   * </code></pre>
   */

  /**
   * 璁剧疆瀵归綈灞炴€�
   * @type {Object}
   * @field
   * <code>
   *   var align =  {
   *    node: null,     // 鍙傝€冨厓绱�, falsy 鎴� window 涓哄彲瑙嗗尯鍩�, 'trigger' 涓鸿Е鍙戝厓绱�, 鍏朵粬涓烘寚瀹氬厓绱�
   *    points: ['cc','cc'], // ['tr', 'tl'] 琛ㄧず overlay 鐨� tl 涓庡弬鑰冭妭鐐圭殑 tr 瀵归綈
   *    offset: [0, 0]    // 鏈夋晥鍊间负 [n, m]
   *   };
   *   overlay.set('align',align);
   * </code>
   */
  align:{
    shared : false,
    value:{}
  }
};

function getRegion(node) {
  var offset, w, h;
  if (node.length && !$.isWindow(node[0])) {
    offset = node.offset();
    w = node.outerWidth();
    h = node.outerHeight();
  } else {
    offset = { left:BUI.scrollLeft(), top:BUI.scrollTop() };
    w = BUI.viewportWidth();
    h = BUI.viewportHeight();
  }
  offset.width = w;
  offset.height = h;
  return offset;
}

/**
 * 鑾峰彇 node 涓婄殑 align 瀵归綈鐐� 鐩稿浜庨〉闈㈢殑鍧愭爣
 * @param region
 * @param align
 */
function getAlignOffset(region, align) {
  var V = align.charAt(0),
    H = align.charAt(1),
    w = region.width,
    h = region.height,
    x, y;

  x = region.left;
  y = region.top;

  if (V === 'c') {
    y += h / 2;
  } else if (V === 'b') {
    y += h;
  }

  if (H === 'c') {
    x += w / 2;
  } else if (H === 'r') {
    x += w;
  }

  return { left:x, top:y };
}

//娓呴櫎瀵归綈鐨刢ss鏍峰紡
function clearAlignCls(el){
  var cls = el.attr('class'),
    regex = new RegExp('\s?'+CLS_ALIGN_PREFIX+'[a-z]{2}-[a-z]{2}','ig'),
    arr = regex.exec(cls);
  if(arr){
    el.removeClass(arr.join(' '));
  }
}

Align.prototype =
{
  _uiSetAlign:function (v,ev) {
    var alignCls = '',
      el,   
      selfAlign; //points 鐨勭浜屼釜鍙傛暟锛屾槸鑷繁瀵归綈浜庡叾浠栬妭鐐圭殑鐨勬柟寮�
    if (v && v.points) {
      this.align(v.node, v.points, v.offset, v.overflow);
      this.set('cachePosition',null);
      el = this.get('el');
      clearAlignCls(el);
      selfAlign = v.points.join('-');
      alignCls = CLS_ALIGN_PREFIX + selfAlign;
      el.addClass(alignCls);
      /**/
    }
  },
  __bindUI : function(){
    var _self = this;

    var fn = BUI.wrapBehavior(_self,'handleWindowResize');
    
    _self.on('show',function(){
      $(window).on('resize',fn);
    });

    _self.on('hide',function(){
      $(window).off('resize',fn);
    });
  },
  //澶勭悊window resize浜嬩欢
  handleWindowResize : function(){
    var _self = this,
      align = _self.get('align');

    _self.set('align',align);
  },
  /*
   瀵归綈 Overlay 鍒� node 鐨� points 鐐�, 鍋忕Щ offset 澶�
   @method
   @ignore
   @param {Element} node 鍙傜収鍏冪礌, 鍙彇閰嶇疆閫夐」涓殑璁剧疆, 涔熷彲鏄竴鍏冪礌
   @param {String[]} points 瀵归綈鏂瑰紡
   @param {Number[]} [offset] 鍋忕Щ
   */
  align:function (refNode, points, offset, overflow) {
    refNode = $(refNode || win);
    offset = offset && [].concat(offset) || [0, 0];
    overflow = overflow || {};

    var self = this,
      el = self.get('el'),
      fail = 0,
    // 褰撳墠鑺傜偣鍙互琚斁缃殑鏄剧ず鍖哄煙
      visibleRect = getVisibleRectForElement(el[0]),
    // 褰撳墠鑺傜偣鎵€鍗犵殑鍖哄煙, left/top/width/height
      elRegion = getRegion(el),
    // 鍙傜収鑺傜偣鎵€鍗犵殑鍖哄煙, left/top/width/height
      refNodeRegion = getRegion(refNode),
    // 褰撳墠鑺傜偣灏嗚琚斁缃殑浣嶇疆
      elFuturePos = getElFuturePos(elRegion, refNodeRegion, points, offset),
    // 褰撳墠鑺傜偣灏嗚鎵€澶勭殑鍖哄煙
      newElRegion = BUI.merge(elRegion, elFuturePos);

    // 濡傛灉鍙鍖哄煙涓嶈兘瀹屽叏鏀剧疆褰撳墠鑺傜偣鏃跺厑璁歌皟鏁�
    if (visibleRect && (overflow.adjustX || overflow.adjustY)) {

      // 濡傛灉妯悜涓嶈兘鏀句笅
      if (isFailX(elFuturePos, elRegion, visibleRect)) {
        fail = 1;
        // 瀵归綈浣嶇疆鍙嶄笅
        points = flip(points, /[lr]/ig, {
          l:'r',
          r:'l'
        });
        // 鍋忕Щ閲忎篃鍙嶄笅
        offset = flipOffset(offset, 0);
      }

      // 濡傛灉绾靛悜涓嶈兘鏀句笅
      if (isFailY(elFuturePos, elRegion, visibleRect)) {
        fail = 1;
        // 瀵归綈浣嶇疆鍙嶄笅
        points = flip(points, /[tb]/ig, {
          t:'b',
          b:'t'
        });
        // 鍋忕Щ閲忎篃鍙嶄笅
        offset = flipOffset(offset, 1);
      }

      // 濡傛灉澶辫触锛岄噸鏂拌绠楀綋鍓嶈妭鐐瑰皢瑕佽鏀剧疆鐨勪綅缃�
      if (fail) {
        elFuturePos = getElFuturePos(elRegion, refNodeRegion, points, offset);
        BUI.mix(newElRegion, elFuturePos);
      }

      var newOverflowCfg = {};

      // 妫€鏌ュ弽涓嬪悗鐨勪綅缃槸鍚﹀彲浠ユ斁涓嬩簡
      // 濡傛灉浠嶇劧鏀句笉涓嬪彧鏈夋寚瀹氫簡鍙互璋冩暣褰撳墠鏂瑰悜鎵嶈皟鏁�
      newOverflowCfg.adjustX = overflow.adjustX &&
        isFailX(elFuturePos, elRegion, visibleRect);

      newOverflowCfg.adjustY = overflow.adjustY &&
        isFailY(elFuturePos, elRegion, visibleRect);

      // 纭疄瑕佽皟鏁达紝鐢氳嚦鍙兘浼氳皟鏁撮珮搴﹀搴�
      if (newOverflowCfg.adjustX || newOverflowCfg.adjustY) {
        newElRegion = adjustForViewport(elFuturePos, elRegion,
          visibleRect, newOverflowCfg);
      }
    }

    // 鏂板尯鍩熶綅缃彂鐢熶簡鍙樺寲
    if (newElRegion.left != elRegion.left) {
      self.setInternal('x', null);
      self.get('view').setInternal('x', null);
      self.set('x', newElRegion.left);
    }

    if (newElRegion.top != elRegion.top) {
      // https://github.com/kissyteam/kissy/issues/190
      // 鐩稿浜庡睆骞曚綅缃病鍙橈紝鑰� left/top 鍙樹簡
      // 渚嬪 <div 'relative'><el absolute></div>
      // el.align(div)
      self.setInternal('y', null);
      self.get('view').setInternal('y', null);
      self.set('y', newElRegion.top);
    }

    // 鏂板尯鍩熼珮瀹藉彂鐢熶簡鍙樺寲
    if (newElRegion.width != elRegion.width) {
      el.width(el.width() + newElRegion.width - elRegion.width);
    }
    if (newElRegion.height != elRegion.height) {
      el.height(el.height() + newElRegion.height - elRegion.height);
    }

    return self;
  },

  /**
   * 瀵归綈鍒板厓绱犵殑涓棿锛屾煡鐪嬪睘鎬� {@link BUI.Component.UIBase.Align#property-align} .
   * <pre><code>
   *  control.center('#t1'); //鎺т欢澶勪簬瀹瑰櫒#t1鐨勪腑闂翠綅缃�
   * </code></pre>
   * @param {undefined|String|HTMLElement|jQuery} node
   * 
   */
  center:function (node) {
    var self = this;
    self.set('align', {
      node:node,
      points:['cc', 'cc'],
      offset:[0, 0]
    });
    return self;
  }
};

module.exports = Align;

});
define("bui/common/component/uibase/autoshow", ["jquery"], function(require, exports, module){
/**
 * @fileOverview click锛宖ocus,hover绛夊紩璧锋帶浠舵樉绀猴紝骞朵笖瀹氫綅
 * @ignore
 */

var $ = require("jquery");

/**
 * 澶勭悊鑷姩鏄剧ず鎺т欢鐨勬墿灞曪紝涓€鑸敤浜庢樉绀簃enu,picker,tip绛�
 * @class BUI.Component.UIBase.AutoShow
 */
function autoShow() {

}

autoShow.ATTRS = {

  /**
   * 瑙﹀彂鏄剧ず鎺т欢鐨凞OM閫夋嫨鍣�
   * <pre><code>
   *  var overlay = new Overlay({ //鐐瑰嚮#t1鏃舵樉绀猴紝鐐瑰嚮#t1,overlay涔嬪鐨勫厓绱犻殣钘�
   *    trigger : '#t1',
   *    autoHide : true,
   *    content : '鎮诞鍐呭'
   *  });
   *  overlay.render();
   * </code></pre>
   * @cfg {HTMLElement|String|jQuery} trigger
   */
  /**
   * 瑙﹀彂鏄剧ず鎺т欢鐨凞OM閫夋嫨鍣�
   * @type {HTMLElement|String|jQuery}
   */
  trigger: {

  },
  delegateTigger: {
    getter: function() {
      this.get('delegateTrigger'); //鍏煎涔嬪墠鐨勭増鏈�
    },
    setter: function(v) {
      this.set('delegateTrigger', v);
    }

  },
  /**
   * 鏄惁浣跨敤浠ｇ悊鐨勬柟寮忚Е鍙戞樉绀烘帶浠�,濡傛灉tigger涓嶆槸瀛楃涓诧紝姝ゅ睘鎬ф棤鏁�
   * <pre><code>
   *  var overlay = new Overlay({ //鐐瑰嚮.t1(鏃犺鍒涘缓鎺т欢鏃�.t1鏄惁瀛樺湪)鏃舵樉绀猴紝鐐瑰嚮.t1,overlay涔嬪鐨勫厓绱犻殣钘�
   *    trigger : '.t1',
   *    autoHide : true,
   *    delegateTrigger : true, //浣跨敤濮旀墭鐨勬柟寮忚Е鍙戞樉绀烘帶浠�
   *    content : '鎮诞鍐呭'
   *  });
   *  overlay.render();
   * </code></pre>
   * @cfg {Boolean} [delegateTrigger = false]
   */
  /**
   * 鏄惁浣跨敤浠ｇ悊鐨勬柟寮忚Е鍙戞樉绀烘帶浠�,濡傛灉tigger涓嶆槸瀛楃涓诧紝姝ゅ睘鎬ф棤鏁�
   * @type {Boolean}
   * @ignore
   */
  delegateTrigger: {
    value: false
  },
  /**
   * 閫夋嫨鍣ㄦ槸鍚﹀缁堣窡闅忚Е鍙戝櫒瀵归綈
   * @cfg {Boolean} autoAlign
   * @ignore
   */
  /**
   * 閫夋嫨鍣ㄦ槸鍚﹀缁堣窡闅忚Е鍙戝櫒瀵归綈
   * @type {Boolean}
   * @protected
   */
  autoAlign: {
    value: true
  },
  /**
   * 鏄剧ず鏃舵槸鍚﹂粯璁よ幏鍙栫劍鐐�
   * @type {Boolean}
   */
  autoFocused: {
    value: true
  },
  /**
   * 濡傛灉璁剧疆浜嗚繖涓牱寮忥紝閭ｄ箞瑙﹀彂鏄剧ず锛坥verlay锛夋椂trigger浼氭坊鍔犳鏍峰紡
   * @type {Object}
   */
  triggerActiveCls: {

  },
  /**
   * 鎺т欢鏄剧ず鏃剁敱姝rigger瑙﹀彂锛屽綋閰嶇疆椤� trigger 閫夋嫨鍣ㄤ唬琛ㄥ涓狣OM 瀵硅薄鏃讹紝
   * 鎺т欢鍙敱澶氫釜DOM瀵硅薄瑙﹀彂鏄剧ず銆�
   * <pre><code>
   *  overlay.on('show',function(){
   *    var curTrigger = overlay.get('curTrigger');
   *    //TO DO
   *  });
   * </code></pre>
   * @type {jQuery}
   * @readOnly
   */
  curTrigger: {

  },
  /**
   * 瑙﹀彂鏄剧ず鏃剁殑鍥炶皟鍑芥暟
   * @cfg {Function} triggerCallback
   * @ignore
   */
  /**
   * 瑙﹀彂鏄剧ず鏃剁殑鍥炶皟鍑芥暟
   * @type {Function}
   * @ignore
   */
  triggerCallback: {

  },
  /**
   * 鏄剧ず鑿滃崟鐨勪簨浠�
   *  <pre><code>
   *    var overlay = new Overlay({ //绉诲姩鍒�#t1鏃舵樉绀猴紝绉诲姩鍑�#t1,overlay涔嬪鎺т欢闅愯棌
   *      trigger : '#t1',
   *      autoHide : true,
   *      triggerEvent :'mouseover',
   *      autoHideType : 'leave',
   *      content : '鎮诞鍐呭'
   *    });
   *    overlay.render();
   *
   *  </code></pre>
   * @cfg {String} [triggerEvent='click']
   * @default 'click'
   */
  /**
   * 鏄剧ず鑿滃崟鐨勪簨浠�
   * @type {String}
   * @default 'click'
   * @ignore
   */
  triggerEvent: {
    value: 'click'
  },
  /**
   * 鍥犱负瑙﹀彂鍏冪礌鍙戠敓鏀瑰彉鑰屽鑷存帶浠堕殣钘�
   * @cfg {String} triggerHideEvent
   * @ignore
   */
  /**
   * 鍥犱负瑙﹀彂鍏冪礌鍙戠敓鏀瑰彉鑰屽鑷存帶浠堕殣钘�
   * @type {String}
   * @ignore
   */
  triggerHideEvent: {

  },
  events: {
    value: {
      /**
       * 褰撹Е鍙戝櫒锛堣Е鍙戦€夋嫨鍣ㄥ嚭鐜帮級鍙戠敓鏀瑰彉鏃讹紝缁忓父鐢ㄤ簬涓€涓€夋嫨鍣ㄥ搴斿涓Е鍙戝櫒鐨勬儏鍐�
       * <pre><code>
       *  overlay.on('triggerchange',function(ev){
       *    var curTrigger = ev.curTrigger;
       *    overlay.set('content',curTrigger.html());
       *  });
       * </code></pre>
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {jQuery} e.prevTrigger 涔嬪墠瑙﹀彂鍣紝鍙兘涓簄ull
       * @param {jQuery} e.curTrigger 褰撳墠鐨勮Е鍙戝櫒
       */
      'triggerchange': false
    }
  }
};

autoShow.prototype = {

  __createDom: function() {
    this._setTrigger();
  },
  __bindUI: function() {
    var _self = this,
      triggerActiveCls = _self.get('triggerActiveCls');
    if (triggerActiveCls) {
      _self.on('hide', function() {
        var curTrigger = _self.get('curTrigger');
        if (curTrigger) {
          curTrigger.removeClass(triggerActiveCls);
        }
      });
    }

  },
  _setTrigger: function() {
    var _self = this,
      triggerEvent = _self.get('triggerEvent'),
      triggerHideEvent = _self.get('triggerHideEvent'),
      triggerCallback = _self.get('triggerCallback'),
      triggerActiveCls = _self.get('triggerActiveCls') || '',
      trigger = _self.get('trigger'),
      isDelegate = _self.get('delegateTrigger'),
      triggerEl = $(trigger);

    //瑙﹀彂鏄剧ず
    function tiggerShow(ev) {
      if (_self.get('disabled')) { //濡傛灉绂佺敤鍒欎腑鏂�
        return;
      }
      var prevTrigger = _self.get('curTrigger'),
        curTrigger = isDelegate ? $(ev.currentTarget) : $(this),
        align = _self.get('align');
      if (!prevTrigger || prevTrigger[0] != curTrigger[0]) {
        if (prevTrigger) {
          prevTrigger.removeClass(triggerActiveCls);
        }
        _self.set('curTrigger', curTrigger);
        _self.fire('triggerchange', {
          prevTrigger: prevTrigger,
          curTrigger: curTrigger
        });
      }
      curTrigger.addClass(triggerActiveCls);
      if (_self.get('autoAlign')) {
        align.node = curTrigger;

      }
      _self.set('align', align);
      _self.show();


      triggerCallback && triggerCallback(ev);
    }

    //瑙﹀彂闅愯棌
    function tiggerHide(ev) {
      var toElement = ev.toElement || ev.relatedTarget;
      if (!toElement || !_self.containsElement(toElement)) { //mouseleave鏃讹紝濡傛灉绉诲姩鍒板綋鍓嶆帶浠朵笂锛屽彇娑堟秷澶�
        _self.hide();
      }
    }

    if (triggerEvent) {
      if (isDelegate && BUI.isString(trigger)) {
        $(document).delegate(trigger, triggerEvent, tiggerShow);
      } else {
        triggerEl.on(triggerEvent, tiggerShow);
      }

    }

    if (triggerHideEvent) {
      if (isDelegate && BUI.isString(trigger)) {
        $(document).delegate(trigger, triggerHideEvent, tiggerHide);
      } else {
        triggerEl.on(triggerHideEvent, tiggerHide);
      }
    }
  },
  __renderUI: function() {
    var _self = this,
      align = _self.get('align');
    //濡傛灉鎺т欢鏄剧ず鏃朵笉鏄敱trigger瑙﹀彂锛屽垯鍚岀埗鍏冪礌瀵归綈
    if (align && !align.node) {
      align.node = _self.get('render') || _self.get('trigger');
    }
  }
};

module.exports = autoShow;

});
define("bui/common/component/uibase/autohide", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鐐瑰嚮鎴栫Щ鍑烘帶浠跺閮紝鎺т欢闅愯棌
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  wrapBehavior = BUI.wrapBehavior,
  getWrapBehavior = BUI.getWrapBehavior;

function isExcept(self, elem) {
  var hideExceptNode = self.get('hideExceptNode');
  if (hideExceptNode && hideExceptNode.length) {
    return $.contains(hideExceptNode[0], elem);
  }
  return false;
}
/**
 * 鐐瑰嚮闅愯棌鎺т欢鐨勬墿灞�
 * @class BUI.Component.UIBase.AutoHide
 */
function autoHide() {

}

autoHide.ATTRS = {

  /**
   * 鎺т欢鑷姩闅愯棌鐨勪簨浠讹紝杩欓噷鏀寔2绉嶏細
   *  - 'click'
   *  - 'leave'
   *  <pre><code>
   *    var overlay = new Overlay({ //鐐瑰嚮#t1鏃舵樉绀猴紝鐐瑰嚮#t1涔嬪鐨勫厓绱犻殣钘�
   *      trigger : '#t1',
   *      autoHide : true,
   *      content : '鎮诞鍐呭'
   *    });
   *    overlay.render();
   *
   *    var overlay = new Overlay({ //绉诲姩鍒�#t1鏃舵樉绀猴紝绉诲姩鍑�#t1,overlay涔嬪鎺т欢闅愯棌
   *      trigger : '#t1',
   *      autoHide : true,
   *      triggerEvent :'mouseover',
   *      autoHideType : 'leave',
   *      content : '鎮诞鍐呭'
   *    });
   *    overlay.render();
   *
   *  </code></pre>
   * @cfg {String} [autoHideType = 'click']
   */
  /**
   * 鎺т欢鑷姩闅愯棌鐨勪簨浠讹紝杩欓噷鏀寔2绉嶏細
   * 'click',鍜�'leave',榛樿涓�'click'
   * @type {String}
   */
  autoHideType: {
    value: 'click'
  },
  /**
   * 鏄惁鑷姩闅愯棌
   * <pre><code>
   *
   *  var overlay = new Overlay({ //鐐瑰嚮#t1鏃舵樉绀猴紝鐐瑰嚮#t1,overlay涔嬪鐨勫厓绱犻殣钘�
   *    trigger : '#t1',
   *    autoHide : true,
   *    content : '鎮诞鍐呭'
   *  });
   *  overlay.render();
   * </code></pre>
   * @cfg {Object} autoHide
   */
  /**
   * 鏄惁鑷姩闅愯棌
   * @type {Object}
   * @ignore
   */
  autoHide: {
    value: false
  },
  /**
   * 鐐瑰嚮鎴栬€呯Щ鍔ㄥ埌姝よ妭鐐规椂涓嶈Е鍙戣嚜鍔ㄩ殣钘�
   * <pre><code>
   *
   *  var overlay = new Overlay({ //鐐瑰嚮#t1鏃舵樉绀猴紝鐐瑰嚮#t1,#t2,overlay涔嬪鐨勫厓绱犻殣钘�
   *    trigger : '#t1',
   *    autoHide : true,
   *    hideExceptNode : '#t2',
   *    content : '鎮诞鍐呭'
   *  });
   *  overlay.render();
   * </code></pre>
   * @cfg {Object} hideExceptNode
   */
  hideExceptNode: {

  },
  events: {
    value: {
      /**
       * @event autohide
       * 鐐瑰嚮鎺т欢澶栭儴鏃惰Е鍙戯紝鍙湁鍦ㄦ帶浠惰缃嚜鍔ㄩ殣钘�(autoHide = true)鏈夋晥
       * 鍙互闃绘鎺т欢闅愯棌锛岄€氳繃鍦ㄤ簨浠剁洃鍚嚱鏁颁腑 return false
       * <pre><code>
       *  overlay.on('autohide',function(){
       *    var curTrigger = overlay.curTrigger; //褰撳墠瑙﹀彂鐨勯」
       *    if(condtion){
       *      return false; //闃绘闅愯棌
       *    }
       *  });
       * </code></pre>
       */
      autohide: false
    }
  }
};

autoHide.prototype = {

  __bindUI: function() {
    var _self = this;

    _self.on('afterVisibleChange', function(ev) {
      var visible = ev.newVal;
      if (_self.get('autoHide')) {
        if (visible) {
          _self._bindHideEvent();
        } else {
          _self._clearHideEvent();
        }
      }
    });
  },
  /**
   * 澶勭悊榧犳爣绉诲嚭浜嬩欢锛屼笉褰卞搷{BUI.Component.Controller#handleMouseLeave}浜嬩欢
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleMoveOuter: function(ev) {
    var _self = this,
      target = ev.toElement || ev.relatedTarget;
    if (!_self.containsElement(target) && !isExcept(_self, target)) {
      if (_self.fire('autohide') !== false) {
        _self.hide();
      }
    }
  },
  /**
   * 鐐瑰嚮椤甸潰鏃剁殑澶勭悊鍑芥暟
   * @param {jQuery.Event} ev 浜嬩欢瀵硅薄
   * @protected
   */
  handleDocumentClick: function(ev) {
    var _self = this,
      target = ev.target;
    if (!_self.containsElement(target) && !isExcept(_self, target)) {
      if (_self.fire('autohide') !== false) {
        _self.hide();
      }
    }
  },
  _bindHideEvent: function() {
    var _self = this,
      trigger = _self.get('curTrigger'),
      autoHideType = _self.get('autoHideType');
    if (autoHideType === 'click') {
      $(document).on('mousedown', wrapBehavior(_self, 'handleDocumentClick'));
    } else {
      _self.get('el').on('mouseleave', wrapBehavior(_self, 'handleMoveOuter'));
      if (trigger) {
        $(trigger).on('mouseleave', wrapBehavior(_self, 'handleMoveOuter'))
      }
    }

  },
  //娓呴櫎缁戝畾鐨勯殣钘忎簨浠�
  _clearHideEvent: function() {
    var _self = this,
      trigger = _self.get('curTrigger'),
      autoHideType = _self.get('autoHideType');
    if (autoHideType === 'click') {
      $(document).off('mousedown', getWrapBehavior(_self, 'handleDocumentClick'));
    } else {
      _self.get('el').off('mouseleave', getWrapBehavior(_self, 'handleMoveOuter'));
      if (trigger) {
        $(trigger).off('mouseleave', getWrapBehavior(_self, 'handleMoveOuter'))
      }
    }
  }
};

module.exports = autoHide;

});
define("bui/common/component/uibase/close", ["jquery"], function(require, exports, module){
/**
 * @fileOverview close 鍏抽棴鎴栭殣钘忔帶浠�
 * @author yiminghe@gmail.com
 * copied and modified by dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery");


var CLS_PREFIX = BUI.prefix + 'ext-';

function getCloseRenderBtn(self) {
  return $(self.get('closeTpl'));
}

/**
 * 鍏抽棴鎸夐挳鐨勮鍥剧被
 * @class BUI.Component.UIBase.CloseView
 * @private
 */
function CloseView() {}

CloseView.ATTRS = {
  closeTpl: {
    value: '<a ' +
      'tabindex="0" ' +
      "href='javascript:void(\"鍏抽棴\")' " +
      'role="button" ' +
      'class="' + CLS_PREFIX + 'close' + '">' +
      '<span class="' +
      CLS_PREFIX + 'close-x' +
      '">鍏抽棴<' + '/span>' +
      '<' + '/a>'
  },
  closeable: {
    value: true
  },
  closeBtn: {}
};

CloseView.prototype = {
  _uiSetCloseable: function(v) {
    var self = this,
      btn = self.get('closeBtn');
    if (v) {
      if (!btn) {
        self.setInternal('closeBtn', btn = getCloseRenderBtn(self));
      }
      btn.appendTo(self.get('el'), undefined);
    } else {
      if (btn) {
        btn.remove();
      }
    }
  }
};

/**
 * @class BUI.Component.UIBase.Close
 * Close extension class.
 * Represent a close button.
 */
function Close() {}

var HIDE = 'hide';
Close.ATTRS = {
  /**
   * 鍏抽棴鎸夐挳鐨勯粯璁ゆā鐗�
   * <pre><code>
   *   var overlay = new Overlay({
   *     closeTpl : '<a href="#" title="close">x</a>',
   *     closeable : true,
   *     trigger : '#t1'
   *   });
   *   overlay.render();
   * </code></pre>
   * @cfg {String} closeTpl
   */
  /**
   * 鍏抽棴鎸夐挳鐨勯粯璁ゆā鐗�
   * @type {String}
   * @protected
   */
  closeTpl: {
    view: true
  },
  /**
   * 鏄惁鍑虹幇鍏抽棴鎸夐挳
   * @cfg {Boolean} [closeable = false]
   */
  /**
   * 鏄惁鍑虹幇鍏抽棴鎸夐挳
   * @type {Boolean}
   */
  closeable: {
    view: 1
  },

  /**
   * 鍏抽棴鎸夐挳.
   * @protected
   * @type {jQuery}
   */
  closeBtn: {
    view: 1
  },
  /**
   * 鍏抽棴鏃堕殣钘忚繕鏄Щ闄OM缁撴瀯<br/>
   *
   *  - "hide" : default 闅愯棌.
   *  - "destroy"锛氬綋鐐瑰嚮鍏抽棴鎸夐挳鏃剁Щ闄わ紙destroy)鎺т欢
   *  - 'remove' : 褰撳瓨鍦ㄧ埗鎺т欢鏃朵娇鐢╮emove锛屽悓鏃朵粠鐖跺厓绱犱腑鍒犻櫎
   * @cfg {String} [closeAction = 'hide']
   */
  /**
   * 鍏抽棴鏃堕殣钘忚繕鏄Щ闄OM缁撴瀯
   * default "hide".鍙互璁剧疆 "destroy" 锛屽綋鐐瑰嚮鍏抽棴鎸夐挳鏃剁Щ闄わ紙destroy)鎺т欢
   * @type {String}
   * @protected
   */
  closeAction: {
    value: HIDE
  }

  /**
   * @event closing
   * 姝ｅ湪鍏抽棴锛屽彲浠ラ€氳繃return false 闃绘鍏抽棴浜嬩欢
   * @param {Object} e 鍏抽棴浜嬩欢
   * @param {String} e.action 鍏抽棴鎵ц鐨勮涓猴紝hide,destroy,remove
   */

  /**
   * @event beforeclosed
   * 鍏抽棴鍓嶏紝鍙戠敓鍦╟losing鍚庯紝closed鍓嶏紝鐢ㄤ簬澶勭悊鍏抽棴鍓嶇殑涓€浜涘伐浣�
   * @param {Object} e 鍏抽棴浜嬩欢
   * @param {String} e.action 鍏抽棴鎵ц鐨勮涓猴紝hide,destroy,remove
   */

  /**
   * @event closed
   * 宸茬粡鍏抽棴
   * @param {Object} e 鍏抽棴浜嬩欢
   * @param {String} e.action 鍏抽棴鎵ц鐨勮涓猴紝hide,destroy,remove
   */

  /**
   * @event closeclick
   * 瑙﹀彂鐐瑰嚮鍏抽棴鎸夐挳鐨勪簨浠�,return false 闃绘鍏抽棴
   * @param {Object} e 鍏抽棴浜嬩欢
   * @param {String} e.domTarget 鐐瑰嚮鐨勫叧闂寜閽妭鐐�
   */
};

var actions = {
  hide: HIDE,
  destroy: 'destroy',
  remove: 'remove'
};

Close.prototype = {
  _uiSetCloseable: function(v) {
    var self = this;
    if (v && !self.__bindCloseEvent) {
      self.__bindCloseEvent = 1;
      self.get('closeBtn').on('click', function(ev) {
        if (self.fire('closeclick', {
          domTarget: ev.target
        }) !== false) {
          self.close();
        }
        ev.preventDefault();
      });
    }
  },
  __destructor: function() {
    var btn = this.get('closeBtn');
    btn && btn.detach();
  },
  /**
   * 鍏抽棴寮瑰嚭妗嗭紝濡傛灉closeAction = 'hide'閭ｄ箞灏辨槸闅愯棌锛屽鏋� closeAction = 'destroy'閭ｄ箞灏辨槸閲婃斁,'remove'浠庣埗鎺т欢涓垹闄わ紝骞堕噴鏀�
   */
  close: function() {
    var self = this,
      action = actions[self.get('closeAction') || HIDE];
    if (self.fire('closing', {
      action: action
    }) !== false) {
      self.fire('beforeclosed', {
        action: action
      });
      if (action == 'remove') { //绉婚櫎鏃跺悓鏃禿estroy
        self[action](true);
      } else {
        self[action]();
      }
      self.fire('closed', {
        action: action
      });
    }
  }
};

Close.View = CloseView;

module.exports = Close;

});
define("bui/common/component/uibase/collapsable", [], function(require, exports, module){
/**
 * @fileOverview 鍙互灞曞紑鎶樺彔鐨勬帶浠�
 * @ignore
 */


/**
 * 鎺т欢灞曞紑鎶樺彔鐨勮鍥剧被
 * @class BUI.Component.UIBase.CollapsableView
 * @private
 */
var collapsableView = function() {

};

collapsableView.ATTRS = {
  collapsed: {}
}

collapsableView.prototype = {
  //璁剧疆鏀剁缉鏍峰紡
  _uiSetCollapsed: function(v) {
    var _self = this,
      cls = _self.getStatusCls('collapsed'),
      el = _self.get('el');
    if (v) {
      el.addClass(cls);
    } else {
      el.removeClass(cls);
    }
  }
}
/**
 * 鎺т欢灞曞紑鎶樺彔鐨勬墿灞�
 * @class BUI.Component.UIBase.Collapsable
 */
var collapsable = function() {

};

collapsable.ATTRS = {
  /**
   * 鏄惁鍙姌鍙�
   * @type {Boolean}
   */
  collapsable: {
    value: false
  },
  /**
   * 鏄惁宸茬粡鎶樺彔 collapsed
   * @cfg {Boolean} collapsed
   */
  /**
   * 鏄惁宸茬粡鎶樺彔
   * @type {Boolean}
   */
  collapsed: {
    view: true,
    value: false
  },
  events: {
    value: {
      /**
       * 鎺т欢灞曞紑
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {BUI.Component.Controller} target 鎺т欢
       */
      'expanded': true,
      /**
       * 鎺т欢鎶樺彔
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {BUI.Component.Controller} target 鎺т欢
       */
      'collapsed': true
    }
  }
};

collapsable.prototype = {
  _uiSetCollapsed: function(v) {
    var _self = this;
    if (v) {
      _self.fire('collapsed');
    } else {
      _self.fire('expanded');
    }
  }
};

collapsable.View = collapsableView;

module.exports = collapsable;

});
define("bui/common/component/uibase/drag", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鎷栨嫿
 * @author by dxq613@gmail.com
 * @ignore
 */



var $ = require("jquery"),
  dragBackId = BUI.guid('drag');

/**
 * 鎷栨嫿鎺т欢鐨勬墿灞�
 * <pre><code>
 *  var Control = Overlay.extend([UIBase.Drag],{
 *
 *  });
 *
 *  var c = new Contol({ //鎷栧姩鎺т欢鏃讹紝鍦�#t2鍐�
 *      content : '<div id="header"></div><div></div>',
 *      dragNode : '#header',
 *      constraint : '#t2'
 *  });
 * </code></pre>
 * @class BUI.Component.UIBase.Drag
 */
var drag = function() {

};

drag.ATTRS = {

  /**
   * 鐐瑰嚮鎷栧姩鐨勮妭鐐�
   * <pre><code>
   *  var Control = Overlay.extend([UIBase.Drag],{
   *
   *  });
   *
   *  var c = new Contol({ //鎷栧姩鎺т欢鏃讹紝鍦�#t2鍐�
   *      content : '<div id="header"></div><div></div>',
   *      dragNode : '#header',
   *      constraint : '#t2'
   *  });
   * </code></pre>
   * @cfg {jQuery} dragNode
   */
  /**
   * 鐐瑰嚮鎷栧姩鐨勮妭鐐�
   * @type {jQuery}
   * @ignore
   */
  dragNode: {

  },
  /**
   * 鏄惁姝ｅ湪鎷栧姩
   * @type {Boolean}
   * @protected
   */
  draging: {
    setter: function(v) {
      if (v === true) {
        return {};
      }
    },
    value: null
  },
  /**
   * 鎷栧姩鐨勯檺鍒惰寖鍥�
   * <pre><code>
   *  var Control = Overlay.extend([UIBase.Drag],{
   *
   *  });
   *
   *  var c = new Contol({ //鎷栧姩鎺т欢鏃讹紝鍦�#t2鍐�
   *      content : '<div id="header"></div><div></div>',
   *      dragNode : '#header',
   *      constraint : '#t2'
   *  });
   * </code></pre>
   * @cfg {jQuery} constraint
   */
  /**
   * 鎷栧姩鐨勯檺鍒惰寖鍥�
   * @type {jQuery}
   * @ignore
   */
  constraint: {

  },
  /**
   * @private
   * @type {jQuery}
   */
  dragBackEl: {
    /** @private **/
    getter: function() {
      return $('#' + dragBackId);
    }
  }
};
var dragTpl = '<div id="' + dragBackId + '" style="background-color: red; position: fixed; left: 0px; width: 100%; height: 100%; top: 0px; cursor: move; z-index: 999999; display: none; "></div>';

function initBack() {
  var el = $(dragTpl).css('opacity', 0).prependTo('body');
  return el;
}
drag.prototype = {

  __bindUI: function() {
    var _self = this,
      constraint = _self.get('constraint'),
      dragNode = _self.get('dragNode');
    if (!dragNode) {
      return;
    }
    dragNode.on('mousedown', function(e) {

      if (e.which == 1) {
        e.preventDefault();
        _self.set('draging', {
          elX: _self.get('x'),
          elY: _self.get('y'),
          startX: e.pageX,
          startY: e.pageY
        });
        registEvent();
      }
    });
    /**
     * @private
     */
    function mouseMove(e) {
      var draging = _self.get('draging');
      if (draging) {
        e.preventDefault();
        _self._dragMoveTo(e.pageX, e.pageY, draging, constraint);
      }
    }
    /**
     * @private
     */
    function mouseUp(e) {
      if (e.which == 1) {
        _self.set('draging', false);
        var dragBackEl = _self.get('dragBackEl');
        if (dragBackEl) {
          dragBackEl.hide();
        }
        unregistEvent();
      }
    }
    /**
     * @private
     */
    function registEvent() {
      $(document).on('mousemove', mouseMove);
      $(document).on('mouseup', mouseUp);
    }
    /**
     * @private
     */
    function unregistEvent() {
      $(document).off('mousemove', mouseMove);
      $(document).off('mouseup', mouseUp);
    }

  },
  _dragMoveTo: function(x, y, draging, constraint) {
    var _self = this,
      dragBackEl = _self.get('dragBackEl'),
      draging = draging || _self.get('draging'),
      offsetX = draging.startX - x,
      offsetY = draging.startY - y;
    if (!dragBackEl.length) {
      dragBackEl = initBack();
    }
    dragBackEl.css({
      cursor: 'move',
      display: 'block'
    });
    _self.set('xy', [_self._getConstrainX(draging.elX - offsetX, constraint),
      _self._getConstrainY(draging.elY - offsetY, constraint)
    ]);

  },
  _getConstrainX: function(x, constraint) {
    var _self = this,
      width = _self.get('el').outerWidth(),
      endX = x + width,
      curX = _self.get('x');
    //濡傛灉瀛樺湪绾︽潫
    if (constraint) {
      var constraintOffset = constraint.offset();
      if (constraintOffset.left >= x) {
        return constraintOffset.left;
      }
      if (constraintOffset.left + constraint.width() < endX) {
        return constraintOffset.left + constraint.width() - width;
      }
      return x;
    }
    //褰撳乏鍙抽《鐐归兘鍦ㄨ鍥惧唴锛岀Щ鍔ㄥ埌姝ょ偣
    if (BUI.isInHorizontalView(x) && BUI.isInHorizontalView(endX)) {
      return x;
    }

    return curX;
  },
  _getConstrainY: function(y, constraint) {
    var _self = this,
      height = _self.get('el').outerHeight(),
      endY = y + height,
      curY = _self.get('y');
    //濡傛灉瀛樺湪绾︽潫
    if (constraint) {
      var constraintOffset = constraint.offset();
      if (constraintOffset.top > y) {
        return constraintOffset.top;
      }
      if (constraintOffset.top + constraint.height() < endY) {
        return constraintOffset.top + constraint.height() - height;
      }
      return y;
    }
    //褰撳乏鍙抽《鐐归兘鍦ㄨ鍥惧唴锛岀Щ鍔ㄥ埌姝ょ偣
    if (BUI.isInVerticalView(y) && BUI.isInVerticalView(endY)) {
      return y;
    }

    return curY;
  }
};

module.exports = drag;

});
define("bui/common/component/uibase/keynav", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 浣跨敤閿洏瀵艰埅
 * @ignore
 */


  var $ = require("jquery"),
    KeyCode = require("bui/common/keycode"),
    wrapBehavior = BUI.wrapBehavior,
    getWrapBehavior = BUI.getWrapBehavior;
  /**
   * 閿洏瀵艰埅
   * @class BUI.Component.UIBase.KeyNav
   */
  var keyNav = function() {

  };

  keyNav.ATTRS = {

    /**
     * 鏄惁鍏佽閿洏瀵艰埅
     * @cfg {Boolean} [allowKeyNav = true]
     */
    allowKeyNav: {
      value: true
    },
    /**
     * 瀵艰埅浣跨敤鐨勪簨浠�
     * @cfg {String} [navEvent = 'keydown']
     */
    navEvent: {
      value: 'keydown'
    },
    /**
     * 褰撹幏鍙栦簨浠剁殑DOM鏄� input,textarea,select绛夋椂锛屼笉澶勭悊閿洏瀵艰埅
     * @cfg {Object} [ignoreInputFields='true']
     */
    ignoreInputFields: {
      value: true
    }

  };

  keyNav.prototype = {

    __bindUI: function() {

    },
    _uiSetAllowKeyNav: function(v) {
      var _self = this,
        eventName = _self.get('navEvent'),
        el = _self.get('el');
      if (v) {
        el.on(eventName, wrapBehavior(_self, '_handleKeyDown'));
      } else {
        el.off(eventName, getWrapBehavior(_self, '_handleKeyDown'));
      }
    },
    /**
     * 澶勭悊閿洏瀵艰埅
     * @private
     */
    _handleKeyDown: function(ev) {
      var _self = this,
        ignoreInputFields = _self.get('ignoreInputFields'),
        code = ev.which;
      if (ignoreInputFields && $(ev.target).is('input,select,textarea')) {
        return;
      }

      switch (code) {
        case KeyCode.UP:
          //ev.preventDefault();
          _self.handleNavUp(ev);
          break;
        case KeyCode.DOWN:
          //ev.preventDefault();
          _self.handleNavDown(ev);
          break;
        case KeyCode.RIGHT:
         // ev.preventDefault();
          _self.handleNavRight(ev);
          break;
        case KeyCode.LEFT:
          //ev.preventDefault();
          _self.handleNavLeft(ev);
          break;
        case KeyCode.ENTER:
          _self.handleNavEnter(ev);
          break;
        case KeyCode.ESC:
          _self.handleNavEsc(ev);
          break;
        case KeyCode.TAB:
          _self.handleNavTab(ev);
          break;
        default:
          break;
      }
    },
    /**
     * 澶勭悊鍚戜笂瀵艰埅
     * @protected
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavUp: function(ev) {
      // body...
    },
    /**
     * 澶勭悊鍚戜笅瀵艰埅
     * @protected
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavDown: function(ev) {
      // body...
    },
    /**
     * 澶勭悊鍚戝乏瀵艰埅
     * @protected
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavLeft: function(ev) {
      // body...
    },
    /**
     * 澶勭悊鍚戝彸瀵艰埅
     * @protected
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavRight: function(ev) {
      // body...
    },
    /**
     * 澶勭悊纭閿�
     * @protected
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavEnter: function(ev) {
      // body...
    },
    /**
     * 澶勭悊 esc 閿�
     * @protected
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavEsc: function(ev) {
      // body...
    },
    /**
     * 澶勭悊Tab閿�
     * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
     */
    handleNavTab: function(ev) {

    }

  };

module.exports = keyNav;

});
define("bui/common/component/uibase/list", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鎵€鏈夊瓙鍏冪礌閮芥槸鍚屼竴绫荤殑闆嗗悎
 * @ignore
 */


var $ = require("jquery"),
  Selection = require("bui/common/component/uibase/selection");

/**
 * 鍒楄〃涓€绫荤殑鎺т欢鐨勬墿灞曪紝list,menu,grid閮芥槸鍙互浠庢绫绘墿灞�
 * @class BUI.Component.UIBase.List
 */
var list = function() {

};

list.ATTRS = {

  /**
   * 閫夋嫨鐨勬暟鎹泦鍚�
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
   *   idField : 'value',
   *   render : '#t1',
   *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   * });
   * list.render();
   * </code></pre>
   * @cfg {Array} items
   */
  /**
   * 閫夋嫨鐨勬暟鎹泦鍚�
   * <pre><code>
   *  list.set('items',items); //鍒楄〃浼氱洿鎺ユ浛鎹㈠唴瀹�
   *  //绛夊悓浜�
   *  list.clearItems();
   *  list.addItems(items);
   * </code></pre>
   * @type {Array}
   */
  items: {
    shared: false,
    view: true
  },
  /**
   * 閫夐」鐨勯粯璁ey鍊�
   * @cfg {String} [idField = 'id']
   */
  idField: {
    value: 'id'
  },
  /**
   * 鍒楄〃椤圭殑榛樿妯℃澘,浠呭湪鍒濆鍖栨椂浼犲叆銆�
   * @type {String}
   * @ignore
   */
  itemTpl: {
    view: true
  },
  /**
   * 鍒楄〃椤圭殑娓叉煋鍑芥暟锛屽簲瀵瑰垪琛ㄩ」涔嬮棿鏈夊緢澶氬樊寮傛椂
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTplRender : function(item){
   *     if(item.type == '1'){
   *       return '&lt;li&gt;&lt;img src="xxx.jpg"/&gt;'+item.text+'&lt;/li&gt;'
   *     }else{
   *       return '&lt;li&gt;item.text&lt;/li&gt;'
   *     }
   *   },
   *   idField : 'value',
   *   render : '#t1',
   *   items : [{value : '1',text : '1',type : '0'},{value : '2',text : '2',type : '1'}]
   * });
   * list.render();
   * </code></pre>
   * @type {Function}
   */
  itemTplRender: {
    view: true
  },
  /**
   * 瀛愭帶浠跺悇涓姸鎬侀粯璁ら噰鐢ㄧ殑鏍峰紡
   * <pre><code>
   * var list = new List.SimpleList({
   *   render : '#t1',
   *   itemStatusCls : {
   *     selected : 'active', //榛樿鏍峰紡涓簂ist-item-selected,鐜板湪鍙樻垚'active'
   *     hover : 'hover' //榛樿鏍峰紡涓簂ist-item-hover,鐜板湪鍙樻垚'hover'
   *   },
   *   items : [{id : '1',text : '1',type : '0'},{id : '2',text : '2',type : '1'}]
   * });
   * list.render();
   * </code></pre>
   * see {@link BUI.Component.Controller#property-statusCls}
   * @type {Object}
   */
  itemStatusCls: {
    view: true,
    value: {}
  },
  events: {

    value: {
      /**
       * 閫夐」鐐瑰嚮浜嬩欢
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {BUI.Component.UIBase.ListItem} e.item 鐐瑰嚮鐨勯€夐」
       * @param {HTMLElement} e.element 閫夐」浠ｈ〃鐨凞OM瀵硅薄
       * @param {HTMLElement} e.domTarget 鐐瑰嚮鐨凞OM瀵硅薄
       * @param {HTMLElement} e.domEvent 鐐瑰嚮鐨勫師鐢熶簨浠跺璞�
       */
      'itemclick': true
    }
  }
};

list.prototype = {

  /**
   * 鑾峰彇閫夐」鐨勬暟閲�
   * <pre><code>
   *   var count = list.getItemCount();
   * </code></pre>
   * @return {Number} 閫夐」鏁伴噺
   */
  getItemCount: function() {
    return this.getItems().length;
  },
  /**
   * 鑾峰彇瀛楁鐨勫€�
   * @param {*} item 瀛楁鍚�
   * @param {String} field 瀛楁鍚�
   * @return {*} 瀛楁鐨勫€�
   * @protected
   */
  getValueByField: function(item, field) {

  },
  /**
   * 鑾峰彇鎵€鏈夐€夐」鍊硷紝濡傛灉閫夐」鏄瓙鎺т欢锛屽垯鏄墍鏈夊瓙鎺т欢
   * <pre><code>
   *   var items = list.getItems();
   *   //绛夊悓
   *   list.get(items);
   * </code></pre>
   * @return {Array} 閫夐」鍊奸泦鍚�
   */
  getItems: function() {

  },
  /**
   * 鑾峰彇绗竴椤�
   * <pre><code>
   *   var item = list.getFirstItem();
   *   //绛夊悓
   *   list.getItemAt(0);
   * </code></pre>
   * @return {Object|BUI.Component.Controller} 閫夐」鍊硷紙瀛愭帶浠讹級
   */
  getFirstItem: function() {
    return this.getItemAt(0);
  },
  /**
   * 鑾峰彇鏈€鍚庝竴椤�
   * <pre><code>
   *   var item = list.getLastItem();
   *   //绛夊悓
   *   list.getItemAt(list.getItemCount()-1);
   * </code></pre>
   * @return {Object|BUI.Component.Controller} 閫夐」鍊硷紙瀛愭帶浠讹級
   */
  getLastItem: function() {
    return this.getItemAt(this.getItemCount() - 1);
  },
  /**
   * 閫氳繃绱㈠紩鑾峰彇閫夐」鍊硷紙瀛愭帶浠讹級
   * <pre><code>
   *   var item = list.getItemAt(0); //鑾峰彇绗�1涓�
   *   var item = list.getItemAt(2); //鑾峰彇绗�3涓�
   * </code></pre>
   * @param  {Number} index 绱㈠紩鍊�
   * @return {Object|BUI.Component.Controller}  閫夐」锛堝瓙鎺т欢锛�
   */
  getItemAt: function(index) {
    return this.getItems()[index] || null;
  },
  /**
   * 閫氳繃Id鑾峰彇閫夐」锛屽鏋滄槸鏀瑰彉浜唅dField鍒欓€氳繃鏀瑰彉鐨刬dField鏉ユ煡鎵鹃€夐」
   * <pre><code>
   *   //濡傛灉idField = 'id'
   *   var item = list.getItem('2');
   *   //绛夊悓浜�
   *   list.findItemByField('id','2');
   *
   *   //濡傛灉idField = 'value'
   *   var item = list.getItem('2');
   *   //绛夊悓浜�
   *   list.findItemByField('value','2');
   * </code></pre>
   * @param {String} id 缂栧彿
   * @return {Object|BUI.Component.Controller} 閫夐」锛堝瓙鎺т欢锛�
   */
  getItem: function(id) {
    var field = this.get('idField');
    return this.findItemByField(field, id);
  },
  /**
   * 杩斿洖鎸囧畾椤圭殑绱㈠紩
   * <pre><code>
   * var index = list.indexOf(item); //杩斿洖绱㈠紩锛屼笉瀛樺湪鍒欒繑鍥�-1
   * </code></pre>
   * @param  {Object|BUI.Component.Controller} item 閫夐」
   * @return {Number}   椤圭殑绱㈠紩鍊�
   */
  indexOfItem: function(item) {
    return BUI.Array.indexOf(item, this.getItems());
  },
  /**
   * 娣诲姞澶氭潯閫夐」
   * <pre><code>
   * var items = [{id : '1',text : '1'},{id : '2',text : '2'}];
   * list.addItems(items);
   * </code></pre>
   * @param {Array} items 璁板綍闆嗗悎锛堝瓙鎺т欢閰嶇疆椤癸級
   */
  addItems: function(items) {
    var _self = this;
    BUI.each(items, function(item) {
      _self.addItem(item);
    });
  },
  /**
   * 鎻掑叆澶氭潯璁板綍
   * <pre><code>
   * var items = [{id : '1',text : '1'},{id : '2',text : '2'}];
   * list.addItemsAt(items,0); // 鍦ㄦ渶鍓嶉潰鎻掑叆
   * list.addItemsAt(items,2); //绗笁涓綅缃彃鍏�
   * </code></pre>
   * @param  {Array} items 澶氭潯璁板綍
   * @param  {Number} start 璧峰浣嶇疆
   */
  addItemsAt: function(items, start) {
    var _self = this;
    BUI.each(items, function(item, index) {
      _self.addItemAt(item, start + index);
    });
  },
  /**
   * 鏇存柊鍒楄〃椤癸紝淇敼閫夐」鍊煎悗锛孌OM璺熼殢鍙樺寲
   * <pre><code>
   *   var item = list.getItem('2');
   *   list.text = '鏂板唴瀹�'; //姝ゆ椂瀵瑰簲鐨凞OM涓嶄細鍙樺寲
   *   list.updateItem(item); //DOM杩涜鐩稿簲鐨勫彉鍖�
   * </code></pre>
   * @param  {Object} item 閫夐」鍊�
   */
  updateItem: function(item) {

  },
  /**
   * 娣诲姞閫夐」,娣诲姞鍦ㄦ帶浠舵渶鍚�
   *
   * <pre><code>
   * list.addItem({id : '3',text : '3',type : '0'});
   * </code></pre>
   *
   * @param {Object|BUI.Component.Controller} item 閫夐」锛屽瓙鎺т欢閰嶇疆椤广€佸瓙鎺т欢
   * @return {Object|BUI.Component.Controller} 瀛愭帶浠舵垨鑰呴€夐」璁板綍
   */
  addItem: function(item) {
    return this.addItemAt(item, this.getItemCount());
  },
  /**
   * 鍦ㄦ寚瀹氫綅缃坊鍔犻€夐」
   * <pre><code>
   * list.addItemAt({id : '3',text : '3',type : '0'},0); //绗竴涓綅缃�
   * </code></pre>
   * @param {Object|BUI.Component.Controller} item 閫夐」锛屽瓙鎺т欢閰嶇疆椤广€佸瓙鎺т欢
   * @param {Number} index 绱㈠紩
   * @return {Object|BUI.Component.Controller} 瀛愭帶浠舵垨鑰呴€夐」璁板綍
   */
  addItemAt: function(item, index) {

  },
  /**
   * 鏍规嵁瀛楁鏌ユ壘鎸囧畾鐨勯」
   * @param {String} field 瀛楁鍚�
   * @param {Object} value 瀛楁鍊�
   * @return {Object} 鏌ヨ鍑烘潵鐨勯」锛堜紶鍏ョ殑璁板綍鎴栬€呭瓙鎺т欢锛�
   * @protected
   */
  findItemByField: function(field, value) {

  },
  /**
   *
   * 鑾峰彇姝ら」鏄剧ず鐨勬枃鏈�
   * @param {Object} item 鑾峰彇璁板綍鏄剧ず鐨勬枃鏈�
   * @protected
   */
  getItemText: function(item) {

  },
  /**
   * 娓呴櫎鎵€鏈夐€夐」,涓嶇瓑鍚屼簬鍒犻櫎鍏ㄩ儴锛屾鏃朵笉浼氳Е鍙戝垹闄や簨浠�
   * <pre><code>
   * list.clearItems();
   * //绛夊悓浜�
   * list.set('items',items);
   * </code></pre>
   */
  clearItems: function() {
    var _self = this,
      items = _self.getItems();
    items.splice(0);
    _self.clearControl();
  },
  /**
   * 鍒犻櫎閫夐」
   * <pre><code>
   * var item = list.getItem('1');
   * list.removeItem(item);
   * </code></pre>
   * @param {Object|BUI.Component.Controller} item 閫夐」锛堝瓙鎺т欢锛�
   */
  removeItem: function(item) {

  },
  /**
   * 绉婚櫎閫夐」闆嗗悎
   * <pre><code>
   * var items = list.getSelection();
   * list.removeItems(items);
   * </code></pre>
   * @param  {Array} items 閫夐」闆嗗悎
   */
  removeItems: function(items) {
    var _self = this;

    BUI.each(items, function(item) {
      _self.removeItem(item);
    });
  },
  /**
   * 閫氳繃绱㈠紩鍒犻櫎閫夐」
   * <pre><code>
   * list.removeItemAt(0); //鍒犻櫎绗竴涓�
   * </code></pre>
   * @param  {Number} index 绱㈠紩
   */
  removeItemAt: function(index) {
    this.removeItem(this.getItemAt(index));
  },
  /**
   * @protected
   * @template
   * 娓呴櫎鎵€鏈夌殑瀛愭帶浠舵垨鑰呭垪琛ㄩ」鐨凞OM
   */
  clearControl: function() {

  }
}





function clearSelected(item) {
  if (item.selected) {
    item.selected = false;
  }
  if (item.set) {
    item.set('selected', false);
  }
}

function beforeAddItem(self, item) {

  var c = item.isController ? item.getAttrVals() : item,
    defaultTpl = self.get('itemTpl'),
    defaultStatusCls = self.get('itemStatusCls'),
    defaultTplRender = self.get('itemTplRender');

  //閰嶇疆榛樿妯℃澘
  if (defaultTpl && !c.tpl) {
    setItemAttr(item, 'tpl', defaultTpl);
    //  c.tpl = defaultTpl;
  }
  //閰嶇疆榛樿娓叉煋鍑芥暟
  if (defaultTplRender && !c.tplRender) {
    setItemAttr(item, 'tplRender', defaultTplRender);
    //c.tplRender = defaultTplRender;
  }
  //閰嶇疆榛樿鐘舵€佹牱寮�
  if (defaultStatusCls) {
    var statusCls = c.statusCls || item.isController ? item.get('statusCls') : {};
    BUI.each(defaultStatusCls, function(v, k) {
      if (v && !statusCls[k]) {
        statusCls[k] = v;
      }
    });
    setItemAttr(item, 'statusCls', statusCls)
    //item.statusCls = statusCls;
  }
  // clearSelected(item);
}

function setItemAttr(item, name, val) {
  if (item.isController) {
    item.set(name, val);
  } else {
    item[name] = val;
  }
}

/**
 * @class BUI.Component.UIBase.ChildList
 * 閫変腑鍏朵腑鐨凞OM缁撴瀯
 * @extends BUI.Component.UIBase.List
 * @mixins BUI.Component.UIBase.Selection
 */
var childList = function() {
  this.__init();
};

childList.ATTRS = BUI.merge(true, list.ATTRS, Selection.ATTRS, {
  items: {
    sync: false
  },
  /**
   * 閰嶇疆鐨刬tems 椤规槸鍦ㄥ垵濮嬪寲鏃朵綔涓篶hildren
   * @protected
   * @type {Boolean}
   */
  autoInitItems: {
    value: true
  },
  /**
   * 浣跨敤srcNode鏃讹紝鏄惁灏嗗唴閮ㄧ殑DOM杞崲鎴愬瓙鎺т欢
   * @type {Boolean}
   */
  isDecorateChild: {
    value: true
  },
  /**
   * 榛樿鐨勫姞杞芥帶浠跺唴瀹圭殑閰嶇疆,榛樿鍊硷細
   * <pre>
   *  {
   *   property : 'children',
   *   dataType : 'json'
   * }
   * </pre>
   * @type {Object}
   */
  defaultLoaderCfg: {
    value: {
      property: 'children',
      dataType: 'json'
    }
  }
});

BUI.augment(childList, list, Selection, {
  //鍒濆鍖栵紝灏唅tems杞崲鎴恈hildren
  __init: function() {
    var _self = this,
      items = _self.get('items');
    if (items && _self.get('autoInitItems')) {
      _self.addItems(items);
    }
    _self.on('beforeRenderUI', function() {
      _self._beforeRenderUI();
    });
  },
  _uiSetItems: function(items) {
    var _self = this;
    //娓呯悊瀛愭帶浠�
    _self.clearControl();
    _self.addItems(items);
  },
  //娓叉煋瀛愭帶浠�
  _beforeRenderUI: function() {
    var _self = this,
      children = _self.get('children'),
      items = _self.get('items');
    BUI.each(children, function(item) {
      beforeAddItem(_self, item);
    });
  },
  //缁戝畾浜嬩欢
  __bindUI: function() {
    var _self = this,
      selectedEvent = _self.get('selectedEvent');

    _self.on(selectedEvent, function(e) {
      var item = e.target;
      if (item.get('selectable')) {
        if (!item.get('selected')) {
          _self.setSelected(item);
        } else if (_self.get('multipleSelect')) {
          _self.clearSelected(item);
        }
      }
    });

    _self.on('click', function(e) {
      if (e.target !== _self) {
        _self.fire('itemclick', {
          item: e.target,
          domTarget: e.domTarget,
          domEvent: e
        });
      }
    });
    _self.on('beforeAddChild', function(ev) {
      beforeAddItem(_self, ev.child);
    });
    _self.on('beforeRemoveChild', function(ev) {
      var item = ev.child,
        selected = item.get('selected');
      //娓呯悊閫変腑鐘舵€�
      if (selected) {
        if (_self.get('multipleSelect')) {
          _self.clearSelected(item);
        } else {
          _self.setSelected(null);
        }
      }
      item.set('selected', false);
    });
  },
  /**
   * @protected
   * @override
   * 娓呴櫎鑰呭垪琛ㄩ」鐨凞OM
   */
  clearControl: function() {
    this.removeChildren(true);
  },
  /**
   * 鑾峰彇鎵€鏈夊瓙鎺т欢
   * @return {Array} 瀛愭帶浠堕泦鍚�
   * @override
   */
  getItems: function() {
    return this.get('children');
  },
  /**
   * 鏇存柊鍒楄〃椤�
   * @param  {Object} item 閫夐」鍊�
   */
  updateItem: function(item) {
    var _self = this,
      idField = _self.get('idField'),
      element = _self.findItemByField(idField, item[idField]);
    if (element) {
      element.setTplContent();
    }
    return element;
  },
  /**
   * 鍒犻櫎椤�,瀛愭帶浠朵綔涓洪€夐」
   * @param  {Object} element 瀛愭帶浠�
   */
  removeItem: function(item) {
    var _self = this,
      idField = _self.get('idField');
    if (!(item instanceof BUI.Component.Controller)) {
      item = _self.findItemByField(idField, item[idField]);
    }
    this.removeChild(item, true);
  },
  /**
   * 鍦ㄦ寚瀹氫綅缃坊鍔犻€夐」,姝ゅ閫夐」鎸囧瓙鎺т欢
   * @param {Object|BUI.Component.Controller} item 瀛愭帶浠堕厤缃」銆佸瓙鎺т欢
   * @param {Number} index 绱㈠紩
   * @return {Object|BUI.Component.Controller} 瀛愭帶浠�
   */
  addItemAt: function(item, index) {
    return this.addChild(item, index);
  },
  findItemByField: function(field, value, root) {

    root = root || this;
    var _self = this,
      children = root.get('children'),
      result = null;
    $(children).each(function(index, item) {
      if (item.get(field) == value) {
        result = item;
      } else if (item.get('children').length) {
        result = _self.findItemByField(field, value, item);
      }
      if (result) {
        return false;
      }
    });
    return result;
  },
  getItemText: function(item) {
    return item.get('el').text();
  },
  getValueByField: function(item, field) {
    return item && item.get(field);
  },
  /**
   * @protected
   * @ignore
   */
  setItemSelectedStatus: function(item, selected) {
    var _self = this,
      method = selected ? 'addClass' : 'removeClass',
      element = null;

    if (item) {
      item.set('selected', selected);
      element = item.get('el');
    }
    _self.afterSelected(item, selected, element);
  },
  /**
   * 閫夐」鏄惁琚€変腑
   * @override
   * @param  {*}  item 閫夐」
   * @return {Boolean}  鏄惁閫変腑
   */
  isItemSelected: function(item) {
    return item ? item.get('selected') : false;
  },
  /**
   * 璁剧疆鎵€鏈夐€夐」閫変腑
   * @override
   */
  setAllSelection: function() {
    var _self = this,
      items = _self.getItems();
    _self.setSelection(items);
  },
  /**
   * 鑾峰彇閫変腑鐨勯」鐨勫€�
   * @return {Array}
   * @override
   * @ignore
   */
  getSelection: function() {
    var _self = this,
      items = _self.getItems(),
      rst = [];
    BUI.each(items, function(item) {
      if (_self.isItemSelected(item)) {
        rst.push(item);
      }

    });
    return rst;
  }
});

list.ChildList = childList;

module.exports = list;

/**
 * @ignore
 * 2013-1-22
 *   鏇存敼鏄剧ず鏁版嵁鐨勬柟寮忥紝浣跨敤 _uiSetItems
 */

});
define("bui/common/component/uibase/selection", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鍗曢€夋垨鑰呭閫�
 * @author  dxq613@gmail.com
 * @ignore
 */
var $ = require("jquery");
var SINGLE_SELECTED = 'single';

/**
 * @class BUI.Component.UIBase.Selection
 * 閫変腑鎺т欢涓殑椤癸紙瀛愬厓绱犳垨鑰匘OM锛夛紝姝ょ被閫夋嫨鐨勫唴瀹规湁2绉�
 * <ol>
 *     <li>瀛愭帶浠�</li>
 *     <li>DOM鍏冪礌</li>
 * </ol>
 * ** 褰撻€夋嫨鏄瓙鎺т欢鏃讹紝element 鍜� item 閮芥槸鎸� 瀛愭帶浠讹紱**
 * ** 褰撻€夋嫨鐨勬槸DOM鍏冪礌鏃讹紝element 鎸嘍OM鍏冪礌锛宨tem 鎸嘍OM鍏冪礌瀵瑰簲鐨勮褰� **
 * @abstract
 */
var selection = function() {

};

selection.ATTRS =

{
  /**
   * 閫変腑鐨勪簨浠�
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
   *   idField : 'value',
   *   selectedEvent : 'mouseenter',
   *   render : '#t1',
   *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   * });
   * </code></pre>
   * @cfg {String} [selectedEvent = 'click']
   */
  selectedEvent: {
    value: 'click'
  },
  events: {
    value: {
      /**
       * 閫変腑鐨勮彍鍗曟敼鍙樻椂鍙戠敓锛�
       * 澶氶€夋椂锛岄€変腑锛屽彇娑堥€変腑閮借Е鍙戞浜嬩欢锛屽崟閫夋椂锛屽彧鏈夐€変腑鏃惰Е鍙戞浜嬩欢
       * @name  BUI.Component.UIBase.Selection#selectedchange
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 褰撳墠閫変腑鐨勯」
       * @param {HTMLElement} e.domTarget 褰撳墠閫変腑鐨勯」鐨凞OM缁撴瀯
       * @param {Boolean} e.selected 鏄惁閫変腑
       */
      'selectedchange': false,

      /**
       * 閫夋嫨鏀瑰彉鍓嶈Е鍙戯紝鍙互閫氳繃return false锛岄樆姝electedchange浜嬩欢
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 褰撳墠閫変腑鐨勯」
       * @param {Boolean} e.selected 鏄惁閫変腑
       */
      'beforeselectedchange': false,

      /**
       * 鑿滃崟閫変腑
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 褰撳墠閫変腑鐨勯」
       * @param {HTMLElement} e.domTarget 褰撳墠閫変腑鐨勯」鐨凞OM缁撴瀯
       */
      'itemselected': false,
      /**
       * 鑿滃崟鍙栨秷閫変腑
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 褰撳墠閫変腑鐨勯」
       * @param {HTMLElement} e.domTarget 褰撳墠閫変腑鐨勯」鐨凞OM缁撴瀯
       */
      'itemunselected': false
    }
  },
  /**
   * 鏁版嵁鐨刬d瀛楁鍚嶇О锛岄€氳繃姝ゅ瓧娈垫煡鎵惧搴旂殑鏁版嵁
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
   *   idField : 'value',
   *   render : '#t1',
   *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   * });
   * </code></pre>
   * @cfg {String} [idField = 'id']
   */
  /**
   * 鏁版嵁鐨刬d瀛楁鍚嶇О锛岄€氳繃姝ゅ瓧娈垫煡鎵惧搴旂殑鏁版嵁
   * @type {String}
   * @ignore
   */
  idField: {
    value: 'id'
  },
  /**
   * 鏄惁澶氶€�
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
   *   idField : 'value',
   *   render : '#t1',
   *   multipleSelect : true,
   *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   * });
   * </code></pre>
   * @cfg {Boolean} [multipleSelect=false]
   */
  /**
   * 鏄惁澶氶€�
   * @type {Boolean}
   * @default false
   */
  multipleSelect: {
    value: false
  }

};

selection.prototype =

{
  /**
   * 娓呯悊閫変腑鐨勯」
   * <pre><code>
   *  list.clearSelection();
   * </code></pre>
   *
   */
  clearSelection: function() {
    var _self = this,
      selection = _self.getSelection();
    BUI.each(selection, function(item) {
      _self.clearSelected(item);
    });
  },
  /**
   * 鑾峰彇閫変腑鐨勯」鐨勫€�
   * @template
   * @return {Array}
   */
  getSelection: function() {

  },
  /**
   * 鑾峰彇閫変腑鐨勭涓€椤�
   * <pre><code>
   * var item = list.getSelected(); //澶氶€夋ā寮忎笅绗竴鏉�
   * </code></pre>
   * @return {Object} 閫変腑鐨勭涓€椤规垨鑰呬负undefined
   */
  getSelected: function() {
    return this.getSelection()[0];
  },
  /**
   * 鏍规嵁 idField 鑾峰彇鍒扮殑鍊�
   * @protected
   * @return {Object} 閫変腑鐨勫€�
   */
  getSelectedValue: function() {
    var _self = this,
      field = _self.get('idField'),
      item = _self.getSelected();

    return _self.getValueByField(item, field);
  },
  /**
   * 鑾峰彇閫変腑鐨勫€奸泦鍚�
   * @protected
   * @return {Array} 閫変腑鍊煎緱闆嗗悎
   */
  getSelectionValues: function() {
    var _self = this,
      field = _self.get('idField'),
      items = _self.getSelection();
    return $.map(items, function(item) {
      return _self.getValueByField(item, field);
    });
  },
  /**
   * 鑾峰彇閫変腑鐨勬枃鏈�
   * @protected
   * @return {Array} 閫変腑鐨勬枃鏈泦鍚�
   */
  getSelectionText: function() {
    var _self = this,
      items = _self.getSelection();
    return $.map(items, function(item) {
      return _self.getItemText(item);
    });
  },
  /**
   * 绉婚櫎閫変腑
   * <pre><code>
   *    var item = list.getItem('id'); //閫氳繃id 鑾峰彇閫夐」
   *    list.setSelected(item); //閫変腑
   *
   *    list.clearSelected();//鍗曢€夋ā寮忎笅娓呴櫎鎵€閫夛紝澶氶€夋ā寮忎笅娓呴櫎閫変腑鐨勭涓€椤�
   *    list.clearSelected(item); //娓呴櫎閫夐」鐨勯€変腑鐘舵€�
   * </code></pre>
   * @param {Object} [item] 娓呴櫎閫夐」鐨勯€変腑鐘舵€侊紝濡傛灉鏈寚瀹氬垯娓呴櫎閫変腑鐨勭涓€涓€夐」鐨勯€変腑鐘舵€�
   */
  clearSelected: function(item) {
    var _self = this;
    item = item || _self.getSelected();
    if (item) {
      _self.setItemSelected(item, false);
    }
  },
  /**
   * 鑾峰彇閫夐」鏄剧ず鐨勬枃鏈�
   * @protected
   */
  getSelectedText: function() {
    var _self = this,
      item = _self.getSelected();
    return _self.getItemText(item);
  },
  /**
   * 璁剧疆閫変腑鐨勯」
   * <pre><code>
   *  var items = list.getItemsByStatus('active'); //鑾峰彇鏌愮鐘舵€佺殑閫夐」
   *  list.setSelection(items);
   * </code></pre>
   * @param {Array} items 椤圭殑闆嗗悎
   */
  setSelection: function(items) {
    var _self = this;

    items = BUI.isArray(items) ? items : [items];

    BUI.each(items, function(item) {
      _self.setSelected(item);
    });
  },
  /**
   * 璁剧疆閫変腑鐨勯」
   * <pre><code>
   *   var item = list.getItem('id');
   *   list.setSelected(item);
   * </code></pre>
   * @param {Object} item 璁板綍鎴栬€呭瓙鎺т欢
   */
  setSelected: function(item) {
    var _self = this,
      multipleSelect = _self.get('multipleSelect');

    if (!_self.isItemSelectable(item)) {
      return;
    }
    if (!multipleSelect) {
      var selectedItem = _self.getSelected();
      if (item != selectedItem) {
        //濡傛灉鏄崟閫夛紝娓呴櫎宸茬粡閫変腑鐨勯」
        _self.clearSelected(selectedItem);
      }

    }
    _self.setItemSelected(item, true);

  },
  /**
   * 閫夐」鏄惁琚€変腑
   * @template
   * @param  {*}  item 閫夐」
   * @return {Boolean}  鏄惁閫変腑
   */
  isItemSelected: function(item) {

  },
  /**
   * 閫夐」鏄惁鍙互閫変腑
   * @protected
   * @param {*} item 閫夐」
   * @return {Boolean} 閫夐」鏄惁鍙互閫変腑
   */
  isItemSelectable: function(item) {
    return true;
  },
  /**
   * 璁剧疆閫夐」鐨勯€変腑鐘舵€�
   * @param {*} item 閫夐」
   * @param {Boolean} selected 閫変腑鎴栬€呭彇娑堥€変腑
   * @protected
   */
  setItemSelected: function(item, selected) {
    var _self = this,
      isSelected;

    //褰撳墠鐘舵€佺瓑浜庤璁剧疆鐨勭姸鎬佹椂锛屼笉瑙﹀彂鏀瑰彉浜嬩欢
    if (item) {
      isSelected = _self.isItemSelected(item);
      if (isSelected == selected) {
        return;
      }
    }
    if (_self.fire('beforeselectedchange', {
      item: item,
      selected: selected
    }) !== false) {
      _self.setItemSelectedStatus(item, selected);
    }
  },
  /**
   * 璁剧疆閫夐」鐨勯€変腑鐘舵€�
   * @template
   * @param {*} item 閫夐」
   * @param {Boolean} selected 閫変腑鎴栬€呭彇娑堥€変腑
   * @protected
   */
  setItemSelectedStatus: function(item, selected) {

  },
  /**
   * 璁剧疆鎵€鏈夐€夐」閫変腑
   * <pre><code>
   *  list.setAllSelection(); //閫変腑鍏ㄩ儴锛屽閫夌姸鎬佷笅鏈夋晥
   * </code></pre>
   * @template
   */
  setAllSelection: function() {

  },
  /**
   * 璁剧疆椤归€変腑锛岄€氳繃瀛楁鍜屽€�
   * @param {String} field 瀛楁鍚�,榛樿涓洪厤缃」'idField',鎵€浠ユ瀛楁鍙互涓嶅～鍐欙紝浠呭～鍐欏€�
   * @param {Object} value 鍊�
   * @example
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTpl : '&lt;li id="{id}"&gt;{text}&lt;/li&gt;',
   *   idField : 'id', //id 瀛楁浣滀负key
   *   render : '#t1',
   *   items : [{id : '1',text : '1'},{id : '2',text : '2'}]
   * });
   *
   *   list.setSelectedByField('123'); //榛樿鎸夌収id瀛楁鏌ユ壘
   *   //鎴栬€�
   *   list.setSelectedByField('id','123');
   *
   *   list.setSelectedByField('value','123');
   * </code></pre>
   */
  setSelectedByField: function(field, value) {
    if (!value) {
      value = field;
      field = this.get('idField');
    }
    var _self = this,
      item = _self.findItemByField(field, value);
    _self.setSelected(item);
  },
  /**
   * 璁剧疆澶氫釜閫変腑锛屾牴鎹瓧娈靛拰鍊�
   * <pre><code>
   * var list = new List.SimpleList({
   *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;',
   *   idField : 'value', //value 瀛楁浣滀负key
   *   render : '#t1',
   *   multipleSelect : true,
   *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
   * });
   *   var values = ['1','2','3'];
   *   list.setSelectionByField(values);//
   *
   *   //绛変簬
   *   list.setSelectionByField('value',values);
   * </code></pre>
   * @param {String} field 榛樿涓篿dField
   * @param {Array} values 鍊煎緱闆嗗悎
   */
  setSelectionByField: function(field, values) {
    if (!values) {
      values = field;
      field = this.get('idField');
    }
    var _self = this;
    BUI.each(values, function(value) {
      _self.setSelectedByField(field, value);
    });
  },
  /**
   * 閫変腑瀹屾垚鍚庯紝瑙﹀彂浜嬩欢
   * @protected
   * @param  {*} item 閫夐」
   * @param  {Boolean} selected 鏄惁閫変腑
   * @param  {jQuery} element
   */
  afterSelected: function(item, selected, element) {
    var _self = this;

    if (selected) {
      _self.fire('itemselected', {
        item: item,
        domTarget: element
      });
      _self.fire('selectedchange', {
        item: item,
        domTarget: element,
        selected: selected
      });
    } else {
      _self.fire('itemunselected', {
        item: item,
        domTarget: element
      });
      if (_self.get('multipleSelect')) { //鍙湁褰撳閫夋椂锛屽彇娑堥€変腑鎵嶈Е鍙憇electedchange
        _self.fire('selectedchange', {
          item: item,
          domTarget: element,
          selected: selected
        });
      }
    }
  }

}

module.exports = selection;

});
define("bui/common/component/uibase/listitem", [], function(require, exports, module){
/**
 * @fileOverview 鍙€変腑鐨勬帶浠�,鐖舵帶浠舵敮鎸乻election鎵╁睍
 * @ignore
 */


/**
 * 鍒楄〃椤规帶浠剁殑瑙嗗浘灞�
 * @class BUI.Component.UIBase.ListItemView
 * @private
 */
function listItemView() {
  // body...
}

listItemView.ATTRS = {
  /**
   * 鏄惁閫変腑
   * @type {Boolean}
   */
  selected: {

  }
};

listItemView.prototype = {
  _uiSetSelected: function(v) {
    var _self = this,
      cls = _self.getStatusCls('selected'),
      el = _self.get('el');
    if (v) {
      el.addClass(cls);
    } else {
      el.removeClass(cls);
    }
  }
};
/**
 * 鍒楄〃椤圭殑鎵╁睍
 * @class BUI.Component.UIBase.ListItem
 */
function listItem() {

}

listItem.ATTRS = {

  /**
   * 鏄惁鍙互琚€変腑
   * @cfg {Boolean} [selectable=true]
   */
  /**
   * 鏄惁鍙互琚€変腑
   * @type {Boolean}
   */
  selectable: {
    value: true
  },

  /**
   * 鏄惁閫変腑,鍙兘閫氳繃璁剧疆鐖剁被鐨勯€変腑鏂规硶鏉ュ疄鐜伴€変腑
   * @type {Boolean}
   * @readOnly
   */
  selected: {
    view: true,
    sync: false,
    value: false
  }
};

listItem.prototype = {

};

listItem.View = listItemView;

module.exports = listItem;

});
define("bui/common/component/uibase/mask", ["jquery"], function(require, exports, module){
/**
 * @fileOverview mask 閬僵灞�
 * @author yiminghe@gmail.com
 * copied and modified by dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery"),
  UA = require("bui/common/ua"),

  /**
   * 姣忕粍鐩稿悓 prefixCls 鐨� position 鍏变韩涓€涓伄缃�
   * @ignore
   */
  maskMap = {
    /**
     * @ignore
     * {
     *  node:
     *  num:
     * }
     */

  },
  ie6 = UA.ie == 6;

function getMaskCls(self) {
  return self.get('prefixCls') + 'ext-mask';
}

function docWidth() {
  return ie6 ? BUI.docWidth() + 'px' : '100%';
}

function docHeight() {
  return ie6 ? BUI.docHeight() + 'px' : '100%';
}

function initMask(maskCls) {
  var mask = $('<div ' +
      ' style="width:' + docWidth() + ';' +
      'left:0;' +
      'top:0;' +
      'height:' + docHeight() + ';' +
      'position:' + (ie6 ? 'absolute' : 'fixed') + ';"' +
      ' class="' +
      maskCls +
      '">' +
      (ie6 ? '<' + 'iframe ' +
        'style="position:absolute;' +
        'left:' + '0' + ';' +
        'top:' + '0' + ';' +
        'background:white;' +
        'width: expression(this.parentNode.offsetWidth);' +
        'height: expression(this.parentNode.offsetHeight);' +
        'filter:alpha(opacity=0);' +
        'z-index:-1;"></iframe>' : '') +
      '</div>')
    .prependTo('body');
  /**
   * 鐐� mask 鐒︾偣涓嶈浆绉�
   * @ignore
   */
  // mask.unselectable();
  mask.on('mousedown', function(e) {
    e.preventDefault();
  });
  return mask;
}

/**
 * 閬僵灞傜殑瑙嗗浘绫�
 * @class BUI.Component.UIBase.MaskView
 * @private
 */
function MaskView() {}

MaskView.ATTRS = {
  maskShared: {
    value: true
  }
};

MaskView.prototype = {

  _maskExtShow: function() {
    var self = this,
      zIndex,
      maskCls = getMaskCls(self),
      maskDesc = maskMap[maskCls],
      maskShared = self.get('maskShared'),
      mask = self.get('maskNode');
    if (!mask) {
      if (maskShared) {
        if (maskDesc) {
          mask = maskDesc.node;
        } else {
          mask = initMask(maskCls);
          maskDesc = maskMap[maskCls] = {
            num: 0,
            node: mask
          };
        }
      } else {
        mask = initMask(maskCls);
      }
      self.setInternal('maskNode', mask);
    }
    if (zIndex = self.get('zIndex')) {
      mask.css('z-index', zIndex - 1);
    }
    if (maskShared) {
      maskDesc.num++;
    }
    if (!maskShared || maskDesc.num == 1) {
      mask.show();
    }
    $('body').addClass('x-masked-relative');
  },

  _maskExtHide: function() {
    var self = this,
      maskCls = getMaskCls(self),
      maskDesc = maskMap[maskCls],
      maskShared = self.get('maskShared'),
      mask = self.get('maskNode');
    if (maskShared && maskDesc) {
      maskDesc.num = Math.max(maskDesc.num - 1, 0);
      if (maskDesc.num == 0) {
        mask.hide();
      }
    } else if (mask) {
      mask.hide();
    }
    $('body').removeClass('x-masked-relative');
  },

  __destructor: function() {
    var self = this,
      maskShared = self.get('maskShared'),
      mask = self.get('maskNode');
    if (self.get('maskNode')) {
      if (maskShared) {
        if (self.get('visible')) {
          self._maskExtHide();
        }
      } else {
        mask.remove();
      }
    }
  }

};

/**
 * @class BUI.Component.UIBase.Mask
 * Mask extension class.
 * Make component to be able to show with mask.
 */
function Mask() {}

Mask.ATTRS = {
  /**
   * 鎺т欢鏄剧ず鏃讹紝鏄惁鏄剧ず灞忚斀灞�
   * <pre><code>
   *   var overlay = new Overlay({ //鏄剧ずoverlay鏃讹紝灞忚斀body
   *     mask : true,
   *     maskNode : 'body',
   *     trigger : '#t1'
   *   });
   *   overlay.render();
   * </code></pre>
   * @cfg {Boolean} [mask = false]
   */
  /**
   * 鎺т欢鏄剧ず鏃讹紝鏄惁鏄剧ず灞忚斀灞�
   * @type {Boolean}
   * @protected
   */
  mask: {
    value: false
  },
  /**
   * 灞忚斀鐨勫唴瀹�
   * <pre><code>
   *   var overlay = new Overlay({ //鏄剧ずoverlay鏃讹紝灞忚斀body
   *     mask : true,
   *     maskNode : 'body',
   *     trigger : '#t1'
   *   });
   *   overlay.render();
   * </code></pre>
   * @cfg {jQuery} maskNode
   */
  /**
   * 灞忚斀鐨勫唴瀹�
   * @type {jQuery}
   * @protected
   */
  maskNode: {
    view: 1
  },
  /**
   * Whether to share mask with other overlays.
   * @default true.
   * @type {Boolean}
   * @protected
   */
  maskShared: {
    view: 1
  }
};

Mask.prototype = {

  __bindUI: function() {
    var self = this,
      view = self.get('view'),
      _maskExtShow = view._maskExtShow,
      _maskExtHide = view._maskExtHide;
    if (self.get('mask')) {
      self.on('show', function() {
        view._maskExtShow();
      });
      self.on('hide', function() {
        view._maskExtHide();
      });
    }
  }
};

Mask = Mask;
Mask.View = MaskView;

module.exports = Mask;

});
define("bui/common/component/uibase/position", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 浣嶇疆锛屾帶浠剁粷瀵瑰畾浣�
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery");

/**
 * 瀵归綈鐨勮鍥剧被
 * @class BUI.Component.UIBase.PositionView
 * @private
 */
function PositionView() {

}

PositionView.ATTRS = {
  x: {
    /**
     * 姘村钩鏂瑰悜缁濆浣嶇疆
     * @private
     * @ignore
     */
    valueFn: function() {
      var self = this;
      // 璇诲埌杩欓噷鏃讹紝el 涓€瀹氭槸宸茬粡鍔犲埌 dom 鏍戜腑浜嗭紝鍚﹀垯鎶ユ湭鐭ラ敊璇�
      // el 涓嶅湪 dom 鏍戜腑 offset 鎶ラ敊鐨�
      // 鏈€鏃╄灏辨槸鍦� syncUI 涓紝涓€鐐归噸澶嶈缃�(璇诲彇鑷韩 X 鍐嶈皟鐢� _uiSetX)鏃犳墍璋撲簡
      return self.get('el') && self.get('el').offset().left;
    }
  },
  y: {
    /**
     * 鍨傜洿鏂瑰悜缁濆浣嶇疆
     * @private
     * @ignore
     */
    valueFn: function() {
      var self = this;
      return self.get('el') && self.get('el').offset().top;
    }
  },
  zIndex: {},
  /**
   * @private
   * see {@link BUI.Component.UIBase.Box#visibleMode}.
   * @default "visibility"
   * @ignore
   */
  visibleMode: {
    value: 'visibility'
  }
};


PositionView.prototype = {

  __createDom: function() {
    this.get('el').addClass(BUI.prefix + 'ext-position');
  },

  _uiSetZIndex: function(x) {
    this.get('el').css('z-index', x);
  },
  _uiSetX: function(x) {
    if (x != null) {
      this.get('el').offset({
        left: x
      });
    }
  },
  _uiSetY: function(y) {
    if (y != null) {
      this.get('el').offset({
        top: y
      });
    }
  },
  _uiSetLeft: function(left) {
    if (left != null) {
      this.get('el').css({
        left: left
      });
    }
  },
  _uiSetTop: function(top) {
    if (top != null) {
      this.get('el').css({
        top: top
      });
    }
  }
};

/**
 * @class BUI.Component.UIBase.Position
 * Position extension class.
 * Make component positionable
 */
function Position() {}

Position.ATTRS = {
  /**
   * 姘村钩鍧愭爣
   * @cfg {Number} x
   */
  /**
   * 姘村钩鍧愭爣
   * <pre><code>
   *     overlay.set('x',100);
   * </code></pre>
   * @type {Number}
   */
  x: {
    view: 1
  },
  /**
   * 鍨傜洿鍧愭爣
   * @cfg {Number} y
   */
  /**
   * 鍨傜洿鍧愭爣
   * <pre><code>
   *     overlay.set('y',100);
   * </code></pre>
   * @type {Number}
   */
  y: {
    view: 1
  },
  /**
   * 鐩稿浜庣埗鍏冪礌鐨勬按骞充綅缃�
   * @type {Number}
   * @protected
   */
  left: {
    view: 1
  },
  /**
   * 鐩稿浜庣埗鍏冪礌鐨勫瀭鐩翠綅缃�
   * @type {Number}
   * @protected
   */
  top: {
    view: 1
  },
  /**
   * 姘村钩鍜屽瀭鐩村潗鏍�
   * <pre><code>
   * var overlay = new Overlay({
   *   xy : [100,100],
   *   trigger : '#t1',
   *   srcNode : '#c1'
   * });
   * </code></pre>
   * @cfg {Number[]} xy
   */
  /**
   * 姘村钩鍜屽瀭鐩村潗鏍�
   * <pre><code>
   *     overlay.set('xy',[100,100]);
   * </code></pre>
   * @type {Number[]}
   */
  xy: {
    // 鐩稿 page 瀹氫綅, 鏈夋晥鍊间负 [n, m], 涓� null 鏃�, 閫� align 璁剧疆
    setter: function(v) {
      var self = this,
        xy = $.makeArray(v);
      /*
               灞炴€у唴鍒嗗彂鐗瑰埆娉ㄦ剰锛�
               xy -> x,y
               */
      if (xy.length) {
        xy[0] && self.set('x', xy[0]);
        xy[1] && self.set('y', xy[1]);
      }
      return v;
    },
    /**
     * xy 绾腑杞綔鐢�
     * @ignore
     */
    getter: function() {
      return [this.get('x'), this.get('y')];
    }
  },
  /**
   * z-index value.
   * <pre><code>
   *   var overlay = new Overlay({
   *       zIndex : '1000'
   *   });
   * </code></pre>
   * @cfg {Number} zIndex
   */
  /**
   * z-index value.
   * <pre><code>
   *   overlay.set('zIndex','1200');
   * </code></pre>
   * @type {Number}
   */
  zIndex: {
    view: 1
  },
  /**
   * Positionable element is by default visible false.
   * For compatibility in overlay and PopupMenu.
   * @default false
   * @ignore
   */
  visible: {
    view: true,
    value: true
  }
};


Position.prototype = {
  /**
   * Move to absolute position.
   * @param {Number|Number[]} x
   * @param {Number} [y]
   * @example
   * <pre><code>
   * move(x, y);
   * move(x);
   * move([x,y])
   * </code></pre>
   */
  move: function(x, y) {
    var self = this;
    if (BUI.isArray(x)) {
      y = x[1];
      x = x[0];
    }
    self.set('xy', [x, y]);
    return self;
  },
  //璁剧疆 x 鍧愭爣鏃讹紝閲嶇疆 left
  _uiSetX: function(v) {
    if (v != null) {
      var _self = this,
        el = _self.get('el');
      _self.setInternal('left', el.position().left);
      if (v != -999) {
        this.set('cachePosition', null);
      }

    }

  },
  //璁剧疆 y 鍧愭爣鏃讹紝閲嶇疆 top
  _uiSetY: function(v) {
    if (v != null) {
      var _self = this,
        el = _self.get('el');
      _self.setInternal('top', el.position().top);
      if (v != -999) {
        this.set('cachePosition', null);
      }
    }
  },
  //璁剧疆 left鏃讹紝閲嶇疆 x
  _uiSetLeft: function(v) {
    var _self = this,
      el = _self.get('el');
    if (v != null) {
      _self.setInternal('x', el.offset().left);
    }
    /*else{ //濡傛灉lef 涓簄ull,鍚屾椂璁剧疆杩噇eft鍜宼op锛岄偅涔堝彇瀵瑰簲鐨勫€�
              _self.setInternal('left',el.position().left);
          }*/
  },
  //璁剧疆top 鏃讹紝閲嶇疆y
  _uiSetTop: function(v) {
    var _self = this,
      el = _self.get('el');
    if (v != null) {
      _self.setInternal('y', el.offset().top);
    }
    /*else{ //濡傛灉lef 涓簄ull,鍚屾椂璁剧疆杩噇eft鍜宼op锛岄偅涔堝彇瀵瑰簲鐨勫€�
              _self.setInternal('top',el.position().top);
          }*/
  }
};

Position.View = PositionView;

module.exports = Position;

});
define("bui/common/component/uibase/stdmod", ["jquery"], function(require, exports, module){
/**
 * @fileOverview
 * 鎺т欢鍖呭惈澶撮儴锛坔ead)銆佸唴瀹�(content)鍜屽熬閮紙foot)
 * @ignore
 */

var $ = require("jquery"),
  CLS_PREFIX = BUI.prefix + 'stdmod-';


/**
 * 鏍囧噯妯″潡缁勭粐鐨勮鍥剧被
 * @class BUI.Component.UIBase.StdModView
 * @private
 */
function StdModView() {}

StdModView.ATTRS = {
  header: {},
  body: {},
  footer: {},
  bodyStyle: {},
  footerStyle: {},
  headerStyle: {},
  headerContent: {},
  bodyContent: {},
  footerContent: {}
};

StdModView.PARSER = {
  header: function(el) {
    return el.one("." + CLS_PREFIX + "header");
  },
  body: function(el) {
    return el.one("." + CLS_PREFIX + "body");
  },
  footer: function(el) {
    return el.one("." + CLS_PREFIX + "footer");
  }
}; /**/

function createUI(self, part) {
  var el = self.get('contentEl'),
    partEl = self.get(part);
  if (!partEl) {
    partEl = $('<div class="' +
      CLS_PREFIX + part + '"' +
      ' ' +
      ' >' +
      '</div>');
    partEl.appendTo(el);
    self.setInternal(part, partEl);
  }
}


function _setStdModRenderContent(self, part, v) {
  part = self.get(part);
  if (BUI.isString(v)) {
    part.html(v);
  } else {
    part.html('')
      .append(v);
  }
}

StdModView.prototype = {

  __renderUI: function() { //createDom
    createUI(this, 'header');
    createUI(this, 'body');
    createUI(this, 'footer');
  },

  _uiSetBodyStyle: function(v) {
    this.get('body').css(v);
  },

  _uiSetHeaderStyle: function(v) {
    this.get('header').css(v);
  },
  _uiSetFooterStyle: function(v) {
    this.get('footer').css(v);
  },

  _uiSetBodyContent: function(v) {
    _setStdModRenderContent(this, 'body', v);
  },

  _uiSetHeaderContent: function(v) {
    _setStdModRenderContent(this, 'header', v);
  },

  _uiSetFooterContent: function(v) {
    _setStdModRenderContent(this, 'footer', v);
  }
};

/**
 * @class BUI.Component.UIBase.StdMod
 * StdMod extension class.
 * Generate head, body, foot for component.
 */
function StdMod() {}

StdMod.ATTRS = {
  /**
   * 鎺т欢鐨勫ご閮―OM. Readonly
   * @readOnly
   * @type {jQuery}
   */
  header: {
    view: 1
  },
  /**
   * 鎺т欢鐨勫唴瀹笵OM. Readonly
   * @readOnly
   * @type {jQuery}
   */
  body: {
    view: 1
  },
  /**
   * 鎺т欢鐨勫簳閮―OM. Readonly
   * @readOnly
   * @type {jQuery}
   */
  footer: {
    view: 1
  },
  /**
   * 搴旂敤鍒版帶浠跺唴瀹圭殑css灞炴€э紝閿€煎褰㈠紡
   * @cfg {Object} bodyStyle
   */
  /**
   * 搴旂敤鍒版帶浠跺唴瀹圭殑css灞炴€э紝閿€煎褰㈠紡
   * @type {Object}
   * @protected
   */
  bodyStyle: {
    view: 1
  },
  /**
   * 搴旂敤鍒版帶浠跺簳閮ㄧ殑css灞炴€э紝閿€煎褰㈠紡
   * @cfg {Object} footerStyle
   */
  /**
   * 搴旂敤鍒版帶浠跺簳閮ㄧ殑css灞炴€э紝閿€煎褰㈠紡
   * @type {Object}
   * @protected
   */
  footerStyle: {
    view: 1
  },
  /**
   * 搴旂敤鍒版帶浠跺ご閮ㄧ殑css灞炴€э紝閿€煎褰㈠紡
   * @cfg {Object} headerStyle
   */
  /**
   * 搴旂敤鍒版帶浠跺ご閮ㄧ殑css灞炴€э紝閿€煎褰㈠紡
   * @type {Object}
   * @protected
   */
  headerStyle: {
    view: 1
  },
  /**
   * 鎺т欢澶撮儴鐨刪tml
   * <pre><code>
   * var dialog = new Dialog({
   *     headerContent: '&lt;div class="header"&gt;&lt;/div&gt;',
   *     bodyContent : '#c1',
   *     footerContent : '&lt;div class="footer"&gt;&lt;/div&gt;'
   * });
   * dialog.show();
   * </code></pre>
   * @cfg {jQuery|String} headerContent
   */
  /**
   * 鎺т欢澶撮儴鐨刪tml
   * @type {jQuery|String}
   */
  headerContent: {
    view: 1
  },
  /**
   * 鎺т欢鍐呭鐨刪tml
   * <pre><code>
   * var dialog = new Dialog({
   *     headerContent: '&lt;div class="header"&gt;&lt;/div&gt;',
   *     bodyContent : '#c1',
   *     footerContent : '&lt;div class="footer"&gt;&lt;/div&gt;'
   * });
   * dialog.show();
   * </code></pre>
   * @cfg {jQuery|String} bodyContent
   */
  /**
   * 鎺т欢鍐呭鐨刪tml
   * @type {jQuery|String}
   */
  bodyContent: {
    view: 1
  },
  /**
   * 鎺т欢搴曢儴鐨刪tml
   * <pre><code>
   * var dialog = new Dialog({
   *     headerContent: '&lt;div class="header"&gt;&lt;/div&gt;',
   *     bodyContent : '#c1',
   *     footerContent : '&lt;div class="footer"&gt;&lt;/div&gt;'
   * });
   * dialog.show();
   * </code></pre>
   * @cfg {jQuery|String} footerContent
   */
  /**
   * 鎺т欢搴曢儴鐨刪tml
   * @type {jQuery|String}
   */
  footerContent: {
    view: 1
  }
};

StdMod.View = StdModView;

module.exports = StdMod;

});
define("bui/common/component/uibase/decorate", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 浣跨敤wrapper
 * @ignore
 */


var $ = require("jquery"),
  ArrayUtil = require("bui/common/array"),
  JSON = require("bui/common/json"),
  prefixCls = BUI.prefix,
  FIELD_PREFIX = 'data-',
  FIELD_CFG = FIELD_PREFIX + 'cfg',
  PARSER = 'PARSER',
  Manager = require("bui/common/component/manage"),
  RE_DASH_WORD = /-([a-z])/g,
  regx = /^[\{\[]/;

function isConfigField(name, cfgFields) {
  if (cfgFields[name]) {
    return true;
  }
  var reg = new RegExp("^" + FIELD_PREFIX);
  if (name !== FIELD_CFG && reg.test(name)) {
    return true;
  }
  return false;
}

// 鏀堕泦鍗曠户鎵块摼锛屽瓙绫诲湪鍓嶏紝鐖剁被鍦ㄥ悗
function collectConstructorChains(self) {
  var constructorChains = [],
    c = self.constructor;
  while (c) {
    constructorChains.push(c);
    c = c.superclass && c.superclass.constructor;
  }
  return constructorChains;
}

function camelCase(str) {
  return str.toLowerCase().replace(RE_DASH_WORD, function(all, letter) {
    return (letter + '').toUpperCase()
  })
}

//濡傛灉灞炴€т负瀵硅薄鎴栬€呮暟缁勶紝鍒欒繘琛岃浆鎹�
function parseFieldValue(value) {

  value = $.trim(value);
  if (value.toLowerCase() === 'false') {
    value = false
  } else if (value.toLowerCase() === 'true') {
    value = true
  } else if (regx.test(value)) {
    value = JSON.looseParse(value);
  } else if (/\d/.test(value) && /[^a-z]/i.test(value)) {
    var number = parseFloat(value)
    if (number + '' === value) {
      value = number
    }
  }

  return value;
}

function setConfigFields(self, cfg) {

  var userConfig = self.userConfig || {};
  for (var p in cfg) {
    // 鐢ㄦ埛璁剧疆杩囬偅涔堣繖閲屼笉浠� dom 鑺傜偣鍙�
    // 鐢ㄦ埛璁剧疆 > html parser > default value
    if (!(p in userConfig)) {
      self.setInternal(p, cfg[p]);
    }
  }
}

function applyParser(srcNode, parser) {
  var self = this,
    p, v,
    userConfig = self.userConfig || {};

  // 浠� parser 涓紝榛橀粯璁剧疆灞炴€э紝涓嶈Е鍙戜簨浠�
  for (p in parser) {
    // 鐢ㄦ埛璁剧疆杩囬偅涔堣繖閲屼笉浠� dom 鑺傜偣鍙�
    // 鐢ㄦ埛璁剧疆 > html parser > default value
    if (!(p in userConfig)) {
      v = parser[p];
      // 鍑芥暟
      if (BUI.isFunction(v)) {
        self.setInternal(p, v.call(self, srcNode));
      }
      // 鍗曢€夐€夋嫨鍣�
      else if (typeof v == 'string') {
        self.setInternal(p, srcNode.find(v));
      }
      // 澶氶€夐€夋嫨鍣�
      else if (BUI.isArray(v) && v[0]) {
        self.setInternal(p, srcNode.find(v[0]))
      }
    }
  }
}

function initParser(self, srcNode) {

  var c = self.constructor,
    len,
    p,
    constructorChains;

  constructorChains = collectConstructorChains(self);

  // 浠庣埗绫诲埌瀛愮被寮€濮嬩粠 html 璇诲彇灞炴€�
  for (len = constructorChains.length - 1; len >= 0; len--) {
    c = constructorChains[len];
    if (p = c[PARSER]) {
      applyParser.call(self, srcNode, p);
    }
  }
}

function initDecorate(self) {
  var _self = self,
    srcNode = _self.get('srcNode'),
    userConfig,
    decorateCfg;
  if (srcNode) {
    srcNode = $(srcNode);
    _self.setInternal('el', srcNode);
    _self.setInternal('srcNode', srcNode);

    userConfig = _self.get('userConfig');
    decorateCfg = _self.getDecorateConfig(srcNode);
    setConfigFields(self, decorateCfg);

    //濡傛灉浠嶥OM涓鍙栧瓙鎺т欢
    if (_self.get('isDecorateChild') && _self.decorateInternal) {
      _self.decorateInternal(srcNode);
    }
    initParser(self, srcNode);
  }
}

/**
 * @class BUI.Component.UIBase.Decorate
 * 灏咲OM瀵硅薄灏佽鎴愭帶浠�
 */
function decorate() {
  initDecorate(this);
}

decorate.ATTRS = {

  /**
   * 閰嶇疆鎺т欢鐨勬牴鑺傜偣鐨凞OM
   * <pre><code>
   * new Form.Form({
   *   srcNode : '#J_Form'
   * }).render();
   * </code></pre>
   * @cfg {jQuery} srcNode
   */
  /**
   * 閰嶇疆鎺т欢鐨勬牴鑺傜偣鐨凞OM
   * @type {jQuery}
   */
  srcNode: {
    view: true
  },
  /**
   * 鏄惁鏍规嵁DOM鐢熸垚瀛愭帶浠�
   * @type {Boolean}
   * @protected
   */
  isDecorateChild: {
    value: false
  },
  /**
   * 姝ら厤缃」閰嶇疆浣跨敤閭ｄ簺srcNode涓婄殑鑺傜偣浣滀负閰嶇疆椤�
   *  - 褰撴椂鐢� decorate 鏃讹紝鍙� srcNode涓婄殑鑺傜偣鐨勫睘鎬т綔涓烘帶浠剁殑閰嶇疆淇℃伅
   *  - 榛樿id,name,value,title 閮戒細浣滀负灞炴€т紶鍏�
   *  - 浣跨敤 'data-cfg' 浣滀负鏁翠綋鐨勯厤缃睘鎬�
   *  <pre><code>
   *     <input id="c1" type="text" name="txtName" id="id",data-cfg="{allowBlank:false}" />
   *     //浼氱敓鎴愪互涓嬮厤缃」锛�
   *     {
   *         name : 'txtName',
   *         id : 'id',
   *         allowBlank:false
   *     }
   *     new Form.Field({
   *        src:'#c1'
   *     }).render();
   *  </code></pre>
   * @type {Object}
   * @protected
   */
  decorateCfgFields: {
    value: {
      'id': true,
      'name': true,
      'value': true,
      'title': true
    }
  }
};

decorate.prototype = {

  /**
   * 鑾峰彇鎺т欢鐨勯厤缃俊鎭�
   * @protected
   */
  getDecorateConfig: function(el) {
    if (!el.length) {
      return null;
    }
    var _self = this,
      dom = el[0],
      attributes = dom.attributes,
      decorateCfgFields = _self.get('decorateCfgFields'),
      config = {},
      statusCfg = _self._getStautsCfg(el);

    BUI.each(attributes, function(attr) {
      var name = attr.nodeName;
      try {
        if (name === FIELD_CFG) {
          var cfg = parseFieldValue(attr.nodeValue);
          BUI.mix(config, cfg);
        } else if (isConfigField(name, decorateCfgFields)) {
          var value = attr.nodeValue;
          if (name.indexOf(FIELD_PREFIX) !== -1) {
            name = name.replace(FIELD_PREFIX, '');
            name = camelCase(name);
            value = parseFieldValue(value);
          }

          if (config[name] && BUI.isObject(value)) {
            BUI.mix(config[name], value);
          } else {
            config[name] = value;
          }
        }
      } catch (e) {
        BUI.log('parse field error,the attribute is:' + name);
      }
    });
    return BUI.mix(config, statusCfg);
  },
  //鏍规嵁css class鑾峰彇鐘舵€佸睘鎬�
  //濡傦細 selected,disabled绛夊睘鎬�
  _getStautsCfg: function(el) {
    var _self = this,
      rst = {},
      statusCls = _self.get('statusCls');
    BUI.each(statusCls, function(v, k) {
      if (el.hasClass(v)) {
        rst[k] = true;
      }
    });
    return rst;
  },
  /**
   * 鑾峰彇灏佽鎴愬瓙鎺т欢鐨勮妭鐐归泦鍚�
   * @protected
   * @return {Array} 鑺傜偣闆嗗悎
   */
  getDecorateElments: function() {
    var _self = this,
      el = _self.get('el'),
      contentContainer = _self.get('childContainer');
    if (contentContainer) {
      return el.find(contentContainer).children();
    } else {
      return el.children();
    }
  },

  /**
   * 灏佽鎵€鏈夌殑瀛愭帶浠�
   * @protected
   * @param {jQuery} el Root element of current component.
   */
  decorateInternal: function(el) {
    var self = this;
    self.decorateChildren(el);
  },
  /**
   * 鑾峰彇瀛愭帶浠剁殑xclass绫诲瀷
   * @protected
   * @param {jQuery} childNode 瀛愭帶浠剁殑鏍硅妭鐐�
   */
  findXClassByNode: function(childNode, ignoreError) {
    var _self = this,
      cls = childNode.attr("class") || '',
      childClass = _self.get('defaultChildClass'); //濡傛灉娌℃湁鏍峰紡鎴栬€呮煡鎵句笉鍒板搴旂殑绫伙紝浣跨敤榛樿鐨勫瓙鎺т欢绫诲瀷

    // 杩囨护鎺夌壒瀹氬墠缂€
    cls = cls.replace(new RegExp("\\b" + prefixCls, "ig"), "");

    var UI = Manager.getConstructorByXClass(cls) || Manager.getConstructorByXClass(childClass);

    if (!UI && !ignoreError) {
      BUI.log(childNode);
      BUI.error("can not find ui " + cls + " from this markup");
    }
    return Manager.getXClassByConstructor(UI);
  },
  // 鐢熸垚涓€涓粍浠�
  decorateChildrenInternal: function(xclass, c) {
    var _self = this,
      children = _self.get('children');
    children.push({
      xclass: xclass,
      srcNode: c
    });
  },
  /**
   * 灏佽瀛愭帶浠�
   * @private
   * @param {jQuery} el component's root element.
   */
  decorateChildren: function(el) {
    var _self = this,
      children = _self.getDecorateElments();
    BUI.each(children, function(c) {
      var xclass = _self.findXClassByNode($(c));
      _self.decorateChildrenInternal(xclass, $(c));
    });
  }
};

module.exports = decorate;

});
define("bui/common/component/uibase/tpl", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鎺т欢妯℃澘
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery");

/**
 * @private
 * 鎺т欢妯℃澘鎵╁睍绫荤殑娓叉煋绫�(view)
 * @class BUI.Component.UIBase.TplView
 */
function tplView() {

}

tplView.ATTRS = {
  /**
   * 妯℃澘
   * @protected
   * @type {String}
   */
  tpl: {

  },
  tplEl: {

  }
};

tplView.prototype = {
  __renderUI: function() {
    var _self = this,
      contentContainer = _self.get('childContainer'),
      contentEl;

    if (contentContainer) {
      contentEl = _self.get('el').find(contentContainer);
      if (contentEl.length) {
        _self.set('contentEl', contentEl);
      }
    }
  },
  /**
   * 鑾峰彇鐢熸垚鎺т欢鐨勬ā鏉�
   * @protected
   * @param  {Object} attrs 灞炴€у€�
   * @return {String} 妯℃澘
   */
  getTpl: function(attrs) {
    var _self = this,
      tpl = _self.get('tpl'),
      tplRender = _self.get('tplRender');
    attrs = attrs || _self.getAttrVals();

    if (tplRender) {
      return tplRender(attrs);
    }
    if (tpl) {
      return BUI.substitute(tpl, attrs);
    }
    return '';
  },
  /**
   * 濡傛灉鎺т欢璁剧疆浜嗘ā鏉匡紝鍒欐牴鎹ā鏉垮拰灞炴€у€肩敓鎴怐OM
   * 濡傛灉璁剧疆浜哻ontent灞炴€э紝姝ゆā鏉夸笉搴旂敤
   * @protected
   * @param  {Object} attrs 灞炴€у€硷紝榛樿涓哄垵濮嬪寲鏃朵紶鍏ョ殑鍊�
   */
  setTplContent: function(attrs) {
    var _self = this,
      el = _self.get('el'),
      content = _self.get('content'),
      tplEl = _self.get('tplEl'),
      tpl = _self.getTpl(attrs);

    //tplEl.remove();
    if (!content && tpl) { //鏇挎崲鎺夊師鍏堢殑鍐呭
      el.empty();
      el.html(tpl);
      /*if(tplEl){
          var node = $(tpl).insertBefore(tplEl);
          tplEl.remove();
          tplEl = node;
        }else{
          tplEl = $(tpl).appendTo(el);
        }
        _self.set('tplEl',tplEl)
        */
    }
  }
}

/**
 * 鎺т欢鐨勬ā鏉挎墿灞�
 * @class BUI.Component.UIBase.Tpl
 */
function tpl() {

}

tpl.ATTRS = {
  /**
   * 鎺т欢鐨勬ā鐗堬紝鐢ㄤ簬鍒濆鍖�
   * <pre><code>
   * var list = new List.List({
   *   tpl : '&lt;div class="toolbar"&gt;&lt;/div&gt;&lt;ul&gt;&lt;/ul&gt;',
   *   childContainer : 'ul'
   * });
   * //鐢ㄤ簬缁熶竴瀛愭帶浠舵ā鏉�
   * var list = new List.List({
   *   defaultChildCfg : {
   *     tpl : '&lt;span&gt;{text}&lt;/span&gt;'
   *   }
   * });
   * list.render();
   * </code></pre>
   * @cfg {String} tpl
   */
  /**
   * 鎺т欢鐨勬ā鏉�
   * <pre><code>
   *   list.set('tpl','&lt;div class="toolbar"&gt;&lt;/div&gt;&lt;ul&gt;&lt;/ul&gt;&lt;div class="bottom"&gt;&lt;/div&gt;')
   * </code></pre>
   * @type {String}
   */
  tpl: {
    view: true,
    sync: false
  },
  /**
   * <p>鎺т欢鐨勬覆鏌撳嚱鏁帮紝搴斿涓€浜涚畝鍗曟ā鏉胯В鍐充笉浜嗙殑闂锛屼緥濡傛湁if,else閫昏緫锛屾湁寰幆閫昏緫,
   * 鍑芥暟鍘熷瀷鏄痜unction(data){},鍏朵腑data鏄帶浠剁殑灞炴€у€�</p>
   * <p>鎺т欢妯℃澘鐨勫姞寮烘ā寮忥紝姝ゅ睘鎬т細瑕嗙洊@see {BUI.Component.UIBase.Tpl#property-tpl}灞炴€�</p>
   * //鐢ㄤ簬缁熶竴瀛愭帶浠舵ā鏉�
   * var list = new List.List({
   *   defaultChildCfg : {
   *     tplRender : funciton(item){
   *       if(item.type == '1'){
   *         return 'type1 html';
   *       }else{
   *         return 'type2 html';
   *       }
   *     }
   *   }
   * });
   * list.render();
   * @cfg {Function} tplRender
   */
  tplRender: {
    view: true,
    value: null
  },
  /**
   * 杩欐槸涓€涓€夋嫨鍣紝浣跨敤浜嗘ā鏉垮悗锛屽瓙鎺т欢鍙兘浼氭坊鍔犲埌妯℃澘瀵瑰簲鐨勪綅缃�,
   *  - 榛樿涓簄ull,姝ゆ椂瀛愭帶浠朵細灏嗘帶浠舵渶澶栧眰 el 浣滀负瀹瑰櫒
   * <pre><code>
   * var list = new List.List({
   *   tpl : '&lt;div class="toolbar"&gt;&lt;/div&gt;&lt;ul&gt;&lt;/ul&gt;',
   *   childContainer : 'ul'
   * });
   * </code></pre>
   * @cfg {String} childContainer
   */
  childContainer: {
    view: true
  }
};

tpl.prototype = {

  __renderUI: function() {
    //浣跨敤srcNode鏃讹紝涓嶄娇鐢ㄦā鏉�
    if (!this.get('srcNode')) {
      this.setTplContent();
    }
  },
  /**
   * 鎺т欢淇℃伅鍙戠敓鏀瑰彉鏃讹紝鎺т欢鍐呭璺熸ā鏉跨浉鍏虫椂闇€瑕佽皟鐢ㄨ繖涓嚱鏁帮紝
   * 閲嶆柊閫氳繃妯℃澘鍜屾帶浠朵俊鎭瀯閫犲唴瀹�
   */
  updateContent: function() {
    this.setTplContent();
  },
  /**
   * 鏍规嵁鎺т欢鐨勫睘鎬у拰妯℃澘鐢熸垚鎺т欢鍐呭
   * @protected
   */
  setTplContent: function() {
    var _self = this,
      attrs = _self.getAttrVals();
    _self.get('view').setTplContent(attrs);
  },
  //妯℃澘鍙戠敓鏀瑰彉
  _uiSetTpl: function() {
    this.setTplContent();
  }
};

tpl.View = tplView;

module.exports = tpl;

});
define("bui/common/component/uibase/childCfg", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 瀛愭帶浠剁殑榛樿閰嶇疆椤�
 * @ignore
 */

var $ = require("jquery");

/**
 * @class BUI.Component.UIBase.ChildCfg
 * 瀛愭帶浠堕粯璁ら厤缃」鐨勬墿灞曠被
 */
var childCfg = function(config) {
  this._init();
};

childCfg.ATTRS = {
  /**
   * 榛樿鐨勫瓙鎺т欢閰嶇疆椤�,鍦ㄥ垵濮嬪寲鎺т欢鏃堕厤缃�
   *
   *  - 濡傛灉鎺т欢宸茬粡娓叉煋杩囷紝姝ら厤缃」鏃犳晥锛�
   *  - 鎺т欢鐢熸垚鍚庯紝淇敼姝ら厤缃」鏃犳晥銆�
   * <pre><code>
   *   var control = new Control({
   *     defaultChildCfg : {
   *       tpl : '&lt;li&gt;{text}&lt;/li&gt;',
   *       xclass : 'a-b'
   *     }
   *   });
   * </code></pre>
   * @cfg {Object} defaultChildCfg
   */
  /**
   * @ignore
   */
  defaultChildCfg: {

  }
};

childCfg.prototype = {

  _init: function() {
    var _self = this,
      defaultChildCfg = _self.get('defaultChildCfg');
    if (defaultChildCfg) {
      _self.on('beforeAddChild', function(ev) {
        var child = ev.child;
        if ($.isPlainObject(child)) {
          BUI.each(defaultChildCfg, function(v, k) {
            if (child[k] == null) { //濡傛灉鏈湪閰嶇疆椤逛腑璁剧疆锛屽垯浣跨敤榛樿鍊�
              child[k] = v;
            }
          });
        }
      });
    }
  }

};

module.exports = childCfg;

});
define("bui/common/component/uibase/bindable", [], function(require, exports, module){
/**
 * @fileOverview bindable extension class.
 * @author dxq613@gmail.com
 * @ignore
 */

/**
 * bindable extension class.
 * <pre><code>
 *   BUI.use(['bui/list','bui/data','bui/mask'],function(List,Data,Mask){
 *     var store = new Data.Store({
 *       url : 'data/xx.json'
 *     });
 *   	var list = new List.SimpleList({
 *  	    render : '#l1',
 *  	    store : store,
 *  	    loadMask : new Mask.LoadMask({el : '#t1'})
 *     });
 *
 *     list.render();
 *     store.load();
 *   });
 * </code></pre>
 * 浣挎帶浠剁粦瀹歴tore锛屽鐞唖tore鐨勪簨浠� {@link BUI.Data.Store}
 * @class BUI.Component.UIBase.Bindable
 */
function bindable() {

}

bindable.ATTRS = {
  /**
   * 缁戝畾 {@link BUI.Data.Store}鐨勪簨浠�
   * <pre><code>
   *  var store = new Data.Store({
   *   url : 'data/xx.json',
   *   autoLoad : true
   *  });
   *
   *  var list = new List.SimpleList({
   *  	 render : '#l1',
   *  	 store : store
   *  });
   *
   *  list.render();
   * </code></pre>
   * @cfg {BUI.Data.Store} store
   */
  /**
   * 缁戝畾 {@link BUI.Data.Store}鐨勪簨浠�
   * <pre><code>
   *  var store = list.get('store');
   * </code></pre>
   * @type {BUI.Data.Store}
   */
  store: {

  },
  /**
   * 鍔犺浇鏁版嵁鏃讹紝鏄惁鏄剧ず绛夊緟鍔犺浇鐨勫睆钄藉眰
   * <pre><code>
   *   BUI.use(['bui/list','bui/data','bui/mask'],function(List,Data,Mask){
   *     var store = new Data.Store({
   *       url : 'data/xx.json'
   *     });
   *   	var list = new List.SimpleList({
   *  	    render : '#l1',
   *  	    store : store,
   *  	    loadMask : new Mask.LoadMask({el : '#t1'})
   *     });
   *
   *     list.render();
   *     store.load();
   *   });
   * </code></pre>
   * @cfg {Boolean|Object} loadMask
   */
  /**
   * 鍔犺浇鏁版嵁鏃讹紝鏄惁鏄剧ず绛夊緟鍔犺浇鐨勫睆钄藉眰
   * @type {Boolean|Object}
   * @ignore
   */
  loadMask: {
    value: false
  }
};


BUI.augment(bindable, {

  __bindUI: function() {
    var _self = this,
      store = _self.get('store'),
      loadMask = _self.get('loadMask');
    if (!store) {
      return;
    }
    store.on('beforeload', function(e) {
      _self.onBeforeLoad(e);
      if (loadMask && loadMask.show) {
        loadMask.show();
      }
    });
    store.on('load', function(e) {
      _self.onLoad(e);
      if (loadMask && loadMask.hide) {
        loadMask.hide();
      }
    });
    store.on('exception', function(e) {
      _self.onException(e);
      if (loadMask && loadMask.hide) {
        loadMask.hide();
      }
    });
    store.on('add', function(e) {
      _self.onAdd(e);
    });
    store.on('remove', function(e) {
      _self.onRemove(e);
    });
    store.on('update', function(e) {
      _self.onUpdate(e);
    });
    store.on('localsort', function(e) {
      _self.onLocalSort(e);
    });
    store.on('filtered', function(e) {
      _self.onFiltered(e);
    });
  },
  __syncUI: function() {
    var _self = this,
      store = _self.get('store');
    if (!store) {
      return;
    }
    if (store.hasData()) {
      _self.onLoad();
    }
  },
  /**
   * @protected
   * @template
   * before store load data
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-beforeload}
   */
  onBeforeLoad: function(e) {

  },
  /**
   * @protected
   * @template
   * after store load data
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-load}
   */
  onLoad: function(e) {

  },
  /**
   * @protected
   * @template
   * occurred exception when store is loading data
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-exception}
   */
  onException: function(e) {

  },
  /**
   * @protected
   * @template
   * after added data to store
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-add}
   */
  onAdd: function(e) {

  },
  /**
   * @protected
   * @template
   * after remvoed data to store
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-remove}
   */
  onRemove: function(e) {

  },
  /**
   * @protected
   * @template
   * after updated data to store
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-update}
   */
  onUpdate: function(e) {

  },
  /**
   * @protected
   * @template
   * after local sorted data to store
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-localsort}
   */
  onLocalSort: function(e) {

  },
  /**
   * @protected
   * @template
   * after filter data to store
   * @param {Object} e The event object
   * @see {@link BUI.Data.Store#event-filtered}
   */
  onFiltered: function(e) {}
});

module.exports = bindable;

});
define("bui/common/component/uibase/depends", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 渚濊禆鎵╁睍锛岀敤浜庤瀵熻€呮ā寮忎腑鐨勮瀵熻€�
 * @ignore
 */


var $ = require("jquery"),
  regexp = /^#(.*):(.*)$/,
  Manager = require("bui/common/component/manage");

//鑾峰彇渚濊禆淇℃伅
function getDepend(name) {

  var arr = regexp.exec(name),
    id = arr[1],
    eventType = arr[2],
    source = getSource(id);
  return {
    source: source,
    eventType: eventType
  };
}

//缁戝畾渚濊禆
function bindDepend(self, name, action) {
  var depend = getDepend(name),
    source = depend.source,
    eventType = depend.eventType,
    callbak;
  if (source && action && eventType) {

    if (BUI.isFunction(action)) { //濡傛灉action鏄竴涓嚱鏁�
      callbak = action;
    } else if (BUI.isArray(action)) { //濡傛灉鏄竴涓暟缁勶紝鏋勫缓涓€涓洖璋冨嚱鏁�
      callbak = function() {
        BUI.each(action, function(methodName) {
          if (self[methodName]) {
            self[methodName]();
          }
        });
      }
    }
  }
  if (callbak) {
    depend.callbak = callbak;
    source.on(eventType, callbak);
    return depend;
  }
  return null;
}
//鍘婚櫎渚濊禆
function offDepend(depend) {
  var source = depend.source,
    eventType = depend.eventType,
    callbak = depend.callbak;
  source.off(eventType, callbak);
}

//鑾峰彇缁戝畾鐨勪簨浠舵簮
function getSource(id) {
  var control = Manager.getComponent(id);
  if (!control) {
    control = $('#' + id);
    if (!control.length) {
      control = null;
    }
  }
  return control;
}

/**
 * @class BUI.Component.UIBase.Depends
 * 渚濊禆浜嬩欢婧愮殑鎵╁睍
 * <pre><code>
 *       var control = new Control({
 *         depends : {
 *           '#btn:click':['toggle'],//褰撶偣鍑籭d涓�'btn'鐨勬寜閽椂锛屾墽琛� control 鐨則oggle鏂规硶
 *           '#checkbox1:checked':['show'],//褰撳嬀閫塩heckbox鏃讹紝鏄剧ず鎺т欢
 *           '#menu:click',function(){}
 *         }
 *       });
 * </code></pre>
 */
function Depends() {

};

Depends.ATTRS = {
  /**
   * 鎺т欢鐨勪緷璧栦簨浠讹紝鏄竴涓暟缁勯泦鍚堬紝姣忎竴鏉¤褰曟槸涓€涓緷璧栧叧绯�<br/>
   * 涓€涓緷璧栨槸娉ㄥ唽涓€涓簨浠讹紝鎵€浠ラ渶瑕佸湪涓€涓緷璧栦腑鎻愪緵锛�
   * <ol>
   * <li>缁戝畾婧愶細涓轰簡鏂逛究閰嶇疆锛屾垜浠娇鐢� #id鏉ユ寚瀹氱粦瀹氭簮锛屽彲浠ヤ娇鎺т欢鐨処D锛堝彧鏀寔缁ф壙{BUI.Component.Controller}鐨勬帶浠讹級锛屼篃鍙互鏄疍OM鐨刬d</li>
   * <li>浜嬩欢鍚嶏細浜嬩欢鍚嶆槸涓€涓娇鐢�":"涓哄墠缂€鐨勫瓧绗︿覆锛屼緥濡� "#id:change",鍗崇洃鍚琧hange浜嬩欢</li>
   * <li>瑙﹀彂鐨勬柟娉曪細鍙互鏄竴涓暟缁勶紝濡俒"disable","clear"],鏁扮粍閲岄潰鏄帶浠剁殑鏂规硶鍚嶏紝涔熷彲浠ユ槸涓€涓洖璋冨嚱鏁�</li>
   * </ol>
   * <pre><code>
   *       var control = new Control({
   *         depends : {
   *           '#btn:click':['toggle'],//褰撶偣鍑籭d涓�'btn'鐨勬寜閽椂锛屾墽琛� control 鐨則oggle鏂规硶
   *           '#checkbox1:checked':['show'],//褰撳嬀閫塩heckbox鏃讹紝鏄剧ず鎺т欢
   *           '#menu:click',function(){}
   *         }
   *       });
   * </code></pre>
   * ** 娉ㄦ剰锛�** 杩欎簺渚濊禆椤规槸鍦ㄦ帶浠舵覆鏌擄紙render锛夊悗杩涜鐨勩€�
   * @type {Object}
   */
  depends: {

  },
  /**
   * @private
   * 渚濊禆鐨勬槧灏勯泦鍚�
   * @type {Object}
   */
  dependencesMap: {
    shared: false,
    value: {}
  }
};

Depends.prototype = {

  __syncUI: function() {
    this.initDependences();
  },
  /**
   * 鍒濆鍖栦緷璧栭」
   * @protected
   */
  initDependences: function() {
    var _self = this,
      depends = _self.get('depends');
    BUI.each(depends, function(action, name) {
      _self.addDependence(name, action);
    });
  },
  /**
   * 娣诲姞渚濊禆锛屽鏋滃凡缁忔湁鍚屽悕鐨勪簨浠讹紝鍒欑Щ闄わ紝鍐嶆坊鍔�
   * <pre><code>
   *  form.addDependence('#btn:click',['toggle']); //褰撴寜閽�#btn鐐瑰嚮鏃讹紝琛ㄥ崟浜ゆ浛鏄剧ず闅愯棌
   *
   *  form.addDependence('#btn:click',function(){//褰撴寜閽�#btn鐐瑰嚮鏃讹紝琛ㄥ崟浜ゆ浛鏄剧ず闅愯棌
   *   //TO DO
   *  });
   * </code></pre>
   * @param {String} name 渚濊禆椤圭殑鍚嶇О
   * @param {Array|Function} action 渚濊禆椤圭殑浜嬩欢
   */
  addDependence: function(name, action) {
    var _self = this,
      dependencesMap = _self.get('dependencesMap'),
      depend;
    _self.removeDependence(name);
    depend = bindDepend(_self, name, action)
    if (depend) {
      dependencesMap[name] = depend;
    }
  },
  /**
   * 绉婚櫎渚濊禆
   * <pre><code>
   *  form.removeDependence('#btn:click'); //褰撴寜閽�#btn鐐瑰嚮鏃讹紝琛ㄥ崟涓嶅湪鐩戝惉
   * </code></pre>
   * @param  {String} name 渚濊禆鍚嶇О
   */
  removeDependence: function(name) {
    var _self = this,
      dependencesMap = _self.get('dependencesMap'),
      depend = dependencesMap[name];
    if (depend) {
      offDepend(depend);
      delete dependencesMap[name];
    }
  },
  /**
   * 娓呴櫎鎵€鏈夌殑渚濊禆
   * <pre><code>
   *  form.clearDependences();
   * </code></pre>
   */
  clearDependences: function() {
    var _self = this,
      map = _self.get('dependencesMap');
    BUI.each(map, function(depend, name) {
      offDepend(depend);
    });
    _self.set('dependencesMap', {});
  },
  __destructor: function() {
    this.clearDependences();
  }

};

module.exports = Depends;

});
define("bui/common/component/view", ["jquery"], function(require, exports, module){
/**
 * @fileOverview  鎺т欢鐨勮鍥惧眰
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  win = window,
  Manager = require("bui/common/component/manage"),
  UIBase = require("bui/common/component/uibase/uibase"), //BUI.Component.UIBase,
  doc = document;

/**
 * 鎺т欢鐨勮鍥惧眰鍩虹被
 * @class BUI.Component.View
 * @protected
 * @extends BUI.Component.UIBase
 * @mixins BUI.Component.UIBase.TplView
 */
var View = UIBase.extend([UIBase.TplView], {

  /**
   * Get all css class name to be applied to the root element of this component for given state.
   * the css class names are prefixed with component name.
   * @param {String} [state] This component's state info.
   */
  getComponentCssClassWithState: function(state) {
    var self = this,
      componentCls = self.get('ksComponentCss');
    state = state || '';
    return self.getCssClassWithPrefix(componentCls.split(/\s+/).join(state + ' ') + state);
  },

  /**
   * Get full class name (with prefix) for current component
   * @param classes {String} class names without prefixCls. Separated by space.
   * @method
   * @return {String} class name with prefixCls
   * @private
   */
  getCssClassWithPrefix: Manager.getCssClassWithPrefix,

  /**
   * Returns the dom element which is responsible for listening keyboard events.
   * @return {jQuery}
   */
  getKeyEventTarget: function() {
    return this.get('el');
  },
  /**
   * Return the dom element into which child component to be rendered.
   * @return {jQuery}
   */
  getContentElement: function() {
    return this.get('contentEl') || this.get('el');
  },
  /**
   * 鑾峰彇鐘舵€佸搴旂殑css鏍峰紡
   * @param  {String} name 鐘舵€佸悕绉� 渚嬪锛歨over,disabled绛夌瓑
   * @return {String} 鐘舵€佹牱寮�
   */
  getStatusCls: function(name) {
    var self = this,
      statusCls = self.get('statusCls'),
      cls = statusCls[name];
    if (!cls) {
      cls = self.getComponentCssClassWithState('-' + name);
    }
    return cls;
  },
  /**
   * 娓叉煋鎺т欢
   * @protected
   */
  renderUI: function() {
    var self = this;

    // 鏂板缓鐨勮妭鐐规墠闇€瑕佹憜鏀惧畾浣�,涓嶆敮鎸乻rcNode妯″紡
    if (!self.get('srcNode')) {
      var render = self.get('render'),
        el = self.get('el'),
        renderBefore = self.get('elBefore');
      if (renderBefore) {
        el.insertBefore(renderBefore, undefined);
      } else if (render) {
        el.appendTo(render, undefined);
      } else {
        el.appendTo(doc.body, undefined);
      }
    }
  },
  /**
   * 鍙礋璐ｅ缓绔嬭妭鐐癸紝濡傛灉鏄� decorate 杩囨潵鐨勶紝鐢氳嚦鍐呭浼氫涪澶�
   * @protected
   * 閫氳繃 render 鏉ラ噸寤哄師鏈夌殑鍐呭
   */
  createDom: function() {
    var self = this,
      contentEl = self.get('contentEl'),
      el = self.get('el');
    if (!self.get('srcNode')) {

      el = $('<' + self.get('elTagName') + '>');

      if (contentEl) {
        el.append(contentEl);
      }

      self.setInternal('el', el);
    }

    el.addClass(self.getComponentCssClassWithState());
    if (!contentEl) {
      // 娌″彇鍒�,杩欓噷璁句笅鍊�, uiSet 鏃跺彲浠� set('content')  鍙栧埌
      self.setInternal('contentEl', el);
    }
  },
  /**
   * 璁剧疆楂樹寒鏄剧ず
   * @protected
   */
  _uiSetHighlighted: function(v) {
    var self = this,
      componentCls = self.getStatusCls('hover'),
      el = self.get('el');
    el[v ? 'addClass' : 'removeClass'](componentCls);
  },

  /**
   * 璁剧疆绂佺敤
   * @protected
   */
  _uiSetDisabled: function(v) {
    var self = this,
      componentCls = self.getStatusCls('disabled'),
      el = self.get('el');
    el[v ? 'addClass' : 'removeClass'](componentCls)
      .attr('aria-disabled', v);

    //濡傛灉绂佺敤鎺т欢鏃讹紝澶勪簬hover鐘舵€侊紝鍒欐竻闄�
    if (v && self.get('highlighted')) {
      self.set('highlighted', false);
    }

    if (self.get('focusable')) {
      //涓嶈兘琚� tab focus 鍒�
      self.getKeyEventTarget().attr('tabIndex', v ? -1 : 0);
    }
  },
  /**
   * 璁剧疆婵€娲荤姸鎬�
   * @protected
   */
  _uiSetActive: function(v) {
    var self = this,
      componentCls = self.getStatusCls('active');
    self.get('el')[v ? 'addClass' : 'removeClass'](componentCls)
      .attr('aria-pressed', !!v);
  },
  /**
   * 璁剧疆鑾峰緱鐒︾偣
   * @protected
   */
  _uiSetFocused: function(v) {
    var self = this,
      el = self.get('el'),
      componentCls = self.getStatusCls('focused');
    el[v ? 'addClass' : 'removeClass'](componentCls);
  },
  /**
   * 璁剧疆鎺т欢鏈€澶栧眰DOM鐨勫睘鎬�
   * @protected
   */
  _uiSetElAttrs: function(attrs) {
    this.get('el').attr(attrs);
  },
  /**
   * 璁剧疆搴旂敤鍒版帶浠舵渶澶栧眰DOM鐨刢ss class
   * @protected
   */
  _uiSetElCls: function(cls) {
    this.get('el').addClass(cls);
  },
  /**
   * 璁剧疆搴旂敤鍒版帶浠舵渶澶栧眰DOM鐨刢ss style
   * @protected
   */
  _uiSetElStyle: function(style) {
    this.get('el').css(style);
  },
  //璁剧疆role
  _uiSetRole: function(role) {
    if (role) {
      this.get('el').attr('role', role);
    }
  },
  /**
   * 璁剧疆搴旂敤鍒版帶浠跺搴�
   * @protected
   */
  _uiSetWidth: function(w) {
    this.get('el').width(w);
  },
  /**
   * 璁剧疆搴旂敤鍒版帶浠堕珮搴�
   * @protected
   */
  _uiSetHeight: function(h) {
    var self = this;
    self.get('el').height(h);
  },
  /**
   * 璁剧疆搴旂敤鍒版帶浠剁殑鍐呭
   * @protected
   */
  _uiSetContent: function(c) {
    var self = this,
      el;
    // srcNode 鏃朵笉閲嶆柊娓叉煋 content
    // 闃叉鍐呴儴鏈夋敼鍙橈紝鑰� content 鍒欐槸鑰佺殑 html 鍐呭
    if (self.get('srcNode') && !self.get('rendered')) {} else {
      el = self.get('contentEl');
      if (typeof c == 'string') {
        el.html(c);
      } else if (c) {
        el.empty().append(c);
      }
    }
  },
  /**
   * 璁剧疆搴旂敤鍒版帶浠舵槸鍚﹀彲瑙�
   * @protected
   */
  _uiSetVisible: function(isVisible) {
    var self = this,
      el = self.get('el'),
      visibleMode = self.get('visibleMode');
    if (visibleMode === 'visibility') {
      el.css('visibility', isVisible ? 'visible' : 'hidden');
    } else {
      el.css('display', isVisible ? '' : 'none');
    }
  },
  set: function(name, value) {
    var _self = this,
      attr = _self.__attrs[name],
      ev,
      ucName,
      m;

    if (!attr || !_self.get('binded')) { //鏈垵濮嬪寲view鎴栬€呮病鐢ㄥ畾涔夊睘鎬�
      View.superclass.set.call(this, name, value);
      return _self;
    }

    var prevVal = View.superclass.get.call(this, name);

    //濡傛灉鏈敼鍙樺€间笉杩涜淇敼
    if (!$.isPlainObject(value) && !BUI.isArray(value) && prevVal === value) {
      return _self;
    }
    View.superclass.set.call(this, name, value);

    value = _self.__attrVals[name];
    ev = {
      attrName: name,
      prevVal: prevVal,
      newVal: value
    };
    ucName = BUI.ucfirst(name);
    m = '_uiSet' + ucName;
    if (_self[m]) {
      _self[m](value, ev);
    }

    return _self;

  },
  /**
   * 鏋愭瀯鍑芥暟
   * @protected
   */
  destructor: function() {
    var el = this.get('el');
    if (el) {
      el.remove();
    }
  }
}, {
  xclass: 'view',
  priority: 0
});


View.ATTRS = {
  /**
   * 鎺т欢鏍硅妭鐐�
   * @readOnly
   * see {@link BUI.Component.Controller#property-el}
   */
  el: {
    /**
     * @private
     */
    setter: function(v) {
      return $(v);
    }
  },

  /**
   * 鎺т欢鏍硅妭鐐规牱寮�
   * see {@link BUI.Component.Controller#property-elCls}
   */
  elCls: {},
  /**
   * 鎺т欢鏍硅妭鐐规牱寮忓睘鎬�
   * see {@link BUI.Component.Controller#property-elStyle}
   */
  elStyle: {},
  /**
   * ARIA 鏍囧噯涓殑role
   * @type {String}
   */
  role: {

  },
  /**
   * 鎺т欢瀹藉害
   * see {@link BUI.Component.Controller#property-width}
   */
  width: {},
  /**
   * 鎺т欢楂樺害
   * see {@link BUI.Component.Controller#property-height}
   */
  height: {},
  /**
   * 鐘舵€佺浉鍏崇殑鏍峰紡,榛樿鎯呭喌涓嬩細浣跨敤 鍓嶇紑鍚� + xclass + '-' + 鐘舵€佸悕
   * see {@link BUI.Component.Controller#property-statusCls}
   * @type {Object}
   */
  statusCls: {
    value: {}
  },
  /**
   * 鎺т欢鏍硅妭鐐逛娇鐢ㄧ殑鏍囩
   * @type {String}
   */
  elTagName: {
    // 鐢熸垚鏍囩鍚嶅瓧
    value: 'div'
  },
  /**
   * 鎺т欢鏍硅妭鐐瑰睘鎬�
   * see {@link BUI.Component.Controller#property-elAttrs}
   * @ignore
   */
  elAttrs: {},
  /**
   * 鎺т欢鍐呭锛宧tml,鏂囨湰绛�
   * see {@link BUI.Component.Controller#property-content}
   */
  content: {},
  /**
   * 鎺т欢鎻掑叆鍒版寚瀹氬厓绱犲墠
   * see {@link BUI.Component.Controller#property-tpl}
   */
  elBefore: {
    // better named to renderBefore, too late !
  },
  /**
   * 鎺т欢鍦ㄦ寚瀹氬厓绱犲唴閮ㄦ覆鏌�
   * see {@link BUI.Component.Controller#property-render}
   * @ignore
   */
  render: {},
  /**
   * 鏄惁鍙
   * see {@link BUI.Component.Controller#property-visible}
   */
  visible: {
    value: true
  },
  /**
   * 鍙妯″紡
   * see {@link BUI.Component.Controller#property-visibleMode}
   */
  visibleMode: {
    value: 'display'
  },
  /**
   * @private
   * 缂撳瓨闅愯棌鏃剁殑浣嶇疆锛屽搴攙isibleMode = 'visiblity' 鐨勫満鏅�
   * @type {Object}
   */
  cachePosition: {

  },
  /**
   * content 璁剧疆鐨勫唴瀹硅妭鐐�,榛樿鏍硅妭鐐�
   * @type {jQuery}
   * @default  el
   */
  contentEl: {
    valueFn: function() {
      return this.get('el');
    }
  },
  /**
   * 鏍峰紡鍓嶇紑
   * see {@link BUI.Component.Controller#property-prefixCls}
   */
  prefixCls: {
    value: BUI.prefix
  },
  /**
   * 鍙互鑾峰彇鐒︾偣
   * @protected
   * see {@link BUI.Component.Controller#property-focusable}
   */
  focusable: {
    value: true
  },
  /**
   * 鑾峰彇鐒︾偣
   * see {@link BUI.Component.Controller#property-focused}
   */
  focused: {},
  /**
   * 婵€娲�
   * see {@link BUI.Component.Controller#property-active}
   */
  active: {},
  /**
   * 绂佺敤
   * see {@link BUI.Component.Controller#property-disabled}
   */
  disabled: {},
  /**
   * 楂樹寒鏄剧ず
   * see {@link BUI.Component.Controller#property-highlighted}
   */
  highlighted: {}
};

module.exports = View;

});
define("bui/common/component/controller", ["jquery"], function(require, exports, module){
/**
 * @fileOverview  鎺т欢鍙互瀹炰緥鍖栫殑鍩虹被
 * @ignore
 * @author yiminghe@gmail.com
 * copied by dxq613@gmail.com
 */

/**
 * jQuery 浜嬩欢
 * @class jQuery.Event
 * @private
 */


'use strict';

var $ = require("jquery"), 
  UIBase = require("bui/common/component/uibase/uibase"),
  Manager = require("bui/common/component/manage"),
  View = require("bui/common/component/view"),
  Loader = require("bui/common/component/loader"),
  wrapBehavior = BUI.wrapBehavior,
  getWrapBehavior = BUI.getWrapBehavior;

/**
 * @ignore
 */
function wrapperViewSetter(attrName) {
  return function(ev) {
    var self = this;
    // in case bubbled from sub component
    if (self === ev.target) {
      var value = ev.newVal,
        view = self.get('view');
      if (view) {
        view.set(attrName, value);
      }

    }
  };
}

/**
 * @ignore
 */
function wrapperViewGetter(attrName) {
  return function(v) {
    var self = this,
      view = self.get('view');
    return v === undefined ? view.get(attrName) : v;
  };
}

/**
 * @ignore
 */
function initChild(self, c, renderBefore) {
  // 鐢熸垚鐖剁粍浠剁殑 dom 缁撴瀯
  self.create();
  var contentEl = self.getContentElement(),
    defaultCls = self.get('defaultChildClass');
  //閰嶇疆榛樿 xclass
  if (!c.xclass && !(c instanceof Controller)) {
    if (!c.xtype) {
      c.xclass = defaultCls;
    } else {
      c.xclass = defaultCls + '-' + c.xtype;
    }

  }

  c = BUI.Component.create(c, self);
  c.setInternal('parent', self);
  // set 閫氱煡 view 涔熸洿鏂板搴斿睘鎬�
  c.set('render', contentEl);
  c.set('elBefore', renderBefore);
  // 濡傛灉 parent 涔熸病娓叉煋锛屽瓙缁勪欢 create 鍑烘潵鍜� parent 鑺傜偣鍏宠仈
  // 瀛愮粍浠跺拰 parent 缁勪欢涓€璧锋覆鏌�
  // 涔嬪墠璁惧ソ灞炴€э紝view 锛宭ogic 鍚屾杩樻病 bind ,create 涓嶆槸 render 锛岃繕娌℃湁 bindUI
  c.create(undefined);
  return c;
}

/**
 * 涓嶄娇鐢� valueFn锛�
 * 鍙湁 render 鏃堕渶瑕佹壘鍒伴粯璁わ紝鍏朵粬鏃跺€欎笉闇€瑕侊紝闃叉鑾悕鍏跺鍒濆鍖�
 * @ignore
 */
function constructView(self) {
  // 閫愬眰鎵鹃粯璁ゆ覆鏌撳櫒
  var attrs,
    attrCfg,
    attrName,
    cfg = {},
    v,
    Render = self.get('xview');


  //灏嗘覆鏌撳眰鍒濆鍖栨墍闇€瑕佺殑灞炴€э紝鐩存帴鏋勯€犲櫒璁剧疆杩囧幓

  attrs = self.getAttrs();

  // 鏁寸悊灞炴€э紝瀵圭函灞炰簬 view 鐨勫睘鎬э紝娣诲姞 getter setter 鐩存帴鍒� view
  for (attrName in attrs) {
    if (attrs.hasOwnProperty(attrName)) {
      attrCfg = attrs[attrName];
      if (attrCfg.view) {
        // 鍏堝彇鍚� getter
        // 闃叉姝诲惊鐜�
        if ((v = self.get(attrName)) !== undefined) {
          cfg[attrName] = v;
        }

        // setter 涓嶅簲璇ユ湁瀹為檯鎿嶄綔锛屼粎鐢ㄤ簬姝ｈ鍖栨瘮杈冨ソ
        // attrCfg.setter = wrapperViewSetter(attrName);
        // 涓嶆洿鏀筧ttrCfg鐨勫畾涔夛紝鍙互澶氫釜瀹炰緥鍏敤涓€浠絘ttrCfg
        /*self.on('after' + BUI.ucfirst(attrName) + 'Change',
          wrapperViewSetter(attrName));
        */
        // 閫昏緫灞傝鍊肩洿鎺ヤ粠 view 灞傝
        // 閭ｄ箞濡傛灉瀛樺湪榛樿鍊间篃璁剧疆鍦� view 灞�
        // 閫昏緫灞備笉瑕佽缃� getter
        //attrCfg.getter = wrapperViewGetter(attrName);
      }
    }
  }
  // does not autoRender for view
  delete cfg.autoRender;
  cfg.ksComponentCss = getComponentCss(self);
  return new Render(cfg);
}

function getComponentCss(self) {
  var constructor = self.constructor,
    cls,
    re = [];
  while (constructor && constructor !== Controller) {
    cls = Manager.getXClassByConstructor(constructor);
    if (cls) {
      re.push(cls);
    }
    constructor = constructor.superclass && constructor.superclass.constructor;
  }
  return re.join(' ');
}

function isMouseEventWithinElement(e, elem) {
  var relatedTarget = e.relatedTarget;
  // 鍦ㄩ噷闈㈡垨绛変簬鑷韩閮戒笉绠� mouseenter/leave
  return relatedTarget &&
    (relatedTarget === elem[0] || $.contains(elem, relatedTarget));
}

/**
 * 鍙互瀹炰緥鍖栫殑鎺т欢锛屼綔涓烘渶椤跺眰鐨勬帶浠剁被锛屼竴鍒囩敤鎴锋帶浠堕兘缁ф壙姝ゆ帶浠�
 * xclass: 'controller'.
 * ** 鍒涘缓瀛愭帶浠� **
 * <pre><code>
 * var Control = Controller.extend([mixin1,mixin2],{ //鍘熷瀷閾句笂鐨勫嚱鏁�
 *   renderUI : function(){ //鍒涘缓DOM
 *
 *   },
 *   bindUI : function(){  //缁戝畾浜嬩欢
 *
 *   },
 *   destructor : funciton(){ //鏋愭瀯鍑芥暟
 *
 *   }
 * },{
 *   ATTRS : { //榛樿鐨勫睘鎬�
 *     text : {
 *
 *     }
 *   }
 * },{
 *   xclass : 'a' //鐢ㄤ簬鎶婂璞¤В鏋愭垚绫�
 * });
 * </code></pre>
 *
 * ** 鍒涘缓瀵硅薄 **
 * <pre><code>
 * var c1 = new Control({
 *   render : '#t1', //鍦╰1涓婂垱寤�
 *   text : 'text1',
 *   children : [{xclass : 'a',text : 'a1'},{xclass : 'b',text : 'b1'}]
 * });
 *
 * c1.render();
 * </code></pre>
 * @extends BUI.Component.UIBase
 * @mixins BUI.Component.UIBase.Tpl
 * @mixins BUI.Component.UIBase.Decorate
 * @mixins BUI.Component.UIBase.Depends
 * @mixins BUI.Component.UIBase.ChildCfg
 * @class BUI.Component.Controller
 */
var Controller = UIBase.extend([UIBase.Decorate, UIBase.Tpl, UIBase.ChildCfg, UIBase.KeyNav, UIBase.Depends], {
  /**
   * 鏄惁鏄帶浠讹紝鏍囩ず瀵硅薄鏄惁鏄竴涓猆I 鎺т欢
   * @type {Boolean}
   */
  isController: true,

  /**
   * 浣跨敤鍓嶇紑鑾峰彇绫荤殑鍚嶅瓧
   * @param classes {String} class names without prefixCls. Separated by space.
   * @method
   * @protected
   * @return {String} class name with prefixCls
   */
  getCssClassWithPrefix: Manager.getCssClassWithPrefix,

  /**
   * From UIBase, Initialize this component.       *
   * @protected
   */
  initializer: function() {
    var self = this;

    if (!self.get('id')) {
      self.set('id', self.getNextUniqueId());
    }
    Manager.addComponent(self.get('id'), self);
    // initialize view
    var view = constructView(self);
    self.setInternal('view', view);
    self.__view = view;
  },

  /**
   * 杩斿洖鏂扮殑鍞竴鐨処d,缁撴灉鏄� 'xclass' + number
   * @protected
   * @return {String} 鍞竴id
   */
  getNextUniqueId: function() {
    var self = this,
      xclass = Manager.getXClassByConstructor(self.constructor);
    return BUI.guid(xclass);
  },
  /**
   * From UIBase. Constructor(or get) view object to create ui elements.
   * @protected
   *
   */
  createDom: function() {
    var self = this,
      //el,
      view = self.get('view');
    view.create(undefined);
    //el = view.getKeyEventTarget();
    /*if (!self.get('allowTextSelection')) {
      //el.unselectable(undefined);
    }*/
  },

  /**
   * From UIBase. Call view object to render ui elements.
   * @protected
   *
   */
  renderUI: function() {
    var self = this,
      loader = self.get('loader');
    self.get('view').render();
    self._initChildren();
    if (loader) {
      self.setInternal('loader', loader);
    }
    /**/

  },
  _initChildren: function(children) {
    var self = this,
      i,
      children,
      child;
    // then render my children
    children = children || self.get('children').concat();
    self.get('children').length = 0;
    for (i = 0; i < children.length; i++) {
      child = self.addChild(children[i]);
      child.render();
    }
  },
  /**
   * bind ui for box
   * @private
   */
  bindUI: function() {
    var self = this,
      events = self.get('events');
    this.on('afterVisibleChange', function(e) {
      this.fire(e.newVal ? 'show' : 'hide');
    });
    //澶勭悊鎺т欢浜嬩欢锛岃缃簨浠舵槸鍚﹀啋娉�
    BUI.each(events, function(v, k) {
      self.publish(k, {
        bubbles: v
      });
    });
  },
  /**
   * 鎺т欢鏄惁鍖呭惈鎸囧畾鐨凞OM鍏冪礌,鍖呮嫭鏍硅妭鐐�
   * <pre><code>
   *   var control = new Control();
   *   $(document).on('click',function(ev){
   *   var target = ev.target;
   *
   *   if(!control.containsElement(elem)){ //鏈偣鍑诲湪鎺т欢鍐呴儴
   *     control.hide();
   *   }
   *   });
   * </code></pre>
   * @param  {HTMLElement} elem DOM 鍏冪礌
   * @return {Boolean}  鏄惁鍖呭惈
   */
  containsElement: function(elem) {
    var _self = this,
      el = _self.get('el'),
      children = _self.get('children'),
      result = false;
    if (!_self.get('rendered')) {
      return false;
    }
    if ($.contains(el[0], elem) || el[0] === elem) {
      result = true;
    } else {
      BUI.each(children, function(item) {
        if (item.containsElement(elem)) {
          result = true;
          return false;
        }
      });
    }
    return result;
  },
  /**
   * 鏄惁鏄瓙鎺т欢鐨凞OM鍏冪礌
   * @protected
   * @return {Boolean} 鏄惁瀛愭帶浠剁殑DOM鍏冪礌
   */
  isChildrenElement: function(elem) {
    var _self = this,
      children = _self.get('children'),
      rst = false;
    BUI.each(children, function(child) {
      if (child.containsElement(elem)) {
        rst = true;
        return false;
      }
    });
    return rst;
  },
  /**
   * 鏄剧ず鎺т欢
   */
  show: function() {
    var self = this;
    self.render();
    self.set('visible', true);
    return self;
  },

  /**
   * 闅愯棌鎺т欢
   */
  hide: function() {
    var self = this;
    self.set('visible', false);
    return self;
  },
  /**
   * 浜ゆ浛鏄剧ず鎴栬€呴殣钘�
   * <pre><code>
   *  control.show(); //鏄剧ず
   *  control.toggle(); //闅愯棌
   *  control.toggle(); //鏄剧ず
   * </code></pre>
   */
  toggle: function() {
    this.set('visible', !this.get('visible'));
    return this;
  },
  _uiSetFocusable: function(focusable) {
    var self = this,
      t,
      el = self.getKeyEventTarget();
    if (focusable) {
      el.attr('tabIndex', 0)
      // remove smart outline in ie
      // set outline in style for other standard browser
      .attr('hideFocus', true)
        .on('focus', wrapBehavior(self, 'handleFocus'))
        .on('blur', wrapBehavior(self, 'handleBlur'))
        .on('keydown', wrapBehavior(self, 'handleKeydown'))
        .on('keyup', wrapBehavior(self, 'handleKeyUp'));
    } else {
      el.removeAttr('tabIndex');
      if (t = getWrapBehavior(self, 'handleFocus')) {
        el.off('focus', t);
      }
      if (t = getWrapBehavior(self, 'handleBlur')) {
        el.off('blur', t);
      }
      if (t = getWrapBehavior(self, 'handleKeydown')) {
        el.off('keydown', t);
      }
      if (t = getWrapBehavior(self, 'handleKeyUp')) {
        el.off('keyup', t);
      }
    }
  },

  _uiSetHandleMouseEvents: function(handleMouseEvents) {
    var self = this,
      el = self.get('el'),
      t;
    if (handleMouseEvents) {
      el.on('mouseenter', wrapBehavior(self, 'handleMouseEnter'))
        .on('mouseleave', wrapBehavior(self, 'handleMouseLeave'))
        .on('contextmenu', wrapBehavior(self, 'handleContextMenu'))
        .on('mousedown', wrapBehavior(self, 'handleMouseDown'))
        .on('mouseup', wrapBehavior(self, 'handleMouseUp'))
        .on('dblclick', wrapBehavior(self, 'handleDblClick'));
    } else {
      t = getWrapBehavior(self, 'handleMouseEnter') &&
        el.off('mouseenter', t);
      t = getWrapBehavior(self, 'handleMouseLeave') &&
        el.off('mouseleave', t);
      t = getWrapBehavior(self, 'handleContextMenu') &&
        el.off('contextmenu', t);
      t = getWrapBehavior(self, 'handleMouseDown') &&
        el.off('mousedown', t);
      t = getWrapBehavior(self, 'handleMouseUp') &&
        el.off('mouseup', t);
      t = getWrapBehavior(self, 'handleDblClick') &&
        el.off('dblclick', t);
    }
  },

  _uiSetFocused: function(v) {
    if (v) {
      this.getKeyEventTarget()[0].focus();
    }
  },
  //褰撲娇鐢╲isiblity鏄剧ず闅愯棌鏃讹紝闅愯棌鏃舵妸DOM绉婚櫎鍑鸿鍥惧唴锛屾樉绀烘椂鍥炲鍘熶綅缃�
  _uiSetVisible: function(isVisible) {
    var self = this,
      el = self.get('el'),
      visibleMode = self.get('visibleMode');
    if (visibleMode === 'visibility') {
      if (isVisible) {
        var position = self.get('cachePosition');
        if (position) {
          self.set('xy', position);
        }
      }
      if (!isVisible) {
        var position = [
          self.get('x'), self.get('y')
        ];
        self.set('cachePosition', position);
        self.set('xy', [-999, -999]);
      }
    }
  },
  //璁剧疆children鏃�
  _uiSetChildren: function(v) {
    var self = this,
      children = BUI.cloneObject(v);
    //self.removeChildren(true);
    self._initChildren(children);
  },
  /**
   * 浣挎帶浠跺彲鐢�
   */
  enable: function() {
    this.set('disabled', false);
    return this;
  },
  /**
   * 浣挎帶浠朵笉鍙敤锛屾帶浠朵笉鍙敤鏃讹紝鐐瑰嚮绛変簨浠朵笉浼氳Е鍙�
   * <pre><code>
   *  control.disable(); //绂佺敤
   *  control.enable(); //瑙ｉ櫎绂佺敤
   * </code></pre>
   */
  disable: function() {
    this.set('disabled', true);
    return this;
  },
  /**
   * 鎺т欢鑾峰彇鐒︾偣
   */
  focus: function() {
    if (this.get('focusable')) {
      this.set('focused', true);
    }
  },
  /**
   * 瀛愮粍浠跺皢瑕佹覆鏌撳埌鐨勮妭鐐癸紝鍦� render 绫讳笂瑕嗙洊瀵瑰簲鏂规硶
   * @protected
   * @ignore
   */
  getContentElement: function() {
    return this.get('view').getContentElement();
  },

  /**
   * 鐒︾偣鎵€鍦ㄥ厓绱犲嵆閿洏浜嬩欢澶勭悊鍏冪礌锛屽湪 render 绫讳笂瑕嗙洊瀵瑰簲鏂规硶
   * @protected
   * @ignore
   */
  getKeyEventTarget: function() {
    return this.get('view').getKeyEventTarget();
  },

  /**
   * 娣诲姞鎺т欢鐨勫瓙鎺т欢锛岀储寮曞€间负 0-based
   * <pre><code>
   *  control.add(new Control());//娣诲姞controller瀵硅薄
   *  control.add({xclass : 'a'});//娣诲姞xclass 涓篴 鐨勪竴涓璞�
   *  control.add({xclass : 'b'},2);//鎻掑叆鍒扮涓変釜浣嶇疆
   * </code></pre>
   * @param {BUI.Component.Controller|Object} c 瀛愭帶浠剁殑瀹炰緥鎴栬€呴厤缃」
   * @param {String} [c.xclass] 濡傛灉c涓洪厤缃」锛岃缃甤鐨剎class
   * @param {Number} [index]  0-based  濡傛灉鏈寚瀹氱储寮曞€硷紝鍒欐彃鍦ㄦ帶浠剁殑鏈€鍚�
   */
  addChild: function(c, index) {
    var self = this,
      children = self.get('children'),
      renderBefore;
    if (index === undefined) {
      index = children.length;
    }
    /**
     * 娣诲姞瀛愭帶浠跺墠瑙﹀彂
     * @event beforeAddChild
     * @param {Object} e
     * @param {Object} e.child 娣诲姞瀛愭帶浠舵椂浼犲叆鐨勯厤缃」鎴栬€呭瓙鎺т欢
     * @param {Number} e.index 娣诲姞鐨勪綅缃�
     */
    self.fire('beforeAddChild', {
      child: c,
      index: index
    });
    renderBefore = children[index] && children[index].get('el') || null;
    c = initChild(self, c, renderBefore);
    children.splice(index, 0, c);
    // 鍏� create 鍗犱綅 鍐� render
    // 闃叉 render 閫昏緫閲岃 parent.get('children') 涓嶅悓姝�
    // 濡傛灉 parent 宸茬粡娓叉煋濂戒簡瀛愮粍浠朵篃瑕佺珛鍗虫覆鏌擄紝灏� 鍒涘缓 dom 锛岀粦瀹氫簨浠�
    if (self.get('rendered')) {
      c.render();
    }

    /**
     * 娣诲姞瀛愭帶浠跺悗瑙﹀彂
     * @event afterAddChild
     * @param {Object} e
     * @param {Object} e.child 娣诲姞瀛愭帶浠�
     * @param {Number} e.index 娣诲姞鐨勪綅缃�
     */
    self.fire('afterAddChild', {
      child: c,
      index: index
    });
    return c;
  },
  /**
   * 灏嗚嚜宸变粠鐖舵帶浠朵腑绉婚櫎
   * <pre><code>
   *  control.remove(); //灏嗘帶浠朵粠鐖舵帶浠朵腑绉婚櫎锛屽苟鏈垹闄�
   *  parent.addChild(control); //杩樺彲浠ユ坊鍔犲洖鐖舵帶浠�
   *
   *  control.remove(true); //浠庢帶浠朵腑绉婚櫎骞惰皟鐢ㄦ帶浠剁殑鏋愭瀯鍑芥暟
   * </code></pre>
   * @param  {Boolean} destroy 鏄惁鍒犻櫎DON鑺傜偣
   * @return {BUI.Component.Controller} 鍒犻櫎鐨勫瓙瀵硅薄.
   */
  remove: function(destroy) {
    var self = this,
      parent = self.get('parent');
    if (parent) {
      parent.removeChild(self, destroy);
    } else if (destroy) {
      self.destroy();
    }
    return self;
  },
  /**
   * 绉婚櫎瀛愭帶浠讹紝骞惰繑鍥炵Щ闄ょ殑鎺т欢
   *
   * ** 濡傛灉 destroy=true,璋冪敤绉婚櫎鎺т欢鐨� {@link BUI.Component.UIBase#destroy} 鏂规硶,
   * 鍚屾椂鍒犻櫎瀵瑰簲鐨凞OM **
   * <pre><code>
   *  var child = control.getChild(id);
   *  control.removeChild(child); //浠呬粎绉婚櫎
   *
   *  control.removeChild(child,true); //绉婚櫎锛屽苟璋冪敤鏋愭瀯鍑芥暟
   * </code></pre>
   * @param {BUI.Component.Controller} c 瑕佺Щ闄ょ殑瀛愭帶浠�.
   * @param {Boolean} [destroy=false] 濡傛灉鏄痶rue,
   * 璋冪敤鎺т欢鐨勬柟娉� {@link BUI.Component.UIBase#destroy} .
   * @return {BUI.Component.Controller} 绉婚櫎鐨勫瓙鎺т欢.
   */
  removeChild: function(c, destroy) {
    var self = this,
      children = self.get('children'),
      index = BUI.Array.indexOf(c, children);

    if (index === -1) {
      return;
    }
    /**
     * 鍒犻櫎瀛愭帶浠跺墠瑙﹀彂
     * @event beforeRemoveChild
     * @param {Object} e
     * @param {Object} e.child 瀛愭帶浠�
     * @param {Boolean} e.destroy 鏄惁娓呴櫎DOM
     */
    self.fire('beforeRemoveChild', {
      child: c,
      destroy: destroy
    });

    if (index !== -1) {
      children.splice(index, 1);
    }
    if (destroy &&
      // c is still json
      c.destroy) {
      c.destroy();
    }
    /**
     * 鍒犻櫎瀛愭帶浠跺墠瑙﹀彂
     * @event afterRemoveChild
     * @param {Object} e
     * @param {Object} e.child 瀛愭帶浠�
     * @param {Boolean} e.destroy 鏄惁娓呴櫎DOM
     */
    self.fire('afterRemoveChild', {
      child: c,
      destroy: destroy
    });

    return c;
  },

  /**
   * 鍒犻櫎褰撳墠鎺т欢鐨勫瓙鎺т欢
   * <pre><code>
   *   control.removeChildren();//鍒犻櫎鎵€鏈夊瓙鎺т欢
   *   control.removeChildren(true);//鍒犻櫎鎵€鏈夊瓙鎺т欢锛屽苟璋冪敤瀛愭帶浠剁殑鏋愭瀯鍑芥暟
   * </code></pre>
   * @see Component.Controller#removeChild
   * @param {Boolean} [destroy] 濡傛灉璁剧疆 true,
   * 璋冪敤瀛愭帶浠剁殑 {@link BUI.Component.UIBase#destroy}鏂规硶.
   */
  removeChildren: function(destroy) {
    var self = this,
      i,
      t = [].concat(self.get('children'));
    for (i = 0; i < t.length; i++) {
      self.removeChild(t[i], destroy);
    }
  },

  /**
   * 鏍规嵁绱㈠紩鑾峰彇瀛愭帶浠�
   * <pre><code>
   *  control.getChildAt(0);//鑾峰彇绗竴涓瓙鎺т欢
   *  control.getChildAt(2); //鑾峰彇绗笁涓瓙鎺т欢
   * </code></pre>
   * @param {Number} index 0-based 绱㈠紩鍊�.
   * @return {BUI.Component.Controller} 瀛愭帶浠舵垨鑰卬ull
   */
  getChildAt: function(index) {
    var children = this.get('children');
    return children[index] || null;
  },
  /**
   * 鏍规嵁Id鑾峰彇瀛愭帶浠�
   * <pre><code>
   *  control.getChild('id'); //浠庢帶浠剁殑鐩存帴瀛愭帶浠朵腑鏌ユ壘
   *  control.getChild('id',true);//閫掑綊鏌ユ壘鎵€鏈夊瓙鎺т欢锛屽寘鍚瓙鎺т欢鐨勫瓙鎺т欢
   * </code></pre>
   * @param  {String} id 鎺т欢缂栧彿
   * @param  {Boolean} deep 鏄惁缁х画鏌ユ壘鍦ㄥ瓙鎺т欢涓煡鎵�
   * @return {BUI.Component.Controller} 瀛愭帶浠舵垨鑰卬ull
   */
  getChild: function(id, deep) {
    return this.getChildBy(function(item) {
      return item.get('id') === id;
    }, deep);
  },
  /**
   * 閫氳繃鍖归厤鍑芥暟鏌ユ壘瀛愭帶浠讹紝杩斿洖绗竴涓尮閰嶇殑瀵硅薄
   * <pre><code>
   *  control.getChildBy(function(child){//浠庢帶浠剁殑鐩存帴瀛愭帶浠朵腑鏌ユ壘
   *  return child.get('id') = '1243';
   *  });
   *
   *  control.getChild(function(child){//閫掑綊鏌ユ壘鎵€鏈夊瓙鎺т欢锛屽寘鍚瓙鎺т欢鐨勫瓙鎺т欢
   *  return child.get('id') = '1243';
   *  },true);
   * </code></pre>
   * @param  {Function} math 鏌ユ壘鐨勫尮閰嶅嚱鏁�
   * @param  {Boolean} deep 鏄惁缁х画鏌ユ壘鍦ㄥ瓙鎺т欢涓煡鎵�
   * @return {BUI.Component.Controller} 瀛愭帶浠舵垨鑰卬ull
   */
  getChildBy: function(math, deep) {
    return this.getChildrenBy(math, deep)[0] || null;
  },
  /**
   * 鑾峰彇鎺т欢鐨勯檮鍔犻珮搴� = control.get('el').outerHeight() - control.get('el').height()
   * @protected
   * @return {Number} 闄勫姞瀹藉害
   */
  getAppendHeight: function() {
    var el = this.get('el');
    return el.outerHeight() - el.height();
  },
  /**
   * 鑾峰彇鎺т欢鐨勯檮鍔犲搴� = control.get('el').outerWidth() - control.get('el').width()
   * @protected
   * @return {Number} 闄勫姞瀹藉害
   */
  getAppendWidth: function() {
    var el = this.get('el');
    return el.outerWidth() - el.width();
  },
  /**
   * 鏌ユ壘绗﹀悎鏉′欢鐨勫瓙鎺т欢
   * <pre><code>
   *  control.getChildrenBy(function(child){//浠庢帶浠剁殑鐩存帴瀛愭帶浠朵腑鏌ユ壘
   *  return child.get('type') = '1';
   *  });
   *
   *  control.getChildrenBy(function(child){//閫掑綊鏌ユ壘鎵€鏈夊瓙鎺т欢锛屽寘鍚瓙鎺т欢鐨勫瓙鎺т欢
   *  return child.get('type') = '1';
   *  },true);
   * </code></pre>
   * @param  {Function} math 鏌ユ壘鐨勫尮閰嶅嚱鏁�
   * @param  {Boolean} deep 鏄惁缁х画鏌ユ壘鍦ㄥ瓙鎺т欢涓煡鎵撅紝濡傛灉绗﹀悎涓婇潰鐨勫尮閰嶅嚱鏁帮紝鍒欎笉鍐嶅線涓嬫煡鎵�
   * @return {BUI.Component.Controller[]} 瀛愭帶浠舵暟缁�
   */
  getChildrenBy: function(math, deep) {
    var self = this,
      results = [];
    if (!math) {
      return results;
    }

    self.eachChild(function(child) {
      if (math(child)) {
        results.push(child);
      } else if (deep) {

        results = results.concat(child.getChildrenBy(math, deep));
      }
    });
    return results;
  },
  /**
   * 閬嶅巻瀛愬厓绱�
   * <pre><code>
   *  control.eachChild(function(child,index){ //閬嶅巻瀛愭帶浠�
   *
   *  });
   * </code></pre>
   * @param  {Function} func 杩唬鍑芥暟锛屽嚱鏁板師鍨媐unction(child,index)
   */
  eachChild: function(func) {
    BUI.each(this.get('children'), func);
  },
  /**
   * Handle dblclick events. By default, this performs its associated action by calling
   * {@link BUI.Component.Controller#performActionInternal}.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleDblClick: function(ev) {
    this.performActionInternal(ev);
    if (!this.isChildrenElement(ev.target)) {
      this.fire('dblclick', {
        domTarget: ev.target,
        domEvent: ev
      });
    }
  },

  /**
   * Called by it's container component to dispatch mouseenter event.
   * @private
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleMouseOver: function(ev) {
    var self = this,
      el = self.get('el');
    if (!isMouseEventWithinElement(ev, el)) {
      self.handleMouseEnter(ev);

    }
  },

  /**
   * Called by it's container component to dispatch mouseleave event.
   * @private
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleMouseOut: function(ev) {
    var self = this,
      el = self.get('el');
    if (!isMouseEventWithinElement(ev, el)) {
      self.handleMouseLeave(ev);

    }
  },

  /**
   * Handle mouseenter events. If the component is not disabled, highlights it.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleMouseEnter: function(ev) {
    var self = this;
    this.set('highlighted', !!ev);
    self.fire('mouseenter', {
      domTarget: ev.target,
      domEvent: ev
    });
  },

  /**
   * Handle mouseleave events. If the component is not disabled, de-highlights it.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleMouseLeave: function(ev) {
    var self = this;
    self.set('active', false);
    self.set('highlighted', !ev);
    self.fire('mouseleave', {
      domTarget: ev.target,
      domEvent: ev
    });
  },

  /**
   * Handles mousedown events. If the component is not disabled,
   * If the component is activeable, then activate it.
   * If the component is focusable, then focus it,
   * else prevent it from receiving keyboard focus.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleMouseDown: function(ev) {
    var self = this,
      n,
      target = $(ev.target),
      isMouseActionButton = ev['which'] === 1,
      el;
    if (isMouseActionButton) {
      el = self.getKeyEventTarget();
      if (self.get('activeable')) {
        self.set('active', true);
      }
      if (self.get('focusable')) {
        //濡傛灉涓嶆槸input,select,area绛夊彲浠ヨ幏鍙栫劍鐐圭殑鎺т欢锛岄偅涔堣缃鎺т欢鐨刦ocus
        /*if(target[0] == el[0] || (!target.is('input,select,area') && !target.attr('tabindex'))){
          el[0].focus(); 
          
        }*/
        self.setInternal('focused', true);
      }

      if (!self.get('allowTextSelection')) {
        // firefox /chrome 涓嶄細寮曡捣鐒︾偣杞Щ
        n = ev.target.nodeName;
        n = n && n.toLowerCase();
        // do not prevent focus when click on editable element
        if (n !== 'input' && n !== 'textarea') {
          ev.preventDefault();
        }
      }
      if (!self.isChildrenElement(ev.target)) {
        self.fire('mousedown', {
          domTarget: ev.target,
          domEvent: ev
        });
      }

    }
  },

  /**
   * Handles mouseup events.
   * If this component is not disabled, performs its associated action by calling
   * {@link BUI.Component.Controller#performActionInternal}, then deactivates it.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleMouseUp: function(ev) {
    var self = this,
      isChildrenElement = self.isChildrenElement(ev.target);
    // 宸﹂敭
    if (self.get('active') && ev.which === 1) {
      self.performActionInternal(ev);
      self.set('active', false);
      if (!isChildrenElement) {
        self.fire('click', {
          domTarget: ev.target,
          domEvent: ev
        });
      }
    }
    if (!isChildrenElement) {
      self.fire('mouseup', {
        domTarget: ev.target,
        domEvent: ev
      });
    }
  },

  /**
   * Handles context menu.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleContextMenu: function(ev) {},

  /**
   * Handles focus events. Style focused class.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleFocus: function(ev) {
    this.set('focused', !!ev);
    this.fire('focus', {
      domEvent: ev,
      domTarget: ev.target
    });
  },

  /**
   * Handles blur events. Remove focused class.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleBlur: function(ev) {
    this.set('focused', !ev);
    this.fire('blur', {
      domEvent: ev,
      domTarget: ev.target
    });
  },

  /**
   * Handle enter keydown event to {@link BUI.Component.Controller#performActionInternal}.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleKeyEventInternal: function(ev) {
    var self = this,
      isChildrenElement = self.isChildrenElement(ev.target);
    if (ev.which === 13) {
      if (!isChildrenElement) {
        self.fire('click', {
          domTarget: ev.target,
          domEvent: ev
        });
      }

      return this.performActionInternal(ev);
    }
    if (!isChildrenElement) {
      self.fire('keydown', {
        domTarget: ev.target,
        domEvent: ev
      });
    }
  },

  /**
   * Handle keydown events.
   * If the component is not disabled, call {@link BUI.Component.Controller#handleKeyEventInternal}
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  handleKeydown: function(ev) {
    var self = this;
    if (self.handleKeyEventInternal(ev)) {
      ev.halt();
      return true;
    }
  },
  handleKeyUp: function(ev) {
    var self = this;
    if (!self.isChildrenElement(ev.target)) {
      self.fire('keyup', {
        domTarget: ev.target,
        domEvent: ev
      });
    }
  },
  /**
   * Performs the appropriate action when this component is activated by the user.
   * @protected
   * @param {jQuery.Event} ev DOM event to handle.
   */
  performActionInternal: function(ev) {},
  /**
   * 鏋愭瀯鍑芥暟
   * @protected
   */
  destructor: function() {
    var self = this,
      id,
      i,
      view,
      children = self.get('children');
    id = self.get('id');
    for (i = 0; i < children.length; i++) {
      children[i].destroy && children[i].destroy();
    }
    self.get('view').destroy();
    Manager.removeComponent(id);
  },
  //瑕嗗啓set鏂规硶
  set: function(name, value, opt) {
    var _self = this,
      view = _self.__view,
      attr = _self.__attrs[name],
      ucName,
      ev,
      m;
    if (BUI.isObject(name)) {
      opt = value;
      BUI.each(name, function(v, k) {
        _self.set(k, v, opt);
      });
    }
    if (!view || !attr || (opt && opt.silent)) { //鏈垵濮嬪寲view鎴栬€呮病鐢ㄥ畾涔夊睘鎬�
      Controller.superclass.set.call(this, name, value, opt);
      return _self;
    }

    var prevVal = Controller.superclass.get.call(this, name);

    //濡傛灉鏈敼鍙樺€间笉杩涜淇敼
    if (!$.isPlainObject(value) && !BUI.isArray(value) && prevVal === value) {
      return _self;
    }
    ucName = BUI.ucfirst(name);
    m = '_uiSet' + ucName;
    //瑙﹀彂before浜嬩欢
    _self.fire('before' + ucName + 'Change', {
      attrName: name,
      prevVal: prevVal,
      newVal: value
    });

    _self.setInternal(name, value);

    value = _self.__attrVals[name];
    if (view && attr.view) {
      view.set(name, value);
      //return _self;
    }
    ev = {
      attrName: name,
      prevVal: prevVal,
      newVal: value
    };

    //瑙﹀彂before浜嬩欢
    _self.fire('after' + ucName + 'Change', ev);
    if (_self.get('binded') && _self[m]) {
      _self[m](value, ev);
    }
    return _self;
  },
  //瑕嗗啓get鏂规硶锛屾敼鍙樻椂鍚屾椂鏀瑰彉view鐨勫€�
  get: function(name) {
    var _self = this,
      view = _self.__view,
      attr = _self.__attrs[name],
      value = Controller.superclass.get.call(this, name);
    if (value !== undefined) {
      return value;
    }
    if (view && attr && attr.view) {
      return view.get(name);
    }

    return value;
  }
}, {
  ATTRS: {
    /**
     * 鎺т欢鐨凥tml 鍐呭
     * <pre><code>
     *  new Control({
     *   content : '鍐呭',
     *   render : '#c1'
     *  });
     * </code></pre>
     * @cfg {String|jQuery} content
     */
    /**
     * 鎺т欢鐨凥tml 鍐呭
     * @type {String|jQuery}
     */
    content: {
      view: 1
    },
    /**
     * 鎺т欢鏍硅妭鐐逛娇鐢ㄧ殑鏍囩
     * <pre><code>
     *  new Control({
     *   elTagName : 'ul',
     *    content : '<li>鍐呭</li>',  //鎺т欢鐨凞OM &lt;ul&gt;&lt;li&gt;鍐呭&lt;/li&gt;&lt;/ul&gt;
     *   render : '#c1'
     *  });
     * </code></pre>
     * @cfg {String} elTagName
     */
    elTagName: {
      // 鐢熸垚鏍囩鍚嶅瓧
      view: true,
      value: 'div'
    },
    /**
     * 瀛愬厓绱犵殑榛樿 xclass,閰嶇疆child鐨勬椂鍊欐病蹇呰姣忔閮藉～鍐檟class
     * @type {String}
     */
    defaultChildClass: {

    },
    /**
     * 濡傛灉鎺т欢鏈缃� xclass锛屽悓鏃剁埗鍏冪礌璁剧疆浜� defaultChildClass锛岄偅涔�
     * xclass = defaultChildClass + '-' + xtype
     * <pre><code>
     *  A.ATTRS = {
     *  defaultChildClass : {
     *    value : 'b'
     *  }
     *  }
     *  //绫籅 鐨剎class = 'b'绫� B1鐨剎class = 'b-1',绫� B2鐨剎class = 'b-2',閭ｄ箞
     *  var a = new A({
     *  children : [
     *    {content : 'b'}, //B绫�
     *    {content : 'b1',xtype:'1'}, //B1绫�
     *    {content : 'b2',xtype:'2'}, //B2绫�
     *  ]
     *  });
     * </code></pre>
     * @type {String}
     */
    xtype: {

    },
    /**
     * 鏍囩ず鎺т欢鐨勫敮涓€缂栧彿锛岄粯璁や細鑷姩鐢熸垚
     * @cfg {String} id
     */
    /**
     * 鏍囩ず鎺т欢鐨勫敮涓€缂栧彿锛岄粯璁や細鑷姩鐢熸垚
     * @type {String}
     */
    id: {
      view: true
    },
    /**
     * 鎺т欢瀹藉害
     * <pre><code>
     * new Control({
     *   width : 200 // 200,'200px','20%'
     * });
     * </code></pre>
     * @cfg {Number|String} width
     */
    /**
     * 鎺т欢瀹藉害
     * <pre><code>
     *  control.set('width',200);
     *  control.set('width','200px');
     *  control.set('width','20%');
     * </code></pre>
     * @type {Number|String}
     */
    width: {
      view: 1
    },
    /**
     * 鎺т欢瀹藉害
     * <pre><code>
     * new Control({
     *   height : 200 // 200,'200px','20%'
     * });
     * </code></pre>
     * @cfg {Number|String} height
     */
    /**
     * 鎺т欢瀹藉害
     * <pre><code>
     *  control.set('height',200);
     *  control.set('height','200px');
     *  control.set('height','20%');
     * </code></pre>
     * @type {Number|String}
     */
    height: {
      view: 1
    },
    /**
     * 鎺т欢鏍硅妭鐐瑰簲鐢ㄧ殑鏍峰紡
     * <pre><code>
     *  new Control({
     *   elCls : 'test',
     *   content : '鍐呭',
     *   render : '#t1'   //&lt;div id='t1'&gt;&lt;div class="test"&gt;鍐呭&lt;/div&gt;&lt;/div&gt;
     *  });
     * </code></pre>
     * @cfg {String} elCls
     */
    /**
     * 鎺т欢鏍硅妭鐐瑰簲鐢ㄧ殑鏍峰紡 css class
     * @type {String}
     */
    elCls: {
      view: 1
    },
    /**
     * @cfg {Object} elStyle
     * 鎺т欢鏍硅妭鐐瑰簲鐢ㄧ殑css灞炴€�
     *  <pre><code>
     *  var cfg = {elStyle : {width:'100px', height:'200px'}};
     *  </code></pre>
     */
    /**
     * 鎺т欢鏍硅妭鐐瑰簲鐢ㄧ殑css灞炴€э紝浠ラ敭鍊煎褰㈠紡
     * @type {Object}
     *  <pre><code>
     *	 control.set('elStyle',	{
     *		width:'100px',
     *		height:'200px'
     *   });
     *  </code></pre>
     */
    elStyle: {
      view: 1
    },
    /**
     * @cfg {Object} elAttrs
     * 鎺т欢鏍硅妭鐐瑰簲鐢ㄧ殑灞炴€э紝浠ラ敭鍊煎褰㈠紡:
     * <pre><code>
     *  new Control({
     *  elAttrs :{title : 'tips'}
     *  });
     * </code></pre>
     */
    /**
     * @type {Object}
     * 鎺т欢鏍硅妭鐐瑰簲鐢ㄧ殑灞炴€э紝浠ラ敭鍊煎褰㈠紡:
     * { title : 'tips'}
     * @ignore
     */
    elAttrs: {
      view: 1
    },
    /**
     * 灏嗘帶浠舵彃鍏ュ埌鎸囧畾鍏冪礌鍓�
     * <pre><code>
     *  new Control({
     *    elBefore : '#t1'
     *  });
     * </code></pre>
     * @cfg {jQuery} elBefore
     */
    /**
     * 灏嗘帶浠舵彃鍏ュ埌鎸囧畾鍏冪礌鍓�
     * @type {jQuery}
     * @ignore
     */
    elBefore: {
      // better named to renderBefore, too late !
      view: 1
    },

    /**
     * 鍙灞炴€э紝鏍硅妭鐐笵OM
     * @type {jQuery}
     */
    el: {
      view: 1
    },
    /**
     * 鎺т欢鏀寔鐨勪簨浠�
     * @type {Object}
     * @protected
     */
    events: {
      value: {
        /**
         * 鐐瑰嚮浜嬩欢锛屾浜嬩欢浼氬啋娉★紝鎵€浠ュ彲浠ュ湪鐖跺厓绱犱笂鐩戝惉鎵€鏈夊瓙鍏冪礌鐨勬浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'click': true,
        /**
         * 鍙屽嚮浜嬩欢锛屾浜嬩欢浼氬啋娉★紝鎵€浠ュ彲浠ュ湪鐖跺厓绱犱笂鐩戝惉鎵€鏈夊瓙鍏冪礌鐨勬浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'dblclick': true,
        /**
         * 榧犳爣绉诲叆鎺т欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'mouseenter': true,
        /**
         * 榧犳爣绉诲嚭鎺т欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'mouseleave': true,
        /**
         * 閿洏鎸変笅鎸夐敭浜嬩欢锛屾浜嬩欢浼氬啋娉★紝鎵€浠ュ彲浠ュ湪鐖跺厓绱犱笂鐩戝惉鎵€鏈夊瓙鍏冪礌鐨勬浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'keydown': true,
        /**
         * 閿洏鎸夐敭鎶捣鎺т欢锛屾浜嬩欢浼氬啋娉★紝鎵€浠ュ彲浠ュ湪鐖跺厓绱犱笂鐩戝惉鎵€鏈夊瓙鍏冪礌鐨勬浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'keyup': true,
        /**
         * 鎺т欢鑾峰彇鐒︾偣浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'focus': false,
        /**
         * 鎺т欢涓㈠け鐒︾偣浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'blur': false,
        /**
         * 榧犳爣鎸変笅鎺т欢锛屾浜嬩欢浼氬啋娉★紝鎵€浠ュ彲浠ュ湪鐖跺厓绱犱笂鐩戝惉鎵€鏈夊瓙鍏冪礌鐨勬浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'mousedown': true,
        /**
         * 榧犳爣鎶捣鎺т欢锛屾浜嬩欢浼氬啋娉★紝鎵€浠ュ彲浠ュ湪鐖跺厓绱犱笂鐩戝惉鎵€鏈夊瓙鍏冪礌鐨勬浜嬩欢
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Component.Controller} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {jQuery.Event} e.domEvent DOM瑙﹀彂鐨勪簨浠�
         * @param {HTMLElement} e.domTarget 瑙﹀彂浜嬩欢鐨凞OM鑺傜偣
         */
        'mouseup': true,
        /**
         * 鎺т欢鏄剧ず
         * @event
         */
        'show': false,
        /**
         * 鎺т欢闅愯棌
         * @event
         */
        'hide': false
      }
    },
    /**
     * 鎸囧畾鎺т欢鐨勫鍣�
     * <pre><code>
     *  new Control({
     *  render : '#t1',
     *  elCls : 'test',
     *  content : '<span>123</span>'  //&lt;div id="t1"&gt;&lt;div class="test bui-xclass"&gt;&lt;span&gt;123&lt;/span&gt;&lt;/div&gt;&lt;/div&gt;
     *  });
     * </code></pre>
     * @cfg {jQuery} render
     */
    /**
     * 鎸囧畾鎺т欢鐨勫鍣�
     * @type {jQuery}
     * @ignore
     */
    render: {
      view: 1
    },
    /**
     * ARIA 鏍囧噯涓殑role,涓嶈鏇存敼姝ゅ睘鎬�
     * @type {String}
     * @protected
     */
    role: {
      view: 1
    },
    /**
     * 鐘舵€佺浉鍏崇殑鏍峰紡,榛樿鎯呭喌涓嬩細浣跨敤 鍓嶇紑鍚� + xclass + '-' + 鐘舵€佸悕
     * <ol>
     *   <li>hover</li>
     *   <li>focused</li>
     *   <li>active</li>
     *   <li>disabled</li>
     * </ol>
     * @type {Object}
     */
    statusCls: {
      view: true,
      value: {

      }
    },
    /**
     * 鎺т欢鐨勫彲瑙嗘柟寮�,鍊间负锛�
     *  - 'display'
     *  - 'visibility'
     *  <pre><code>
     *   new Control({
     *   visibleMode: 'visibility'
     *   });
     *  </code></pre>
     * @cfg {String} [visibleMode = 'display']
     */
    /**
     * 鎺т欢鐨勫彲瑙嗘柟寮�,浣跨敤 css
     *  - 'display' 鎴栬€�
     *  - 'visibility'
     * <pre><code>
     *  control.set('visibleMode','display')
     * </code></pre>
     * @type {String}
     */
    visibleMode: {
      view: 1,
      value: 'display'
    },
    /**
     * 鎺т欢鏄惁鍙
     * <pre><code>
     *  new Control({
     *  visible : false   //闅愯棌
     *  });
     * </code></pre>
     * @cfg {Boolean} [visible = true]
     */
    /**
     * 鎺т欢鏄惁鍙
     * <pre><code>
     *  control.set('visible',true); //control.show();
     *  control.set('visible',false); //control.hide();
     * </code></pre>
     * @type {Boolean}
     * @default true
     */
    visible: {
      value: true,
      view: 1
    },
    /**
     * 鏄惁鍏佽澶勭悊榧犳爣浜嬩欢
     * @default true.
     * @type {Boolean}
     * @protected
     */
    handleMouseEvents: {
      value: true
    },

    /**
     * 鎺т欢鏄惁鍙互鑾峰彇鐒︾偣
     * @default true.
     * @protected
     * @type {Boolean}
     */
    focusable: {
      value: false,
      view: 1
    },
    /**
     * 涓€鏃︿娇鐢╨oader鐨勯粯璁ら厤缃�
     * @protected
     * @type {Object}
     */
    defaultLoaderCfg: {
      value: {
        property: 'content',
        autoLoad: true
      }
    },
    /**
     * 鎺т欢鍐呭鐨勫姞杞藉櫒
     * @type {BUI.Component.Loader}
     */
    loader: {
      getter: function(v) {
        var _self = this,
          defaultCfg;
        if (v && !v.isLoader) {
          v.target = _self;
          defaultCfg = _self.get('defaultLoaderCfg')
          v = new Loader(BUI.merge(defaultCfg, v));
          _self.setInternal('loader', v);
        }
        return v;
      }
    },
    /**
     * 1. Whether allow select this component's text.<br/>
     * 2. Whether not to lose last component's focus if click current one (set false).
     *
     * Defaults to: false.
     * @type {Boolean}
     * @property allowTextSelection
     * @protected
     */
    /**
     * @ignore
     */
    allowTextSelection: {
      // 鍜� focusable 鍒嗙
      // grid 闇€姹傦細瀹瑰櫒鍏佽閫夋嫨閲岄潰鍐呭
      value: true
    },

    /**
     * 鎺т欢鏄惁鍙互婵€娲�
     * @default true.
     * @type {Boolean}
     * @protected
     */
    activeable: {
      value: true
    },

    /**
     * 鎺т欢鏄惁鑾峰彇鐒︾偣
     * @type {Boolean}
     * @readOnly
     */
    focused: {
      view: 1
    },

    /**
     * 鎺т欢鏄惁澶勪簬婵€娲荤姸鎬侊紝鎸夐挳鎸変笅杩樻湭鎶捣
     * @type {Boolean}
     * @default false
     * @protected
     */
    active: {
      view: 1
    },
    /**
     * 鎺т欢鏄惁楂樹寒
     * @cfg {Boolean} highlighted
     * @ignore
     */
    /**
     * 鎺т欢鏄惁楂樹寒
     * @type {Boolean}
     * @protected
     */
    highlighted: {
      view: 1
    },
    /**
     * 瀛愭帶浠堕泦鍚�
     * @cfg {BUI.Component.Controller[]} children
     */
    /**
     * 瀛愭帶浠堕泦鍚�
     * @type {BUI.Component.Controller[]}
     */
    children: {
      sync: false,
      shared: false,
      value: [] /**/
    },
    /**
     * 鎺т欢鐨凜SS鍓嶇紑
     * @cfg {String} [prefixCls = BUI.prefix]
     */
    /**
     * 鎺т欢鐨凜SS鍓嶇紑
     * @type {String}
     * @default BUI.prefix
     */
    prefixCls: {
      value: BUI.prefix, // box srcNode need
      view: 1
    },

    /**
     * 鐖舵帶浠�
     * @cfg {BUI.Component.Controller} parent
     * @ignore
     */
    /**
     * 鐖舵帶浠�
     * @type {BUI.Component.Controller}
     */
    parent: {
      setter: function(p) {
        // 浜嬩欢鍐掓场婧�
        this.addTarget(p);
      }
    },

    /**
     * 绂佺敤鎺т欢
     * @cfg {Boolean} [disabled = false]
     */
    /**
     * 绂佺敤鎺т欢
     * <pre><code>
     *  control.set('disabled',true); //==  control.disable();
     *  control.set('disabled',false); //==  control.enable();
     * </code></pre>
     * @type {Boolean}
     * @default false
     */
    disabled: {
      view: 1,
      value: false
    },
    /**
     * 娓叉煋鎺т欢鐨刅iew绫�.
     * @protected
     * @cfg {BUI.Component.View} [xview = BUI.Component.View]
     */
    /**
     * 娓叉煋鎺т欢鐨刅iew绫�.
     * @protected
     * @type {BUI.Component.View}
     */
    xview: {
      value: View
    }
  },
  PARSER: {
    visible: function(el) {
      var _self = this,
        display = el.css('display'),

        visibility = el.css('visibility'),
        visibleMode = _self.get('visibleMode');
      if ((display == 'none' && visibleMode == 'display') || (visibility == 'hidden' && visibleMode == 'visibility')) {
        return false;
      }
      return true;
    },
    disabled: function(el){
      var _self = this,
        cls = _self.get('prefixCls') + _self.get('xclass') + '-disabled';
      return el.hasClass(cls);
    }
  }
}, {
  xclass: 'controller',
  priority: 0
});
module.exports = Controller;

});
define("bui/common/component/loader", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鍔犺浇鎺т欢鍐呭
 * @ignore
 */

'use strict';
var $ = require("jquery"),
  BUI = require("bui/common/util"),
  Base = require("bui/common/base"),
  /**
   * @class BUI.Component.Loader
   * @extends BUI.Base
   * ** 鎺т欢鐨勯粯璁oader灞炴€ф槸锛�**
   * <pre><code>
   *
   *   defaultLoader : {
   *     value : {
   *       property : 'content',
   *       autoLoad : true
   *     }
   *   }
   * </code></pre>
   * ** 涓€鑸殑鎺т欢榛樿璇诲彇html锛屼綔涓烘帶浠剁殑content鍊� **
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json'
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   *
   * ** 鍙互淇敼Loader鐨勯粯璁ゅ睘鎬э紝鍔犺浇children **
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/children.json',
   *       property : 'children',
   *       dataType : 'json'
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * 鍔犺浇鎺т欢鍐呭鐨勭被锛屼竴鑸笉杩涜瀹炰緥鍖�
   */
  Loader = function(config) {
    Loader.superclass.constructor.call(this, config);
    this._init();
  };

Loader.ATTRS = {

  /**
   * 鍔犺浇鍐呭鐨勫湴鍧€
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json'
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {String} url
   */
  url: {

  },
  /**
   * 瀵瑰簲鐨勬帶浠讹紝鍔犺浇瀹屾垚鍚庤缃睘鎬у埌瀵瑰簲鐨勬帶浠�
   * @readOnly
   * @type {BUI.Component.Controller}
   */
  target: {

  },
  /**
   * @private
   * 鏄惁load 杩�
   */
  hasLoad: {
    value: false
  },
  /**
   * 鏄惁鑷姩鍔犺浇鏁版嵁
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       autoLoad : false
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {Boolean} [autoLoad = true]
   */
  autoLoad: {

  },
  /**
   * 寤惰繜鍔犺浇
   *
   *   - event : 瑙﹀彂鍔犺浇鐨勪簨浠�
   *   - repeat 锛氭槸鍚﹂噸澶嶅姞杞�
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       lazyLoad : {
   *         event : 'show',
   *         repeat : true
   *       }
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {Object} [lazyLoad = null]
   */
  lazyLoad: {

  },
  /**
   * 鍔犺浇杩斿洖鐨勬暟鎹綔涓烘帶浠剁殑閭ｄ釜灞炴€�
   * <pre><code>
   *   var control = new BUI.List.SimpleList({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       dataType : 'json',
   *       property : 'items'
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {String} property
   */
  property: {

  },
  /**
   * 鏍煎紡鍖栬繑鍥炵殑鏁版嵁
   * @cfg {Function} renderer
   */
  renderer: {
    value: function(value) {
      return value;
    }
  },
  /**
   * 鍔犺浇鏁版嵁鏃舵槸鍚︽樉绀哄睆钄藉眰鍜屽姞杞芥彁绀� {@link BUI.Mask.LoadMask}
   *
   *  -  loadMask : true鏃朵娇鐢╨oadMask 榛樿鐨勯厤缃俊鎭�
   *  -  loadMask : {msg : '姝ｅ湪鍔犺浇锛岃绋嶅悗銆傘€�'} LoadMask鐨勯厤缃俊鎭�
   *   <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       loadMask : true
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {Boolean|Object} [loadMask = false]
   */
  loadMask: {
    value: false
  },
  /**
   * ajax 璇锋眰杩斿洖鏁版嵁鐨勭被鍨�
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       dataType : 'json',
   *       property : 'items'
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {String} [dataType = 'text']
   */
  dataType: {
    value: 'text'
  },
  /**
   * Ajax璇锋眰鐨勯厤缃」,浼氳鐩� url,dataType鏁版嵁
   * @cfg {Object} ajaxOptions
   */
  ajaxOptions: {
    //shared : false,
    value: {
      type: 'get',
      cache: false
    }
  },
  /**
   * 鍒濆鍖栫殑璇锋眰鍙傛暟
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       params : {
   *         a : 'a',
   *         b : 'b'
   *       }
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {Object} params
   * @default null
   */
  params: {

  },
  /**
   * 闄勫姞鍙傛暟锛屾瘡娆¤姹傞兘甯︾殑鍙傛暟
   * @cfg {Object} appendParams
   */
  appendParams: {

  },
  /**
   * 鏈€鍚庝竴娆¤姹傜殑鍙傛暟
   * @readOnly
   * @private
   * @type {Object}
   */
  lastParams: {
    shared: false,
    value: {}
  },
  /**
   * 鍔犺浇鏁版嵁锛屽苟娣诲姞灞炴€у埌鎺т欢鍚庣殑鍥炶皟鍑芥暟
   *   - data : 鍔犺浇鐨勬暟鎹�
   *   - params : 鍔犺浇鐨勫弬鏁�
   * <pre><code>
   *   var control = new BUI.Component.Controller({
   *     render : '#c1',
   *     loader : {
   *       url : 'data/text.json',
   *       callback : function(text){
   *         var target = this.get('target');//control
   *         //TO DO
   *       }
   *     }
   *   });
   *
   *   control.render();
   * </code></pre>
   * @cfg {Function} callback
   */
  callback: {

  },
  /**
   * 澶辫触鐨勫洖璋冨嚱鏁�
   *   - response : 杩斿洖鐨勯敊璇璞�
   *   - params : 鍔犺浇鐨勫弬鏁�
   * @cfg {Function} failure
   */
  failure: {

  }

};

BUI.extend(Loader, Base);

BUI.augment(Loader, {
  /**
   * @protected
   * 鏄惁鏄疞oader
   * @type {Boolean}
   */
  isLoader: true,
  //鍒濆鍖�
  _init: function() {
    var _self = this,
      autoLoad = _self.get('autoLoad'),
      params = _self.get('params');

    _self._initMask();
    if (autoLoad) {
      _self.load(params);
    } else {
      _self._initParams();
      _self._initLazyLoad();
    }
  },
  //鍒濆鍖栧欢杩熷姞杞�
  _initLazyLoad: function() {
    var _self = this,
      target = _self.get('target'),
      lazyLoad = _self.get('lazyLoad');

    if (target && lazyLoad && lazyLoad.event) {
      target.on(lazyLoad.event, function() {
        if (!_self.get('hasLoad') || lazyLoad.repeat) {
          _self.load();
        }
      });
    }
  },
  /**
   * 鍒濆鍖杕ask
   * @private
   */
  _initMask: function() {
    var _self = this,
      target = _self.get('target'),
      loadMask = _self.get('loadMask');
    if (target && loadMask) {
      require.async('bui/mask', function(Mask) {
        var cfg = $.isPlainObject(loadMask) ? loadMask : {};
        loadMask = new Mask.LoadMask(BUI.mix({
          el: target.get('el')
        }, cfg));
        _self.set('loadMask', loadMask);
      });
    }
  },
  //鍒濆鍖栨煡璇㈠弬鏁�
  _initParams: function() {
    var _self = this,
      lastParams = _self.get('lastParams'),
      params = _self.get('params');

    //鍒濆鍖� 鍙傛暟
    BUI.mix(lastParams, params);
  },
  /**
   * 鍔犺浇鍐呭
   * @param {Object} params 鍔犺浇鏁版嵁鐨勫弬鏁�
   */
  load: function(params) {
    var _self = this,
      url = _self.get('url'),
      ajaxOptions = _self.get('ajaxOptions'),
      lastParams = _self.get('lastParams'),
      appendParams = _self.get('appendParams');

    //BUI.mix(true,lastParams,appendParams,params);
    params = params || lastParams;
    params = BUI.merge(appendParams, params); //BUI.cloneObject(lastParams);
    _self.set('lastParams', params);
    //鏈彁渚涘姞杞藉湴鍧€锛岄樆姝㈠姞杞�
    if (!url) {
      return;
    }

    _self.onBeforeLoad();
    _self.set('hasLoad', true);
    $.ajax(BUI.mix({
      dataType: _self.get('dataType'),
      data: params,
      url: url,
      success: function(data) {
        _self.onload(data, params);
      },
      error: function(jqXHR, textStatus, errorThrown) {
        _self.onException({
          jqXHR: jqXHR,
          textStatus: textStatus,
          errorThrown: errorThrown
        }, params);
      }
    }, ajaxOptions));
  },
  /**
   * @private
   * 鍔犺浇鍓�
   */
  onBeforeLoad: function() {
    var _self = this,
      loadMask = _self.get('loadMask');
    if (loadMask && loadMask.show) {
      loadMask.show();
    }
  },
  /**
   * @private
   * 鍔犺浇瀹屾瘯
   */
  onload: function(data, params) {
    var _self = this,
      loadMask = _self.get('loadMask'),
      property = _self.get('property'),
      callback = _self.get('callback'),
      renderer = _self.get('renderer'),
      target = _self.get('target');

    if (BUI.isString(data)) {
      target.set(property, ''); //闃叉2娆¤繑鍥炵殑鏁版嵁涓€鏍�
    }
    target.set(property, renderer.call(_self, data));

    /**/
    if (loadMask && loadMask.hide) {
      loadMask.hide();
    }
    if (callback) {
      callback.call(this, data, params);
    }
  },
  /**
   * @private
   * 鍔犺浇鍑洪敊
   */
  onException: function(response, params) {
    var _self = this,
      failure = _self.get('failure');
    if (failure) {
      failure.call(this, response, params);
    }
  }

});
module.exports = Loader;

});

define("bui/data", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview Data 鍛藉悕绌洪棿鐨勫叆鍙ｆ枃浠�
 * @ignore
 */
  
var BUI = require("bui/common"),
  Data = BUI.namespace('Data');

BUI.mix(Data, {
  Sortable: require("bui/data/sortable"),
  Proxy: require("bui/data/proxy"),
  AbstractStore: require("bui/data/abstractstore"),
  Store: require("bui/data/store"),
  Node: require("bui/data/node"),
  TreeStore: require("bui/data/treestore")
});

module.exports = Data;

});
define("bui/data/sortable", [], function(require, exports, module){
/**
 * @fileOverview 鍙帓搴忔墿灞曠被
 * @ignore
 */


  var ASC = 'ASC',
    DESC = 'DESC';
  /**
   * 鎺掑簭鎵╁睍鏂规硶锛屾棤娉曠洿鎺ヤ娇鐢�
   * 璇峰湪缁ф壙浜� {@link BUI.Base}鐨勭被涓婁娇鐢�
   * @class BUI.Data.Sortable
   * @extends BUI.Base
   */
  var sortable = function(){

  };

  sortable.ATTRS = 

  {
    /**
     * 姣旇緝鍑芥暟
     * @cfg {Function} compareFunction
     * 鍑芥暟鍘熷瀷 function(v1,v2)锛屾瘮杈�2涓瓧娈垫槸鍚︾浉绛�
     * 濡傛灉鏄瓧绗︿覆鍒欐寜鐓ф湰鍦版瘮杈冪畻娉曪紝鍚﹀垯浣跨敤 > ,== 楠岃瘉
     */
    compareFunction:{
      value : function(v1,v2){
        if(v1 === undefined){
          v1 = '';
        }
        if(v2 === undefined){
          v2 = '';
        }
        if(BUI.isString(v1)){
          return v1.localeCompare(v2);
        }

        if(v1 > v2){
          return 1;
        }else if(v1 === v2){
          return 0;
        }else{
          return  -1;
        }
      }
    },
    /**
     * 鎺掑簭瀛楁
     * @cfg {String} sortField
     */
    /**
     * 鎺掑簭瀛楁
     * @type {String}
     */
    sortField : {

    },
    /**
     * 鎺掑簭鏂瑰悜,'ASC'銆�'DESC'
     * @cfg {String} [sortDirection = 'ASC']
     */
    /**
     * 鎺掑簭鏂瑰悜,'ASC'銆�'DESC'
     * @type {String}
     */
    sortDirection : {
      value : 'ASC'
    },
    /**
     * 鎺掑簭淇℃伅
     * <ol>
     * <li>field: 鎺掑簭瀛楁</li>
     * <li>direction: 鎺掑簭鏂瑰悜,ASC(榛樿),DESC</li>
     * </ol>
     * @cfg {Object} sortInfo
     */
    /**
     * 鎺掑簭淇℃伅
     * <ol>
     * <li>field: 鎺掑簭瀛楁</li>
     * <li>direction: 鎺掑簭鏂瑰悜,ASC(榛樿),DESC</li>
     * </ol>
     * @type {Object}
     */
    sortInfo: {
      getter : function(){
        var _self = this,
          field = _self.get('sortField');

        return {
          field : field,
          direction : _self.get('sortDirection')
        };
      },
      setter: function(v){
        var _self = this;

        _self.set('sortField',v.field);
        _self.set('sortDirection',v.direction);
      }
    }
  };

  BUI.augment(sortable,
  {
    compare : function(obj1,obj2,field,direction){

      var _self = this,
        dir;
      field = field || _self.get('sortField');
      direction = direction || _self.get('sortDirection');
      //濡傛灉鏈寚瀹氭帓搴忓瓧娈碉紝鎴栨柟鍚戯紝鍒欐寜鐓ч粯璁ら『搴�
      if(!field || !direction){
        return 1;
      }
      dir = direction === ASC ? 1 : -1;

      return _self.get('compareFunction')(obj1[field],obj2[field]) * dir;
    },
    /**
     * 鑾峰彇鎺掑簭鐨勯泦鍚�
     * @protected
     * @return {Array} 鎺掑簭闆嗗悎
     */
    getSortData : function(){

    },
    /**
     * 鎺掑簭鏁版嵁
     * @param  {String|Array} field   鎺掑簭瀛楁鎴栬€呮暟缁�
     * @param  {String} direction 鎺掑簭鏂瑰悜
     * @param {Array} records 鎺掑簭
     * @return {Array}    
     */
    sortData : function(field,direction,records){
      var _self = this,
        records = records || _self.getSortData();

      if(BUI.isArray(field)){
        records = field;
        field = null;
      }

      field = field || _self.get('sortField');
      direction = direction || _self.get('sortDirection');

      _self.set('sortField',field);
      _self.set('sortDirection',direction);

      if(!field || !direction){
        return records;
      }

      records.sort(function(obj1,obj2){
        return _self.compare(obj1,obj2,field,direction);
      });
      return records;
    }
  });

module.exports = sortable;

});
define("bui/data/proxy", ["jquery"], function(require, exports, module){


  var $ = require("jquery"),
    Sortable = require("bui/data/sortable");

  /**
   * 鏁版嵁浠ｇ悊瀵硅薄锛屽姞杞芥暟鎹�,
   * 涓€鑸笉鐩存帴浣跨敤锛屽湪store閲岄潰鍐冲畾浣跨敤浠€涔堢被鍨嬬殑鏁版嵁浠ｇ悊瀵硅薄
   * @class BUI.Data.Proxy
   * @extends BUI.Base
   * @abstract 
   */
  var proxy = function(config){
    proxy.superclass.constructor.call(this,config);
  };

  proxy.ATTRS = {
    
  };

  BUI.extend(proxy, BUI.Base);

  BUI.augment(proxy,

  {
    /**
     * @protected
     * 璇诲彇鏁版嵁鐨勬柟娉曪紝鍦ㄥ瓙绫讳腑瑕嗙洊
     */
    _read : function(params,callback){

    },
    /**
     * 璇绘暟鎹�
     * @param  {Object} params 閿€煎褰㈠紡鐨勫弬鏁�
     * @param {Function} callback 鍥炶皟鍑芥暟锛屽嚱鏁板師鍨� function(data){}
     * @param {Object} scope 鍥炶皟鍑芥暟鐨勪笂涓嬫枃
     */
    read : function(params,callback,scope){
      var _self = this;
      scope = scope || _self;

      _self._read(params,function(data){
        callback.call(scope,data);
      });
    },
    /**
     * @protected
     * 淇濆瓨鏁版嵁鐨勬柟娉曪紝鍦ㄥ瓙绫讳腑瑕嗙洊
     */
    _save : function(ype,data,callback){

    },
    /**
     * 淇濆瓨鏁版嵁
     * @param {String} type 绫诲瀷锛屽寘鎷紝add,update,remove,all鍑犵绫诲瀷
     * @param  {Object} saveData 閿€煎褰㈠紡鐨勫弬鏁�
     * @param {Function} callback 鍥炶皟鍑芥暟锛屽嚱鏁板師鍨� function(data){}
     * @param {Object} scope 鍥炶皟鍑芥暟鐨勪笂涓嬫枃
     */
    save : function(type,saveData,callback,scope){
      var _self = this;
      scope = scope || _self;
      _self._save(type,saveData,function(data){
        callback.call(scope,data);
      });
    }
  });


  var TYPE_AJAX = {
    READ : 'read',
    ADD : 'add',
    UPDATE : 'update',
    REMOVE : 'remove',
    SAVE_ALL : 'all'
  };
  /**
   * 寮傛鍔犺浇鏁版嵁鐨勪唬鐞�
   * @class BUI.Data.Proxy.Ajax
   * @extends BUI.Data.Proxy
   */
  var ajaxProxy = function(config){
    ajaxProxy.superclass.constructor.call(this,config);
  };

  ajaxProxy.ATTRS = BUI.mix(true,proxy.ATTRS,
  {
    /**
     * 闄愬埗鏉℃暟
     * @cfg {String} [limitParam='limit'] 
     */
    /**
     * 闄愬埗鏉℃暟
     * @type {String}
     * @default 'limit'
     */
    limitParam : {
      value : 'limit'
    },
    /**
     * 璧峰绾綍浠ｈ〃鐨勫瓧娈�
     * @cfg {String} [startParam='start']
     */
    /**
     * 璧峰绾綍浠ｈ〃鐨勫瓧娈�
     * @type {String}
     */
    startParam : {
      value : 'start'
    },
    /**
     * 椤电爜鐨勫瓧娈靛悕
     * @cfg {String} [pageIndexParam='pageIndex']
     */
    /**
     * 椤电爜鐨勫瓧娈靛悕
     * @type {String}
     * @default 'pageIndex'
     */
    pageIndexParam : {
      value : 'pageIndex'
    },
    /**
     * 淇濆瓨绫诲瀷鐨勫瓧娈靛悕,濡傛灉姣忕淇濆瓨绫诲瀷鏈缃搴旂殑Url锛屽垯闄勫姞鍙傛暟
     * @type {Object}
     */
    saveTypeParam : {
      value : 'saveType'
    },
    /**
     * 淇濆瓨鏁版嵁鏀惧埌鐨勫瓧娈靛悕绉�
     * @type {String}
     */
    saveDataParam : {

    },
    /**
     * 浼犻€掑埌鍚庡彴锛屽垎椤靛紑濮嬬殑椤电爜锛岄粯璁や粠0寮€濮�
     * @type {Number}
     */
    pageStart : {
      value : 0
    },
    /**
    * 鍔犺浇鏁版嵁鏃讹紝杩斿洖鐨勬牸寮�,鐩墠鍙敮鎸�"json銆乯sonp"鏍煎紡<br>
    * @cfg {String} [dataType='json']
    */
   /**
    * 鍔犺浇鏁版嵁鏃讹紝杩斿洖鐨勬牸寮�,鐩墠鍙敮鎸�"json銆乯sonp"鏍煎紡<br>
    * @type {String}
    * @default "json"
    */
    dataType: {
      value : 'json'
    },
    /**
     * 鑾峰彇鏁版嵁鐨勬柟寮�,'GET'鎴栬€�'POST',榛樿涓�'GET'
     * @cfg {String} [method='GET']
     */
    /**
     * 鑾峰彇鏁版嵁鐨勬柟寮�,'GET'鎴栬€�'POST',榛樿涓�'GET'
     * @type {String}
     * @default 'GET'
     */
    method : {
      value : 'GET'
    },
    /**
     * 寮傛璇锋眰鐨勬墍鏈夎嚜瀹氫箟鍙傛暟锛屽紑鏀剧殑鍏朵粬灞炴€х敤浜庡揩鎹蜂娇鐢紝濡傛灉鏈夌壒娈婂弬鏁伴厤缃紝鍙互浣跨敤杩欎釜灞炴€�,<br>
     * 涓嶈浣跨敤success鍜宔rror鐨勫洖璋冨嚱鏁帮紝浼氳鐩栭粯璁ょ殑澶勭悊鏁版嵁鐨勫嚱鏁�
     * @cfg {Object} ajaxOptions 
     */
    /**
     * 寮傛璇锋眰鐨勬墍鏈夎嚜瀹氫箟鍙傛暟
     * @type {Object}
     */
    ajaxOptions  : {
      value : {

      }
    },
    /**
     * 鏄惁浣跨敤Cache
     * @type {Boolean}
     */
    cache : {
      value : false
    },
    /**
     * 淇濆瓨鏁版嵁鐨勯厤缃俊鎭�
     * @type {Object}
     */
    save : {

    },
    /**
     * 鍔犺浇鏁版嵁鐨勯摼鎺�
     * @cfg {String} url
     * @required
     */
    /**
     * 鍔犺浇鏁版嵁鐨勯摼鎺�
     * @type {String}
     * @required
     */
    url :{

    }

  });
  BUI.extend(ajaxProxy,proxy);

  BUI.augment(ajaxProxy,{

    _processParams : function(params){
      var _self = this,
        pageStart = _self.get('pageStart'),
        arr = ['start','limit','pageIndex'];
      if(params.pageIndex != null){
        params.pageIndex = params.pageIndex + pageStart;
      }
      BUI.each(arr,function(field){
        var fieldParam = _self.get(field+'Param');
        if(fieldParam !== field){
          params[fieldParam] = params[field];
          delete params[field];
        }
      });
    },
    //鑾峰彇寮傛璇锋眰鐨剈rl
    _getUrl : function(type){
      var _self = this,
        save = _self.get('save'),
        url;
      if(type === TYPE_AJAX.READ){ //鑾峰彇鏁版嵁锛岀洿鎺ヨ繑鍥� url
        return _self.get('url');
      }
      
      //濡傛灉涓嶅瓨鍦ㄤ繚瀛樺弬鏁帮紝鍒欒繑鍥� url
      if(!save){
        return _self.get('url')
      }

      if(BUI.isString(save)){
        return save;
      }

      url = save[type + 'Url'];
      if(!url){
        url = _self.get('url');
      }

      return url;

    },
    //鏍规嵁绫诲瀷闄勫姞棰濆鐨勫弬鏁�
    _getAppendParams : function(type){
      var _self = this,
        save,
        saveTypeParam,
        rst = null;
      if(type == TYPE_AJAX.READ){
        return rst;
      }
      save = _self.get('save');
      saveTypeParam = _self.get('saveTypeParam');
      if(save && !save[type + 'Url']){
        rst = {};
        rst[saveTypeParam] = type;
      }
      return rst;
    },
    /**
     * @protected
     * @private
     */
    _read : function(params,callback){
      var _self = this,
        cfg;

      params = BUI.cloneObject(params);
      _self._processParams(params);
      cfg = _self._getAjaxOptions(TYPE_AJAX.READ,params);

      _self._ajax(cfg,callback);
    },
    //鑾峰彇寮傛璇锋眰鐨勯€夐」
    _getAjaxOptions : function(type,params){
      var _self = this,
        ajaxOptions  = _self.get('ajaxOptions'),
        url = _self._getUrl(type),
        cfg;
      BUI.mix(params,_self._getAppendParams(type));
      cfg = BUI.merge({
        url: url,
        type : _self.get('method'),
        dataType: _self.get('dataType'),
        data : params,
        cache : _self.get('cache')
      },ajaxOptions);

      return cfg;
    },
    //寮傛璇锋眰
    _ajax : function(cfg,callback){
      var _self = this,
        success = cfg.success,
        error = cfg.error;
      //澶嶅啓success
      cfg.success = function(data){
        success && success(data);
        callback(data);
      };
      //澶嶅啓閿欒
      cfg.error = function(jqXHR, textStatus, errorThrown){
        error && error(jqXHR, textStatus, errorThrown);
        var result = {
            exception : {
              status : textStatus,
              errorThrown: errorThrown,
              jqXHR : jqXHR
            }
          };
          callback(result);
      }

      $.ajax(cfg);
      
    },
    _save : function(type,data,callback){
      var _self = this,
        cfg;

      cfg = _self._getAjaxOptions(type,data);

      _self._ajax(cfg,callback);
    }

  });

  /**
   * 璇诲彇缂撳瓨鐨勪唬鐞�
   * @class BUI.Data.Proxy.Memery
   * @extends BUI.Data.Proxy
   * @mixins BUI.Data.Sortable
   */
  var memeryProxy = function(config){
    memeryProxy.superclass.constructor.call(this,config);
  };
  memeryProxy.ATTRS = {
    /**
     * 鍖归厤鐨勫瓧娈靛悕
     * @type {Array}
     */
    matchFields : {
      value : []
    }
  };

  BUI.extend(memeryProxy, proxy);

  BUI.mixin(memeryProxy, [Sortable]);

  BUI.augment(memeryProxy,{

    /**
     * @protected
     * @ignore
     */
    _read : function(params,callback){
      var _self = this,
        pageable = params.pageable,
        start = params.start,
        sortField = params.sortField,
        sortDirection = params.sortDirection,
        limit = params.limit,
        data = _self.get('data'),
        rows = []; 

      data = _self._getMatches(params);
      _self.sortData(sortField,sortDirection); 

      if(limit){//鍒嗛〉鏃�
        rows = data.slice(start,start + limit);
        callback({rows:rows,results:data.length});
      }else{//涓嶅垎椤垫椂
        rows = data.slice(start);
        callback(rows);
      }
      
    },
    //鑾峰彇鍖归厤鍑芥暟
    _getMatchFn : function(params, matchFields){
      var _self = this;
      return function(obj){
        var result = true;
        BUI.each(matchFields,function(field){
          if(params[field] != null && !(params[field] === obj[field])){
            result = false;
            return false;
          }
        });
        return result;
      }
    },
    //鑾峰彇鍖归厤鐨勫€�
    _getMatches : function(params){
      var _self = this,
        matchFields = _self.get('matchFields'),
        matchFn,
        data = _self.get('data') || [];
      if(params && matchFields.length){
        matchFn = _self._getMatchFn(params,matchFields);
        data = BUI.Array.filter(data,matchFn);
      }
      return data;
    },
    /**
     * @protected
     * 淇濆瓨淇敼鐨勬暟鎹�
     */
    _save : function(type,saveData,callback){
      var _self = this,
        data = _self.get('data');

      if(type == TYPE_AJAX.ADD){
        data.push(saveData);
      }else if(type == TYPE_AJAX.REMOVE){
        BUI.Array.remove(data,saveData);
      }else if(type == TYPE_AJAX.SAVE_ALL){
        BUI.each(saveData.add,function(item){
          data.push(item);
        });

        BUI.each(saveData.remove,function(item){
          BUI.Array.remove(data,item);
        });
      }
    }

  });

  proxy.Ajax = ajaxProxy;
  proxy.Memery = memeryProxy;

  module.exports = proxy;

});
define("bui/data/abstractstore", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 鎶借薄鏁版嵁缂撳啿绫�
 * @ignore
 */

  var BUI = require("bui/common"),
    Proxy = require("bui/data/proxy");

  /**
   * @class BUI.Data.AbstractStore
   * 鏁版嵁缂撳啿鎶借薄绫�,姝ょ被涓嶈繘琛屽疄渚嬪寲
   * @extends BUI.Base
   */
  function AbstractStore(config){
    AbstractStore.superclass.constructor.call(this,config);
    this._init();
  }

  AbstractStore.ATTRS = {

    /**
    * 鍒涘缓瀵硅薄鏃舵槸鍚﹁嚜鍔ㄥ姞杞�
    * <pre><code>
    *   var store = new Data.Store({
    *     url : 'data.php',  //璁剧疆鍔犺浇鏁版嵁鐨刄RL
    *     autoLoad : true    //鍒涘缓Store鏃惰嚜鍔ㄥ姞杞芥暟鎹�
    *   });
    * </code></pre>
    * @cfg {Boolean} [autoLoad=false]
    */
    autoLoad: {
      value :false 
    },
    /**
     * 鏄惁鏈嶅姟鍣ㄧ杩囨护鏁版嵁锛屽鏋滆缃灞炴€э紝褰撹皟鐢╢ilter()鍑芥暟鏃跺彂閫佽姹�
     * @type {Object}
     */
    remoteFilter: {
        value : false
    },
    /**
     * 涓婃鏌ヨ鐨勫弬鏁�
     * @type {Object}
     * @readOnly
     */
    lastParams : {
      shared : false,
      value : {}
    },
    /**
     * 鍒濆鍖栨椂鏌ヨ鐨勫弬鏁帮紝鍦ㄥ垵濮嬪寲鏃舵湁鏁�
     * <pre><code>
     * var store = new Data.Store({
    *     url : 'data.php',  //璁剧疆鍔犺浇鏁版嵁鐨刄RL
    *     autoLoad : true,    //鍒涘缓Store鏃惰嚜鍔ㄥ姞杞芥暟鎹�
    *     params : {         //璁剧疆璇锋眰鏃剁殑鍙傛暟
    *       id : '1',
    *       type : '1'
    *     }
    *   });
     * </code></pre>
     * @cfg {Object} params
     */
    params : {

    },
    /**
     * 閿欒瀛楁,鍖呭惈鍦ㄨ繑鍥炰俊鎭腑琛ㄧず閿欒淇℃伅鐨勫瓧娈�
     * <pre><code>
     *   //鍙互淇敼鎺ユ敹鐨勫悗鍙板弬鏁扮殑鍚箟
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //瀛樻斁閿欒淇℃伅鐨勫瓧娈�(error)
     *     hasErrorProperty : 'isError', //鏄惁閿欒鐨勫瓧娈碉紙hasError)
     *     root : 'data',               //瀛樻斁鏁版嵁鐨勫瓧娈靛悕(rows)
     *     totalProperty : 'total'     //瀛樻斁璁板綍鎬绘暟鐨勫瓧娈靛悕(results)
     *   });
     * </code></pre>
     * @cfg {String} [errorProperty='error']
     */
    /**
     * 閿欒瀛楁
     * @type {String}
     * @ignore
     */
    errorProperty : {
      value : 'error'
    },
    /**
     * 鏄惁瀛樺湪閿欒,鍔犺浇鏁版嵁鏃跺鏋滆繑鍥為敊璇紝姝ゅ瓧娈佃〃绀烘湁閿欒鍙戠敓
     * <pre><code>
     *   //鍙互淇敼鎺ユ敹鐨勫悗鍙板弬鏁扮殑鍚箟
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //瀛樻斁閿欒淇℃伅鐨勫瓧娈�(error)
     *     hasErrorProperty : 'isError', //鏄惁閿欒鐨勫瓧娈碉紙hasError)
     *     root : 'data',               //瀛樻斁鏁版嵁鐨勫瓧娈靛悕(rows)
     *     totalProperty : 'total'     //瀛樻斁璁板綍鎬绘暟鐨勫瓧娈靛悕(results)
     *   });
     * </code></pre>
     * @cfg {String} [hasErrorProperty='hasError']
     */
    /**
     * 鏄惁瀛樺湪閿欒
     * @type {String}
     * @default 'hasError'
     * @ignore
     */
    hasErrorProperty : {
      value : 'hasError'
    },
    /**
     * 鏁版嵁浠ｇ悊瀵硅薄,鐢ㄤ簬鍔犺浇鏁版嵁鐨刟jax閰嶇疆锛寋@link BUI.Data.Proxy}
     * <pre><code>
     *   var store = new Data.Store({
    *     url : 'data.php',  //璁剧疆鍔犺浇鏁版嵁鐨刄RL
    *     autoLoad : true,    //鍒涘缓Store鏃惰嚜鍔ㄥ姞杞芥暟鎹�
    *     proxy : {
    *       method : 'post',
    *       dataType : 'jsonp'
    *     }
    *   });
     * </code></pre>
     * @cfg {Object|BUI.Data.Proxy} proxy
     */
    proxy : {
      shared : false,
      value : {
        
      }
    },
    /**
     * 璇锋眰鏁版嵁鐨勫湴鍧€锛岄€氳繃ajax鍔犺浇鏁版嵁锛�
     * 姝ゅ弬鏁拌缃垯鍔犺浇杩滅▼鏁版嵁
     * ** 浣犲彲浠ヨ缃湪proxy澶栭儴 **
     * <pre><code>
     *   var store = new Data.Store({
    *     url : 'data.php',  //璁剧疆鍔犺浇鏁版嵁鐨刄RL
    *     autoLoad : true,    //鍒涘缓Store鏃惰嚜鍔ㄥ姞杞芥暟鎹�
    *     proxy : {
    *       method : 'post',
    *       dataType : 'jsonp'
    *     }
    *   });
     * </code></pre>
     * ** 浣犱篃鍙互璁剧疆鍦╬roxy涓� **
     * <pre><code>
     *   var store = new Data.Store({
    *     autoLoad : true,    //鍒涘缓Store鏃惰嚜鍔ㄥ姞杞芥暟鎹�
    *     proxy : {
    *       url : 'data.php',  //璁剧疆鍔犺浇鏁版嵁鐨刄RL
    *       method : 'post',
    *       dataType : 'jsonp'
    *     }
    *   });
     * </code></pre>
     * 鍚﹀垯鎶� {BUI.Data.Store#cfg-data}浣滀负鏈湴缂撳瓨鏁版嵁鍔犺浇
     * @cfg {String} url
     */
    /**
     * 璇锋眰鏁版嵁鐨剈rl
     * <pre><code>
     *   //鏇存敼url
     *   store.get('proxy').set('url',url);
     * </code></pre>
     * @type {String}
     */
    url : {

    },
    events : {
      value : [
        /**  
        * 鏁版嵁鎺ュ彈鏀瑰彉锛屾墍鏈夊鍔犮€佸垹闄ゃ€佷慨鏀圭殑鏁版嵁璁板綍娓呯┖
        * @name BUI.Data.Store#acceptchanges
        * @event  
        */
        'acceptchanges',
        /**  
        * 褰撴暟鎹姞杞藉畬鎴愬悗
        * @name BUI.Data.Store#load  
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄锛屽寘鍚姞杞芥暟鎹椂鐨勫弬鏁�
        */
        'load',

        /**  
        * 褰撴暟鎹姞杞藉墠
        * @name BUI.Data.Store#beforeload
        * @event  
        */
        'beforeload',

        /**  
        * 鍙戠敓鍦紝beforeload鍜宭oad涓棿锛屾暟鎹凡缁忚幏鍙栧畬鎴愶紝浣嗘槸杩樻湭瑙﹀彂load浜嬩欢锛岀敤浜庤幏鍙栬繑鍥炵殑鍘熷鏁版嵁
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.data 浠庢湇鍔″櫒绔繑鍥炵殑鏁版嵁
        */
        'beforeprocessload',
        
        /**  
        * 褰撴坊鍔犳暟鎹椂瑙﹀彂璇ヤ簨浠�
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.record 娣诲姞鐨勬暟鎹�
        */
        'add',

        /**
        * 鍔犺浇鏁版嵁鍙戠敓寮傚父鏃惰Е鍙�
        * @event
        * @name BUI.Data.Store#exception
        * @param {jQuery.Event} e 浜嬩欢瀵硅薄
        * @param {String|Object} e.error 鍔犺浇鏁版嵁鏃惰繑鍥炵殑閿欒淇℃伅鎴栬€呭姞杞芥暟鎹け璐ワ紝娴忚鍣ㄨ繑鍥炵殑淇℃伅锛坔ttpResponse 瀵硅薄 鐨則extStatus锛�
        * @param {String} e.responseText 缃戠粶鎴栬€呮祻瑙堝櫒鍔犺浇鏁版嵁鍙戠敓閿欒鏄繑鍥炵殑httpResponse 瀵硅薄鐨剅esponseText
        */
        'exception',

        /**  
        * 褰撳垹闄ゆ暟鎹槸瑙﹀彂璇ヤ簨浠�
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.data 鍒犻櫎鐨勬暟鎹�
        */
        'remove',
        
        /**  
        * 褰撴洿鏂版暟鎹寚瀹氬瓧娈垫椂瑙﹀彂璇ヤ簨浠� 
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.record 鏇存柊鐨勬暟鎹�
        * @param {Object} e.field 鏇存柊鐨勫瓧娈�
        * @param {Object} e.value 鏇存柊鐨勫€�
        */
        'update',

        /**  
        * 鍓嶇鍙戠敓鎺掑簭鏃惰Е鍙�
        * @name BUI.Data.Store#localsort
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.field 鎺掑簭鐨勫瓧娈�
        * @param {Object} e.direction 鎺掑簭鐨勬柟鍚� 'ASC'锛�'DESC'
        */
        'localsort',

        /**  
        * 鍓嶇鍙戠敓杩囨护鏃惰Е鍙�
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Array} e.data 杩囨护瀹屾垚鐨勬暟鎹�
        * @param {Function} e.filter 杩囨护鍣�
        */
        'filtered'
      ]
    },
    /**
     * 鏈湴鏁版嵁婧�,浣跨敤鏈湴鏁版嵁婧愭椂浼氫娇鐢▄@link BUI.Data.Proxy.Memery}
     * @cfg {Array} data
     */
    /**
     * 鏈湴鏁版嵁婧�
     * @type {Array}
     */
    data : {
      setter : function(data){
        var _self = this,
          proxy = _self.get('proxy');
        if(proxy.set){
          proxy.set('data',data);
        }else{
          proxy.data = data;
        }
        //璁剧疆鏈湴鏁版嵁鏃讹紝鎶奱utoLoad缃负true
        _self.set('autoLoad',true);
      }
    }
  };

  BUI.extend(AbstractStore,BUI.Base);

  BUI.augment(AbstractStore,{
    /**
     * 鏄惁鏄暟鎹紦鍐插璞★紝鐢ㄤ簬鍒ゆ柇瀵硅薄
     * @type {Boolean}
     */
    isStore : true,
    /**
     * @private
     * 鍒濆鍖�
     */
    _init : function(){
      var _self = this;

      _self.beforeInit();
      //鍒濆鍖栫粨鏋滈泦
      _self._initParams();
      _self._initProxy();
      _self._initData();
    },
    /**
     * @protected
     * 鍒濆鍖栦箣鍓�
     */
    beforeInit : function(){

    },
    //鍒濆鍖栨暟鎹�,濡傛灉榛樿鍔犺浇鏁版嵁锛屽垯鍔犺浇鏁版嵁
    _initData : function(){
      var _self = this,
        autoLoad = _self.get('autoLoad');

      if(autoLoad){
        _self.load();
      }
    },
    //鍒濆鍖栨煡璇㈠弬鏁�
    _initParams : function(){
      var _self = this,
        lastParams = _self.get('lastParams'),
        params = _self.get('params');

      //鍒濆鍖� 鍙傛暟
      BUI.mix(lastParams,params);
    },
    /**
     * @protected
     * 鍒濆鍖栨暟鎹唬鐞嗙被
     */
    _initProxy : function(){
      var _self = this,
        url = _self.get('url'),
        proxy = _self.get('proxy');

      if(!(proxy instanceof Proxy)){

        if(url){
          proxy.url = url;
        }

        //寮傛璇锋眰鐨勪唬鐞嗙被
        if(proxy.type === 'ajax' || proxy.url){
          proxy = new Proxy.Ajax(proxy);
        }else{
          proxy = new Proxy.Memery(proxy);
        }

        _self.set('proxy',proxy);
      }
    },
    /**
     * 鍔犺浇鏁版嵁
     * <pre><code>
     *  //涓€鑸皟鐢�
     *  store.load(params);
     *  
     *  //浣跨敤鍥炶皟鍑芥暟
     *  store.load(params,function(data){
     *  
     *  });
     *
     *  //load鏈夎蹇嗗弬鏁扮殑鍔熻兘
     *  store.load({id : '123',type="1"});
     *  //涓嬩竴娆¤皟鐢�
     *  store.load();榛樿浣跨敤涓婃鐨勫弬鏁帮紝鍙互瀵瑰搴旂殑鍙傛暟杩涜瑕嗙洊
     * </code></pre>
     * @param  {Object} params 鍙傛暟閿€煎
     * @param {Function} fn 鍥炶皟鍑芥暟锛岄粯璁や负绌�
     */
    load : function(params,callback){
      var _self = this,
        proxy = _self.get('proxy'),
        lastParams = _self.get('lastParams');

      BUI.mix(lastParams,_self.getAppendParams(),params);

      _self.fire('beforeload',{params:lastParams});

      //闃叉寮傛璇锋眰鏈粨鏉燂紝鍙堝彂閫佹柊璇锋眰鍥炶皟鍙傛暟閿欒
      params = BUI.cloneObject(lastParams);
      proxy.read(lastParams,function(data){
        _self.onLoad(data,params);
        if(callback){
          callback(data,params);
        }
      },_self);
    },
    /**
     * 瑙﹀彂杩囨护
     * @protected
     */
    onFiltered : function(data,filter){
      var _self = this;
      _self.fire('filtered',{data : data,filter : filter});
    },
    /**
     * 鍔犺浇瀹屾暟鎹�
     * @protected
     * @template
     */
    onLoad : function(data,params){
      var _self = this;

      var processResult = _self.processLoad(data,params);
      //濡傛灉澶勭悊鎴愬姛锛岃繑鍥為敊璇椂锛屼笉杩涜鍚庨潰鐨勫鐞�
      if(processResult){
        _self.afterProcessLoad(data,params);
      }
    },
    /**
     * 鑾峰彇褰撳墠缂撳瓨鐨勭邯褰�
     */
    getResult : function(){
    },
    /**
     * 杩囨护鏁版嵁锛屾鍑芥暟鐨勬墽琛屽悓灞炴€� remoteFilter鍏宠仈瀵嗗垏
     *
     *  - remoteFilter == true鏃讹細姝ゅ嚱鏁板彧鎺ュ彈瀛楃涓茬被鍨嬬殑杩囨护鍙傛暟锛屽皢{filter : filterStr}鍙傛暟浼犺緭鍒版湇鍔″櫒绔�
     *  - remoteFilter == false鏃讹細姝ゅ嚱鏁版帴鍙楁瘮瀵瑰嚱鏁帮紝鍙湁褰撳嚱鏁拌繑鍥瀟rue鏃剁敓鏁�
     *  
     * @param {Function|String} fn 杩囨护鍑芥暟
     * @return {Array} 杩囨护缁撴灉
     */
    filter : function(filter){
        var _self = this,
            remoteFilter = _self.get('remoteFilter'),
            result;

        filter = filter || _self.get('filter');

        if(remoteFilter){
            _self.load({filter : filter});
        }else if(filter){
            _self.set('filter',filter);
            //濡傛灉result鏈夊€兼椂鎵嶄細杩涜filter
            if(_self.getResult().length > 0){
                result = _self._filterLocal(filter);
                _self.onFiltered(result,filter);
            }
        }
    },
    /**
     * @protected
     * 杩囨护缂撳瓨鐨勬暟鎹�
     * @param  {Function} fn 杩囨护鍑芥暟
     * @return {Array} 杩囨护缁撴灉
     */
    _filterLocal : function(fn){
        
    },
    /**
     * 鑾峰彇杩囨护鍚庣殑鏁版嵁锛屼粎褰撴湰鍦拌繃婊�(remoteFilter = false)鏃舵湁鏁�
     * @return {Array} 杩囨护杩囩殑鏁版嵁
     */
    getFilterResult: function(){
        var filter = this.get('filter');
        if(filter) {
            return this._filterLocal(filter);
        }
        else {
            return this.getResult();
        }
    },
    _clearLocalFilter : function(){
        this.set('filter', null);
    },
    /**
     * 娓呯悊杩囨护
     */
    clearFilter : function(){
        var _self = this,
            remoteFilter = _self.get('remoteFilter'),
            result;

        if(remoteFilter){
            _self.load({filter : ''});
        }else{
            _self._clearLocalFilter();
            result = _self.getFilterResult();
            _self.onFiltered(result, null);
        }
    },
    /**
     * @private
     * 鍔犺浇瀹屾暟鎹鐞嗘暟鎹�
     */
    processLoad : function(data,params){
      var _self = this,
        hasErrorField = _self.get('hasErrorProperty');

      _self.fire('beforeprocessload',{data : data});
    
      //鑾峰彇鐨勫師濮嬫暟鎹�
      _self.fire('beforeProcessLoad',data);

      if(BUI.getValue(data,hasErrorField) || data.exception){
        _self.onException(data);
        return false;
      }
      return true;
    },
    /**
     * @protected
     * @template
     * 澶勭悊鏁版嵁鍚�
     */
    afterProcessLoad : function(data,params){

    },
    /**
     * @protected
     * 澶勭悊閿欒鍑芥暟
     * @param  {*} data 鍑洪敊瀵硅薄
     */
    onException : function(data){
      var _self = this,
        errorProperty = _self.get('errorProperty'),
        obj = {};
      //缃戠粶寮傚父銆佽浆鐮侀敊璇箣绫伙紝鍙戠敓鍦╦son鑾峰彇鎴栬浆鍙樻椂
      if(data.exception){
        obj.type = 'exception';
        obj.error = data.exception;
      }else{//鐢ㄦ埛瀹氫箟鐨勯敊璇�
        obj.type = 'error';
        obj.error = BUI.getValue(data,errorProperty);
      }
      _self.fire('exception',obj);

    },
    /**
     * 鏄惁鍖呭惈鏁版嵁
     * @return {Boolean} 
     */
    hasData : function(){

    },
    /**
     * 鑾峰彇闄勫姞鐨勫弬鏁�
     * @template
     * @protected
     * @return {Object} 闄勫姞鐨勫弬鏁�
     */
    getAppendParams : function(){
      return {};
    }
  });

module.exports = AbstractStore;

});
define("bui/data/store", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鏁版嵁缂撳啿瀵硅薄
 * @author dxq613@gmail.com
 * @ignore
 */

  
  var $ = require("jquery"),
    Proxy = require("bui/data/proxy"),
    AbstractStore = require("bui/data/abstractstore"),
    Sortable = require("bui/data/sortable");

  //绉婚櫎鏁版嵁
  function removeAt(index,array){
    if(index < 0){
      return;
    }
    var records = array,
      record = records[index];
    records.splice(index,1);
    return record;
  }

  function removeFrom(record,array){
    var index = BUI.Array.indexOf(record,array);   
    if(index >= 0){
      removeAt(index,array);
    }
  }

  function contains(record,array){
    return BUI.Array.indexOf(record,array) !== -1;
  }
  /**
   * 鐢ㄤ簬鍔犺浇鏁版嵁锛岀紦鍐叉暟鎹殑绫�
   * <p>
   * <img src="../assets/img/class-data.jpg"/>
   * </p>
   * ** 缂撳瓨闈欐€佹暟鎹� ** 
   * <pre><code>
   *  var store = new Store({
   *    data : [{},{}]
   *  });
   * </code></pre>
   * ** 寮傛鍔犺浇鏁版嵁 **
   * <pre><code>
   *  var store = new Store({
   *    url : 'data.json',
   *    autoLoad : true,
   *    params : {id : '123'},
   *    sortInfo : {
   *      field : 'id',
   *      direction : 'ASC' //ASC,DESC
   *    }
   *  });
   * </code></pre>
   * 
   * @class BUI.Data.Store
   * @extends BUI.Data.AbstractStore
   * @mixins BUI.Data.Sortable
   */
  var store = function(config){
    store.superclass.constructor.call(this,config);
    //this._init();
  };

  store.ATTRS = 
  {
    /**
     * 淇濆瓨鏁版嵁鏃讹紝鏄惁鑷姩鏇存柊鏁版嵁婧愮殑鏁版嵁锛屽父鐢ㄤ簬娣诲姞銆佸垹闄ゃ€佹洿鏀规暟鎹悗閲嶆柊鍔犺浇鏁版嵁銆�
     * @cfg {Boolean} autoSync
     */
    autoSync : {
      value : false
    },
    /**
     * 褰撳墠椤电爜
     * @cfg {Number} [currentPage=0]
     * @ignore
     */
    /**
     * 褰撳墠椤电爜
     * @type {Number}
     * @ignore
     * @readOnly
     */
    currentPage:{
      value : 0
    },
    
    /**
     * 鍒犻櫎鎺夌殑绾綍
     * @readOnly
     * @private
     * @type {Array}
     */
    deletedRecords : {
      shared : false,
      value:[]
    },
    

    /**
     * 瀵规瘮2涓璞℃槸鍚︾浉褰擄紝鍦ㄥ幓閲嶃€佹洿鏂般€佸垹闄わ紝鏌ユ壘鏁版嵁鏃朵娇鐢ㄦ鍑芥暟
     * @default  
     * function(obj1,obj2){
     *   return obj1 == obj2;
     * }
     * @type {Object}
     * @example
     * function(obj1 ,obj2){
     *   //濡傛灉id鐩哥瓑锛屽氨璁や负2涓暟鎹浉绛夛紝鍙互鍦ㄦ坊鍔犲璞℃椂鍘婚噸
     *   //鏇存柊瀵硅薄鏃讹紝浠呮彁渚涙敼鍙樼殑瀛楁
     *   return obj1.id == obj2.id;
     * }
     * 
     */
    matchFunction : {
      value : function(obj1,obj2){
        return obj1 == obj2;
      }
    },
    /**
     * 鏇存敼鐨勭邯褰曢泦鍚�
     * @type {Array}
     * @private
     * @readOnly
     */
    modifiedRecords : {
      shared : false,
      value:[]
    },
    /**
     * 鏂版坊鍔犵殑绾綍闆嗗悎锛屽彧璇�
     * @type {Array}
     * @private
     * @readOnly
     */
    newRecords : {
      shared : false,
      value : []
    },
    /**
     * 鏄惁杩滅▼鎺掑簭锛岄粯璁ょ姸鎬佷笅鍐呭瓨鎺掑簭
     *   - 鐢变簬褰撳墠Store瀛樺偍鐨勪笉涓€瀹氭槸鏁版嵁婧愮殑鍏ㄩ泦锛屾墍浠ユ閰嶇疆椤归渶瑕侀噸鏂拌鍙栨暟鎹�
     *   - 鍦ㄥ垎椤电姸鎬佷笅锛岃繘琛岃繙绋嬫帓搴忥紝浼氳繘琛屽叏闆嗘暟鎹殑鎺掑簭锛屽苟杩斿洖棣栭〉鐨勬暟鎹�
     *   - remoteSort涓� false鐨勬儏鍐典笅锛屼粎瀵瑰綋鍓嶉〉鐨勬暟鎹繘琛屾帓搴�
     * @cfg {Boolean} [remoteSort=false]
     */
    remoteSort : {
      value : false
    },
    /**
     * 缂撳瓨鐨勬暟鎹紝鍖呭惈浠ヤ笅鍑犱釜瀛楁
     * <ol>
     * <li>rows: 鏁版嵁闆嗗悎</li>
     * <li>results: 鎬荤殑鏁版嵁鏉℃暟</li>
     * </ol>
     * @type {Object}
     * @private
     * @readOnly
     */
    resultMap : {
      shared : false,
      value : {}
    },
    /**
     * 鍔犺浇鏁版嵁鏃讹紝杩斿洖鏁版嵁鐨勬牴鐩綍
     * @cfg {String} [root='rows']
     * <pre><code>
     *    //榛樿杩斿洖鏁版嵁绫诲瀷锛�
     *    '{"rows":[{"name":"abc"},{"name":"bcd"}],"results":100}'
     *   //鍙互淇敼鎺ユ敹鐨勫悗鍙板弬鏁扮殑鍚箟
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //瀛樻斁閿欒淇℃伅鐨勫瓧娈�(error)
     *     hasErrorProperty : 'isError', //鏄惁閿欒鐨勫瓧娈碉紙hasError)
     *     root : 'data',               //瀛樻斁鏁版嵁鐨勫瓧娈靛悕(rows)
     *     totalProperty : 'total'     //瀛樻斁璁板綍鎬绘暟鐨勫瓧娈靛悕(results)
     *   });
     * </code></pre>
     *   
     */
    root: { value : 'rows'}, 

    /**
     * 褰撳墠Store缂撳瓨鐨勬暟鎹潯鏁�
     * @type {Number}
     * @private
     * @readOnly
     */
    rowCount :{
      value : 0
    },
    /**
     * 鍔犺浇鏁版嵁鏃讹紝杩斿洖璁板綍鐨勬€绘暟鐨勫瓧娈碉紝鐢ㄤ簬鍒嗛〉
     * @cfg {String} [totalProperty='results']
     *<pre><code>
     *    //榛樿杩斿洖鏁版嵁绫诲瀷锛�
     *    '{"rows":[{"name":"abc"},{"name":"bcd"}],"results":100}'
     *   //鍙互淇敼鎺ユ敹鐨勫悗鍙板弬鏁扮殑鍚箟
     *   var store = new Store({
     *     url : 'data.json',
     *     errorProperty : 'errorMsg', //瀛樻斁閿欒淇℃伅鐨勫瓧娈�(error)
     *     hasErrorProperty : 'isError', //鏄惁閿欒鐨勫瓧娈碉紙hasError)
     *     root : 'data',               //瀛樻斁鏁版嵁鐨勫瓧娈靛悕(rows)
     *     totalProperty : 'total'     //瀛樻斁璁板綍鎬绘暟鐨勫瓧娈靛悕(results)
     *   });
     * </code></pre>
     */
    totalProperty: {value :'results'}, 

    /**
     * 鍔犺浇鏁版嵁鐨勮捣濮嬩綅缃�
     * <pre><code>
     *  //鍒濆鍖栨椂锛屽彲浠ュ湪params涓厤缃�
     *  var store = new Store({
     *    url : 'data.json',
     *    params : {
     *      start : 100
     *    }
     *  });
     * </code></pre>
     * @type {Object}
     */
    start:{
      value : 0
    },
    /**
     * 姣忛〉澶氬皯鏉¤褰�,榛樿涓簄ull,姝ゆ椂涓嶅垎椤碉紝褰撴寚瀹氫簡姝ゅ€兼椂鍒嗛〉
     * <pre><code>
     *  //褰撹姹傜殑鏁版嵁鍒嗛〉鏃�
     *  var store = new Store({
     *    url : 'data.json',
     *    pageSize : 30
     *  });
     * </code></pre>
     * @cfg {Number} pageSize
     */
    pageSize : {

    }
  };
  BUI.extend(store,AbstractStore);

  BUI.mixin(store,[Sortable]);

  BUI.augment(store,
  {
    /**
    * 娣诲姞璁板綍,榛樿娣诲姞鍦ㄥ悗闈�
    * <pre><code>
    *  //娣诲姞璁板綍
    *  store.add({id : '2',text: 'new data'});
    *  //鏄惁鍘婚噸锛岄噸澶嶆暟鎹笉鑳芥坊鍔�
    *  store.add(obj,true); //涓嶈兘娣诲姞閲嶅鏁版嵁锛屾鏃剁敤obj1 === obj2鍒ゆ柇
    *  //浣跨敤鍖归厤鍑藉幓閲�
    *  store.add(obj,true,function(obj1,obj2){
    *    return obj1.id == obj2.id;
    *  });
    *  
    * </code></pre>
    * @param {Array|Object} data 娣诲姞鐨勬暟鎹紝鍙互鏄暟缁勶紝鍙互鏄崟鏉¤褰�
    * @param {Boolean} [noRepeat = false] 鏄惁鍘婚噸,鍙互涓虹┖锛岄粯璁わ細 false 
    * @param {Function} [match] 鍖归厤鍑芥暟锛屽彲浠ヤ负绌猴紝
    * @default 閰嶇疆椤逛腑 matchFunction 灞炴€т紶鍏ョ殑鍑芥暟锛岄粯璁ゆ槸锛�<br>
    *  function(obj1,obj2){
    *    return obj1 == obj2;
    *  }
    * 
    */
    add :function(data,noRepeat,match){
      var _self = this,
        count = _self.getCount();
      _self.addAt(data,count,noRepeat,match)
    },
    /**
    * 娣诲姞璁板綍,鎸囧畾绱㈠紩鍊�
    * <pre><code>
    *  //浣跨敤鏂瑰紡璺熺被浼间簬add,澧炲姞浜唅ndex鍙傛暟
    *  store.add(obj,0);//娣诲姞鍦ㄦ渶鍓嶉潰
    * </code></pre>
    * @param {Array|Object} data 娣诲姞鐨勬暟鎹紝鍙互鏄暟缁勶紝鍙互鏄崟鏉¤褰�
    * @param {Number} index 寮€濮嬫坊鍔犳暟鎹殑浣嶇疆
    * @param {Boolean} [noRepeat = false] 鏄惁鍘婚噸,鍙互涓虹┖锛岄粯璁わ細 false 
    * @param {Function} [match] 鍖归厤鍑芥暟锛屽彲浠ヤ负绌猴紝
     */
    addAt : function(data,index,noRepeat,match){
      var _self = this;

      match = match || _self._getDefaultMatch();
      if(!BUI.isArray(data)){
        data = [data];
      }

      $.each(data,function(pos,element){
        if(!noRepeat || !_self.contains(element,match)){
          _self._addRecord(element,pos + index);

          _self.get('newRecords').push(element);

          removeFrom(element,_self.get('deletedRecords'));
          removeFrom(element,_self.get('modifiedRecords'));
        }
      });
    },
    /**
    * 楠岃瘉鏄惁瀛樺湪鎸囧畾璁板綍
    * <pre><code>
    *  store.contains(obj); //鏄惁鍖呭惈鎸囧畾鐨勮褰�
    *
    *  store.contains(obj,function(obj1,obj2){ //浣跨敤鍖归厤鍑芥暟
    *    return obj1.id == obj2.id;
    *  });
    * </code></pre>
    * @param {Object} record 鎸囧畾鐨勮褰�
    * @param {Function} [match = function(obj1,obj2){return obj1 == obj2}] 榛樿涓烘瘮杈�2涓璞℃槸鍚︾浉鍚�
    * @return {Boolean}
    */
    contains :function(record,match){
      return this.findIndexBy(record,match)!==-1;
    },
    /**
    * 鏌ユ壘璁板綍锛屼粎杩斿洖绗竴鏉�
    * <pre><code>
    *  var record = store.find('id','123');
    * </code></pre>
    * @param {String} field 瀛楁鍚�
    * @param {String} value 瀛楁鍊�
    * @return {Object|null}
    */
    find : function(field,value){
      var _self = this,
        result = null,
        records = _self.getResult();
      $.each(records,function(index,record){
        if(record[field] === value){
          result = record;
          return false;
        }
      });
      return result;
    },
    /**
    * 鏌ユ壘璁板綍锛岃繑鍥炴墍鏈夌鍚堟煡璇㈡潯浠剁殑璁板綍
    * <pre><code>
    *   var records = store.findAll('type','0');
    * </code></pre>
    * @param {String} field 瀛楁鍚�
    * @param {String} value 瀛楁鍊�
    * @return {Array}
    */
    findAll : function(field,value){
      var _self = this,
        result = [],
        records = _self.getResult();
      $.each(records,function(index,record){
        if(record[field] === value){
          result.push(record);
        }
      });
      return result;
    },
    /**
    * 鏍规嵁绱㈠紩鏌ユ壘璁板綍
    * <pre><code>
    *  var record = store.findByIndex(1);
    * </code></pre>
    * @param {Number} index 绱㈠紩
    * @return {Object} 鏌ユ壘鐨勮褰�
    */
    findByIndex : function(index){
      return this.getResult()[index];
    },
    /**
    * 鏌ユ壘鏁版嵁鎵€鍦ㄧ殑绱㈠紩浣嶇疆,鑻ヤ笉瀛樺湪杩斿洖-1
    * <pre><code>
    *  var index = store.findIndexBy(obj);
    *
    *  var index = store.findIndexBy(obj,function(obj1,obj2){
    *    return obj1.id == obj2.id;
    *  });
    * </code></pre>
    * @param {Object} target 鎸囧畾鐨勮褰�
    * @param {Function} [match = matchFunction] @see {BUI.Data.Store#matchFunction}榛樿涓烘瘮杈�2涓璞℃槸鍚︾浉鍚�
    * @return {Number}
    */
    findIndexBy :function(target,match){
      var _self = this,
        position = -1,
        records = _self.getResult();
      match = match || _self._getDefaultMatch();
      if(target === null || target === undefined){
        return -1;
      }
      $.each(records,function(index,record){
        if(match(target,record)){
          position = index;
          return false;
        }
      });
      return position;
    },
    /**
    * 鑾峰彇涓嬩竴鏉¤褰�
    * <pre><code>
    *  var record = store.findNextRecord(obj);
    * </code></pre>
    * @param {Object} record 褰撳墠璁板綍
    * @return {Object} 涓嬩竴鏉¤褰�
    */
    findNextRecord : function(record){
      var _self = this,
        index = _self.findIndexBy(record);
      if(index >= 0){
        return _self.findByIndex(index + 1);
      }
      return;
    },

    /**
     * 鑾峰彇缂撳瓨鐨勮褰曟暟
     * <pre><code>
     *  var count = store.getCount(); //缂撳瓨鐨勬暟鎹暟閲�
     *
     *  var totalCount = store.getTotalCount(); //鏁版嵁鐨勬€绘暟锛屽鏋滄湁鍒嗛〉鏃讹紝totalCount != count
     * </code></pre>
     * @return {Number} 璁板綍鏁�
     */
    getCount : function(){
      return this.getResult().length;
    },
    /**
     * 鑾峰彇鏁版嵁婧愮殑鏁版嵁鎬绘暟锛屽垎椤垫椂锛屽綋鍓嶄粎缂撳瓨褰撳墠椤垫暟鎹�
     * <pre><code>
     *  var count = store.getCount(); //缂撳瓨鐨勬暟鎹暟閲�
     *
     *  var totalCount = store.getTotalCount(); //鏁版嵁鐨勬€绘暟锛屽鏋滄湁鍒嗛〉鏃讹紝totalCount != count
     * </code></pre>
     * @return {Number} 璁板綍鐨勬€绘暟
     */
    getTotalCount : function(){
      var _self = this,
        resultMap = _self.get('resultMap'),
        total = _self.get('totalProperty'),
        totalVal = BUI.getValue(resultMap,total); 
      return parseInt(totalVal,10) || 0;
    },
    /**
     * 鑾峰彇褰撳墠缂撳瓨鐨勭邯褰�
     * <pre><code>
     *   var records = store.getResult();
     * </code></pre>
     * @return {Array} 绾綍闆嗗悎
     */
    getResult : function(){
      var _self = this,
        resultMap = _self.get('resultMap'),
        root = _self.get('root');
      return BUI.getValue(resultMap,root);
    },
    /**
     * 鏄惁鍖呭惈鏁版嵁
     * @return {Boolean} 
     */
    hasData : function(){
      return this.getCount() !== 0;
    },
    /**
     * 璁剧疆鏁版嵁婧�,闈炲紓姝ュ姞杞芥椂锛岃缃紦瀛樼殑鏁版嵁
     * <pre><code>
     *   store.setResult([]); //娓呯┖鏁版嵁
     *
     *   var data = [{},{}];
     *   store.setResult(data); //閲嶈鏁版嵁
     * </code></pre>
     */
    setResult : function(data){
      var _self = this,
        proxy = _self.get('proxy');
      if(proxy instanceof Proxy.Memery){
        _self.set('data',data);
        _self.load({start:0});
      }else{
        _self._setResult(data);
        //濡傛灉鏈塮ilter鍒欒繘琛岃繃婊�
        if(_self.get('filter')){
          _self.filter();
        }
      }
    },

    /**
    * 鍒犻櫎涓€鏉℃垨澶氭潯璁板綍瑙﹀彂 remove 浜嬩欢.
    * <pre><code>
    *  store.remove(obj);  //鍒犻櫎涓€鏉¤褰�
    *
    *  store.remove([obj1,obj2...]); //鍒犻櫎澶氫釜鏉¤褰�
    *
    *  store.remvoe(obj,funciton(obj1,obj2){ //浣跨敤鍖归厤鍑芥暟
    *    return obj1.id == obj2.id;
    *  });
    * </code></pre>
    * @param {Array|Object} data 娣诲姞鐨勬暟鎹紝鍙互鏄暟缁勶紝鍙互鏄崟鏉¤褰�
    * @param {Function} [match = function(obj1,obj2){return obj1 == obj2}] 鍖归厤鍑芥暟锛屽彲浠ヤ负绌�
    */
    remove :function(data,match){
      var _self =this,
        delData=[];
      match = match || _self._getDefaultMatch();
      if(!BUI.isArray(data)){
        data = [data];
      }
      $.each(data,function(index,element){
        var index = _self.findIndexBy(element,match),
            record = removeAt(index,_self.getResult());
        //娣诲姞鍒板凡鍒犻櫎闃熷垪涓�,濡傛灉鏄柊娣诲姞鐨勬暟鎹紝涓嶈鍏ュ垹闄ょ殑鏁版嵁闆嗗悎涓�
        if(!contains(record,_self.get('newRecords')) && !contains(record,_self.get('deletedRecords'))){
          _self.get('deletedRecords').push(record);
        }
        removeFrom(record,_self.get('newRecords'));
        removeFrom(record,_self.get('modifiedRecords'));
        _self.fire('remove',{record:record});
      }); 
    },
    /**
     * 淇濆瓨鏁版嵁锛屾湁鍑犵绫诲瀷锛�
     * 
     *  - add 淇濆瓨娣诲姞鐨勮褰�,
     *  - remove 淇濆瓨鍒犻櫎,
     *  - update 淇濆瓨鏇存柊,
     *  - all 淇濆瓨store浠庝笂娆″姞杞藉埌鐩墠鏇存敼鐨勮褰�
     *
     * 
     * @param {String} type 淇濆瓨鐨勭被鍨�
     * @param {Object} saveData 鏁版嵁
     * @param {Function} callback
     */
    save : function(type,saveData,callback){
      var _self = this,
        proxy = _self.get('proxy');

      if(BUI.isFunction(type)){ //鍙湁鍥炶皟鍑芥暟
        callback = type;
        type = undefined;
      }
      if(BUI.isObject(type)){ //鏈寚瀹氱被鍨�
        callback = saveData;
        saveData = type;
        type = undefined;
      }
      if(!type){
        type = _self._getSaveType(saveData);
      }
      if(type == 'all' && !saveData){//濡傛灉淇濆瓨鍏ㄩ儴锛屽悓鏃舵湭鎻愪緵淇濆瓨鐨勬暟鎹紝鑷姩鑾峰彇
        saveData = _self._getDirtyData();
      }

      _self.fire('beforesave',{type : type,saveData : saveData});

      proxy.save(type,saveData,function(data){
        _self.onSave(type,saveData,data);
        if(callback){
          callback(data,saveData);
        }
      },_self);

    },
    //鏍规嵁淇濆瓨鐨勬暟鎹幏鍙栦繚瀛樼殑绫诲瀷
    _getSaveType :function(saveData){
      var _self = this;
      if(!saveData){
        return 'all';
      }

      if(BUI.Array.contains(saveData,_self.get('newRecords'))){
        return 'add';
      }

      if(BUI.Array.contains(saveData,_self.get('modifiedRecords'))){
        return 'update';
      }

      if(BUI.Array.contains(saveData,_self.get('deletedRecords'))){
        return 'remove';
      }
      return 'custom';
    },
    //鑾峰彇鏈繚瀛樼殑鏁版嵁
    _getDirtyData : function(){
      var _self = this,
        proxy = _self.get('proxy');
      if(proxy.get('url')){
        return {
          add : BUI.JSON.stringify(_self.get('newRecords')),
          update : BUI.JSON.stringify(_self.get('modifiedRecords')),
          remove : BUI.JSON.stringify(_self.get('deletedRecords'))
        };
      }else{
        return {
          add : _self.get('newRecords'),
          update : _self.get('modifiedRecords'),
          remove : _self.get('deletedRecords')
        };
      }
      
    },
    /**
     * 淇濆瓨瀹屾垚鍚�
     * @private
     */
    onSave : function(type,saveData,data){
      var _self = this,
         hasErrorField = _self.get('hasErrorProperty');

      if (BUI.getValue(data,hasErrorField) || data.exception){ //濡傛灉澶辫触
        _self.onException(data);
        return;
      }
      _self._clearDirty(type,saveData);

      _self.fire('saved',{type : type,saveData : saveData,data : data});
      if(_self.get('autoSync')){
        _self.load();
      }
    },
    //娓呴櫎鑴忔暟鎹�
    _clearDirty : function(type,saveData){
      var _self = this;
      switch(type){
        case  'all' : 
          _self._clearChanges();
          break;
        case 'add' : 
          removeFrom(saveData,'newRecords');
          break;
        case 'update' : 
          removeFrom(saveData,'modifiedRecords');
          break;
        case 'remove' : 
          removeFrom(saveData,'deletedRecords');
          break;
        default : 
          break;
      }
      function removeFrom(obj,name){
        BUI.Array.remove(_self.get(name),obj);
      }
    },
    /**
     * 鎺掑簭锛屽鏋渞emoteSort = true,鍙戦€佽姹傦紝鍚庣鎺掑簭
     * <pre><code>
     *   store.sort('id','DESC'); //浠d涓烘帓搴忓瓧娈碉紝鍊掑簭鎺掑簭
     * </code></pre>
     * @param  {String} field     鎺掑簭瀛楁
     * @param  {String} direction 鎺掑簭鏂瑰悜
     */
    sort : function(field,direction){
      var _self = this,
        remoteSort = _self.get('remoteSort');

      if(!remoteSort){
        _self._localSort(field,direction);
      }else{
        _self.set('sortField',field);
        _self.set('sortDirection',direction);
        _self.load(_self.get('sortInfo'));
      }
    },
    /**
     * 璁＄畻鎸囧畾瀛楁鐨勫拰
     * <pre><code>
     *   var sum = store.sum('number');
     * </code></pre>
     * @param  {String} field 瀛楁鍚�
     * @param  {Array} [data] 璁＄畻鐨勯泦鍚堬紝榛樿涓篠tore涓殑鏁版嵁闆嗗悎
     * @return {Number} 姹囨€诲拰
     */
    sum : function(field,data){
      var  _self = this,
        records = data || _self.getResult(),
        sum = 0;
      BUI.each(records,function(record){
        var val = record[field];
        if(!isNaN(val)){
          sum += parseFloat(val);
        }
      });
      return sum;
    },
    /**
    * 璁剧疆璁板綍鐨勫€� 锛岃Е鍙� update 浜嬩欢
    * <pre><code>
    *  store.setValue(obj,'value','new value');
    * </code></pre>
    * @param {Object} obj 淇敼鐨勮褰�
    * @param {String} field 淇敼鐨勫瓧娈靛悕
    * @param {Object} value 淇敼鐨勫€�
    */
    setValue : function(obj,field,value){
      var record = obj,
        _self = this;

      record[field]=value;
      if(!contains(record,_self.get('newRecords')) && !contains(record,_self.get('modifiedRecords'))){
          _self.get('modifiedRecords').push(record);
      }
      _self.fire('update',{record:record,field:field,value:value});
    },
    /**
    * 鏇存柊璁板綍 锛岃Е鍙� update浜嬩欢
    * <pre><code>
    *   var record = store.find('id','12');
    *   record.value = 'new value';
    *   record.text = 'new text';
    *   store.update(record); //瑙﹀彂update浜嬩欢锛屽紩璧风粦瀹氫簡store鐨勬帶浠舵洿鏂�
    * </code></pre>
    * @param {Object} obj 淇敼鐨勮褰�
    * @param {Boolean} [isMatch = false] 鏄惁闇€瑕佽繘琛屽尮閰嶏紝妫€娴嬫寚瀹氱殑璁板綍鏄惁鍦ㄩ泦鍚堜腑
    * @param {Function} [match = matchFunction] 鍖归厤鍑芥暟
    */
    update : function(obj,isMatch,match){
      var record = obj,
        _self = this,
        match = null,
        index = null;
      if(isMatch){
        match = match || _self._getDefaultMatch();
        index = _self.findIndexBy(obj,match);
        if(index >=0){
          record = _self.getResult()[index];
        }
      }
      record = BUI.mix(record,obj);
      if(!contains(record,_self.get('newRecords')) && !contains(record,_self.get('modifiedRecords'))){
          _self.get('modifiedRecords').push(record);
      }
      _self.fire('update',{record:record});
    },
    //娣诲姞绾綍
    _addRecord :function(record,index){
      var records = this.getResult();
      if(index == undefined){
        index = records.length;
      }
      records.splice(index,0,record);
      this.fire('add',{record:record,index:index});
    },
    //娓呴櫎鏀瑰彉鐨勬暟鎹褰�
    _clearChanges : function(){
      var _self = this;
      BUI.Array.empty(_self.get('newRecords'));
      BUI.Array.empty(_self.get('modifiedRecords'));
      BUI.Array.empty(_self.get('deletedRecords'));
    },
    /**
     * @protected
     * 杩囨护缂撳瓨鐨勬暟鎹�
     * @param  {Function} fn 杩囨护鍑芥暟
     * @return {Array} 杩囨护缁撴灉
     */
    _filterLocal : function(fn,data){

      var _self = this,
        rst = [];
      data = data || _self.getResult();
      if(!fn){ //娌℃湁杩囨护鍣ㄦ椂鐩存帴杩斿洖
        return data;
      }
      BUI.each(data,function(record){
        if(fn(record)){
          rst.push(record);
        }
      });
      return rst;
    },
    //鑾峰彇榛樿鐨勫尮閰嶅嚱鏁�
    _getDefaultMatch :function(){

      return this.get('matchFunction');
    },

    //鑾峰彇鍒嗛〉鐩稿叧鐨勪俊鎭�
    _getPageParams : function(){
      var _self = this,
        sortInfo = _self.get('sortInfo'),
        start = _self.get('start'),
        limit = _self.get('pageSize'),
        pageIndex = _self.get('pageIndex') || (limit ? start/limit : 0);

        params = {
          start : start,
          limit : limit,
          pageIndex : pageIndex //涓€鑸€岃█锛宲ageIndex = start/limit
        };

      if(_self.get('remoteSort')){
        BUI.mix(params,sortInfo);
      }

      return params;
    },
     /**
     * 鑾峰彇闄勫姞鐨勫弬鏁�,鍒嗛〉淇℃伅锛屾帓搴忎俊鎭�
     * @override
     * @protected
     * @return {Object} 闄勫姞鐨勫弬鏁�
     */
    getAppendParams : function(){
      return this._getPageParams();
    },
    /**
     * @protected
     * 鍒濆鍖栦箣鍓�
     */
    beforeInit : function(){
      //鍒濆鍖栫粨鏋滈泦
      this._setResult([]);
    },
    //鏈湴鎺掑簭
    _localSort : function(field,direction){
      var _self = this;

      _self._sortData(field,direction);

      _self.fire('localsort',{field:field,direction:direction});
    },
    _sortData : function(field,direction,data){
      var _self = this;
      data = data || _self.getResult();

      _self.sortData(field,direction,data);
    },
    //澶勭悊鏁版嵁
    afterProcessLoad : function(data,params){
      var _self = this,
        root = _self.get('root'),
        start = params.start,
        limit = params.limit,
        totalProperty = _self.get('totalProperty');

      if(BUI.isArray(data)){
        _self._setResult(data);
      }else{
        _self._setResult(BUI.getValue(data,root), BUI.getValue(data,totalProperty));
      }

      _self.set('start',start);

      if(limit){
        _self.set('pageIndex',start/limit);
      }

      //濡傛灉鏈湴鎺掑簭,鍒欐帓搴�
      if(!_self.get('remoteSort')){
        _self._sortData();
      }

      _self.fire('load',{ params : params });

      //濡傛灉鏈夋湰鍦拌繃婊わ紝鍒欐湰鍦拌繃婊�
      if(!_self.get('remoteFilter') && _self.get('filter')){
        _self.filter(_self.get('filter'));
      }
    },
    //璁剧疆缁撴灉闆�
    _setResult : function(rows,totalCount){
      var _self = this,
        resultMap = _self.get('resultMap');

      totalCount = totalCount || rows.length;

      BUI.setValue(resultMap,_self.get('root'),rows);
      BUI.setValue(resultMap,_self.get('totalProperty'),totalCount);

      //娓呯悊涔嬪墠鍙戠敓鐨勬敼鍙�
      _self._clearChanges();
    }
  });

module.exports = store;

});
define("bui/data/node", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 鏍戝舰鏁版嵁缁撴瀯鐨勮妭鐐圭被锛屾棤娉曠洿鎺ヤ娇鐢ㄦ暟鎹綔涓鸿妭鐐癸紝鎵€浠ヨ繘琛屼竴灞傚皝瑁�
 * 鍙互鐩存帴浣滀负TreeNode鎺т欢鐨勯厤缃」
 * @ignore
 */

  var BUI = require("bui/common");

  function mapNode(cfg,map){
    var rst = {};
    if(map){
      BUI.each(cfg,function(v,k){
        var name = map[k] || k;
        rst[name] = v;
      });
      rst.record = cfg;
    }else{
      rst = cfg;
    }
    return rst;
  }
  /**
   * @class BUI.Data.Node
   * 鏍戝舰鏁版嵁缁撴瀯鐨勮妭鐐圭被
   */
  function Node (cfg,map) {
    var _self = this;
    cfg = mapNode(cfg,map);
    BUI.mix(this,cfg);
  }

  BUI.augment(Node,{
    /**
     * 鏄惁鏍硅妭鐐�
     * @type {Boolean}
     */
    root : false,
    /**
     * 鏄惁鍙跺瓙鑺傜偣
     * @type {Boolean}
     */
    leaf : null,
    /**
     * 鏄剧ず鑺傜偣鏃舵樉绀虹殑鏂囨湰
     * @type {Object}
     */
    text : '',
    /**
     * 浠ｈ〃鑺傜偣鐨勭紪鍙�
     * @type {String}
     */
    id : null,
    /**
     * 瀛愯妭鐐规槸鍚﹀凡缁忓姞杞借繃
     * @type {Boolean}
     */
    loaded : false,
    /**
     * 浠庢牴鑺傜偣鍒版鑺傜偣鐨勮矾寰勶紝id鐨勯泦鍚堝锛� ['0','1','12'],
     * 渚夸簬蹇€熷畾浣嶈妭鐐�
     * @type {Array}
     */
    path : null,
    /**
     * 鐖惰妭鐐�
     * @type {BUI.Data.Node}
     */
    parent : null,
    /**
     * 鏍戣妭鐐圭殑绛夌骇
     * @type {Number}
     */
    level : 0,
    /**
     * 鑺傜偣鏄惁鐢变竴鏉¤褰曞皝瑁呰€屾垚
     * @type {Object}
     */
    record : null,
    /**
     * 瀛愯妭鐐归泦鍚�
     * @type {BUI.Data.Node[]}
     */
    children : null,
    /**
     * 鏄惁鏄疦ode瀵硅薄
     * @type {Object}
     */
    isNode : true
  });

  module.exports = Node;

});
define("bui/data/treestore", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 鏍戝舰瀵硅薄缂撳啿绫�
 * @ignore
 */


  var BUI = require("bui/common"),
    Node = require("bui/data/node"),
    Proxy = require("bui/data/proxy"),
    AbstractStore = require("bui/data/abstractstore");

  /**
   * @class BUI.Data.TreeStore
   * 鏍戝舰鏁版嵁缂撳啿绫�
   * <p>
   * <img src="../assets/img/class-data.jpg"/>
   * </p>
   * <pre><code>
   *   //鍔犺浇闈欐€佹暟鎹�
   *   var store = new TreeStore({
   *     root : {
   *       text : '鏍硅妭鐐�',
   *       id : 'root'
   *     },
   *     data : [{id : '1',text : 1},{id : '2',text : 2}] //浼氬姞杞芥垚root鐨刢hildren
   *   });
   *   //寮傛鍔犺浇鏁版嵁锛岃嚜鍔ㄥ姞杞芥暟鎹椂锛屼細璋冪敤store.load({id : 'root'}); //root涓烘牴鑺傜偣鐨刬d
   *   var store = new TreeStore({
   *     root : {
   *       text : '鏍硅妭鐐�',
   *       id : 'root'
   *     },
   *     url : 'data/nodes.php',
   *     autoLoad : true  //璁剧疆鑷姩鍔犺浇锛屽垵濮嬪寲鍚庤嚜鍔ㄥ姞杞芥暟鎹�
   *   });
   *
   *   //鍔犺浇鎸囧畾鑺傜偣
   *   var node = store.findNode('1');
   *   store.loadNode(node);
   *   //鎴栬€�
   *   store.load({id : '1'});//鍙互閰嶇疆鑷畾涔夊弬鏁帮紝杩斿洖鍊奸檮鍔犲埌鎸囧畾id鐨勮妭鐐逛笂
   * </code></pre>
   * @extends BUI.Data.AbstractStore
   */
  function TreeStore(config){
    TreeStore.superclass.constructor.call(this,config);
  }

  TreeStore.ATTRS = {
    /**
     * 鏍硅妭鐐�
     * <pre><code>
     *  var store = new TreeStore({
     *    root : {text : '鏍硅妭鐐�',id : 'rootId',children : [{id : '1',text : '1'}]}
     *  });
     * </code></pre>
     * @cfg {Object} root
     */
    /**
     * 鏍硅妭鐐�,鍒濆鍖栧悗涓嶈鏇存敼瀵硅薄锛屽彲浠ユ洿鏀瑰睘鎬у€�
     * <pre><code>
     *  var root = store.get('root');
     *  root.text = '淇敼鐨勬枃鏈�'锛�
     *  store.update(root);
     * </code></pre>
     * @type {Object}
     * @readOnly
     */
    root : {

    },
    /**
     * 鏁版嵁鏄犲皠锛岀敤浜庤缃殑鏁版嵁璺烜see {BUI.Data.Node} 涓嶄竴鑷存椂锛岃繘琛屽尮閰嶃€�
     * 濡傛灉姝ゅ睘鎬т负null,閭ｄ箞鍋囪璁剧疆鐨勫璞℃槸Node瀵硅薄
     * <pre><code>
     *   //渚嬪鍘熷鏁版嵁涓� {name : '123',value : '鏂囨湰123',isLeaf: false,nodes : []}
     *   var store = new TreeStore({
     *     map : {
     *       'name' : 'id',
     *       'value' : 'text',
     *       'isLeaf' : 'leaf' ,
     *       'nodes' : 'children'
     *     }
     *   });
     *   //鏄犲皠鍚庯紝璁板綍浼氬彉鎴�  {id : '123',text : '鏂囨湰123',leaf: false,children : []};
     *   //姝ゆ椂鍘熷璁板綍浼氫綔涓哄璞＄殑 record灞炴€�
     *   var node = store.findNode('123'),
     *     record = node.record;
     * </code></pre> 
     * **Notes:**
     * 浣跨敤鏁版嵁鏄犲皠鐨勮褰曚粎鍋氫簬灞曠ず鏁版嵁锛屼笉浣滀负鍙洿鏀圭殑鏁版嵁锛宎dd,update涓嶄細鏇存敼鏁版嵁鐨勫師濮嬫暟鎹�
     * @cfg {Object} map
     */
    map : {

    },
    /**
     * 鏍囩ず鐖跺厓绱爄d鐨勫瓧娈靛悕绉�
     * @type {String}
     */
    pidField : {
      
    },
    /**
     * 杩斿洖鏁版嵁鏍囩ず鏁版嵁鐨勫瓧娈�<br/>
     * 寮傛鍔犺浇鏁版嵁鏃讹紝杩斿洖鏁版嵁鍙互浣挎暟缁勬垨鑰呭璞�
     * - 濡傛灉杩斿洖鐨勬槸瀵硅薄,鍙互闄勫姞鍏朵粬淇℃伅,閭ｄ箞鍙栧璞″搴旂殑瀛楁 {nodes : [],hasError:false}
     * - 濡備綍鑾峰彇闄勫姞淇℃伅鍙傜湅 @see {BUI.Data.AbstractStore-event-beforeprocessload}
     * <pre><code>
     *  //杩斿洖鏁版嵁涓烘暟缁� [{},{}]锛屼細鐩存帴闄勫姞鍒板姞杞界殑鑺傜偣鍚庨潰
     *  
     *  var node = store.loadNode('123');
     *  store.loadNode(node);
     *  
     * </code></pre>
     * @cfg {Object} [dataProperty = 'nodes']
     */
    dataProperty : {
      value : 'nodes'
    },
    events : {
      value : [
        /**  
        * 褰撴坊鍔犳暟鎹椂瑙﹀彂璇ヤ簨浠�
        * @event  
        * <pre><code>
        *  store.on('add',function(ev){
        *    list.addItem(e.node,index);
        *  });
        * </code></pre>
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.node 娣诲姞鐨勮妭鐐�
        * @param {Number} index 娣诲姞鐨勪綅缃�
        */
        'add',
        /**  
        * 褰撴洿鏂版暟鎹寚瀹氬瓧娈垫椂瑙﹀彂璇ヤ簨浠� 
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.node 鏇存柊鐨勮妭鐐�
        */
        'update',
        /**  
        * 褰撳垹闄ゆ暟鎹椂瑙﹀彂璇ヤ簨浠�
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.node 鍒犻櫎鐨勮妭鐐�
        * @param {Number} index 鍒犻櫎鑺傜偣鐨勭储寮�
        */
        'remove',
        /**  
        * 鑺傜偣鍔犺浇瀹屾瘯瑙﹀彂璇ヤ簨浠�
        * <pre><code>
        *   //寮傛鍔犺浇鑺傜偣,姝ゆ椂鑺傜偣宸茬粡闄勫姞鍒板姞杞借妭鐐圭殑鍚庨潰
        *   store.on('load',function(ev){
        *     var params = ev.params,
        *       id = params.id,
        *       node = store.findNode(id),
        *       children = node.children;  //鑺傜偣鐨刬d
        *     //TO DO
        *   });
        * </code></pre>
        * 
        * @event  
        * @param {jQuery.Event} e  浜嬩欢瀵硅薄
        * @param {Object} e.node 鍔犺浇鐨勮妭鐐�
        * @param {Object} e.params 鍔犺浇鑺傜偣鏃剁殑鍙傛暟
        */
        'load'
      ]
    }
  }

  BUI.extend(TreeStore,AbstractStore);

  BUI.augment(TreeStore,{
    /**
     * @protected
     * @override
     * 鍒濆鍖栧墠
     */
    beforeInit:function(){
      this.initRoot();
    },
    //鍒濆鍖栨暟鎹�,濡傛灉榛樿鍔犺浇鏁版嵁锛屽垯鍔犺浇鏁版嵁
    _initData : function(){
      var _self = this,
        autoLoad = _self.get('autoLoad'),
        pidField = _self.get('pidField'),
        proxy = _self.get('proxy'),
        root = _self.get('root');

      //娣诲姞榛樿鐨勫尮閰嶇埗鍏冪礌鐨勫瓧娈�
      if(!proxy.get('url') && pidField){
        proxy.get('matchFields').push(pidField);
      }
      
      if(autoLoad && !root.children){
        //params = root.id ? {id : root.id}: {};
        _self.loadNode(root);
      }
    },
    /**
     * @protected
     * 鍒濆鍖栨牴鑺傜偣
     */
    initRoot : function(){
      var _self = this,
        map = _self.get('map'),
        root = _self.get('root');
      if(!root){
        root = {};
      }
      if(!root.isNode){
        root = new Node(root,map);
        //root.children= [];
      }
      root.path = [root.id];
      root.level = 0;
      if(root.children){
        _self.setChildren(root,root.children);
      }
      _self.set('root',root);
    },
    /**
     * 娣诲姞鑺傜偣锛岃Е鍙憑@link BUI.Data.TreeStore#event-add} 浜嬩欢
     * <pre><code>
     *  //娣诲姞鍒版牴鑺傜偣涓�
     *  store.add({id : '1',text : '1'});
     *  //娣诲姞鍒版寚瀹氳妭鐐�
     *  var node = store.findNode('1'),
     *    subNode = store.add({id : '11',text : '11'},node);
     *  //鎻掑叆鍒拌妭鐐圭殑鎸囧畾浣嶇疆
     *  var node = store.findNode('1'),
     *    subNode = store.add({id : '12',text : '12'},node,0);
     * </code></pre>
     * @param {BUI.Data.Node|Object} node 鑺傜偣鎴栬€呮暟鎹璞�
     * @param {BUI.Data.Node} [parent] 鐖惰妭鐐�,濡傛灉鏈寚瀹氬垯涓烘牴鑺傜偣
     * @param {Number} [index] 娣诲姞鑺傜偣鐨勪綅缃�
     * @return {BUI.Data.Node} 娣诲姞瀹屾垚鐨勮妭鐐�
     */
    add : function(node,parent,index){
      var _self = this;

      node = _self._add(node,parent,index);
      _self.fire('add',{node : node,record : node,index : index});
      return node;
    },
    //
    _add : function(node,parent,index){
      parent = parent || this.get('root');  //濡傛灉鏈寚瀹氱埗鍏冪礌锛屾坊鍔犲埌璺熻妭鐐�
      var _self = this,
        map = _self.get('map'),
        nodes = parent.children,
        nodeChildren;

      if(!node.isNode){
        node = new Node(node,map);
      }

      nodeChildren = node.children || []

      if(nodeChildren.length == 0 && node.leaf == null){
        node.leaf = true;
      }
      if(parent){
        parent.leaf = false;
      }
      
      node.parent = parent;
      node.level = parent.level + 1;
      node.path = parent.path.concat(node.id);
      index = index == null ? parent.children.length : index;
      BUI.Array.addAt(nodes,node,index);

      _self.setChildren(node,nodeChildren);
      return node;
    },
    /**
     * 绉婚櫎鑺傜偣锛岃Е鍙憑@link BUI.Data.TreeStore#event-remove} 浜嬩欢
     * 
     * <pre><code>
     *  var node = store.findNode('1'); //鏍规嵁鑺傜偣id 鑾峰彇鑺傜偣
     *  store.remove(node);
     * </code></pre>
     * 
     * @param {BUI.Data.Node} node 鑺傜偣鎴栬€呮暟鎹璞�
     * @return {BUI.Data.Node} 鍒犻櫎鐨勮妭鐐�
     */
    remove : function(node){
      var parent = node.parent || _self.get('root'),
        index = BUI.Array.indexOf(node,parent.children) ;

      BUI.Array.remove(parent.children,node);
      if(parent.children.length === 0){
        parent.leaf = true;
      }
      this.fire('remove',{node : node ,record : node , index : index});
      node.parent = null;
      return node;
    },
    /**
    * 璁剧疆璁板綍鐨勫€� 锛岃Е鍙� update 浜嬩欢
    * <pre><code>
    *  store.setValue(obj,'value','new value');
    * </code></pre>
    * @param {Object} obj 淇敼鐨勮褰�
    * @param {String} field 淇敼鐨勫瓧娈靛悕
    * @param {Object} value 淇敼鐨勫€�
    */
    setValue : function(node,field,value){
      var 
        _self = this;
        node[field] = value;

      _self.fire('update',{node:node,record : node,field:field,value:value});
    },
    /**
     * 鏇存柊鑺傜偣
     * <pre><code>
     *  var node = store.findNode('1'); //鏍规嵁鑺傜偣id 鑾峰彇鑺傜偣
     *  node.text = 'modify text'; //淇敼鏂囨湰
     *  store.update(node);        //姝ゆ椂浼氳Е鍙憉pdate浜嬩欢锛岀粦瀹氫簡store鐨勬帶浠朵細鏇存柊瀵瑰簲鐨凞OM
     * </code></pre>
     * @return {BUI.Data.Node} 鏇存柊鑺傜偣
     */
    update : function(node){
      this.fire('update',{node : node,record : node});
    },
    /**
     * 杩斿洖缂撳瓨鐨勬暟鎹紝鏍硅妭鐐圭殑鐩存帴瀛愯妭鐐归泦鍚�
     * <pre><code>
     *   //鑾峰彇鏍硅妭鐐圭殑鎵€鏈夊瓙鑺傜偣
     *   var data = store.getResult();
     *   //鑾峰彇鏍硅妭鐐�
     *   var root = store.get('root');
     * </code></pre>
     * @return {Array} 鏍硅妭鐐逛笅闈㈢殑鏁版嵁
     */
    getResult : function(){
      return this.get('root').children;
    },
    /**
     * 璁剧疆缂撳瓨鐨勬暟鎹紝璁剧疆涓烘牴鑺傜偣鐨勬暟鎹�
    *   <pre><code>
    *     var data = [
    *       {id : '1',text : '鏂囨湰1'},
    *       {id : '2',text : '鏂囨湰2',children:[
    *         {id : '21',text : '鏂囨湰21'}
    *       ]},
    *       {id : '3',text : '鏂囨湰3'}
    *     ];
    *     store.setResult(data); //浼氬鏁版嵁杩涜鏍煎紡鍖栵紝娣诲姞leaf绛夊瓧娈碉細
    *                            //[{id : '1',text : '鏂囨湰1',leaf : true},{id : '2',text : '鏂囨湰2',leaf : false,children:[...]}....]
    *   </code></pre>
     * @param {Array} data 缂撳瓨鐨勬暟鎹�
     */
    setResult : function(data){
      var _self = this,
        proxy = _self.get('proxy'),
        root = _self.get('root');
      if(proxy instanceof Proxy.Memery){
        _self.set('data',data);
        _self.load({id : root.id});
      }else{
        _self.setChildren(root,data);
      }
    },
    /**
     * 璁剧疆瀛愯妭鐐�
     * @protected
     * @param {BUI.Data.Node} node  鑺傜偣
     * @param {Array} children 瀛愯妭鐐�
     */
    setChildren : function(node,children){
      var _self = this;
      node.children = [];
      if(!children.length){
        return;
      }
      BUI.each(children,function(item){
        _self._add(item,node);
      });
    },
    /**
     * 鏌ユ壘鑺傜偣
     * <pre><code>
     *  var node = store.findNode('1');//浠庢牴鑺傜偣寮€濮嬫煡鎵捐妭鐐�
     *  
     *  var subNode = store.findNode('123',node); //浠庢寚瀹氳妭鐐瑰紑濮嬫煡鎵�
     * </code></pre>
     * @param  {String} id 鑺傜偣Id
     * @param  {BUI.Data.Node} [parent] 鐖惰妭鐐�
     * @param {Boolean} [deep = true] 鏄惁閫掑綊鏌ユ壘
     * @return {BUI.Data.Node} 鑺傜偣
     */
    findNode : function(id,parent,deep){
      return this.findNodeBy(function(node){
        return node.id === id;
      },parent,deep);
    },
    /**
     * 鏍规嵁鍖归厤鍑芥暟鏌ユ壘鑺傜偣
     * @param  {Function} fn  鍖归厤鍑芥暟
     * @param  {BUI.Data.Node} [parent] 鐖惰妭鐐�
     * @param {Boolean} [deep = true] 鏄惁閫掑綊鏌ユ壘
     * @return {BUI.Data.Node} 鑺傜偣
     */
    findNodeBy : function(fn,parent,deep){
      var _self = this;
      deep = deep == null ? true : deep;
      if(!parent){
        var root = _self.get('root');
        if(fn(root)){
          return root;
        }
        return _self.findNodeBy(fn,root);
      }
      var children = parent.children,
        rst = null;
      BUI.each(children,function(item){
        if(fn(item)){
          rst = item;
        }else if(deep){
          rst = _self.findNodeBy(fn,item);
        }
        if(rst){
          return false;
        }
      });
      return rst;
    },
    /**
     * 鏌ユ壘鑺傜偣,鏍规嵁鍖归厤鍑芥暟鏌ユ壘
     * <pre><code>
     *  var nodes = store.findNodesBy(function(node){
     *   if(node.status == '0'){
     *     return true;
     *   }
     *   return false;
     *  });
     * </code></pre>
     * @param  {Function} func 鍖归厤鍑芥暟
     * @param  {BUI.Data.Node} [parent] 鐖跺厓绱狅紝濡傛灉涓嶅瓨鍦紝鍒欎粠鏍硅妭鐐规煡鎵�
     * @return {Array} 鑺傜偣鏁扮粍
     */
    findNodesBy : function(func,parent){
      var _self = this,
        root,
        rst = [];

      if(!parent){
        parent = _self.get('root');
      }

      BUI.each(parent.children,function(item){
        if(func(item)){
          rst.push(item);
        }
        rst = rst.concat(_self.findNodesBy(func,item));
      });

      return rst;
    },
    /**
     * 鏍规嵁path鏌ユ壘鑺傜偣
     * @return {BUI.Data.Node} 鑺傜偣
     * @ignore
     */
    findNodeByPath : function(path){
      if(!path){
        return null;
      }
      var _self = this,
        root = _self.get('root'),
        pathArr = path.split(','),
        node,
        i,
        tempId = pathArr[0];
      if(!tempId){
        return null;
      }
      if(root.id == tempId){
        node = root;
      }else{
        node = _self.findNode(tempId,root,false);
      }
      if(!node){
        return;
      }
      for(i = 1 ; i < pathArr.length ; i = i + 1){
        var tempId = pathArr[i];
        node = _self.findNode(tempId,node,false);
        if(!node){
          break;
        }
      }
      return node;
    },
    /**
     * 鏄惁鍖呭惈鎸囧畾鑺傜偣锛屽鏋滄湭鎸囧畾鐖惰妭鐐癸紝浠庢牴鑺傜偣寮€濮嬫悳绱�
     * <pre><code>
     *  store.contains(node); //鏄惁瀛樺湪鑺傜偣
     *
     *  store.contains(subNode,node); //鑺傜偣鏄惁瀛樺湪鎸囧畾瀛愯妭鐐�
     * </code></pre>
     * @param  {BUI.Data.Node} node 鑺傜偣
     * @param  {BUI.Data.Node} parent 鐖惰妭鐐�
     * @return {Boolean} 鏄惁鍖呭惈鎸囧畾鑺傜偣
     */
    contains : function(node,parent){
      var _self = this,
        findNode = _self.findNode(node.id,parent);
      return !!findNode;
    },
    /**
     * 鍔犺浇瀹屾暟鎹�
     * @protected
     * @override
     */
    afterProcessLoad : function(data,params){
      var _self = this,
        pidField = _self.get('pidField'),
        id = params.id || params[pidField],
        dataProperty = _self.get('dataProperty'),
        node = _self.findNode(id) || _self.get('root');//濡傛灉鎵句笉鍒扮埗鍏冪礌锛屽垯鏀剧疆鍦ㄨ窡鑺傜偣

      if(BUI.isArray(data)){
        _self.setChildren(node,data);
      }else{
        _self.setChildren(node, BUI.getValue(data, dataProperty));
      }
      node.loaded = true; //鏍囪瘑宸茬粡鍔犺浇杩�
      _self.fire('load',{node : node,params : params});
    },
    /**
     * 鏄惁鍖呭惈鏁版嵁
     * @return {Boolean} 
     */
    hasData : function(){
      //return true;
      return this.get('root').children && this.get('root').children.length !== 0;
    },
    /**
     * 鏄惁宸茬粡鍔犺浇杩囷紝鍙跺瓙鑺傜偣鎴栬€呭瓨鍦ㄥ瓧鑺傜偣鐨勮妭鐐�
     * @param   {BUI.Data.Node} node 鑺傜偣
     * @return {Boolean}  鏄惁鍔犺浇杩�
     */
    isLoaded : function(node){
      var root = this.get('root');
      if(node == root && !root.children){
        return false;
      }
      if(!this.get('url') && !this.get('pidField')){ //濡傛灉涓嶄粠杩滅▼鍔犺浇鏁版嵁,榛樿宸茬粡鍔犺浇
        return true;
      }
      
      return node.loaded || node.leaf || !!(node.children && node.children.length);
    },
    /**
     * 鍔犺浇鑺傜偣鐨勫瓙鑺傜偣
     * @param  {BUI.Data.Node} node 鑺傜偣
     * @param {Boolean} forceLoad 鏄惁寮鸿揩閲嶆柊鍔犺浇鑺傜偣锛屽鏋滆缃垚true锛屼笉鍒ゆ柇鏄惁鍔犺浇杩�
     */
    loadNode : function(node,forceLoad){
      var _self = this,
        pidField = _self.get('pidField'),
        params;
      //濡傛灉宸茬粡鍔犺浇杩囷紝鎴栬€呰妭鐐规槸鍙跺瓙鑺傜偣
      if(!forceLoad && _self.isLoaded(node)){
        return ;
      }
      params = {id : node.id};
      if(pidField){
        params[pidField] = node.id;
      }
      _self.load(params);  
    },
    /**
     * 閲嶆柊鍔犺浇鑺傜偣
     * @param  {BUI.Data.Node} node node鑺傜偣
     */
    reloadNode : function(node){
      var _self = this;
      node = node || _self.get('root');
      node.loaded = false;
      //node.children = [];
      _self.loadNode(node,true);
    },
    /**
     * 鍔犺浇鑺傜偣锛屾牴鎹畃ath
     * @param  {String} path 鍔犺浇璺緞
     * @ignore
     */
    loadPath : function(path){
      var _self = this,
        arr = path.split(','),
        id = arr[0];
      if(_self.findNodeByPath(path)){ //鍔犺浇杩�
        return;
      }
      _self.load({id : id,path : path});
    }
  });

module.exports = TreeStore;

});

define("bui/list", ["bui/common","jquery","bui/data"], function(require, exports, module){
/**
* @fileOverview 鍒楄〃妯″潡鍏ュ彛鏂囦欢
* @ignore
*/
var BUI = require("bui/common"),
  List = BUI.namespace('List');

BUI.mix(List, {
  List : require("bui/list/list"),
  ListItem : require("bui/list/listitem"),
  SimpleList : require("bui/list/simplelist"),
  Listbox : require("bui/list/listbox")
});

BUI.mix(List, {
  ListItemView : List.ListItem.View,
  SimpleListView : List.SimpleList.View
});

module.exports = List;

});
define("bui/list/list", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鍒楄〃
 * @ignore
 */
  
var $ = require("jquery"),
  BUI = require("bui/common"),
  Component = BUI.Component,
  UIBase = Component.UIBase;

/**
 * 鍒楄〃
 * <p>
 * <img src="../assets/img/class-list.jpg"/>
 * </p>
 * xclass:'list'
 * @class BUI.List.List
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.ChildList
 */
var list = Component.Controller.extend([UIBase.ChildList],{
  
},{
  ATTRS : 
  {
    elTagName:{
      view:true,
      value:'ul'
    },
    idField:{
      value:'id'
    },
    /**
     * 瀛愮被鐨勯粯璁ょ被鍚嶏紝鍗崇被鐨� xclass
     * @type {String}
     * @override
     * @default 'list-item'
     */
    defaultChildClass : {
      value : 'list-item'
    }
  }
},{
  xclass:'list'
});

module.exports = list;

});
define("bui/list/listitem", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鍒楄〃椤�
 * @author dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  Component = BUI.Component,
  UIBase = Component.UIBase;
  
/**
 * @private
 * @class BUI.List.ItemView
 * @extends BUI.Component.View
 * @mixins BUI.Component.UIBase.ListItemView
 * 鍒楄〃椤圭殑瑙嗗浘灞傚璞�
 */
var itemView = Component.View.extend([UIBase.ListItemView],{
});

/**
 * 鍒楄〃椤�
 * @private
 * @class BUI.List.ListItem
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.ListItem
 */
var item = Component.Controller.extend([UIBase.ListItem],{
  
},{
  ATTRS : 
  {
    elTagName:{
      view:true,
      value:'li'
    },
    xview:{
      value:itemView
    },
    tpl:{
      view:true,
      value:'<span>{text}</span>'
    }
  }
},{
  xclass:'list-item'
});

item.View = itemView;

module.exports = item;

});
define("bui/list/simplelist", ["jquery","bui/common","bui/data"], function(require, exports, module){
/**
 * @fileOverview 绠€鍗曞垪琛紝鐩存帴浣跨敤DOM浣滀负鍒楄〃椤�
 * @ignore
 */


/**
 * @name BUI.List
 * @namespace 鍒楄〃鍛藉悕绌洪棿
 * @ignore
 */
var $ = require("jquery"),
  BUI = require("bui/common"),
  UIBase = BUI.Component.UIBase,
  UA = BUI.UA,
  DomList = require("bui/list/domlist"),
  KeyNav = require("bui/list/keynav"),
  Sortable = require("bui/list/sortable"),
  CLS_ITEM = BUI.prefix + 'list-item';

/**
 * @class BUI.List.SimpleListView
 * 绠€鍗曞垪琛ㄨ鍥剧被
 * @extends BUI.Component.View
 */
var simpleListView = BUI.Component.View.extend([DomList.View],{

  setElementHover : function(element,hover){
    var _self = this;

    _self.setItemStatusCls('hover',element,hover);
  }

},{
  ATTRS : {
    itemContainer : {
      valueFn : function(){
        return this.get('el').find(this.get('listSelector'));
      }
    }
  }
},{
  xclass:'simple-list-view'
});

/**
 * 绠€鍗曞垪琛紝鐢ㄤ簬鏄剧ず绠€鍗曟暟鎹�
 * <p>
 * <img src="../assets/img/class-list.jpg"/>
 * </p>
 * xclass:'simple-list'
 * ## 鏄剧ず闈欐€佹暟缁勭殑鏁版嵁
 * 
 * ** 鏈€绠€鍗曠殑鍒楄〃 **
 * <pre><code>
 * 
 * BUI.use('bui/list',function(List){
 *   var list = new List.SimpleList({
 *     render : '#t1',
 *     items : [{value : '1',text : '1'},{value : '2',text : '2'}]
 *   });
 *   list.render();
 * });
 * 
 * </code></pre>
 *
 * ** 鑷畾涔夋ā鏉跨殑鍒楄〃 **
 *<pre><code>
 * 
 * BUI.use('bui/list',function(List){
 *   var list = new List.SimpleList({
 *     render : '#t1',
 *     items : [{value : '1',text : '1'},{value : '2',text : '2'}]
 *   });
 *   list.render();
 * });
 * 
 * </code></pre>
 * 
 * @class BUI.List.SimpleList
 * @extends BUI.Component.Controller
 * @mixins BUI.List.DomList
 * @mixins BUI.List.KeyNav
 * @mixins BUI.Component.UIBase.Bindable
 */
var  simpleList = BUI.Component.Controller.extend([DomList,UIBase.Bindable,KeyNav,Sortable],
{
  /**
   * @protected
   * @ignore
   */
  bindUI : function(){
    var _self = this,
      itemCls = _self.get('itemCls'),
      itemContainer = _self.get('view').getItemContainer();

    itemContainer.delegate('.'+itemCls,'mouseover',function(ev){
      if(_self.get('disabled')){ //鎺т欢绂佺敤鍚庯紝闃绘浜嬩欢
        return;
      }
      var element = ev.currentTarget,
        item = _self.getItemByElement(element);
      if(_self.isItemDisabled(ev.item,ev.currentTarget)){ //濡傛灉绂佺敤
        return;
      }
      
      if(!(UA.ie && UA.ie < 8) && _self.get('focusable') && _self.get('highlightedStatus') === 'hover'){
        _self.setHighlighted(item,element)
      }else{
        _self.setItemStatus(item,'hover',true,element);
      }
      /*_self.get('view').setElementHover(element,true);*/

    }).delegate('.'+itemCls,'mouseout',function(ev){
      if(_self.get('disabled')){ //鎺т欢绂佺敤鍚庯紝闃绘浜嬩欢
        return;
      }
      var sender = $(ev.currentTarget);
      _self.get('view').setElementHover(sender,false);
    });
  },
  /**
   * 娣诲姞
   * @protected
   */
  onAdd : function(e){
    var _self = this,
      store = _self.get('store'),
      item = e.record;
    if(_self.getCount() == 0){ //鍒濆涓虹┖鏃讹紝鍒楄〃璺烻tore涓嶅悓姝�
      _self.setItems(store.getResult());
    }else{
      _self.addItemToView(item,e.index);
    }
    
  },
  handleContextMenu: function(ev) {
    var _self = this,
      target = ev.target,
      itemCls = _self.get('itemCls'),
      element = $(target).closest('.' + itemCls),
      item = _self.getItemByElement(element);

    var result = _self.fire('itemcontextmenu',{
      element : element,
      item : item,
      pageX : ev.pageX,
      pageY : ev.pageY,
      domTarget : ev.target,
      domEvent : ev
    });
    if(result === false){
      ev.preventDefault();
    }
  },
  /**
   * 鍒犻櫎
  * @protected
  */
  onRemove : function(e){
    var _self = this,
      item = e.record;
    _self.removeItem(item);
  },
  /**
   * 鏇存柊
  * @protected
  */
  onUpdate : function(e){
    this.updateItem(e.record);
  },
  /**
  * 鏈湴鎺掑簭
  * @protected
  */
  onLocalSort : function(e){
    if(this.get('frontSortable')){
      this.sort(e.field ,e.direction);
    }else{
      this.onLoad(e);
    }
  },
  /**
   * 鍔犺浇鏁版嵁
   * @protected
   */
  onLoad:function(){
    var _self = this,
      store = _self.get('store'),
      items = store.getResult();
    _self.set('items',items);
  },
  /**
   * 杩囨护鏁版嵁
   * @protected
   */
  onFiltered: function(e){
    var _self = this,
      items = e.data;
    _self.set('items', items);
  }
},{
  ATTRS : 

  {

    /**
     * 鎺掑簭鐨勬椂鍊欐槸鍚︾洿鎺ヨ繘琛孌OM鐨勬帓搴忥紝涓嶉噸鏂扮敓鎴怐OM锛�<br>
     * 鍦ㄥ彲灞曞紑鐨勮〃鏍兼彃浠讹紝TreeGrid绛夋帶浠朵腑涓嶈浣跨敤姝ゅ睘鎬�
     * @type {Boolean}
     * cfg {Boolean} frontSortable
     */
    frontSortable : {
      value : false
    },
    focusable : {
      value : false
    },
    /**
     * 閫夐」闆嗗悎
     * @protected
     * @type {Array}
     */
    items : {
      view:true,
      value : []
    },
    /**
     * 閫夐」鐨勬牱寮忥紝鐢ㄦ潵鑾峰彇瀛愰」
     * <pre><code>
     * var list = new List.SimpleList({
     *   render : '#t1',
     *   itemCls : 'my-item', //鑷畾涔夋牱寮忓悕绉�
     *   items : [{id : '1',text : '1',type : '0'},{id : '2',text : '2',type : '1'}]
     * });
     * list.render();
     * </code></pre>
     * @cfg {Object} [itemCl='list-item']
     */
    itemCls : {
      view:true,
      value : CLS_ITEM
    },
    /**
     * 閫夐」鐨勯粯璁d瀛楁
     * <pre><code>
     * var list = new List.SimpleList({
     *   render : '#t1',
     *   idField : 'id', //鑷畾涔夐€夐」 id 瀛楁
     *   items : [{id : '1',text : '1',type : '0'},{id : '2',text : '2',type : '1'}]
     * });
     * list.render();
     *
     * list.getItem('1'); //浣跨敤idField鎸囧畾鐨勫瓧娈佃繘琛屾煡鎵�
     * </code></pre>
     * @cfg {String} [idField = 'value']
     */
    idField : {
      value : 'value'
    },
    /**
     * 鍒楄〃鐨勯€夋嫨鍣紝灏嗗垪琛ㄩ」闄勫姞鍒版鑺傜偣
     * @protected
     * @type {Object}
     */
    listSelector:{
      view:true,
      value:'ul'
    },
    /**
     * 鍒楄〃椤圭殑榛樿妯℃澘銆�
     *<pre><code>
     * var list = new List.SimpleList({
     *   itemTpl : '&lt;li id="{value}"&gt;{text}&lt;/li&gt;', //鍒楄〃椤圭殑妯℃澘
     *   idField : 'value',
     *   render : '#t1',
     *   items : [{value : '1',text : '1'},{value : '2',text : '2'}]
     * });
     * list.render();
     * </code></pre>
     * @cfg {String} [itemTpl ='&lt;li role="option" class="bui-list-item" data-value="{value}"&gt;{text}&lt;/li&gt;']
     */
    
    itemTpl :{
      view : true,
      value : '<li role="option" class="' + CLS_ITEM + '">{text}</li>'
    },
    tpl : {
      value:'<ul></ul>'
    },
    xview:{
      value : simpleListView
    }
  }
},{
  xclass : 'simple-list',
  prority : 0
});

simpleList.View = simpleListView;

module.exports = simpleList;

});
define("bui/list/domlist", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 浣跨敤DOM鍏冪礌浣滀负閫夐」鐨勬墿灞曠被
 * @author dxq613@gmail.com
 * @ignore
 */

'use strict';

var $ = require("jquery"),
  BUI = require("bui/common"),
  Selection = BUI.Component.UIBase.Selection,
  FIELD_PREFIX = 'data-',
  List = BUI.Component.UIBase.List;

function getItemStatusCls(name ,self) {
  var _self = self,
    itemCls = _self.get('itemCls'),
    itemStatusCls = _self.get('itemStatusCls');

  if(itemStatusCls && itemStatusCls[name]){
    return itemStatusCls[name];
  }
  return itemCls + '-' + name;
}

/**
 * 閫夐」鏄疍OM鐨勫垪琛ㄧ殑瑙嗗浘绫�
 * @private
 * @class BUI.List.DomList.View
 */
var domListView = function(){

};

domListView.ATTRS = {
  items : {}
};

domListView.prototype = {
  /**
   * @protected
   * 娓呴櫎鑰呭垪琛ㄩ」鐨凞OM
   */
  clearControl : function(){
    var _self = this,
      listEl = _self.getItemContainer(),
      itemCls = _self.get('itemCls');
    listEl.find('.'+itemCls).remove();
  },
  /**
   * 娣诲姞閫夐」
   * @param {Object} item  閫夐」鍊�
   * @param {Number} index 绱㈠紩
   */
  addItem : function(item,index){
    return this._createItem(item,index);
  },
  /**
   * 鑾峰彇鎵€鏈夌殑璁板綍
   * @return {Array} 璁板綍闆嗗悎
   */
  getItems : function(){
    var _self = this,
      elements = _self.getAllElements(),
      rst = [];
    BUI.each(elements,function(elem){
      rst.push(_self.getItemByElement(elem));
    });
    return rst;
  },
  /**
   * 鏇存柊鍒楄〃椤�
   * @param  {Object} item 閫夐」鍊�
   * @ignore
   */
  updateItem : function(item){
    var _self = this, 
      items = _self.getItems(),
      index = BUI.Array.indexOf(item,items),
      element = null,
      tpl;
    if(index >=0 ){
      element = _self.findElement(item);
      tpl = _self.getItemTpl(item,index);
      if(element){
        $(element).html($(tpl).html());
      }
    }
    return element;
  },
  /**
   * 绉婚櫎閫夐」
   * @param  {jQuery} element
   * @ignore
   */
  removeItem:function(item,element){
    element = element || this.findElement(item);
    $(element).remove();
  },
  /**
   * 鑾峰彇鍒楄〃椤圭殑瀹瑰櫒
   * @return {jQuery} 鍒楄〃椤瑰鍣�
   * @protected
   */
  getItemContainer : function  () {
    var container = this.get('itemContainer');
    if(container.length){
      return container;
    }
    return this.get('el');
  },
  /**
   * 鑾峰彇璁板綍鐨勬ā鏉�,itemTpl 鍜� 鏁版嵁item 鍚堝苟浜х敓鐨勬ā鏉�
   * @protected 
   */
  getItemTpl : function  (item,index) {
    var _self = this,
      render = _self.get('itemTplRender'),
      itemTpl = _self.get('itemTpl');  
    if(render){
      return render(item,index);
    }
    
    return BUI.substitute(itemTpl,item);
  },
  //鍒涘缓椤�
  _createItem : function(item,index){
    var _self = this,
      listEl = _self.getItemContainer(),
      itemCls = _self.get('itemCls'),
      dataField = _self.get('dataField'),
      tpl = _self.getItemTpl(item,index),
      node = $(tpl);
    if(index !== undefined){
      var target = listEl.find('.'+itemCls)[index];
      if(target){
        node.insertBefore(target);
      }else{
        node.appendTo(listEl);
      }
    }else{
      node.appendTo(listEl);
    }
    node.addClass(itemCls);
    node.data(dataField,item);
    return node;
  },
  /**
   * 鑾峰彇鍒楄〃椤瑰搴旂姸鎬佺殑鏍峰紡
   * @param  {String} name 鐘舵€佸悕绉�
   * @return {String} 鐘舵€佺殑鏍峰紡
   */
  getItemStatusCls : function(name){
    return getItemStatusCls(name,this);
  },
  /**
   * 璁剧疆鍒楄〃椤归€変腑
   * @protected
   * @param {*} name 鐘舵€佸悕绉�
   * @param {HTMLElement} element DOM缁撴瀯
   * @param {Boolean} value 璁剧疆鎴栧彇娑堟鐘舵€�
   */
  setItemStatusCls : function(name,element,value){
    var _self = this,
      cls = _self.getItemStatusCls(name),
      method = value ? 'addClass' : 'removeClass';
    if(element){
      $(element)[method](cls);
    }
  },
  /**
   * 鏄惁鏈夋煇涓姸鎬�
   * @param {*} name 鐘舵€佸悕绉�
   * @param {HTMLElement} element DOM缁撴瀯
   * @return {Boolean} 鏄惁鍏锋湁鐘舵€�
   */
  hasStatus : function(name,element){
    var _self = this,
      cls = _self.getItemStatusCls(name);
    return $(element).hasClass(cls);
  },
  /**
   * 璁剧疆鍒楄〃椤归€変腑
   * @param {*} item   璁板綍
   * @param {Boolean} selected 鏄惁閫変腑
   * @param {HTMLElement} element DOM缁撴瀯
   */
  setItemSelected: function(item,selected,element){
    var _self = this;

    element = element || _self.findElement(item);
    _self.setItemStatusCls('selected',element,selected);
  },
  /**
   * 鑾峰彇鎵€鏈夊垪琛ㄩ」鐨凞OM缁撴瀯
   * @return {Array} DOM鍒楄〃
   */
  getAllElements : function(){
    var _self = this,
      itemCls = _self.get('itemCls'),
      el = _self.get('el');
    return el.find('.' + itemCls);
  },
  /**
   * 鑾峰彇DOM缁撴瀯涓殑鏁版嵁
   * @param {HTMLElement} element DOM 缁撴瀯
   * @return {Object} 璇ラ」瀵瑰簲鐨勫€�
   */
  getItemByElement : function(element){
    var _self = this,
      dataField = _self.get('dataField');
    return $(element).data(dataField);
  },
  /**
   * 鏍规嵁鐘舵€佽幏鍙栫涓€涓狣OM 鑺傜偣
   * @param {String} name 鐘舵€佸悕绉�
   * @return {HTMLElement} Dom 鑺傜偣
   */
  getFirstElementByStatus : function(name){
    var _self = this,
      cls = _self.getItemStatusCls(name),
      el = _self.get('el');
    return el.find('.' + cls)[0];
  },
  /**
   * 鏍规嵁鐘舵€佽幏鍙朌OM
   * @return {Array} DOM鏁扮粍
   */
  getElementsByStatus : function(status){
    var _self = this,
      cls = _self.getItemStatusCls(status),
      el = _self.get('el');
    return el.find('.' + cls);
  },
  /**
   * 閫氳繃鏍峰紡鏌ユ壘DOM鍏冪礌
   * @param {String} css鏍峰紡
   * @return {jQuery} DOM鍏冪礌鐨勬暟缁勫璞�
   */
  getSelectedElements : function(){
    var _self = this,
      cls = _self.getItemStatusCls('selected'),
      el = _self.get('el');
    return el.find('.' + cls);
  },
  /**
   * 鏌ユ壘鎸囧畾鐨勯」鐨凞OM缁撴瀯
   * @param  {Object} item 
   * @return {HTMLElement} element
   */
  findElement : function(item){
    var _self = this,
      elements = _self.getAllElements(),
      result = null;

    BUI.each(elements,function(element){
      if(_self.getItemByElement(element) == item){
          result = element;
          return false;
      }
    });
    return result;
  },
  /**
   * 鍒楄〃椤规槸鍚﹂€変腑
   * @param  {HTMLElement}  element 鏄惁閫変腑
   * @return {Boolean}  鏄惁閫変腑
   */
  isElementSelected : function(element){
    var _self = this,
      cls = _self.getItemStatusCls('selected');
    return element && $(element).hasClass(cls);
  }
};

//杞崲鎴怬bject
function parseItem(element,self){
  var attrs = element.attributes,
    itemStatusFields = self.get('itemStatusFields'),
    item = {};

  BUI.each(attrs,function(attr){
    var name = attr.nodeName;
    if(name.indexOf(FIELD_PREFIX) !== -1){
      name = name.replace(FIELD_PREFIX,'');
      item[name] = attr.nodeValue;
    }
  });
  item.text = $(element).text();
  //鑾峰彇鐘舵€佸搴旂殑鍊�
  BUI.each(itemStatusFields,function(v,k){
    var cls = getItemStatusCls(k,self);
    if($(element).hasClass(cls)){
      item[v] = true;
    }
  });
  return item;
}

/**
 * @class BUI.List.DomList
 * 閫夐」鏄疍OM缁撴瀯鐨勫垪琛�
 * @extends BUI.Component.UIBase.List
 * @mixins BUI.Component.UIBase.Selection
 */
var domList = function(){

};

domList.ATTRS =BUI.merge(true,List.ATTRS,Selection.ATTRS,{

  /**
   * 鍦―OM鑺傜偣涓婂瓨鍌ㄦ暟鎹殑瀛楁
   * @type {String}
   * @protected
   */
  dataField : {
      view:true,
      value:'data-item'
  },
  /**
   * 閫夐」鎵€鍦ㄥ鍣紝濡傛灉鏈瀹氾紝浣跨敤 el
   * @type {jQuery}
   * @protected
   */
  itemContainer : {
      view : true
  },
  /**
   * 閫夐」鐘舵€佸搴旂殑閫夐」鍊�
   * 
   *   - 姝ゅ瓧娈电敤浜庡皢閫夐」璁板綍鐨勫€艰窡鏄剧ず鐨凞OM鐘舵€佺浉瀵瑰簲
   *   - 渚嬪锛氫笅闈㈣褰曚腑 <code> checked : true </code>锛屽彲浠ヤ娇寰楁璁板綍瀵瑰簲鐨凞OM涓婂簲鐢ㄥ搴旂殑鐘舵€�(榛樿涓� 'list-item-checked')
   *     <pre><code>{id : '1',text : 1,checked : true}</code></pre>
   *   - 褰撴洿鏀笵OM鐨勭姸鎬佹椂锛岃褰曚腑瀵瑰簲鐨勫瓧娈靛睘鎬т篃浼氳窡鐫€鍙樺寲
   * <pre><code>
   *   var list = new List.SimpleList({
   *   render : '#t1',
   *   idField : 'id', //鑷畾涔夋牱寮忓悕绉�
   *   itemStatusFields : {
   *     checked : 'checked',
   *     disabled : 'disabled'
   *   },
   *   items : [{id : '1',text : '1',checked : true},{id : '2',text : '2',disabled : true}]
   * });
   * list.render(); //鍒楄〃娓叉煋鍚庯紝浼氳嚜鍔ㄥ甫鏈塩hecked,鍜宒isabled瀵瑰簲鐨勬牱寮�
   *
   * var item = list.getItem('1');
   * list.hasStatus(item,'checked'); //true
   *
   * list.setItemStatus(item,'checked',false);
   * list.hasStatus(item,'checked');  //false
   * item.checked;                    //false
   * 
   * </code></pre>
   * ** 娉ㄦ剰 **
   * 姝ゅ瓧娈佃窡 {@link #itemStatusCls} 涓€璧蜂娇鐢ㄦ晥鏋滄洿濂斤紝鍙互鑷畾涔夊搴旂姸鎬佺殑鏍峰紡
   * @cfg {Object} itemStatusFields
   */
  itemStatusFields : {
    value : {}
  },
  /**
   * 椤圭殑鏍峰紡锛岀敤鏉ヨ幏鍙栧瓙椤�
   * @cfg {Object} itemCls
   */
  itemCls : {
    view : true
  }, 
  /**
   * 鏄惁鍏佽鍙栨秷閫変腑锛屽湪澶氶€夋儏鍐典笅榛樿鍏佽鍙栨秷锛屽崟閫夋儏鍐典笅涓嶅厑璁稿彇娑�,娉ㄦ剰姝ゅ睘鎬у彧鏈夊崟閫夋儏鍐典笅鐢熸晥
   * @type {Boolean}
   */
  cancelSelected : {
    value : false
  },   
  /**
   * 鑾峰彇椤圭殑鏂囨湰锛岄粯璁よ幏鍙栨樉绀虹殑鏂囨湰
   * @type {Object}
   * @protected
   */
  textGetter : {

  },
  /**
   * 榛樿鐨勫姞杞芥帶浠跺唴瀹圭殑閰嶇疆,榛樿鍊硷細
   * <pre>
   *  {
   *   property : 'items',
   *   dataType : 'json'
   * }
   * </pre>
   * @type {Object}
   */
  defaultLoaderCfg  : {
    value : {
      property : 'items',
      dataType : 'json'
    }
  },
  events : {
    value : {
      /**
       * 閫夐」瀵瑰簲鐨凞OM鍒涘缓瀹屾瘯
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 娓叉煋DOM瀵瑰簲鐨勯€夐」
       * @param {HTMLElement} e.element 娓叉煋鐨凞OM瀵硅薄
       */
      'itemrendered' : true,
      /**
       * @event
       * 鍒犻櫎閫夐」
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 鍒犻櫎DOM瀵瑰簲鐨勯€夐」
       * @param {HTMLElement} e.element 鍒犻櫎鐨凞OM瀵硅薄
       */
      'itemremoved' : true,
      /**
       * @event
       * 鏇存柊閫夐」
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.item 鏇存柊DOM瀵瑰簲鐨勯€夐」
       * @param {HTMLElement} e.element 鏇存柊鐨凞OM瀵硅薄
       */
      'itemupdated' : true,
      /**
      * 璁剧疆璁板綍鏃讹紝鎵€鏈夌殑璁板綍鏄剧ず瀹屾瘯鍚庤Е鍙�
      * @event
      */
      'itemsshow' : false,
      /**
      * 璁剧疆璁板綍鍚庯紝鎵€鏈夌殑璁板綍鏄剧ず鍓嶈Е鍙�
      * @event:
      */
      'beforeitemsshow' : false,
      /**
      * 娓呯┖鎵€鏈夎褰曪紝DOM娓呯悊瀹屾垚鍚�
      * @event
      */
      'itemsclear' : false,
      /**
       * 鍙屽嚮鏄Е鍙�
      * @event
      * @param {Object} e 浜嬩欢瀵硅薄
      * @param {Object} e.item DOM瀵瑰簲鐨勯€夐」
      * @param {HTMLElement} e.element 閫夐」鐨凞OM瀵硅薄
      * @param {HTMLElement} e.domTarget 鐐瑰嚮鐨勫厓绱�
      */
      'itemdblclick' : false,
      /**
      * 娓呯┖鎵€鏈塂om鍓嶈Е鍙�
      * @event
      */
      'beforeitemsclear' : false
       
    } 
  }
});

domList.PARSER = {
  items : function(el){
    var _self = this,
      rst = [],
      itemCls = _self.get('itemCls'),
      dataField = _self.get('dataField'),
      elements = el.find('.' + itemCls);
    if(!elements.length){
      elements = el.children();
      elements.addClass(itemCls);
    }
    BUI.each(elements,function(element){
      var item = parseItem(element,_self);
      rst.push(item);
      $(element).data(dataField,item);
    });
    //_self.setInternal('items',rst);
    return rst;
  }
};

BUI.augment(domList,List,Selection,{
   
  //璁剧疆璁板綍
  _uiSetItems : function (items) {
    var _self = this;
    //浣跨敤srcNode 鐨勬柟寮忥紝涓嶅悓姝�
    if(_self.get('srcNode') && !_self.get('rendered')){
      return;
    }
    this.setItems(items);
  },
  __bindUI : function(){
    var _self = this,
      selectedEvent = _self.get('selectedEvent'),
      itemCls = _self.get('itemCls'),
      itemContainer = _self.get('view').getItemContainer();

    itemContainer.delegate('.'+itemCls,'click',function(ev){
      if(_self.get('disabled')){ //鎺т欢绂佺敤鍚庯紝闃绘浜嬩欢
        return;
      }
      var itemEl = $(ev.currentTarget),
        item = _self.getItemByElement(itemEl);
      if(_self.isItemDisabled(item,itemEl)){ //绂佺敤鐘舵€佷笅闃绘閫変腑
        return;
      }
      var rst = _self.fire('itemclick',{item:item,element : itemEl[0],domTarget:ev.target,domEvent : ev});
      if(rst !== false && selectedEvent == 'click' && _self.isItemSelectable(item)){
        setItemSelectedStatus(item,itemEl); 
      }
    });
    if(selectedEvent !== 'click'){ //濡傛灉閫変腑浜嬩欢涓嶇瓑浜巆lick锛屽垯杩涜鐩戝惉閫変腑
      itemContainer.delegate('.'+itemCls,selectedEvent,function(ev){
        if(_self.get('disabled')){ //鎺т欢绂佺敤鍚庯紝闃绘浜嬩欢
          return;
        }
        var itemEl = $(ev.currentTarget),
          item = _self.getItemByElement(itemEl);
        if(_self.isItemDisabled(item,itemEl)){ //绂佺敤鐘舵€佷笅闃绘閫変腑
          return;
        }
        if(_self.isItemSelectable(item)){
          setItemSelectedStatus(item,itemEl); 
        }
        
      });
    }

    itemContainer.delegate('.' + itemCls,'dblclick',function(ev){
      if(_self.get('disabled')){ //鎺т欢绂佺敤鍚庯紝闃绘浜嬩欢
        return;
      }
      var itemEl = $(ev.currentTarget),
        item = _self.getItemByElement(itemEl);
      if(_self.isItemDisabled(item,itemEl)){ //绂佺敤鐘舵€佷笅闃绘閫変腑
        return;
      }
      _self.fire('itemdblclick',{item:item,element : itemEl[0],domTarget:ev.target});
    });
    
    function setItemSelectedStatus(item,itemEl){
      var multipleSelect = _self.get('multipleSelect'),
        isSelected;
      isSelected = _self.isItemSelected(item,itemEl);
      if(!isSelected){
        if(!multipleSelect){
          _self.clearSelected();
        }
        _self.setItemSelected(item,true,itemEl);
      }else if(multipleSelect){
        _self.setItemSelected(item,false,itemEl);
      }else if(_self.get('cancelSelected')){
        _self.setSelected(null); //閫変腑绌鸿褰�
      }      
    }
    _self.on('itemrendered itemupdated',function(ev){
      var item = ev.item,
        element = ev.element;
      _self._syncItemStatus(item,element);
    });
  },
  //鑾峰彇鍊硷紝閫氳繃瀛楁
  getValueByField : function(item,field){
    return item && item[field];
  }, 
  //鍚屾閫夐」鐘舵€�
  _syncItemStatus : function(item,element){
    var _self = this,
      itemStatusFields = _self.get('itemStatusFields');
    BUI.each(itemStatusFields,function(v,k){
      if(item[v] != null){
        _self.get('view').setItemStatusCls(k,element,item[v]);
      }
    });
  },
  /**
   * @protected
   * 鑾峰彇璁板綍涓殑鐘舵€佸€硷紝鏈畾涔夊垯涓簎ndefined
   * @param  {Object} item  璁板綍
   * @param  {String} status 鐘舵€佸悕
   * @return {Boolean|undefined}  
   */
  getStatusValue : function(item,status){
    var _self = this,
      itemStatusFields = _self.get('itemStatusFields'),
      field = itemStatusFields[status];
    return item[field];
  },
  /**
   * 鑾峰彇閫夐」鏁伴噺
   * @return {Number} 閫夐」鏁伴噺
   */
  getCount : function(){
    var items = this.getItems();
    return items ? items.length : 0;
  },
  /**
   * 鏇存敼鐘舵€佸€煎搴旂殑瀛楁
   * @protected
   * @param  {String} status 鐘舵€佸悕
   * @return {String} 鐘舵€佸搴旂殑瀛楁
   */
  getStatusField : function(status){
    var _self = this,
      itemStatusFields = _self.get('itemStatusFields');
    return itemStatusFields[status];
  },
  /**
   * 璁剧疆璁板綍鐘舵€佸€�
   * @protected
   * @param  {Object} item  璁板綍
   * @param  {String} status 鐘舵€佸悕
   * @param {Boolean} value 鐘舵€佸€�
   */
  setStatusValue : function(item,status,value){
    var _self = this,
      itemStatusFields = _self.get('itemStatusFields'),
      field = itemStatusFields[status];
    if(field){
      item[field] = value;
    }
  },
  /**
   * @ignore
   * 鑾峰彇閫夐」鏂囨湰
   */
  getItemText : function(item){
    var _self = this,
        textGetter = _self.get('textGetter');
    if(!item)
    {
        return '';
    }
    if(textGetter){
      return textGetter(item);
    }else{
      return $(_self.findElement(item)).text();
    }
  },
  /**
   * 鍒犻櫎椤�
   * @param  {Object} item 閫夐」璁板綍
   * @ignore
   */
  removeItem : function (item) {
    var _self = this,
      items = _self.get('items'),
      element = _self.findElement(item),
      index;
    index = BUI.Array.indexOf(item,items);
    if(index !== -1){
      items.splice(index, 1);
    }
    _self.get('view').removeItem(item,element);
    _self.fire('itemremoved',{item:item,domTarget: $(element)[0],element : element});
  },
  /**
   * 鍦ㄦ寚瀹氫綅缃坊鍔犻€夐」,閫夐」鍊间负涓€涓璞�
   * @param {Object} item 閫夐」
   * @param {Number} index 绱㈠紩
   * @ignore
   */
  addItemAt : function(item,index) {
    var _self = this,
      items = _self.get('items');
    if(index === undefined) {
        index = items.length;
    }
    items.splice(index, 0, item);
    _self.addItemToView(item,index);
    return item;
  }, 
  /**
   * @protected
   * 鐩存帴鍦╒iew涓婃樉绀�
   * @param {Object} item 閫夐」
   * @param {Number} index 绱㈠紩
   * 
   */
  addItemToView : function(item,index){
    var _self = this,
      element = _self.get('view').addItem(item,index);
    _self.fire('itemrendered',{item:item,domTarget : $(element)[0],element : element});
    return element;
  },
  /**
   * 鏇存柊鍒楄〃椤�
   * @param  {Object} item 閫夐」鍊�
   * @ignore
   */
  updateItem : function(item){
    var _self = this,
      element =  _self.get('view').updateItem(item);
    _self.fire('itemupdated',{item : item,domTarget : $(element)[0],element : element});
  },
  /**
   * 璁剧疆鍒楄〃璁板綍
   * <pre><code>
   *   list.setItems(items);
   *   //绛夊悓 
   *   list.set('items',items);
   * </code></pre>
   * @param {Array} items 鍒楄〃璁板綍
   */
  setItems : function(items){
    var _self = this;
    if(items != _self.getItems()){
      _self.setInternal('items',items);
    }
    //娓呯悊瀛愭帶浠�
    _self.clearControl();
    _self.fire('beforeitemsshow');
    BUI.each(items,function(item,index){
      _self.addItemToView(item,index);
    });
    _self.fire('itemsshow');
  },
  /**
   * 鑾峰彇鎵€鏈夐€夐」
   * @return {Array} 閫夐」闆嗗悎
   * @override
   * @ignore
   */
  getItems : function () {
    
    return this.get('items');
  },
   /**
   * 鑾峰彇DOM缁撴瀯涓殑鏁版嵁
   * @protected
   * @param {HTMLElement} element DOM 缁撴瀯
   * @return {Object} 璇ラ」瀵瑰簲鐨勫€�
   */
  getItemByElement : function(element){
    return this.get('view').getItemByElement(element);
  },
  /**
   * 鑾峰彇閫変腑鐨勭涓€椤�,
   * <pre><code>
   * var item = list.getSelected(); //澶氶€夋ā寮忎笅绗竴鏉�
   * </code></pre>
   * @return {Object} 閫変腑鐨勭涓€椤规垨鑰呬负null
   */
  getSelected : function(){ //this.getSelection()[0] 鐨勬柟寮忔晥鐜囧お浣�
    var _self = this,
      element = _self.get('view').getFirstElementByStatus('selected');
      return _self.getItemByElement(element) || null;
  },
  /**
   * 鏍规嵁鐘舵€佽幏鍙栭€夐」
   * <pre><code>
   *   //璁剧疆鐘舵€�
   *   list.setItemStatus(item,'active');
   *   
   *   //鑾峰彇'active'鐘舵€佺殑閫夐」
   *   list.getItemsByStatus('active');
   * </code></pre>
   * @param  {String} status 鐘舵€佸悕
   * @return {Array}  閫夐」缁勯泦鍚�
   */
  getItemsByStatus : function(status){
    var _self = this,
      elements = _self.get('view').getElementsByStatus(status),
      rst = [];
    BUI.each(elements,function(element){
      rst.push(_self.getItemByElement(element));
    });
    return rst;
  },
  /**
   * 鏌ユ壘鎸囧畾鐨勯」鐨凞OM缁撴瀯
   * <pre><code>
   *   var item = list.getItem('2'); //鑾峰彇閫夐」
   *   var element = list.findElement(item);
   *   $(element).addClass('xxx');
   * </code></pre>
   * @param  {Object} item 
   * @return {HTMLElement} element
   */
  findElement : function(item){
    var _self = this;
    if(BUI.isString(item)){
      item = _self.getItem(item);
    }
    return this.get('view').findElement(item);
  },
  findItemByField : function(field,value){
    var _self = this,
      items = _self.get('items'),
      result = null;
    BUI.each(items,function(item){
      if(item[field] != null && item[field] == value){//浼氬嚭鐜癴alse == '','0' == false鐨勬儏鍐�
          result = item;
          return false;
      }
    });

    return result;
  },
  /**
   * @override
   * @ignore
   */
  setItemSelectedStatus : function(item,selected,element){
    var _self = this;
    element = element || _self.findElement(item);
    //_self.get('view').setItemSelected(item,selected,element);
    _self.setItemStatus(item,'selected',selected,element);
    //_self.afterSelected(item,selected,element);
  },
  /**
   * 璁剧疆鎵€鏈夐€夐」閫変腑
   * @ignore
   */
  setAllSelection : function(){
    var _self = this,
      items = _self.getItems();
    _self.setSelection(items);
  },
  /**
   * 閫夐」鏄惁琚€変腑
   * <pre><code>
   *   var item = list.getItem('2');
   *   if(list.isItemSelected(item)){
   *     //do something
   *   }
   * </code></pre>
   * @override
   * @param  {Object}  item 閫夐」
   * @return {Boolean}  鏄惁閫変腑
   */
  isItemSelected : function(item,element){
    var _self = this;
    element = element || _self.findElement(item);

    return _self.get('view').isElementSelected(element);
  },
  /**
   * 鏄惁閫夐」琚鐢�
   * <pre><code>
   * var item = list.getItem('2');
   * if(list.isItemDisabled(item)){ //濡傛灉閫夐」绂佺敤
   *   //do something
   * }
   * </code></pre>
   * @param {Object} item 閫夐」
   * @return {Boolean} 閫夐」鏄惁绂佺敤
   */
  isItemDisabled : function(item,element){
    return this.hasStatus(item,'disabled',element);
  },
  /**
   * 璁剧疆閫夐」绂佺敤
   * <pre><code>
   * var item = list.getItem('2');
   * list.setItemDisabled(item,true);//璁剧疆閫夐」绂佺敤锛屼細鍦―OM涓婃坊鍔� itemCls + 'disabled'鐨勬牱寮�
   * list.setItemDisabled(item,false); //鍙栨秷绂佺敤锛屽彲浠ョ敤{@link #itemStatusCls} 鏉ユ浛鎹㈡牱寮�
   * </code></pre>
   * @param {Object} item 閫夐」
   */
  setItemDisabled : function(item,disabled){
    
    var _self = this;
    /*if(disabled){
      //娓呴櫎閫夋嫨
      _self.setItemSelected(item,false);
    }*/
    _self.setItemStatus(item,'disabled',disabled);
  },
  /**
   * 鑾峰彇閫変腑鐨勯」鐨勫€�
   * @override
   * @return {Array} 
   * @ignore
   */
  getSelection : function(){
    var _self = this,
      elements = _self.get('view').getSelectedElements(),
      rst = [];
    BUI.each(elements,function(elem){
      rst.push(_self.getItemByElement(elem));
    });
    return rst;
  },
  /**
   * @protected
   * @override
   * 娓呴櫎鑰呭垪琛ㄩ」鐨凞OM
   */
  clearControl : function(){
    this.fire('beforeitemsclear');
    this.get('view').clearControl();
    this.fire('itemsclear');
  },
  /**
   * 閫夐」鏄惁瀛樺湪鏌愮鐘舵€�
   * <pre><code>
   * var item = list.getItem('2');
   * list.setItemStatus(item,'active',true);
   * list.hasStatus(item,'active'); //true
   *
   * list.setItemStatus(item,'active',false);
   * list.hasStatus(item,'false'); //true
   * </code></pre>
   * @param {*} item 閫夐」
   * @param {String} status 鐘舵€佸悕绉帮紝濡俿elected,hover,open绛夌瓑
   * @param {HTMLElement} [element] 閫夐」瀵瑰簲鐨凞om锛屾斁缃弽澶嶆煡鎵�
   * @return {Boolean} 鏄惁鍏锋湁鏌愮鐘舵€�
   */
  hasStatus : function(item,status,element){
    if(!item){
      return false;
    }
    var _self = this,
      field = _self.getStatusField(status);
    /*if(field){
      return _self.getStatusValue(item,status);
    }*/
    element = element || _self.findElement(item);
    return _self.get('view').hasStatus(status,element);
  },
  /**
   * 璁剧疆閫夐」鐘舵€�,鍙互璁剧疆浠讳綍鑷畾涔夌姸鎬�
   * <pre><code>
   * var item = list.getItem('2');
   * list.setItemStatus(item,'active',true);
   * list.hasStatus(item,'active'); //true
   *
   * list.setItemStatus(item,'active',false);
   * list.hasStatus(item,'false'); //true
   * </code></pre>
   * @param {*} item 閫夐」
   * @param {String} status 鐘舵€佸悕绉�
   * @param {Boolean} value 鐘舵€佸€硷紝true,false
   * @param {HTMLElement} [element] 閫夐」瀵瑰簲鐨凞om锛屾斁缃弽澶嶆煡鎵�
   */
  setItemStatus : function(item,status,value,element){
    var _self = this;
    if(item){
      element = element || _self.findElement(item);
    }
    
    if(!_self.isItemDisabled(item,element) || status === 'disabled'){ //绂佺敤鍚庯紝闃绘娣诲姞浠讳綍鐘舵€佸彉鍖�
      if(item){
        if(status === 'disabled' && value){ //绂佺敤锛屽悓鏃舵竻鐞嗗叾浠栫姸鎬�
          _self.clearItemStatus(item);
        }
        _self.setStatusValue(item,status,value);
        _self.get('view').setItemStatusCls(status,element,value);
        _self.fire('itemstatuschange',{item : item,status : status,value : value,element : element});
      }
      
      if(status === 'selected'){ //澶勭悊閫変腑
        _self.afterSelected(item,value,element);
      }
    }
    
  },
  /**
   * 娓呴櫎鎵€鏈夐€夐」鐘舵€�,濡傛灉鎸囧畾娓呴櫎鐨勭姸鎬佸悕锛屽垯娓呴櫎鎸囧畾鐨勶紝鍚﹀垯娓呴櫎鎵€鏈夌姸鎬�
   * @param {Object} item 閫夐」
   */
  clearItemStatus : function(item,status,element){
    var _self = this,
      itemStatusFields = _self.get('itemStatusFields');
    element = element || _self.findElement(item);
      
    if(status){
      _self.setItemStatus(item,status,false,element);
    }else{
      BUI.each(itemStatusFields,function(v,k){
        _self.setItemStatus(item,k,false,element);
      });
      if(!itemStatusFields['selected']){
        _self.setItemSelected(item,false);
      }
      //绉婚櫎hover鐘舵€�
      _self.setItemStatus(item,'hover',false);
    }
    
  }
});

domList.View = domListView;

module.exports = domList;

});
define("bui/list/keynav", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鍒楄〃閫夐」锛屼娇鐢ㄩ敭鐩樺鑸�
 * @author dxq613@gmail.com
 * @ignore
 */

'use strict';
/**
 * @class BUI.List.KeyNav
 * 鍒楄〃瀵艰埅鎵╁睍绫�
 */
var $ = require("jquery"),
  BUI = require("bui/common"),
  KeyNav = function(){};

KeyNav.ATTRS = {
  /**
   * 閫夐」楂樹寒浣跨敤鐨勭姸鎬�,鏈変簺鍦烘櫙涓嬶紝浣跨敤selected鏇村悎閫�
   * @cfg {String} [highlightedStatus='hover']
   */
  highlightedStatus : {
    value : 'hover'
  }
};

BUI.augment(KeyNav,{

  /**
   * 璁剧疆閫夐」楂樹寒锛岄粯璁や娇鐢� 'hover' 鐘舵€�
   * @param  {Object} item 閫夐」
   * @param  {Boolean} value 鐘舵€佸€硷紝true,false
   * @protected
   */
  setHighlighted : function(item,element){
    if(this.hasStatus(item,'hover',element)){
      return;
    }
    var _self = this,
      highlightedStatus = _self.get('highlightedStatus'),
      lightedElement = _self._getHighLightedElement(),
      lightedItem = lightedElement ? _self.getItemByElement(lightedElement) : null;
    if(lightedItem !== item){
      if(lightedItem){
        this.setItemStatus(lightedItem,highlightedStatus,false,lightedElement);
      }
      this.setItemStatus(item,highlightedStatus,true,element);
      _self._scrollToItem(item,element);
    }
  },
  _getHighLightedElement : function(){
    var _self = this,
      highlightedStatus = _self.get('highlightedStatus'),
      element = _self.get('view').getFirstElementByStatus(highlightedStatus);
    return element;
  },
  /**
   * 鑾峰彇楂樹寒鐨勯€夐」
   * @return {Object} item
   * @protected
   */
  getHighlighted : function(){
    var _self = this,
      highlightedStatus = _self.get('highlightedStatus'),
      element = _self.get('view').getFirstElementByStatus(highlightedStatus);
    return _self.getItemByElement(element) || null;
  },
  /**
   * 鑾峰彇鍒楁暟
   * @return {Number} 閫夐」鐨勫垪鏁�,榛樿涓�1鍒�
   * @protected
   */
  getColumnCount : function(){
    var _self = this,
      firstItem = _self.getFirstItem(),
      element = _self.findElement(firstItem),
      node = $(element);
    if(element){
      return parseInt(node.parent().width() / node.outerWidth(),10);
    }
    return 1;
  },
  /**
   * 鑾峰彇閫夐」鐨勮鏁� 锛屾€绘暟/鍒楁暟 = list.getCount / column
   * @protected
   * @return {Number} 閫夐」琛屾暟
   */
  getRowCount : function(columns){
    var _self = this;
    columns = columns || _self.getColumnCount();
    return (this.getCount() + columns - 1) / columns;
  },
  _getNextItem : function(forward,skip,count){
    var _self = this,
      currentIndx = _self._getCurrentIndex(),//榛樿绗竴琛�
      itemCount = _self.getCount(),
      factor = forward ? 1 : -1,
      nextIndex; 
    if(currentIndx === -1){
      return forward ? _self.getFirstItem() : _self.getLastItem();
    }
    if(!forward){
      skip = skip * factor;
    }
    nextIndex = (currentIndx + skip + count) % count;
    if(nextIndex > itemCount - 1){ //濡傛灉浣嶇疆瓒呭嚭绱㈠紩浣嶇疆
      if(forward){
        nextIndex = nextIndex -  (itemCount - 1);
      }else{
        nextIndex = nextIndex + skip;
      }
      
    }
    return _self.getItemAt(nextIndex);
  },
  //鑾峰彇宸﹁竟涓€椤�
  _getLeftItem : function(){
    var _self = this,
      count = _self.getCount(),
      column = _self.getColumnCount();
    if(!count || column <= 1){ //鍗曞垪鏃�,鎴栬€呬负0鏃�
      return null;
    }
    return _self._getNextItem(false,1,count);
  },
  //鑾峰彇褰撳墠椤�
  _getCurrentItem : function(){
    return this.getHighlighted();
  },
  //鑾峰彇褰撳墠椤�
  _getCurrentIndex : function(){
    var _self = this,
      item = _self._getCurrentItem();
    return this.indexOfItem(item);
  },
  //鑾峰彇鍙宠竟涓€椤�
  _getRightItem : function(){
    var _self = this,
      count = _self.getCount(),
      column = _self.getColumnCount();
    if(!count || column <= 1){ //鍗曞垪鏃�,鎴栬€呬负0鏃�
      return null;
    }
    return this._getNextItem(true,1,count);
  },
  //鑾峰彇涓嬮潰涓€椤�
  _getDownItem : function(){
    var _self = this,
      columns = _self.getColumnCount(),
      rows = _self.getRowCount(columns);
    if(rows <= 1){ //鍗曡鎴栬€呬负0鏃�
      return null;
    }

    return  this._getNextItem(true,columns,columns * rows);

  },
  getScrollContainer : function(){
    return this.get('el');
  },
  /**
   * @protected
   * 鍙鐞嗕笂涓嬫粴鍔紝涓嶅鐞嗗乏鍙虫粴鍔�
   * @return {Boolean} 鏄惁鍙互涓婁笅婊氬姩
   */
  isScrollVertical : function(){
    var _self = this,
      el = _self.get('el'),
      container = _self.get('view').getItemContainer();

    return el.height() < container.height();
  },

  _scrollToItem : function(item,element){
    var _self = this;

    if(_self.isScrollVertical()){
      element = element || _self.findElement(item);
      var container = _self.getScrollContainer(),
        top = $(element).position().top,
        ctop = container.position().top,
        cHeight = container.height(),
        distance = top - ctop,
        height = $(element).height(),
        scrollTop = container.scrollTop();

      if(distance < 0 || distance > cHeight - height){
        container.scrollTop(scrollTop + distance);
      }

    }
  },
  //鑾峰彇涓婇潰涓€椤�
  _getUpperItem : function(){
    var _self = this,
      columns = _self.getColumnCount(),
      rows = _self.getRowCount(columns);
    if(rows <= 1){ //鍗曡鎴栬€呬负0鏃�
      return null;
    }
    return this._getNextItem(false,columns,columns * rows);
  },
  /**
   * 澶勭悊鍚戜笂瀵艰埅
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavUp : function (ev) {

    var _self = this,
      upperItem = _self._getUpperItem();
    _self.setHighlighted(upperItem);
  },
  /**
   * 澶勭悊鍚戜笅瀵艰埅
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavDown : function (ev) {
    
    this.setHighlighted(this._getDownItem());
  },
  /**
   * 澶勭悊鍚戝乏瀵艰埅
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavLeft : function (ev) {
    this.setHighlighted(this._getLeftItem());
  },
  
  /**
   * 澶勭悊鍚戝彸瀵艰埅
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavRight : function (ev) {
    this.setHighlighted(this._getRightItem());
  },
  /**
   * 澶勭悊纭閿�
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavEnter : function (ev) {
    var _self = this,
      current = _self._getCurrentItem(),
      element;
    if(current){
      element = _self.findElement(current);
      //_self.setSelected(current);
      $(element).trigger('click');
    }
  },
  /**
   * 澶勭悊 esc 閿�
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavEsc : function (ev) {
    this.setHighlighted(null); //绉婚櫎
  },
  /**
   * 澶勭悊Tab閿�
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavTab : function(ev){
    this.setHighlighted(this._getRightItem());
  }

});

module.exports = KeyNav;

});
define("bui/list/sortable", ["jquery","bui/common","bui/data"], function(require, exports, module){
/**
 * @fileOverview 鍒楄〃鎺掑簭
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  DataSortable = require("bui/data").Sortable;

/**
 * @class BUI.List.Sortable
 * 鍒楄〃鎺掑簭鐨勬墿灞�
 * @extends BUI.Data.Sortable
 */
var Sortable = function(){

};



Sortable.ATTRS = BUI.merge(true,DataSortable.ATTRS, {

});

BUI.augment(Sortable,DataSortable,{
  
  /**
   * @protected
   * @override
   * @ignore
   * 瑕嗗啓姣旇緝鏂规硶
   */
  compare : function(obj1,obj2,field,direction){
    var _self = this,
      dir;
    field = field || _self.get('sortField');
    direction = direction || _self.get('sortDirection');
    //濡傛灉鏈寚瀹氭帓搴忓瓧娈碉紝鎴栨柟鍚戯紝鍒欐寜鐓ч粯璁ら『搴�
    if(!field || !direction){
      return 1;
    }
    dir = direction === 'ASC' ? 1 : -1;
    if(!$.isPlainObject(obj1)){
      obj1 = _self.getItemByElement(obj1);
    }
    if(!$.isPlainObject(obj2)){
      obj2 = _self.getItemByElement(obj2);
    }

    return _self.get('compareFunction')(obj1[field],obj2[field]) * dir;
  },
  /**
   * 鑾峰彇鎺掑簭鐨勯泦鍚�
   * @protected
   * @return {Array} 鎺掑簭闆嗗悎
   */
  getSortData : function(){
    return $.makeArray(this.get('view').getAllElements());
  },
  /**
   * 鍒楄〃鎺掑簭
   * @param  {string} field  瀛楁鍚�
   * @param  {string} direction 鎺掑簭鏂瑰悜 ASC,DESC
   */
  sort : function(field,direction){
    var _self = this,
      sortedElements = _self.sortData(field,direction),
      itemContainer = _self.get('view').getItemContainer();
    if(!_self.get('store')){
      _self.sortData(field,direction,_self.get('items'));
    }
    BUI.each(sortedElements,function(el){
      $(el).appendTo(itemContainer);
    });
  }

});

module.exports = Sortable;

});
define("bui/list/listbox", ["jquery","bui/common","bui/data"], function(require, exports, module){
/**
 * @fileOverview 鍙€夋嫨鐨勫垪琛�
 * @author dengbin
 * @ignore
 */

var $ = require("jquery"),
  SimpleList = require("bui/list/simplelist");
/**
 * 鍒楄〃閫夋嫨妗�
 * @extends BUI.List.SimpleList
 * @class BUI.List.Listbox
 */
var listbox = SimpleList.extend({
  bindUI : function(){
  	var _self = this;
    
  	_self.on('selectedchange',function(e){
  		var item = e.item,
  			sender = $(e.domTarget),
  			checkbox =sender.find('input');
  		if(item){
  			checkbox.attr('checked',e.selected);
  		}
  	});
  }
},{
  ATTRS : {
    /**
     * 閫夐」妯℃澘
     * @override
     * @type {String}
     */
    itemTpl : {
      value : '<li><span class="x-checkbox"></span>{text}</li>'
    },
    /**
     * 閫夐」妯℃澘
     * @override
     * @type {Boolean}
     */
    multipleSelect : {
      value : true
    }
  }
},{
  xclass: 'listbox'
});

module.exports = listbox;

});

define("bui/menu", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 鑿滃崟鍛藉悕绌洪棿鍏ュ彛鏂囦欢
 * @ignore
 */

  var BUI = require("bui/common"),
    Menu = BUI.namespace('Menu');

  BUI.mix(Menu,{
    Menu : require("bui/menu/menu"),
    MenuItem : require("bui/menu/menuitem"),
    ContextMenu : require("bui/menu/contextmenu"),
    PopMenu : require("bui/menu/popmenu"),
    SideMenu : require("bui/menu/sidemenu")
  });

  Menu.ContextMenuItem = Menu.ContextMenu.Item;

  module.exports = Menu;

});
define("bui/menu/menu", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 鑿滃崟鍩虹被
 * @author dxq613@gmail.com
 * @ignore
 */


var BUI = require("bui/common"),
  Component =  BUI.Component,
  UIBase = Component.UIBase;

/**
 * 鑿滃崟
 * xclass:'menu'
 * <img src="../assets/img/class-menu.jpg"/>
 * @class BUI.Menu.Menu
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.ChildList
 */
var Menu = Component.Controller.extend([UIBase.ChildList],{
  /**
   * 缁戝畾浜嬩欢
   * @protected
   */
  bindUI:function(){
    var _self = this;

    _self.on('click',function(e){
      var item = e.target,
        multipleSelect = _self.get('multipleSelect');
      if(_self != item){
        //鍗曢€夋儏鍐典笅锛屽厑璁歌嚜鍔ㄩ殣钘忥紝涓旀病鏈夊瓙鑿滃崟鐨勬儏鍐典笅锛岃彍鍗曢殣钘�
        if(!multipleSelect && _self.get('clickHide') && !item.get('subMenu')){
          _self.getTopAutoHideMenu().hide();
        }
      }
    });

    _self.on('afterOpenChange',function (ev) {
      var target = ev.target,
        opened = ev.newVal,
        children = _self.get('children');
      if(opened){
        BUI.each(children,function(item) {
          if(item !== target && item.get('open')){
            item.set('open',false);
          }
        });
      }
    });

    _self.on('afterVisibleChange',function (ev) {
      var visible = ev.newVal,
        parent = _self.get('parentMenu');
      _self._clearOpen();
    });
  },
 
  //鐐瑰嚮鑷姩闅愯棌鏃�
  getTopAutoHideMenu : function() {
    var _self = this,
      parentMenu = _self.get('parentMenu'),
      topHideMenu;
    if(parentMenu && parentMenu.get('autoHide')){
      return parentMenu.getTopAutoHideMenu();
    }
    if(_self.get('autoHide')){
      return _self;
    }
    return null;
  },
  //娓呴櫎鑿滃崟椤圭殑婵€娲荤姸鎬�
  _clearOpen : function () {
    var _self = this,
      children = _self.get('children');
    BUI.each(children,function (item) {
      if(item.set){
        item.set('open',false);
      }
    });
  },
  /**
   * 鏍规嵁ID鏌ユ壘鑿滃崟椤�
   * @param  {String} id 缂栧彿
   * @return {BUI.Menu.MenuItem} 鑿滃崟椤�
   */
  findItemById : function(id){ 

    return this.findItemByField('id',id);
  },
  _uiSetSelectedItem : function(item){
    if(item){
      _self.setSelected(item);
    }
  }
},{
  ATTRS:
  {

    elTagName:{
      view : true,
      value : 'ul'
    },
	  idField:{
      value:'id'
    },
    
    /**
     * @protected
     * 鏄惁鏍规嵁DOM鐢熸垚瀛愭帶浠�
     * @type {Boolean}
     */
    isDecorateChild : {
      value : true
    },
    /**
     * 瀛愮被鐨勯粯璁ょ被鍚嶏紝鍗崇被鐨� xclass
     * @type {String}
     * @default 'menu-item'
     */
    defaultChildClass : {
      value : 'menu-item'
    },
    /**
     * 閫変腑鐨勮彍鍗曢」
     * @type {Object}
     */
    selectedItem : {

    },
    /**
     * 涓婁竴绾ц彍鍗�
     * @type {BUI.Menu.Menu}
     * @readOnly
     */
    parentMenu : {

    }
  }
  
},{
  xclass : 'menu',
  priority : 0
});

module.exports = Menu;

});
define("bui/menu/menuitem", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鑿滃崟椤�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Component =  BUI.Component,
  UIBase = Component.UIBase,
  PREFIX = BUI.prefix,
  CLS_OPEN = PREFIX + 'menu-item-open',
  CLS_CARET = 'x-caret',
  CLS_COLLAPSE = PREFIX + 'menu-item-collapsed',
  DATA_ID = 'data-id';

/**
 * @private
 * @class BUI.Menu.MenuItemView
 * @mixins BUI.Component.UIBase.ListItemView
 * @mixins BUI.Component.UIBase.CollapsableView
 * 鑿滃崟椤圭殑瑙嗗浘绫�
 */
var menuItemView = Component.View.extend([UIBase.ListItemView,UIBase.CollapsableView],{

  _uiSetOpen : function (v) {
    var _self = this,
      cls = _self.getStatusCls('open');
    if(v){
      _self.get('el').addClass(cls);
    }else{
      _self.get('el').removeClass(cls);
    }
  }
},{
  ATTRS : {
  }
},{
  xclass:'menu-item-view'
});

/**
 * 鑿滃崟椤�
 * @class BUI.Menu.MenuItem
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.ListItem
 */
var menuItem = Component.Controller.extend([UIBase.ListItem,UIBase.Collapsable],{
  /**
   * 娓叉煋
   * @protected
   */
  renderUI : function(){
    var _self = this,
      el = _self.get('el'),
      id = _self.get('id'),
      temp = null;
    //鏈缃甶d鏃惰嚜鍔ㄧ敓鎴�
    if(!id){
      id = BUI.guid('menu-item');
      _self.set('id',id);
    }
    el.attr(DATA_ID,id);   
  },
   /**
   * 澶勭悊榧犳爣绉诲叆
   * @protected
   */
  handleMouseEnter : function (ev) {
    var _self = this;

    if(this.get('subMenu') && this.get('openable')){
      this.set('open',true);
    }
    menuItem.superclass.handleMouseEnter.call(this,ev);
  },
  /**
   * 澶勭悊榧犳爣绉诲嚭
   * @protected
   */
  handleMouseLeave :function (ev) {
    if(this.get('openable')){
      var _self = this,
        subMenu = _self.get('subMenu'),
        toElement = ev.toElement || ev.relatedTarget;;
      if(toElement && subMenu && subMenu.containsElement(toElement)){
        _self.set('open',true);
      }else{
        _self.set('open',false);
      }
    }
    menuItem.superclass.handleMouseLeave.call(this,ev);
  },
  /**
   * 鑷繁鍜屽瓙鑿滃崟鏄惁鍖呭惈
   * @override
   */
  containsElement:function (elem) {
    var _self = this,
      subMenu,
      contains = menuItem.superclass.containsElement.call(_self,elem);
    if(!contains){
      subMenu = _self.get('subMenu');
      contains = subMenu && subMenu.containsElement(elem);
    }
    return contains;
  }, 
  //璁剧疆鎵撳紑瀛愯彍鍗� 
  _uiSetOpen : function (v) {
    if(this.get('openable')){
      var _self = this,
        subMenu = _self.get('subMenu'),
        subMenuAlign = _self.get('subMenuAlign');
      if(subMenu){
        if(v){
          subMenuAlign.node = _self.get('el');
          subMenu.set('align',subMenuAlign);
          subMenu.show();
        }else{
          var menuAlign = subMenu.get('align');
          //闃叉瀛愯彍鍗曡鍏敤鏃�
          if(!menuAlign || menuAlign.node == _self.get('el')){
            subMenu.hide();
          }
          
        }
      }
    }
  },
  //璁剧疆涓嬬骇鑿滃崟
  _uiSetSubMenu : function (subMenu) {
    if(subMenu){
      var _self = this,
        el = _self.get('el'),
        parent = _self.get('parent');
      //璁剧疆鑿滃崟椤规墍灞炵殑鑿滃崟涓轰笂涓€绾ц彍鍗�
      if(!subMenu.get('parentMenu')){
        subMenu.set('parentMenu',parent);
        if(parent.get('autoHide')){
          if(parent.get('autoHideType') == 'click'){
            subMenu.set('autoHide',false);
          }else{
            subMenu.set('autoHideType','leave');
          }
          
        } /**/
      }
      $(_self.get('arrowTpl')).appendTo(el);
    }
  },
  /** 
   * 鏋愭瀯鍑芥暟
   * @protected
   */
  destructor : function () {
    var _self = this,
      subMenu = _self.get('subMenu');
    if(subMenu){
      subMenu.destroy();
    }
  }

},{
  ATTRS : 
  {
    /**
     * 榛樿鐨凥tml 鏍囩
     * @type {String}
     */
    elTagName : {
        value: 'li'
    },
    xview : {
      value : menuItemView
    },
    /**
     * 鑿滃崟椤规槸鍚﹀睍寮€锛屾樉绀哄瓙鑿滃崟
     * @cfg {Boolean} [open=false]
     */
    /**
     * 鑿滃崟椤规槸鍚﹀睍寮€锛屾樉绀哄瓙鑿滃崟
     * @type {Boolean}
     * @default false
     */
    open :{
      view : true,
      value : false
    },
    /**
     * 鏄惁鍙互灞曞紑
     * @type {Boolean}
     */
    openable : {
      value : true
    },
    /**
     * 涓嬬骇鑿滃崟
     * @cfg {BUI.Menu.Menu} subMenu
     */
    /**
     * 涓嬬骇鑿滃崟
     * @type {BUI.Menu.Menu}
     */
    subMenu : {
      view : true
    },
     /**
     * 涓嬬骇鑿滃崟鍜岃彍鍗曢」鐨勫榻愭柟寮�
     * @type {Object}
     * @default 榛樿鍦ㄤ笅闈㈡樉绀�
     */
    subMenuAlign : {
      valueFn : function (argument) {
        return {
           //node: this.get('el'), // 鍙傝€冨厓绱�, falsy 鎴� window 涓哄彲瑙嗗尯鍩�, 'trigger' 涓鸿Е鍙戝厓绱�, 鍏朵粬涓烘寚瀹氬厓绱�
           points: ['tr','tl'], // ['tr', 'tl'] 琛ㄧず overlay 鐨� tl 涓庡弬鑰冭妭鐐圭殑 tr 瀵归綈
           offset: [-5, 0]      // 鏈夋晥鍊间负 [n, m]
        }
      }
    },
    /**
     * 褰撳瓨鍦ㄥ瓙鑿滃崟鏃剁殑绠ご妯＄増
     * @protected
     * @type {String}
     */
    arrowTpl : {
      value : '<span class="' + CLS_CARET + ' ' + CLS_CARET + '-left"></span>'
    },
    events : {
      value : {
        'afterOpenChange' : true
      }
    },
    subMenuType : {
      value : 'pop-menu'
    }
  },
  PARSER : {
    subMenu : function(el){
      var 
        subList = el.find('ul'),
        type = this.get('subMenuType'),
        sub;
      if(subList && subList.length){
        sub = BUI.Component.create({
          srcNode : subList,
          xclass : type
        });
        if(type == 'pop-menu'){
          subList.appendTo('body');
          sub.setInternal({
            autoHide : true,
            autoHideType : 'leave'
          });
        }else{
          this.get('children').push(sub);
        }
      }
      return sub;
    }
  }
},{
  xclass : 'menu-item',
  priority : 0
});

var separator = menuItem.extend({

},{
  ATTRS : {
    focusable : {
      value : false
    },
    selectable:{
      value : false
    },
    handleMouseEvents:{
      value:false
    }
  }
},{
  xclass:'menu-item-sparator'
});

menuItem.View = menuItemView;
menuItem.Separator = separator;

module.exports = menuItem;

});
define("bui/menu/contextmenu", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 寮瑰嚭鑿滃崟锛屼竴鑸敤浜庡彸閿彍鍗�
 * @author dxq613@gmail.com
 * @ignore
 */


var BUI = require("bui/common"),
  MenuItem = require("bui/menu/menuitem"),
  PopMenu = require("bui/menu/popmenu"),
  PREFIX = BUI.prefix,
  CLS_Link = PREFIX + 'menu-item-link',
  CLS_ITEM_ICON =  PREFIX + 'menu-item-icon',
  Component = BUI.Component,
  UIBase = Component.UIBase;

/**
 * 涓婁笅鏂囪彍鍗曢」
 * xclass:'context-menu-item'
 * @class BUI.Menu.ContextMenuItem 
 * @extends BUI.Menu.MenuItem
 */
var contextMenuItem = MenuItem.extend({
 
  bindUI:function(){
    var _self = this;

    _self.get('el').delegate('.' + CLS_Link,'click',function(ev){
      ev.preventDefault();
    });
  }, 
  //璁剧疆鍥炬爣鏍峰紡
  _uiSetIconCls : function (v,ev) {
    var _self = this,
      preCls = ev.prevVal,
      iconEl = _self.get('el').find('.'+CLS_ITEM_ICON);
    iconEl.removeClass(preCls);
    iconEl.addClass(v);
  }
},{

  ATTRS:
  {
    /**
     * 鏄剧ず鐨勬枃鏈�
     * @type {String}
     */
    text:{
      veiw:true,
      value:''
    },
    /**
     * 鑿滃崟椤瑰浘鏍囩殑鏍峰紡
     * @type {String}
     */
    iconCls:{
      sync:false,
      value:''
    },
    tpl:{
      value:'<a class="' + CLS_Link + '" href="#">\
      <span class="' + CLS_ITEM_ICON + ' {iconCls}"></span><span class="' + PREFIX + 'menu-item-text">{text}</span></a>'
    }
  }
},{
  xclass:'context-menu-item'
});

/**
 * 涓婁笅鏂囪彍鍗曪紝涓€鑸敤浜庡脊鍑鸿彍鍗�
 * xclass:'context-menu'
 * @class BUI.Menu.ContextMenu
 * @extends BUI.Menu.PopMenu
 */
var contextMenu = PopMenu.extend({

},{
  ATTRS:{
    /**
     * 瀛愮被鐨勯粯璁ょ被鍚嶏紝鍗崇被鐨� xclass
     * @type {String}
     * @override
     * @default 'menu-item'
     */
    defaultChildClass : {
      value : 'context-menu-item'
    },
    align : {
      value : null
    }
  }
},{
  xclass:'context-menu'
});

contextMenu.Item = contextMenuItem;

module.exports = contextMenu;

});
define("bui/menu/popmenu", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 涓嬫媺鑿滃崟锛屼竴鑸敤浜庝笅鎷夋樉绀鸿彍鍗�
 * @author dxq613@gmail.com
 * @ignore
 */

var BUI = require("bui/common"),
  UIBase = BUI.Component.UIBase,
  Menu = require("bui/menu/menu");

var popMenuView =  BUI.Component.View.extend([UIBase.PositionView],{
  
});

 /**
 * @class BUI.Menu.PopMenu
 * 涓婁笅鏂囪彍鍗曪紝涓€鑸敤浜庡脊鍑鸿彍鍗�
 * xclass:'pop-menu'
 * @extends BUI.Menu.Menu
 * @mixins BUI.Component.UIBase.AutoShow
 * @mixins BUI.Component.UIBase.Position
 * @mixins BUI.Component.UIBase.Align
 * @mixins BUI.Component.UIBase.AutoHide
 */
var popMenu =  Menu.extend([UIBase.Position,UIBase.Align,UIBase.AutoShow,UIBase.AutoHide],{

},{
  ATTRS:{
     /** 鐐瑰嚮鑿滃崟椤癸紝濡傛灉鑿滃崟涓嶆槸澶氶€夛紝鑿滃崟闅愯棌
     * @type {Boolean} 
     * @default true
     */
    clickHide : {
      value : true
    },
    align : {
      value : {
         points: ['bl','tl'], // ['tr', 'tl'] 琛ㄧず overlay 鐨� tl 涓庡弬鑰冭妭鐐圭殑 tr 瀵归綈
         offset: [0, 0]      // 鏈夋晥鍊间负 [n, m]
      }
    },
    visibleMode : {
      value : 'visibility'
    },
    /**
     * 鐐瑰嚮鑿滃崟澶栭潰锛岃彍鍗曢殣钘�
     * 鐐瑰嚮鑿滃崟椤癸紝濡傛灉鑿滃崟涓嶆槸澶氶€夛紝鑿滃崟闅愯棌
     * @type {Boolean} 
     * @default true
     */
    autoHide : {
      value : true
    },
    visible : {
      value : false
    },
    xview:{
      value : popMenuView
    }
  }
},{
  xclass:'pop-menu'
});

module.exports = popMenu;

});
define("bui/menu/sidemenu", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 渚ц竟鏍忚彍鍗�
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Menu = require("bui/menu/menu"),
  Component =  BUI.Component,
  CLS_MENU_TITLE = BUI.prefix + 'menu-title',
  CLS_MENU_LEAF = 'menu-leaf';
  
/**
 * 渚ц竟鏍忚彍鍗�
 * xclass:'side-menu'
 * @class BUI.Menu.SideMenu
 * @extends BUI.Menu.Menu
 */
var sideMenu = Menu.extend(
{
  //鍒濆鍖栭厤缃」
  initializer : function(){
    var _self = this,
      items = _self.get('items'),
      children = _self.get('children');

    BUI.each(items,function(item){
      var menuCfg = _self._initMenuCfg(item);
      children.push(menuCfg);
    });
  },
  bindUI : function(){
    var _self = this,
      children = _self.get('children');
    BUI.each(children,function(item){
      var menu = item.get('children')[0];
      if(menu){
        menu.publish('click',{
          bubbles:1
        });
      }
    });
    //闃叉閾炬帴璺宠浆
    _self.get('el').delegate('a','click',function(ev){
      ev.preventDefault();
    });
    //澶勭悊鐐瑰嚮浜嬩欢锛屽睍寮€銆佹姌鍙犮€侀€変腑
    _self.on('itemclick',function(ev){
      var item = ev.item,
        titleEl = $(ev.domTarget).closest('.' + _self.get('collapsedCls'));
      if(titleEl.length){
        var collapsed = item.get('collapsed');
          item.set('collapsed',!collapsed);
      }else if(item.get('el').hasClass(CLS_MENU_LEAF)){
        _self.fire('menuclick',{item:item});
        _self.clearSelection();
        _self.setSelected(item);
      }
    });
  },
  /**
   * @protected
   * @ignore
   */
  getItems:function(){
    var _self = this,
      items = [],
      children = _self.get('children');
    BUI.each(children,function(item){
      var menu = item.get('children')[0];
      items = items.concat(menu.get('children'));
    }); 
    return items;
  },
  //鍒濆鍖栬彍鍗曢厤缃」
  _initMenuCfg : function(item){
    var _self = this,
      items = item.items,
      subItems = [],
      cfg = {
        selectable: false,
        children : [{
          xclass : 'menu',
          children : subItems
        }]
      };

    BUI.mix(cfg,{
      xclass : 'menu-item',
      elCls : 'menu-second'
    },item);

    BUI.each(items,function(subItem){
      var subItemCfg = _self._initSubMenuCfg(subItem);
      subItems.push(subItemCfg);
    });

    return cfg;

  },
  //鍒濆鍖栦簩绾ц彍鍗�
  _initSubMenuCfg : function(subItem){
    var _self = this,
      cfg = {
        xclass : 'menu-item',
        elCls : 'menu-leaf',
        tpl : _self.get('subMenuItemTpl')
      };
    return BUI.mix(cfg,subItem);
  }
},{

  ATTRS : 
  {
    defaultChildCfg : {
      value : {
        subMenuType : 'menu',
        openable : false,
        arrowTpl : ''
      }
    },
    
    /**
     * 閰嶇疆鐨刬tems 椤规槸鍦ㄥ垵濮嬪寲鏃朵綔涓篶hildren
     * @protected
     * @type {Boolean}
     */
    autoInitItems : {
        value : false
    },
    /**
     * 鑿滃崟椤圭殑妯℃澘
     * @type {String}
     */
    itemTpl : {
      value : '<div class="'+CLS_MENU_TITLE+'"><s></s><span class="'+CLS_MENU_TITLE+'-text">{text}</span></div>'
    },
    /**
     * 瀛愯彍鍗曠殑閫夐」妯℃澘
     * @cfg {String} subMenuTpl
     */
    subMenuItemTpl : {
      value : '<a href="{href}"><em>{text}</em></a>'
    },
    /**
     * 灞曞紑鏀剁缉鐨勬牱寮忥紝鐢ㄦ潵瑙﹀彂灞曞紑鎶樺彔浜嬩欢,榛樿鏄� 'bui-menu-title'
     * @type {String} 
     */
    collapsedCls : {
      value : CLS_MENU_TITLE
    },
    events : {
      value : {
        /**
         * 鐐瑰嚮鑿滃崟椤�
	       * @name BUI.Menu.SideMenu#menuclick
         * @event 
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {Object} e.item 褰撳墠閫変腑鐨勯」
         */
        'menuclick' : false
      }
    }
  }
},{
  xclass :'side-menu'
});

module.exports = sideMenu;

});

define("bui/tab", ["bui/common","jquery","bui/menu"], function(require, exports, module){
/**
 * @fileOverview 鍒囨崲鏍囩鍏ュ彛
 * @ignore
 */

var BUI = require("bui/common"),
  Tab = BUI.namespace('Tab');

BUI.mix(Tab, {
  Tab : require("bui/tab/tab"),
  TabItem : require("bui/tab/tabitem"),
  NavTabItem : require("bui/tab/navtabitem"),
  NavTab : require("bui/tab/navtab"),
  TabPanel : require("bui/tab/tabpanel"),
  TabPanelItem : require("bui/tab/tabpanelitem")
});

module.exports = Tab;

});
define("bui/tab/tab", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 鍒囨崲鏍囩
 * @ignore
 */

  var BUI = require("bui/common"),
    Component = BUI.Component,
    UIBase = Component.UIBase;

  /**
   * 鍒楄〃
   * xclass:'tab'
   * <pre><code>
   * BUI.use('bui/tab',function(Tab){
   *   
   *     var tab = new Tab.Tab({
   *         render : '#tab',
   *         elCls : 'nav-tabs',
   *         autoRender: true,
   *         children:[
   *           {text:'鏍囩涓€',value:'1'},
   *           {text:'鏍囩浜�',value:'2'},
   *           {text:'鏍囩涓�',value:'3'}
   *         ]
   *       });
   *     tab.on('selectedchange',function (ev) {
   *       var item = ev.item;
   *       $('#log').text(item.get('text') + ' ' + item.get('value'));
   *     });
   *     tab.setSelected(tab.getItemAt(0)); //璁剧疆閫変腑绗竴涓�
   *   
   *   });
   *  </code></pre>
   * @class BUI.Tab.Tab
   * @extends BUI.Component.Controller
   * @mixins BUI.Component.UIBase.ChildList
   */
  var tab = Component.Controller.extend([UIBase.ChildList],{

  },{
    ATTRS : {
      elTagName:{
        view:true,
        value:'ul'
      },
      /**
       * 瀛愮被鐨勯粯璁ょ被鍚嶏紝鍗崇被鐨� xclass
       * @type {String}
       * @override
       * @default 'tab-item'
       */
      defaultChildClass : {
        value : 'tab-item'
      }
    }
  },{
    xclass : 'tab'
  });

  module.exports = tab;

});
define("bui/tab/tabitem", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 
 * @ignore
 */


var BUI = require("bui/common"),
  Component = BUI.Component,
  UIBase = Component.UIBase;

/**
 * @private
 * @class BUI.Tab.TabItemView
 * @extends BUI.Component.View
 * @mixins BUI.Component.UIBase.ListItemView
 * 鏍囩椤圭殑瑙嗗浘灞傚璞�
 */
var itemView = Component.View.extend([UIBase.ListItemView],{
},{
  xclass:'tab-item-view'
});


/**
 * 鏍囩椤�
 * @class BUI.Tab.TabItem
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.ListItem
 */
var item = Component.Controller.extend([UIBase.ListItem],{

},{
  ATTRS : 
  {
   
    elTagName:{
      view:true,
      value:'li'
    },
    xview:{
      value:itemView
    },
    tpl:{
      view:true,
      value:'<span class="bui-tab-item-text">{text}</span>'
    }
  }
},{
  xclass:'tab-item'
});


item.View = itemView;
module.exports = item;

});
define("bui/tab/navtabitem", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 瀵艰埅椤�
 * @author dxq613@gmail.com
 * @ignore
 */
var $ = require("jquery"),
  BUI = require("bui/common"),
  Component =  BUI.Component,
  CLS_ITEM_TITLE = 'tab-item-title',
  CLS_ITEM_CLOSE = 'tab-item-close',
  CLS_ITEM_INNER = 'tab-item-inner',
  CLS_NAV_ACTIVED = 'tab-nav-actived',
  CLS_CONTENT = 'tab-content';

/**
 * 瀵艰埅鏍囩椤圭殑瑙嗗浘绫�
 * @class BUI.Tab.NavTabItemView
 * @extends BUI.Component.View
 * @private
 */
var navTabItemView =  Component.View.extend({
  renderUI : function(){
    var _self = this,
      contentContainer = _self.get('tabContentContainer'),
      contentTpl = _self.get('tabContentTpl');
    if(contentContainer){
      var tabContentEl = $(contentTpl).appendTo(contentContainer);
      _self.set('tabContentEl',tabContentEl);
    }
  },
  //璁剧疆閾炬帴鍦板潃
  _uiSetHref : function(v){
    this._setHref(v);
  },
  _setHref : function(href){
    var _self = this,
      tabContentEl = _self.get('tabContentEl');
    href = href || _self.get('href');
    if(tabContentEl){
      $('iframe',tabContentEl).attr('src',href);
    }
  },
  resetHref : function(){
    this._setHref();
  },
  //璁剧疆鏍囬
  _uiSetTitle : function(v){
    var _self = this,
      el = _self.get('el');
    //el.attr('title',v);
    $('.' + CLS_ITEM_TITLE,el).html(v);
  },
  _uiSetActived : function(v){
    var _self = this,
      el = _self.get('el');

    _self.setTabContentVisible(v);
    if(v){
      el.addClass(CLS_NAV_ACTIVED);
    }else{
      el.removeClass(CLS_NAV_ACTIVED);
    }

  },
  //鏋愭瀯鍑芥暟
  destructor : function(){
    var _self = this,
      tabContentEl = _self.get('tabContentEl');
    if(tabContentEl){
      tabContentEl.remove();
    }
  },
  //璁剧疆鏍囩鍐呭鏄惁鍙
  setTabContentVisible : function(v){
    var _self = this,
      tabContentEl = _self.get('tabContentEl');

    if(tabContentEl){
      if(v){
        tabContentEl.show();
      }else{
        tabContentEl.hide();
      }
    }
  }

},{

  ATTRS : {

    tabContentContainer:{

    },
    tabContentEl: {

    },
    title:{

    },
    href:{

    }
  }
});

/**
 * 瀵艰埅鏍囩椤�
 * xclass : 'nav-tab-item'
 * @class BUI.Tab.NavTabItem
 * @extends BUI.Component.Controller
 */
var navTabItem = Component.Controller.extend(
{
  /**
   * 鍒涘缓DOM
   * @protected
   */
  createDom : function(){
    var _self = this,
        parent = _self.get('parent');
    if(parent){
      _self.set('tabContentContainer',parent.getTabContentContainer());
    }
  },
  /**
   * 缁戝畾浜嬩欢
   * @protected
   */
  bindUI : function(){
    var _self = this,
      el = _self.get('el'),
      events = _self.get('events');

    el.on('click',function(ev){
      var sender = $(ev.target);
     if(sender.hasClass(CLS_ITEM_CLOSE)){
        if(_self.fire('closing')!== false){
          _self.close();
        }
      }
    });
  },
  /**
   * 澶勭悊鍙屽嚮
   * @protected
   */
  handleDblClick:function(ev){
    var _self = this;

    if(_self.get('closeable') && _self.fire('closing')!== false){
      _self.close();
    }
    _self.fire('dblclick',{domTarget : ev.target,domEvent : ev});
  },
  /**
   * 澶勭悊鍙抽敭
   * @protected
   */
  handleContextMenu:function(ev){
    ev.preventDefault();
    this.fire('showmenu',{position:{x:ev.pageX,y:ev.pageY}});
  },
  /**
   * 璁剧疆鏍囬
   * @param {String} title 鏍囬
   */
  setTitle : function(title){
    this.set('title',title);
  },
  /**
  * 鍏抽棴
  */
  close:function(){
    this.fire('closed');
  },
  /**
   * 閲嶆柊鍔犺浇椤甸潰
   */
  reload : function(){
    this.get('view').resetHref();
  },
  /**
   * @protected
   * @ignore
   */
  show : function(){
    var _self = this;
      _self.get('el').show(500,function(){
        _self.set('visible',true);
      });
  },
  /**
   * @protected
   * @ignore
   */
  hide : function(callback){
    var _self = this;
    this.get('el').hide(500,function(){
      _self.set('visible',false);
      callback && callback();
    });
  },

  _uiSetActived : function(v){
    var _self = this,
      parent = _self.get('parent');
    if(parent && v){
      parent._setItemActived(_self);
    }
  },
  _uiSetCloseable : function(v){
    var _self = this,
      el = _self.get('el'),
      closeEl = el.find('.' + CLS_ITEM_CLOSE);
    if(v){
      closeEl.show();
    }else{
      closeEl.hide();
    }
  }
},{
  ATTRS : 
  {
    elTagName : {
      value: 'li'
    },
    /**
     * 鏍囩鏄惁閫変腑
     * @type {Boolean}
     */
    actived : {
      view:true,
      value : false
    }, 
    /**
     * 鏄惁鍙叧闂�
     * @type {Boolean}
     */
    closeable : {
      value : true
    },
    allowTextSelection:{
      view:false,
      value:false
    },
    events:{
      value : {
        /**
         * 鐐瑰嚮鑿滃崟椤�
         * @name BUI.Tab.NavTabItem#click
         * @event 
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Tab.NavTabItem} e.target 姝ｅ湪鐐瑰嚮鐨勬爣绛�
         */
        'click' : true,
        /**
         * 姝ｅ湪鍏抽棴锛岃繑鍥瀎alse鍙互闃绘鍏抽棴浜嬩欢鍙戠敓
         * @name BUI.Tab.NavTabItem#closing
         * @event 
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Tab.NavTabItem} e.target 姝ｅ湪鍏抽棴鐨勬爣绛�
         */
        'closing' : true,
        /**
         * 鍏抽棴浜嬩欢
         * @name BUI.Tab.NavTabItem#closed
         * @event 
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Tab.NavTabItem} e.target 鍏抽棴鐨勬爣绛�
         */
        'closed' : true,
        /**
         * @name BUI.Tab.NavTabItem#showmenu
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {BUI.Tab.NavTabItem} e.target 鏄剧ず鑿滃崟鐨勬爣绛�
         */
        'showmenu' : true,
        'afterVisibleChange' : true
      }
    },
    /**
     * @private
     * @type {Object}
     */
    tabContentContainer:{
      view : true
    },
    /**
     * @private
     * @type {Object}
     */
    tabContentTpl : {
      view : true,
      value : '<div class="' + CLS_CONTENT + '" style="display:none;"><iframe src="" width="100%" height="100%" frameborder="0"></iframe></div>'
    },
    /**
     * 鏍囩椤垫寚瀹氱殑URL
     * @cfg {String} href
     */
    /**
     * 鏍囩椤垫寚瀹氱殑URL
     * @type {String}
     */
    href : {
      view : true,
      value:''
    },
    visible:{
      view:true,
      value:true
    },
    /**
     * 鏍囩鏂囨湰
     * @cfg {String} title
     */
    /**
     * 鏍囩鏂囨湰
     * tab.getItem('id').set('title','new title');
     * @type {String}
     * @default ''
     */
    title : {
      view:true,
      value : ''
    },
    tpl : {
      view:true,
      value :'<s class="l"></s><div class="' + CLS_ITEM_INNER + '">{icon}<span class="' + CLS_ITEM_TITLE + '"></span><s class="' + CLS_ITEM_CLOSE + '"></s></div><s class="r"></s>'
    },
    xview:{
      value : navTabItemView
    }
  }
},{
  xclass : 'nav-tab-item',
  priority : 0
});

navTabItem.View = navTabItemView;

module.exports = navTabItem;

});
define("bui/tab/navtab", ["bui/common","jquery","bui/menu"], function(require, exports, module){
/**
 * @fileOverview 瀵艰埅鏍囩
 * @author dxq613@gmail.com
 * @ignore              
 */

var BUI = require("bui/common"),
  Menu = require("bui/menu"),
  Component =  BUI.Component,
  CLS_NAV_LIST = 'tab-nav-list',
  CLS_ARROW_LEFT = 'arrow-left',
  CLS_ARROW_RIGHT = 'arrow-right',
  CLS_FORCE_FIT = BUI.prefix + 'tab-force',
  ID_CLOSE = 'm_close',
  ITEM_WIDTH = 140;

/**
 * 瀵艰埅鏍囩鐨勮鍥剧被
 * @class BUI.Tab.NavTabView
 * @extends BUI.Component.View
 * @private
 */
var navTabView = Component.View.extend({
  renderUI : function(){
    var _self = this,
      el = _self.get('el'),
      listEl = null;

    listEl = el.find('.' + CLS_NAV_LIST);
    _self.setInternal('listEl',listEl);
  },
  getContentElement : function(){
    
    return this.get('listEl');
  },
  getTabContentContainer : function(){
    return this.get('el').find('.tab-content-container');
  },
  _uiSetHeight : function(v){
    var _self = this,
      el = _self.get('el'),
      barEl = el.find('.tab-nav-bar'),
      containerEl = _self.getTabContentContainer();
    if(v){
      containerEl.height(v - barEl.height());
    }
    el.height(v);
  },
  //璁剧疆鑷姩閫傚簲瀹藉害
  _uiSetForceFit : function(v){
    var _self = this,
      el = _self.get('el');
    if(v){
      el.addClass(CLS_FORCE_FIT);
    }else{
      el.removeClass(CLS_FORCE_FIT);
    }
  }
},{
  ATTRS : {
    forceFit : {}
  }
},{
  xclass : 'nav-tab-view',
  priority:0
});
/**
 * 瀵艰埅鏍囩
 * @class BUI.Tab.NavTab
 * @extends BUI.Component.Controller
 */
var navTab = Component.Controller.extend(
  {
    /**
     * 娣诲姞鏍囩椤�
     * @param {Object} config 鑿滃崟椤圭殑閰嶇疆椤�
     * @param {Boolean} reload 濡傛灉鏍囩椤靛凡瀛樺湪锛屽垯閲嶆柊鍔犺浇
     */
    addTab:function(config,reload){
      var _self = this,
        id = config.id || BUI.guid('tab-item'),
        forceFit = _self.get('forceFit'),
        item = _self.getItemById(id);

      if(item){
        var hrefChage = false;
        if(config.href && item.get('href') != config.href){
          item.set('href',config.href);
          hrefChage = true;
        }
        _self._setItemActived(item);
        if(reload && !hrefChage){
          item.reload();
        }
      }else{

        config = BUI.mix({
          id : id,
          visible : false,
          actived : true,
          xclass : 'nav-tab-item'
        },config);

        item = _self.addChild(config);
        if(forceFit){
          _self.forceFit();
        }
        item.show();
        _self._resetItemList();
      }
      return item;
    },
    /**
     * 鑾峰彇瀵艰埅鏍囩锛屽瓨鏀惧唴瀹圭殑鑺傜偣
     * @return {jQuery} 瀵艰埅鍐呭鐨勫鍣�
     */
    getTabContentContainer : function(){
      return this.get('view').getTabContentContainer();
    },
    //缁戝畾浜嬩欢
    bindUI: function(){
      var _self = this,
        forceFit = _self.get('forceFit');
      if(!forceFit){
        _self._bindScrollEvent();
        _self.on('afterVisibleChange',function(ev){
          var item = ev.target;
          if(item.get('actived')){
            _self._scrollToItem(item);
          }
        });
      }

      //鐩戝惉鐐瑰嚮鏍囩
      _self.on('click',function(ev){
        var item = ev.target;
        if(item != _self){
          _self._setItemActived(item);
          _self.fire('itemclick',{item:item});
        }
      });

      //鍏抽棴鏍囩
      _self.on('closed',function(ev){
        var item = ev.target;
        _self._closeItem(item);
      });

      _self.on('showmenu',function(ev){
        _self._showMenu(ev.target,ev.position);
      });

      
    },
    //缁戝畾婊氬姩浜嬩欢
    _bindScrollEvent : function(){
      var _self = this,
        el = _self.get('el');

      el.find('.arrow-left').on('click',function(){
        if(el.hasClass(CLS_ARROW_LEFT + '-active')){
          _self._scrollLeft();
        }
      });

      el.find('.arrow-right').on('click',function(){
        if(el.hasClass(CLS_ARROW_RIGHT + '-active')){
          _self._scrllRight();
        }
      });
    },
    _showMenu : function(item,position){
      var _self = this,
          menu = _self._getMenu(),
          closeable = item.get('closeable'),
          closeItem;

      _self.set('showMenuItem',item);

      menu.set('xy',[position.x,position.y]);
      menu.show();
      closeItem = menu.getItem(ID_CLOSE);
      if(closeItem){
        closeItem.set('disabled',!closeable);
      }
    },
    /**
     * 閫氳繃id,璁剧疆閫変腑鐨勬爣绛鹃」
     * @param {String} id 鏍囩缂栧彿
     */
    setActived : function(id){
      var _self = this,
        item = _self.getItemById(id);
      _self._setItemActived(item);
    },
    /**
     * 鑾峰彇褰撳墠閫変腑鐨勬爣绛鹃」
     * @return {BUI.Tab.NavTabItem} 閫変腑鐨勬爣绛惧璞�
     */
    getActivedItem : function(){
      var _self = this,
        children = _self.get('children'),
        result = null;
      BUI.each(children,function(item){
        if(item.get('actived')){
          result = item;
          return false;
        }
      });
      return result;
    },
    /**
     * 閫氳繃缂栧彿鑾峰彇鏍囩椤�
     * @param  {String} id 鏍囩椤圭殑缂栧彿
     * @return {BUI.Tab.NavTabItem} 鏍囩椤瑰璞�
     */
    getItemById : function(id){
      var _self = this,
        children = _self.get('children'),
        result = null;
      BUI.each(children,function(item){
        if(item.get('id') === id){
          result = item;
          return false;
        }
      });
      return result;
    },
    _getMenu : function(){
      var _self = this;

      return _self.get('menu') || _self._initMenu();
    },
    _initMenu : function(){
      var _self = this,
        menu = new Menu.ContextMenu({
            children : [
            {

              xclass : 'context-menu-item',
              iconCls:'icon icon-refresh',
              text : '鍒锋柊',
              listeners:{
                'click':function(){
                  var item = _self.get('showMenuItem');
                  if(item){
                    item.reload();
                  }
                }
              }
            },
            {
              id : ID_CLOSE,
              xclass : 'context-menu-item',
              iconCls:'icon icon-remove',
              text: '鍏抽棴',
              listeners:{
                'click':function(){
                  var item = _self.get('showMenuItem');
                  if(item){
                    item.close();
                  }
                }
              }
            },
            {
              xclass : 'context-menu-item',
              iconCls:'icon icon-remove-sign',
              text : '鍏抽棴鍏朵粬',
              listeners:{
                'click':function(){
                  var item = _self.get('showMenuItem');
                  if(item){
                    _self.closeOther(item);
                  }
                }
              }
            },
            {
              xclass : 'context-menu-item',
              iconCls:'icon icon-remove-sign',
              text : '鍏抽棴鎵€鏈�',
              listeners:{
                'click':function(){
                  _self.closeAll();
                }
              }
            }

          ]
        });
        
      _self.set('menu',menu);
      return menu;
    },
    //鍏抽棴鏍囩椤�
    _closeItem : function(item){
      var _self = this,
        index = _self._getIndex(item),
        activedItem = _self.getActivedItem(),
        preItem = _self.get('preItem') || _self._getItemByIndex(index -1),
        nextItem = _self._getItemByIndex(index + 1);

      item.hide(function(){
        _self.removeChild(item,true);
        _self._resetItemList();
        if(activedItem === item){
          if(preItem){
            _self._setItemActived(preItem);
          }else{
            _self._setItemActived(nextItem);
          }
        }else{//鍒犻櫎鏍囩椤规椂锛屽彲鑳戒細寮曡捣婊氬姩鎸夐挳鐘舵€佺殑鏀瑰彉
          _self._scrollToItem(activedItem);;
        }
        _self.forceFit();
      });
      
    },
    closeAll:function(){
      var _self = this,
        children = _self.get('children');
      BUI.each(children,function(item){
        if(item.get('closeable')){
          item.close();
        }
      });
    },
    closeOther : function(curItem){
      var _self = this,
        children = _self.get('children');
      BUI.each(children,function(item){
        if(curItem !==item){
          item.close();
        }
        
      });
    },
    //閫氳繃浣嶇疆鏌ユ壘鏍囩椤�
    _getItemByIndex : function(index){
      var _self = this,
        children = _self.get('children');  
      return children[index];
    },
    //鑾峰彇鏍囩椤圭殑浣嶇疆
    _getIndex : function(item){
      var _self = this,
        children = _self.get('children');    
      return BUI.Array.indexOf(item,children);
    },
    //閲嶆柊璁＄畻鏍囩椤瑰鍣ㄧ殑瀹藉害浣嶇疆
    _resetItemList : function(){
      if(this.get('forceFit')){
        return;
      }
      var _self = this,
        container = _self.getContentElement();

      container.width(_self._getTotalWidth());

    },
    //鑾峰彇閫夐」鐨勬€诲搴︼紝浠ラ粯璁ゅ搴︿负鍩烘暟
    _getTotalWidth : function(){
      var _self = this,
        children = _self.get('children');

      return children.length * _self.get('itemWidth');
    },
    _getForceItemWidth : function(){
      var _self = this,
        width =  _self.getContentElement().width(),
        children = _self.get('children'),
        totalWidth = _self._getTotalWidth(),
        itemWidth = _self.get(itemWidth);
      if(totalWidth > width){
        itemWidth = width/children.length;
      }
      return itemWidth;
    },
    forceFit : function(){
      var _self = this;
      _self._forceItemWidth(_self._getForceItemWidth());
    },
    //璁剧疆骞冲潎瀹藉害
    _forceItemWidth : function(width){
      width = width || this.get('itemWidth');
      var _self = this,
        children = _self.get('children');
      BUI.each(children,function(item){
        item.set('width',width);
      });
    },
    //浣挎寚瀹氭爣绛鹃」鍦ㄧ敤鎴峰彲瑙嗗尯鍩熷唴
    _scrollToItem : function(item){
      if(this.get('forceFit')){ //鑷€傚簲鍚庯紝涓嶈繘琛屾粴鍔�
        return;
      }
      var _self = this,
        container = _self.getContentElement(),
        containerPosition = container.position(),
        disWidth = _self._getDistanceToEnd(item,container,containerPosition),
        disBegin = _self._getDistanceToBegin(item,containerPosition); //褰撳墠娲诲姩鐨勯」璺濈鏈€鍙崇鐨勮窛绂�

      //濡傛灉鏍囩椤瑰垪琛ㄥ皬浜庢暣涓爣绛惧鍣ㄧ殑澶у皬锛屽垯宸﹀榻�
      if(container.width() < container.parent().width()){
        _self._scrollTo(container,0);  
      }else if(disBegin < 0){//濡傛灉宸﹁竟琚伄鎸★紝鍚戝彸绉诲姩

        _self._scrollTo(container,containerPosition.left - (disBegin));

      }else if(disWidth > 0){//濡傛灉褰撳墠鑺傜偣琚彸绔伄鎸★紝鍒欏悜宸︽粴鍔ㄥ埌鏄剧ず浣嶇疆
      
        _self._scrollTo(container,containerPosition.left + (disWidth) * -1);

      }else if(containerPosition.left < 0){//灏嗗乏杈圭Щ鍔紝浣挎渶鍚庝竴涓爣绛鹃」绂诲彸杈规渶杩�
        var lastDistance = _self._getLastDistance(container,containerPosition),
          toLeft = 0;
        if(lastDistance < 0){
          toLeft = containerPosition.left - lastDistance;
          toLeft = toLeft < 0 ? toLeft : 0;
          _self._scrollTo(container,toLeft);  
        }
      }
    },
    //鑾峰彇鏍囩鍒版渶宸︾鐨勮窛绂�
    _getDistanceToBegin : function(item,containerPosition){
      var position = item.get('el').position();

      return position.left + containerPosition.left;
    },
    /**
     * 鑾峰彇鏍囩鍒版渶鍙崇鐨勮窛绂�
     * @return  {Number} 鍍忕礌
     * @private
     */
    _getDistanceToEnd : function(item,container,containerPosition){
      var _self = this,
        container = container || _self.getContentElement(),
        wraperWidth = container.parent().width(),
        containerPosition = containerPosition || container.position(),
        offsetLeft = _self._getDistanceToBegin(item,containerPosition),
        disWidth = offsetLeft + _self.get('itemWidth') - wraperWidth; 
      return disWidth;
    },
    //鑾峰彇鏈€鍚庝竴涓爣绛鹃」绂诲彸杈圭殑闂磋窛
    _getLastDistance : function(container,containerPosition){
      var _self = this,
        children = _self.get('children'),
        lastItem = children[children.length - 1];
      if(lastItem)
      {
        return _self._getDistanceToEnd(lastItem,container,containerPosition);
      }
      return 0;
    },
    _scrollTo : function(el,left,callback){
      var _self = this;
      el.animate({left:left},500,function(){
         _self._setArrowStatus(el);
      });
    },
    _scrollLeft : function(){
      var _self = this,
        container = _self.getContentElement(),
        position = container.position(),
        disWidth = _self._getLastDistance(container,position),
        toLeft;
      if(disWidth > 0 ){
        toLeft = disWidth > _self.get('itemWidth') ? _self.get('itemWidth') : disWidth;
        _self._scrollTo(container,position.left - toLeft);
      }

    },
    //鍚戝彸婊氬姩
    _scrllRight : function(){
      var _self = this,
        container = _self.getContentElement(),
        position = container.position(),
        toRight;
      if(position.left < 0){
        toRight = position.left + _self.get('itemWidth');
        toRight = toRight < 0 ? toRight : 0;
        _self._scrollTo(container,toRight);
      }
    },
    //璁剧疆鍚戝乏锛屽悜鍙崇殑绠ご鏄惁鍙敤
    _setArrowStatus : function(container,containerPosition){

      container = container || this.getContentElement();
      var _self = this,
        wapperEl = _self.get('el'),
        position = containerPosition || container.position(),
        disWidth = _self._getLastDistance(container,containerPosition);

      //鍙互鍚戝乏杈规粴鍔�
      if(position.left < 0){
        wapperEl.addClass(CLS_ARROW_RIGHT+'-active');
      }else{
        wapperEl.removeClass(CLS_ARROW_RIGHT+'-active');
      }

      if(disWidth > 0){
        wapperEl.addClass(CLS_ARROW_LEFT+'-active');
      }else{
        wapperEl.removeClass(CLS_ARROW_LEFT+'-active');
      }
    },
    //璁剧疆褰撳墠閫変腑鐨勬爣绛�
    _setItemActived:function(item){
      var _self = this,
        preActivedItem = _self.getActivedItem();
      if(item === preActivedItem){
        return;
      }

      if(preActivedItem){
        preActivedItem.set('actived',false);
      }
      _self.set('preItem',preActivedItem);
      if(item){
        if(!item.get('actived')){
          item.set('actived',true);
        }
        //褰撴爣绛鹃」鍙鏃讹紝鍚﹀垯鏃犳硶璁＄畻浣嶇疆淇℃伅
        if(item.get('visible')){
          _self._scrollToItem(item);
        }
        //涓轰簡鍏煎鍘熷厛浠ｇ爜
        _self.fire('activeChange',{item:item});
        _self.fire('activedchange',{item:item});
      }
    }

  },
  
  {
    ATTRS :    
  {
      defaultChildClass:{
        value : 'nav-tab-item'
      },
      /**
       * @private
       * 鍙抽敭鑿滃崟
       * @type {Object}
       */
      menu : {

      },
      /**
       * 璁剧疆姝ゅ弬鏁版椂锛屾爣绛鹃€夐」鐨勫搴︿細杩涜鑷€傚簲
       * @cfg {Boolean} forceFit
       */
      forceFit : {
        view : true,
        value : false
      },
      /**
       * 鏍囩鐨勯粯璁ゅ搴�,140px锛岃缃甪orceFit:true鍚庯紝姝ゅ搴︿负鏈€瀹藉搴�
       * @type {Number}
       */
      itemWidth : {
        value : ITEM_WIDTH
      },
      /**
       * 娓叉煋鏍囩鐨勬ā鐗�
       * @type {String}
       */
      tpl : {
        view : true,
        value : '<div class="tab-nav-bar">'+
          '<s class="tab-nav-arrow arrow-left"></s><div class="tab-nav-wrapper"><div class="tab-nav-inner"><ul class="'+CLS_NAV_LIST+'"></ul></div></div><s class="tab-nav-arrow arrow-right"></s>'+
          '</div>'+
          '<div class="tab-content-container"></div>'
      },
      xview : {
        value : navTabView
      },
      events : {
              
        value : {
          /**
           * 鐐瑰嚮鏍囩椤�
           * @event
           * @param {Object} e 浜嬩欢瀵硅薄
           * @param {BUI.Tab.NavTabItem} e.item 鏍囩椤�
           */
          'itemclick' : false,
          /**
           * 鏍囩椤规縺娲绘敼鍙�
           * @event
           * @param {Object} e 浜嬩欢瀵硅薄
           * @param {BUI.Tab.NavTabItem} e.item 鏍囩椤�
           */
          activedchange : false
        }
      }
    }
  },
  {
    xclass:'nav-tab',
    priority : 0

  }
);

module.exports = navTab;

});
define("bui/tab/tabpanel", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 姣忎釜鏍囩瀵瑰簲涓€涓潰鏉�
 * @ignore
 */

var BUI = require("bui/common"),
  Tab = require("bui/tab/tab"),
  Panels = require("bui/tab/panels");

/**
 * 甯︽湁闈㈡澘鐨勫垏鎹㈡爣绛�
 * <pre><code>
 * BUI.use('bui/tab',function(Tab){
 *   
 *     var tab = new Tab.TabPanel({
 *       render : '#tab',
 *       elCls : 'nav-tabs',
 *       panelContainer : '#panel',
 *       autoRender: true,
 *       children:[
 *         {text:'婧愪唬鐮�',value:'1'},
 *         {text:'HTML',value:'2'},
 *         {text:'JS',value:'3'}
 *       ]
 *     });
 *     tab.setSelected(tab.getItemAt(0));
 *   });
 * </code></pre>
 * @class BUI.Tab.TabPanel
 * @extends BUI.Tab.Tab
 * @mixins BUI.Tab.Panels
 */
var tabPanel = Tab.extend([Panels],{

  bindUI : function(){
    var _self = this;
    //鍏抽棴鏍囩
    _self.on('beforeclosed',function(ev){
      var item = ev.target;
      _self._beforeClosedItem(item);
    });
  },
  //鍏抽棴鏍囩閫夐」鍓�
  _beforeClosedItem : function(item){
    if(!item.get('selected')){ //濡傛灉鏈€変腑涓嶆墽琛屼笅闈㈢殑閫変腑鎿嶄綔
      return;
    }

    var _self = this,
      index = _self.indexOfItem(item),
      count = _self.getItemCount(),
      preItem,
      nextItem;
    if(index !== count - 1){ //涓嶆槸鏈€鍚庝竴涓紝鍒欐縺娲绘渶鍚庝竴涓�
      nextItem = _self.getItemAt(index + 1);
      _self.setSelected(nextItem);
    }else if(index !== 0){
      preItem = _self.getItemAt(index - 1);
      _self.setSelected(preItem);
    }
  }

},{
  ATTRS : {
    elTagName : {
      value : 'div'
    },
    childContainer : {
      value : 'ul'
    },
    tpl : {
      value : '<div class="tab-panel-inner"><ul></ul><div class="tab-panels"></div></div>'
    },
    panelTpl : {
      value : '<div></div>'
    },
    /**
     * 榛樿鐨勯潰鏉垮鍣�
     * @cfg {String} [panelContainer='.tab-panels']
     */
    panelContainer : {
      value : '.tab-panels'
    },
    /**
     * 榛樿瀛愭帶浠剁殑xclass
     * @type {String}
     */
    defaultChildClass:{
      value : 'tab-panel-item'
    }
  }
},{
  xclass : 'tab-panel'
});

module.exports = tabPanel;

});
define("bui/tab/panels", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鎷ユ湁澶氫釜闈㈡澘鐨勫鍣�
 * @ignore
 */

var $ = require("jquery");

/**
 * @class BUI.Tab.Panels
 * 鍖呭惈闈㈡澘鐨勬爣绛剧殑鎵╁睍绫�
 */
var Panels = function(){
  //this._initPanels();
};

Panels.ATTRS = {

  /**
   * 闈㈡澘鐨勬ā鏉�
   * @type {String}
   */
  panelTpl : {

  },
  /**
   * 闈㈡澘鐨勫鍣紝濡傛灉鏄痠d鐩存帴閫氳繃id鏌ユ壘锛屽鏋滄槸闈瀒d锛岄偅涔堜粠el寮€濮嬫煡鎵�,渚嬪锛�
   *   -#id 锛� 閫氳繃$('#id')鏌ユ壘
   *   -.cls : 閫氳繃 this.get('el').find('.cls') 鏌ユ壘
   *   -DOM/jQuery 锛氫笉闇€瑕佹煡鎵�
   * @type {String|HTMLElement|jQuery}
   */
  panelContainer : {
    
  },
  /**
   * panel 闈㈡澘浣跨敤鐨勬牱寮忥紝濡傛灉鍒濆鍖栨椂锛屽鍣ㄥ唴宸茬粡瀛樺湪鏈夎鏍峰紡鐨凞OM锛屽垯浣滀负闈㈡澘浣跨敤
   * 瀵瑰簲鍚屼竴涓綅缃殑鏍囩椤�,濡傛灉涓虹┖锛岄粯璁ゅ彇闈㈡澘瀹瑰櫒鐨勫瓙鍏冪礌
   * @type {String}
   */
  panelCls : {

  }
};

BUI.augment(Panels,{

  __renderUI : function(){
    var _self = this,
      children = _self.get('children'),
      panelContainer = _self._initPanelContainer(),
      panelCls = _self.get('panelCls'),
      panels = panelCls ? panelContainer.find('.' + panels) : panelContainer.children();

    BUI.each(children,function(item,index){
      var panel = panels[index];
      _self._initPanelItem(item,panel);
    });
  },

  __bindUI : function(){
    var _self = this;
    _self.on('beforeAddChild',function(ev){
      var item = ev.child;
      _self._initPanelItem(item);
    });
  },
  //鍒濆鍖栧鍣�
  _initPanelContainer : function(){
    var _self = this,
      panelContainer = _self.get('panelContainer');
    if(panelContainer && BUI.isString(panelContainer)){
      if(panelContainer.indexOf('#') == 0){ //濡傛灉鏄痠d
        panelContainer = $(panelContainer);
      }else{
        panelContainer = _self.get('el').find(panelContainer);
      }
      _self.setInternal('panelContainer',panelContainer);
    }
    return panelContainer;
  },
  //鍒濆鍖栭潰鏉块厤缃俊鎭�
  _initPanelItem : function(item,panel){
    var _self = this;

    if(item.set){
      if(!item.get('panel')){
        panel = panel || _self._getPanel(item.get('userConfig'));
        item.set('panel',panel);
      }
    }else{
      if(!item.panel){
        panel = panel || _self._getPanel(item);
        item.panel = panel;
      }
    }
  },
  //鑾峰彇闈㈡澘
  _getPanel : function(item){
    var _self = this,
      panelContainer = _self.get('panelContainer'),
      panelTpl = BUI.substitute(_self.get('panelTpl'),item);
    
    return $(panelTpl).appendTo(panelContainer);
  }
});

module.exports = Panels;

});
define("bui/tab/tabpanelitem", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 
 * @ignore
 */


var BUI = require("bui/common"),
  TabItem = require("bui/tab/tabitem"),
  PanelItem = require("bui/tab/panelitem"),
  CLS_TITLE = 'bui-tab-item-text',
  Component = BUI.Component;

/**
 * @private
 * @class BUI.Tab.TabPanelItemView
 * @extends BUI.Tab.TabItemView
 * 瀛樺湪闈㈡澘鐨勬爣绛鹃」瑙嗗浘灞傚璞�
 */
var itemView = TabItem.View.extend([Component.UIBase.Close.View],{
  _uiSetTitle : function(v){
    var _self = this,
      el = _self.get('el'),
      titleEl = el.find('.' + CLS_TITLE);
    titleEl.text(v);
  }
},{
  xclass:'tab-panel-item-view'
});


/**
 * 鏍囩椤�
 * @class BUI.Tab.TabPanelItem
 * @extends BUI.Tab.TabItem
 * @mixins BUI.Tab.PanelItem
 * @mixins BUI.Component.UIBase.Close
 */
var item = TabItem.extend([PanelItem,Component.UIBase.Close],{
  
},{
  ATTRS : 
  {
    /**
     * 鍏抽棴鏃剁洿鎺ラ攢姣佹爣绛鹃」锛屾墽琛宺emove鏂规硶
     * @type {String}
     */
    closeAction : {
      value : 'remove'
    },
    /**
     * 鏍囬
     * @cfg {String} title 
     */
    /**
     * 鏍囬
     * @type {String}
     * <code>
     *   tab.getItem('id').set('title','new title');
     * </code>
     */
    title : {
      view : true,
      sync : false

    },
    /**
     * 鏍囩椤圭殑妯℃澘,鍥犱负涔嬪墠娌℃湁title灞炴€э紝鎵€浠ラ粯璁ょ敤text锛屾墍浠ヤ篃鍏煎text锛屼絾鏄湪鏈€濂界洿鎺ヤ娇鐢╰itle锛屾柟渚挎洿鏀�
     * @type {String}
     */
    tpl : {
      value : '<span class="' + CLS_TITLE + '">{text}{title}</span>'
    },
    closeable : {
      value : false
    },
    events : {
      value : {
        beforeclosed : true
      }
    },
    xview:{
      value:itemView
    }
  }
},{
  xclass:'tab-panel-item'
});

item.View = itemView;

module.exports = item;

});
define("bui/tab/panelitem", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 鎷ユ湁鍐呭鐨勬爣绛鹃」鐨勬墿灞曠被锛屾瘡涓爣绛鹃」閮芥湁涓€涓垎绂荤殑瀹瑰櫒浣滀负闈㈡澘
 * @ignore
 */
var $ = require("jquery");
/**
 * @class BUI.Tab.PanelItem
 * 鍖呭惈闈㈡澘鐨勬爣绛鹃」鐨勬墿灞�
 */
var PanelItem = function(){

};

PanelItem.ATTRS = {

  /**
   * 鏍囩椤瑰搴旂殑闈㈡澘瀹瑰櫒锛屽綋鏍囩閫変腑鏃讹紝闈㈡澘鏄剧ず
   * @cfg {String|HTMLElement|jQuery} panel
   * @internal 闈㈡澘灞炴€т竴鑸敱 tabPanel璁剧疆鑰屼笉搴旇鐢辩敤鎴锋墜宸ヨ缃�
   */
  /**
   * 鏍囩椤瑰搴旂殑闈㈡澘瀹瑰櫒锛屽綋鏍囩閫変腑鏃讹紝闈㈡澘鏄剧ず
   * @type {String|HTMLElement|jQuery}
   * @readOnly
   */
  panel : {

  },
  /**
   * 闈㈡澘鐨勫唴瀹�
   * @type {String}
   */
  panelContent : {

  },
  /**
   * 鍏宠仈闈㈡澘鏄剧ず闅愯棌鐨勫睘鎬у悕
   * @protected
   * @type {string}
   */
  panelVisibleStatus : {
    value : 'selected'
  },
  /**
     * 榛樿鐨勫姞杞芥帶浠跺唴瀹圭殑閰嶇疆,榛樿鍊硷細
     * <pre>
     *  {
     *   property : 'panelContent',
     *   lazyLoad : {
     *       event : 'active'
     *   },
     *     loadMask : {
     *       el : _self.get('panel')
     *   }
     * }
     * </pre>
     * @type {Object}
     */
    defaultLoaderCfg  : {
      valueFn :function(){
        var _self = this,
          eventName = _self._getVisibleEvent();
        return {
          property : 'panelContent',
          autoLoad : false,
          lazyLoad : {
            event : eventName
          },
          loadMask : {
            el : _self.get('panel')
          }
        }
      } 
    },
  /**
   * 闈㈡澘鏄惁璺熼殢鏍囩涓€璧烽噴鏀�
   * @type {Boolean}
   */
  panelDestroyable : {
    value : true
  }
}


BUI.augment(PanelItem,{

  __renderUI : function(){
    this._resetPanelVisible();
  },
  __bindUI : function(){
    var _self = this,
    eventName = _self._getVisibleEvent();

    _self.on(eventName,function(ev){
      _self._setPanelVisible(ev.newVal);
    });
  },
  _resetPanelVisible : function(){
    var _self = this,
      status = _self.get('panelVisibleStatus'),
      visible = _self.get(status);
    _self._setPanelVisible(visible);
  },
  //鑾峰彇鏄剧ず闅愯棌鐨勪簨浠�
  _getVisibleEvent : function(){
    var _self = this,
      status = _self.get('panelVisibleStatus');

    return 'after' + BUI.ucfirst(status) + 'Change';;
  },
  /**
   * @private
   * 璁剧疆闈㈡澘鐨勫彲瑙�
   * @param {Boolean} visible 鏄剧ず鎴栬€呴殣钘�
   */
  _setPanelVisible : function(visible){
    var _self = this,
      panel = _self.get('panel'),
      method = visible ? 'show' : 'hide';
    if(panel){
      $(panel)[method]();
    }
  },
  __destructor : function(){
    var _self = this,
      panel = _self.get('panel');
    if(panel && _self.get('panelDestroyable')){
      $(panel).remove();
    }
  },
  _setPanelContent : function(panel,content){
    var panelEl = $(panel);
    $(panel).html(content);
  },
  _uiSetPanelContent : function(v){
    var _self = this,
      panel = _self.get('panel');
    //$(panel).html(v);
    _self._setPanelContent(panel,v);
  },
  //璁剧疆panel
  _uiSetPanel : function(v){
    var _self = this,
      content = _self.get('panelContent');
    if(content){
      _self._setPanelContent(v,content);
    }
    _self._resetPanelVisible();
  }
});

module.exports = PanelItem;

});

define("bui/mask", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview Mask鐨勫叆鍙ｆ枃浠�
 * @ignore
 */

  var BUI = require("bui/common"),
    Mask = require("bui/mask/mask");
  Mask.LoadMask = require("bui/mask/loadMask");

  module.exports = Mask;

});
define("bui/mask/mask", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview Mask灞忚斀灞�
 * @author dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  Mask = BUI.namespace('Mask'),
  UA = BUI.UA,
  CLS_MASK = BUI.prefix + 'ext-mask',
  CLS_MASK_MSG = CLS_MASK + '-msg';

BUI.mix(Mask,
/**
* 灞忚斀灞�
* <pre><code>
* BUI.use('bui/mask',function(Mask){
*   Mask.maskElement('#domId'); //灞忚斀dom
*   Mask.unmaskElement('#domId'); //瑙ｉ櫎DOM灞忚斀
* });
* </code></pre>
* @class BUI.Mask
* @singleton
*/
{
  /**
   * @description 灞忚斀鎸囧畾鍏冪礌
   * @param {String|HTMLElement} element 琚睆钄界殑鍏冪礌
   * @param {String} [msg] 灞忚斀鍏冪礌鏃舵樉绀虹殑鏂囨湰
   * @param {String} [msgCls] 鏄剧ず鏂囨湰搴旂敤鐨勬牱寮�
   * <pre><code>
   *   BUI.Mask.maskElement('#domId');
   *   BUI.Mask.maskElement('body'); //灞忚斀鏁翠釜绐楀彛
   * </code></pre>
   */
  maskElement:function (element, msg, msgCls) {
    var maskedEl = $(element),
      maskDiv = maskedEl.children('.' + CLS_MASK),
      tpl = null,
      msgDiv = null,
      top = null,
      left = null;
    if (!maskDiv.length) {
      maskDiv = $('<div class="' + CLS_MASK + '"></div>').appendTo(maskedEl);
      maskedEl.addClass('x-masked-relative x-masked');
      //灞忚斀鏁翠釜绐楀彛
      if(element == 'body'){
        if(UA.ie == 6){
        maskDiv.height(BUI.docHeight());
        }else{
        maskDiv.css('position','fixed');
        }
      }else{
        if (UA.ie === 6) {
          maskDiv.height(maskedEl.height());
        }
      }
       
      if (msg) {
        tpl = ['<div class="' + CLS_MASK_MSG + '"><div>', msg, '</div></div>'].join('');
        msgDiv = $(tpl).appendTo(maskedEl);
        if (msgCls) {
          msgDiv.addClass(msgCls);
        }

        try {
        //灞忚斀鏁翠釜绐楀彛
        if(element == 'body' && UA.ie != 6){
          top = '50%',
          left = '50%';
          msgDiv.css('position','fixed');
        }else{
          top = (maskDiv.height() - msgDiv.height()) / 2;
          left = (maskDiv.width() - msgDiv.width()) / 2;            
        }
        msgDiv.css({ left:left, top:top });

        } catch (ex) {
        BUI.log('mask error occurred');
        }
        
      }
    }
    return maskDiv;
  },
  /**
   * @description 瑙ｉ櫎鍏冪礌鐨勫睆钄�
   * @param {String|HTMLElement} element 灞忚斀鐨勫厓绱�
   * <pre><code>
   * BUI.Mask.unmaskElement('#domId');
   * </code></pre>
   */
  unmaskElement:function (element) {
    var maskedEl = $(element),
      msgEl = maskedEl.children('.' + CLS_MASK_MSG),
      maskDiv = maskedEl.children('.' + CLS_MASK);
    if (msgEl) {
      msgEl.remove();
    }
    if (maskDiv) {
      maskDiv.remove();
    }
    maskedEl.removeClass('x-masked-relative x-masked');

  }
});

module.exports = Mask;

});
define("bui/mask/loadMask", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鍔犺浇鏁版嵁鏃跺睆钄藉眰
 * @ignore
 */

  
var $ = require("jquery"),
  Mask = require("bui/mask/mask");

 /**
 * 灞忚斀鎸囧畾鍏冪礌锛屽苟鏄剧ず鍔犺浇淇℃伅
 * <pre><code>
 * BUI.use('bui/mask',function(Mask){
 *  var loadMask = new Mask.LoadMask({
 *    el : '#domId',
 *    msg : 'loading ....'
 *  });
 *
 *  $('#btn').on('click',function(){
 *    loadMask.show();
 *  });
 *
 *  $('#btn1').on('click',function(){
 *    loadMask.hide();
 *  });
 * });
 * </code></pre>
 * @class BUI.Mask.LoadMask
 * @extends BUI.Base
 */
function LoadMask(config) {
  var _self = this;
  LoadMask.superclass.constructor.call(_self, config);
}

BUI.extend(LoadMask, BUI.Base);

LoadMask.ATTRS = {
  /**
   * 灞忚斀鐨勫厓绱�
   * <pre><code>
   *  var loadMask = new Mask.LoadMask({
   *    el : '#domId'
   *  });
   * </code></pre>
   * @cfg {jQuery} el
   */
  el : {

  },
  /**
   * 鍔犺浇鏃舵樉绀虹殑鍔犺浇淇℃伅
   * <pre><code>
   *  var loadMask = new Mask.LoadMask({
   *    el : '#domId',
   *    msg : '姝ｅ湪鍔犺浇锛岃绋嶅悗銆傘€傘€�'
   *  });
   * </code></pre>
   * @cfg {String} msg [msg = 'Loading...']
   */
  msg:{
    value : 'Loading...'
  },
  /**
   * 鍔犺浇鏃舵樉绀虹殑鍔犺浇淇℃伅鐨勬牱寮�
   * <pre><code>
   *  var loadMask = new Mask.LoadMask({
   *    el : '#domId',
   *    msgCls : 'custom-cls'
   *  });
   * </code></pre>
   * @cfg {String} [msgCls = 'x-mask-loading']
   */
  msgCls:{
    value : 'x-mask-loading'
  },
  /**
   * 鍔犺浇鎺т欢鏄惁绂佺敤
   * @type {Boolean}
   * @field
   * @default false
   * @ignore
   */
  disabled:{
     value : false
  }
};

//瀵硅薄鍘熷瀷
BUI.augment(LoadMask,
{
  
  /**
   * 璁剧疆鎺т欢涓嶅彲鐢�
   */
  disable:function () {
    this.set('disabled',true);
  },
  /**
   * @private 鍔犺浇宸茬粡瀹屾瘯锛岃В闄ゅ睆钄�
   */
  onLoad:function () {
    Mask.unmaskElement(this.get('el'));
  },
  /**
   * @private 寮€濮嬪姞杞斤紝灞忚斀褰撳墠鍏冪礌
   */
  onBeforeLoad:function () {
    var _self = this;
    if (!_self.get('disabled')) {
      Mask.maskElement(_self.get('el'), _self.get('msg'), this.get('msgCls'));
    }
  },
  /**
   * 鏄剧ず鍔犺浇鏉★紝骞堕伄鐩栧厓绱�
   */
  show:function () {
    this.onBeforeLoad();
  },

  /**
   * 闅愯棌鍔犺浇鏉★紝骞惰В闄ら伄鐩栧厓绱�
   */
  hide:function () {
    this.onLoad();
  },

  /*
   * 娓呯悊璧勬簮
   */
  destroy:function () {
    this.hide();
    this.clearAttrVals();
    this.off();
  }
});

module.exports = LoadMask;

});

define("bui/overlay", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview Overlay 妯″潡鐨勫叆鍙�
 * @ignore
 */

var BUI = require("bui/common"),
  Overlay = BUI.namespace('Overlay');

BUI.mix(Overlay, {
  Overlay : require("bui/overlay/overlay"),
  Dialog : require("bui/overlay/dialog"),
  Message : require("bui/overlay/message")
});

BUI.mix(Overlay,{
  OverlayView : Overlay.Overlay.View,
  DialogView : Overlay.Dialog.View
});

BUI.Message = BUI.Overlay.Message;

module.exports = Overlay;

});
define("bui/overlay/overlay", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鎮诞灞�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Component =  BUI.Component,
  CLS_ARROW = 'x-align-arrow',
  UIBase = Component.UIBase;

/**
 * 鎮诞灞傜殑瑙嗗浘绫�
 * @class BUI.Overlay.OverlayView
 * @extends BUI.Component.View
 * @mixins BUI.Component.UIBase.PositionView
 * @mixins BUI.Component.UIBase.CloseView
 * @private
 */
var overlayView = Component.View.extend([
    UIBase.PositionView,
    UIBase.CloseView
  ]);

/**
 * 鎮诞灞傦紝鏄剧ず鎮诞淇℃伅锛孧essage銆丏ialog鐨勫熀绫�
 * <p>
 * <img src="../assets/img/class-overlay.jpg"/>
 * </p>
 * xclass : 'overlay'
 * ** 涓€鑸潵璇达紝overlay鐨勫瓙绫伙紝Dialog 銆丮essage銆乀oolTip宸茬粡鑳藉婊¤冻鏃ュ父搴旂敤锛屼絾鏄娇鐢╫veray鏇撮€傚悎涓€浜涙洿鍔犵伒娲荤殑鍦版柟 **
 * ## 绠€鍗昽verlay
 * <pre><code>
 *   BUI.use('bui/overlay',function(Overlay){
 *     //鐐瑰嚮#btn锛屾樉绀簅verlay
 *     var overlay = new Overlay.Overlay({
 *       trigger : '#btn',
 *       content : '杩欐槸鍐呭',
 *       align : {
 *         points : ['bl','tl']
 *       }, //瀵归綈鏂瑰紡
 *       elCls : 'custom-cls', //鑷畾涔夋牱寮�
 *       autoHide : true //鐐瑰嚮overlay澶栭潰锛宱verlay 浼氳嚜鍔ㄩ殣钘�
 *     });
 *
 *     overlay.render();
 *   });
 * </code></pre>
 *
 * 
 * @class BUI.Overlay.Overlay
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.Position
 * @mixins BUI.Component.UIBase.Align
 * @mixins BUI.Component.UIBase.Close
 * @mixins BUI.Component.UIBase.AutoShow
 * @mixins BUI.Component.UIBase.AutoHide
 */
var overlay = Component.Controller.extend([UIBase.Position,UIBase.Align,UIBase.Close,UIBase.AutoShow,UIBase.AutoHide],{
  renderUI : function(){
    var _self = this,
      el = _self.get('el'),
      arrowContainer = _self.get('arrowContainer'),
      container = arrowContainer ? el.one(arrowContainer) : el;
    if(_self.get('showArrow')){
      $(_self.get('arrowTpl')).appendTo(container);
    }
  },
  show : function(){
    var _self = this,
      effectCfg = _self.get('effect'),
      el = _self.get('el'),
	    visibleMode = _self.get('visibleMode'),
      effect = effectCfg.effect,
      duration = effectCfg.duration;

	  
    //濡傛灉杩樻湭娓叉煋锛屽垯鍏堟覆鏌撴帶浠�
    if(!_self.get('rendered')){
      _self.set('visible',true);
      _self.render();
      _self.set('visible',false);
      el = _self.get('el');
    }

    if(visibleMode === 'visibility'){
      _self.set('visible',true);
      el.css({display : 'none'});
    }
    
    switch(effect){
      case  'linear' :
        el.show(duration,callback);
        break;
      case  'fade' :
        el.fadeIn(duration,callback);
        break;
      case  'slide' :
        el.slideDown(duration,callback);
        break;
      default:
        callback();
      break;
    }

    function callback(){
      if(visibleMode === 'visibility'){
        el.css({display : 'block'});
      }else{
        _self.set('visible',true);
      }
      if(effectCfg.callback){
        effectCfg.callback.call(_self);
      }
      //鑷姩闅愯棌
      var delay = _self.get('autoHideDelay'),
        delayHandler = _self.get('delayHandler');
      if(delay){
        delayHandler && clearTimeout(delayHandler);
        delayHandler = setTimeout(function(){
          _self.hide();
          _self.set('delayHandler',null);
        },delay);
        _self.set('delayHandler',delayHandler);
      }
    }

  },
  hide : function(){
    var _self = this,
      effectCfg = _self.get('effect'),
      el = _self.get('el'),
      effect = effectCfg.effect,
      duration = effectCfg.duration;
	  
    switch(effect){
      case 'linear':
        el.hide(duration,callback);
        break;
      case  'fade' :
        el.fadeOut(duration,callback);
        break;
      case  'slide' :
        el.slideUp(duration,callback);
        break;
      default:
        callback();
      break;
    }
    function callback(){
      if(_self.get('visibleMode') === 'visibility'){
        el.css({display : 'block'});
      }
      _self.set('visible',false);
      if(effectCfg.callback){
        effectCfg.callback.call(_self);
      }
    }

  }
},{
  ATTRS : 
{
    /**
     * {Object} - 鍙€�, 鏄剧ず鎴栭殣钘忔椂鐨勭壒鏁堟敮鎸�, 瀵硅薄鍖呭惈浠ヤ笅閰嶇疆
     * <ol>
     * <li>effect:鐗规晥鏁堟灉锛�'none(榛樿鏃犵壒鏁�)','linear(绾挎€�)',fade(娓愬彉)','slide(婊戝姩鍑虹幇)'</li>
     * <li>duration:鏃堕棿闂撮殧 </li>
     * </ol>
     * @type {Object}
     */
    effect:{
      value : {
        effect : 'none',
        duration : 0,
        callback : null
      }
    },
    /**
     * 鏄剧ず鍚庨棿闅斿灏戠鑷姩闅愯棌
     * @type {Number}
     */
    autoHideDelay : {

    },
    /**
     * whether this component can be closed.
     * @default false
     * @type {Boolean}
     * @protected
     */
    closeable:{
        value:false
    },
    /**
     * 鏄惁鏄剧ず鎸囧悜绠ご锛岃窡align灞炴€х殑points鐩稿叧
     * @cfg {Boolean} [showArrow = false]
     */
    showArrow : {
      value : false
    },
    /**
     * 绠ご鏀剧疆鍦ㄧ殑浣嶇疆锛屾槸涓€涓€夋嫨鍣紝渚嬪 .arrow-wraper
     *     new Tip({ //鍙互璁剧疆鏁翠釜鎺т欢鐨勬ā鏉�
     *       arrowContainer : '.arrow-wraper',
     *       tpl : '<div class="arrow-wraper"></div>'
     *     });
     *     
     * @cfg {String} arrowContainer
     */
    arrowContainer : {
      view : true
    },
    /**
     * 鎸囧悜绠ご鐨勬ā鏉�
     * @cfg {Object} arrowTpl
     */
    arrowTpl : {
      value : '<s class="' + CLS_ARROW + '"><s class="' + CLS_ARROW + '-inner"></s></s>'
    },
    visibleMode : {
      value : 'visibility'
    },
    visible :{
      value:false
    },
    xview : {
      value : overlayView
    }
  }
},{
  xclass:'overlay'
});

overlay.View = overlayView;

module.exports = overlay;

});
define("bui/overlay/dialog", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 寮瑰嚭妗�
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  Overlay = require("bui/overlay/overlay"),
  UIBase = BUI.Component.UIBase,
  CLS_TITLE = 'header-title',
  PREFIX = BUI.prefix,
  HEIGHT_PADDING = 20;

/**
 * dialog鐨勮鍥剧被
 * @class BUI.Overlay.DialogView
 * @extends BUI.Overlay.OverlayView
 * @mixins BUI.Component.UIBase.StdModView
 * @mixins BUI.Component.UIBase.MaskView
 * @private
 */
var dialogView = Overlay.View.extend([UIBase.StdModView,UIBase.MaskView],{

  /**
   * 瀛愮粍浠跺皢瑕佹覆鏌撳埌鐨勮妭鐐癸紝鍦� render 绫讳笂瑕嗙洊瀵瑰簲鏂规硶
   * @protected
   * @ignore
   */
  getContentElement: function () {
    return this.get('body');
  },

  _uiSetTitle:function(v){
    var _self = this,
      el = _self.get('el');

    el.find('.' + CLS_TITLE).html(v);

  },
  _uiSetContentId : function(v){
    var _self = this,
      body = _self.get('body'),
      children = $('#'+v).children();

    children.appendTo(body);
  },
  _uiSetHeight : function(v){
    var _self = this,
      bodyHeight = v,
      header = _self.get('header'),
      body = _self.get('body'),
      footer = _self.get('footer');

    bodyHeight -= header.outerHeight()+footer.outerHeight();
    bodyHeight -=HEIGHT_PADDING * 2;
    body.height(bodyHeight);
  },
  _removeContent : function(){
    var _self = this,
      body = _self.get('body'),
      contentId = _self.get('contentId');
    if(contentId){
      body.children().appendTo($('#'+contentId));
    }else {
      body.children().remove();
    }
  }

},{
  xclass:'dialog-view'
});

/**
 * 寮瑰嚭妗� xclass:'dialog'
 * <p>
 * <img src="../assets/img/class-overlay.jpg"/>
 * </p>
 * ** 鏅€氬脊鍑烘 **
 * <pre><code>
 *  BUI.use('bui/overlay',function(Overlay){
 *      var dialog = new Overlay.Dialog({
 *        title:'闈炴ā鎬佺獥鍙�',
 *        width:500,
 *        height:300,
 *        mask:false,  //璁剧疆鏄惁妯℃€�
 *        buttons:[],
 *        bodyContent:'<p>杩欐槸涓€涓潪妯℃€佺獥鍙�,骞朵笖涓嶅甫鎸夐挳</p>'
 *      });
 *    dialog.show();
 *    $('#btnShow').on('click',function () {
 *      dialog.show();
 *    });
 *  });
 * </code></pre>
 *
 * ** 浣跨敤鐜版湁鐨刪tml缁撴瀯 **
 * <pre><code>
 *  BUI.use('bui/overlay',function(Overlay){
 *      var dialog = new Overlay.Dialog({
 *        title:'閰嶇疆DOM',
 *        width:500,
 *        height:250,
 *        contentId:'content',//閰嶇疆DOM瀹瑰櫒鐨勭紪鍙�
 *        success:function () {
 *          alert('纭');
 *          this.hide();
 *        }
 *      });
 *    dialog.show();
 *    $('#btnShow').on('click',function () {
 *      dialog.show();
 *    });
 *  });
 * </code></pre>
 * @class BUI.Overlay.Dialog
 * @extends BUI.Overlay.Overlay
 * @mixins BUI.Component.UIBase.StdMod
 * @mixins BUI.Component.UIBase.Mask
 * @mixins BUI.Component.UIBase.Drag
 */
var dialog = Overlay.extend([UIBase.StdMod,UIBase.Mask,UIBase.Drag],{
  
  show:function(){
    var _self = this;
    align = _self.get('align');
    
    dialog.superclass.show.call(this);
    _self.set('align',align);
    
    
  },/**/
  //缁戝畾浜嬩欢
  bindUI : function(){
    var _self = this;
    _self.on('closeclick',function(){
      return _self.onCancel();
    });
  },
  /**
   * @protected
   * 鍙栨秷
   */
  onCancel : function(){
    var _self = this,
      cancel = _self.get('cancel');
    return cancel.call(this);
  },
  //璁剧疆鎸夐挳
  _uiSetButtons:function(buttons){
    var _self = this,
      footer = _self.get('footer');

    footer.children().remove();
    BUI.each(buttons,function(conf){
      _self._createButton(conf,footer);
    });

  },
  //鍒涘缓鎸夐挳
  _createButton : function(conf,parent){
    var _self = this,
      temp = '<button class="'+conf.elCls+'">'+conf.text+'</button>',
      btn = $(temp).appendTo(parent);
    btn.on('click',function(){
      conf.handler.call(_self,_self,this);
    });
  },
  destructor : function(){
    var _self = this,
      contentId = _self.get('contentId'),
      body = _self.get('body'),
      closeAction = _self.get('closeAction');
    if(closeAction == 'destroy'){
      _self.hide();
      if(contentId){
        body.children().appendTo('#'+contentId);
      }
    }
  }
},{

  ATTRS : 
  {
    closeTpl:{
      view:true,
      value : '<a tabindex="0" href=javascript:void("鍏抽棴") role="button" class="' + PREFIX + 'ext-close" style=""><span class="' + PREFIX + 'ext-close-x x-icon x-icon-normal">脳</span></a>'
    },
   /**
     * 寮瑰嚭搴撶殑鎸夐挳锛屽彲浠ユ湁澶氫釜,鏈�3涓弬鏁�
     * var dialog = new Overlay.Dialog({
     *     title:'鑷畾涔夋寜閽�',
     *     width:500,
     *     height:300,
     *     mask:false,
     *     buttons:[
     *       {
     *         text:'鑷畾涔�',
     *         elCls : 'button button-primary',
     *         handler : function(){
     *           //do some thing
     *           this.hide();
     *         }
     *       },{
     *         text:'鍏抽棴',
     *         elCls : 'button',
     *         handler : function(){
     *           this.hide();
     *         }
     *       }
     *     ],
     *     
     *     bodyContent:'<p>杩欐槸涓€涓嚜瀹氫箟鎸夐挳绐楀彛,鍙互閰嶇疆浜嬩欢鍜屾枃鏈牱寮�</p>'
     *   });
     *  dialog.show();
     * <ol>
     *   <li>text:鎸夐挳鏂囨湰</li>
     *   <li>elCls:鎸夐挳鏍峰紡</li>
     *   <li>handler:鐐瑰嚮鎸夐挳鐨勫洖璋冧簨浠�</li>
     * </ol>
     * @cfg {Array} buttons
     * @default '纭畾'銆�'鍙栨秷'2涓寜閽�
     * 
     */
    buttons:{
      value:[
        {
          text:'纭畾',
          elCls : 'button button-primary',
          handler : function(){
            var _self = this,
              success = _self.get('success');
            if(success){
              success.call(_self);
            }
          }
        },{
          text:'鍙栨秷',
          elCls : 'button button-primary',
          handler : function(dialog,btn){
            if(this.onCancel() !== false){
              this.close();
            }
          }
        }
      ]
    },
    /**
     * 寮瑰嚭妗嗘樉绀哄唴瀹圭殑DOM瀹瑰櫒ID
     * @cfg {Object} contentId
     */
    contentId:{
      view:true
    },
    /**
    * 鐐瑰嚮鎴愬姛鏃剁殑鍥炶皟鍑芥暟
    * @cfg {Function} success
    */
    success : {
      value : function(){
        this.close();
      }
    },
    /**
     * 鐢ㄦ埛鍙栨秷鏃惰皟鐢紝濡傛灉return false鍒欓樆姝㈢獥鍙ｅ叧闂�
     * @cfg {Function} cancel
     */
    cancel : {
      value : function(){

      }
    },
    dragNode : {
      /**
       * @private
       */
      valueFn : function(){
        return this.get('header');
      }
    },

    /**
     * 榛樿鐨勫姞杞芥帶浠跺唴瀹圭殑閰嶇疆,榛樿鍊硷細
     * <pre>
     *  {
     *    property : 'bodyContent',
     *    autoLoad : false,
     *    lazyLoad : {
     *      event : 'show'
     *    },
     *    loadMask : {
     *      el : _self.get('body')
     *    }
     *  }
     * </pre>
     * @type {Object}
     */
    defaultLoaderCfg  : {
      valueFn :function(){
        var _self = this;
        return {
          property : 'bodyContent',
          autoLoad : false,
          lazyLoad : {
            event : 'show'
          },
          loadMask : {
            el : _self.get('body')
          }
        }
      } 
    },
    /**
     * 寮瑰嚭妗嗘爣棰�
     * @cfg {String} title
     */
    /**
     * 寮瑰嚭妗嗘爣棰�
     * <pre><code>
     *  dialog.set('title','new title');
     * </code></pre>
     * @type {String}
     */
    title : {
      view:true,
      value : ''
    },
    align : {
      value : {
        node : window,
        points : ['cc','cc']
      }
    },
    mask : {
      value:true
    },
    maskShared:{
      value:false
    },
    headerContent:{
      value:'<div class="' + CLS_TITLE + '">鏍囬</div>'
    },
    footerContent:{

    },
    closeable:{
      value : true
    },
    xview:{
      value:dialogView
    }
  }
},{
  xclass : 'dialog'
});

dialog.View = dialogView;

module.exports = dialog;

});
define("bui/overlay/message", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 娑堟伅妗嗭紝璀﹀憡銆佺‘璁�
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  Dialog = require("bui/overlay/dialog"),
  PREFIX = BUI.prefix,
  iconText ={
      info : 'i',
      error : '脳',
      success : '<i class="icon-ok icon-white"></i>',
      question : '?',
      warning: '!'
  };

/**
 * 娑堟伅妗嗙被锛屼竴鑸笉鐩存帴鍒涘缓瀵硅薄锛岃€屾槸璋冪敤鍏禔lert鍜孋onfirm鏂规硶
 * <pre><code>
 ** BUI.use('bui/overlay',function(overlay){
 * 
 *    BUI.Message.Alert('杩欏彧鏄畝鍗曠殑鎻愮ず淇℃伅','info');
 *    BUI.Message.Alert('杩欏彧鏄畝鍗曠殑鎴愬姛淇℃伅','success');
 *    BUI.Message.Alert('杩欏彧鏄畝鍗曠殑璀﹀憡淇℃伅','warning');
 *    BUI.Message.Alert('杩欏彧鏄畝鍗曠殑閿欒淇℃伅','error');
 *    BUI.Message.Alert('杩欏彧鏄畝鍗曠殑璇㈤棶淇℃伅','question');
 *
 *    //鍥炶皟鍑芥暟
 *    BUI.Message.Alert('鐐瑰嚮瑙﹀彂鍥炶皟鍑芥暟',function() {
 *         alert('鎵ц鍥炶皟');
 *       },'error');
 *       
 *    //澶嶆潅鐨勬彁绀轰俊鎭�
 *    var msg = '&lt;h2&gt;涓婁紶澶辫触锛岃涓婁紶10M浠ュ唴鐨勬枃浠�&lt;/h2&gt;'+
 *       '&lt;p class="auxiliary-text"&gt;濡傝繛缁笂浼犲け璐ワ紝璇峰強鏃惰仈绯诲鏈嶇儹绾匡細0511-23883767834&lt;/p&gt;'+
 *       '&lt;p&gt;&lt;a href="#"&gt;杩斿洖list椤甸潰&lt;/a&gt; &lt;a href="#"&gt;鏌ョ湅璇︽儏&lt;/a&gt;&lt;/p&gt;';
 *     BUI.Message.Alert(msg,'error');
 *    //纭淇℃伅
 *    BUI.Message.Confirm('纭瑕佹洿鏀逛箞锛�',function(){
 *       alert('纭');
 *     },'question');
 * });
 * </code></pre>
 * @class BUI.Overlay.Message
 * @private
 * @extends BUI.Overlay.Dialog
 */
var message = Dialog.extend({

  /**
   * @protected
   * @ignore
   */
  renderUI : function(){
    this._setContent();
  },
  bindUI : function(){
    var _self = this,
      body = _self.get('body');
    _self.on('afterVisibleChange',function(ev){
      if(ev.newVal){
        if(BUI.UA.ie < 8){
         /**
         * fix ie6,7 bug
         * @ignore
         */
          var outerWidth = body.outerWidth();
          if(BUI.UA.ie == 6){
            outerWidth = outerWidth > 350 ? 350 : outerWidth;
          }
          _self.get('header').width(outerWidth - 20);
          _self.get('footer').width(outerWidth);
        }
      }
    });
  },
  //鏍规嵁妯＄増璁剧疆鍐呭
  _setContent : function(){
    var _self = this,
      body = _self.get('body'),
      contentTpl = BUI.substitute(_self.get('contentTpl'),{
        msg : _self.get('msg'),
        iconTpl : _self.get('iconTpl')
      });
    body.empty();

    $(contentTpl).appendTo(body);
  },
  //璁剧疆绫诲瀷
  _uiSetIcon : function(v){
     if (!this.get('rendered')) {
          return;
      }
      this._setContent();
  },
  //璁剧疆鏂囨湰
  _uiSetMsg : function(v){
     if (!this.get('rendered')) {
          return;
      }
      this._setContent();
  }

},{
  ATTRS : 
  {
    /**
     * 鍥炬爣绫诲瀷
     * <ol>
     * <li>鎻愮ず淇℃伅锛岀被鍨嬪弬鏁�<code>info</code></li>
     * <li>鎴愬姛淇℃伅锛岀被鍨嬪弬鏁�<code>success</code></li>
     * <li>璀﹀憡淇℃伅锛岀被鍨嬪弬鏁�<code>warning</code></li>
     * <li>閿欒淇℃伅锛岀被鍨嬪弬鏁�<code>error</code></li>
     * <li>纭淇℃伅锛岀被鍨嬪弬鏁�<code>question</code></li>
     * </ol>
     * @type {String}
     */
    icon : {

    },
    /**
     * 鎻愮ず娑堟伅锛屽彲浠ユ槸鏂囨湰鎴栬€卙tml
     * @cfg {String} msg
     */
    /**
     * 鎻愮ず娑堟伅锛屽彲浠ユ槸鏂囨湰鎴栬€卙tml
     * @type {String}
     */
    msg : {

    },
    /**
     * @private
     */
    iconTpl : {
      /**
       * @private
       */
      getter:function(){
        var _self = this,
          type = _self.get('icon');
        return '<div class="x-icon x-icon-' + type + '">' + iconText[type] + '</div>';
      }
    },
    /**
     * 鍐呭鐨勬ā鐗�
     * @type {String}
     * @protected
     */
    contentTpl : {
      value : '{iconTpl}<div class="' + PREFIX + 'message-content">{msg}</div>'
    }
  }
},{
  xclass : 'message',
  priority : 0
});

var singlelon;
    
function messageFun(buttons,defaultIcon){
 
  return function (msg,callback,icon){

    if(BUI.isString(callback)){
      icon = callback;
      callback = null;
    }
    icon = icon || defaultIcon;
    callback = callback || hide;
    showMessage({
      'buttons': buttons,
      'icon':icon,
      'msg':msg,
      'success' : callback
    });
    return singlelon;
  };
}

function showMessage(config){
  if(!singlelon){
    singlelon = new message({
        icon:'info',
        title:''
    });
  }
  singlelon.set(config);
    
  singlelon.show();
}

function success(){
 var _self = this,
    success = _self.get('success');
  if(success){
    success.call(_self);
    _self.hide();
  }
}

function hide(){
   this.hide();
}


var Alert = messageFun([{
        text:'纭畾',
        elCls : 'button button-primary',
        handler : success
      }
    ],'info'),
  Confirm = messageFun([{
        text:'纭畾',
        elCls : 'button button-primary',
        handler : success
      },{
          text:'鍙栨秷',
          elCls : 'button',
          handler : hide
        }
    ],'question');

/**
 * 鎻愮ず妗嗛潤鎬佺被
 * @class BUI.Message
 */

/**
 * 鏄剧ず鎻愮ず淇℃伅妗�
 * @static
 * @method
 * @member BUI.Message
 * @param  {String}   msg      鎻愮ず淇℃伅
 * @param  {Function} callback 纭畾鐨勫洖璋冨嚱鏁�
 * @param  {String}   icon     鍥炬爣锛屾彁渚涗互涓嬪嚑绉嶅浘鏍囷細info,error,success,question,warning
 */
message.Alert = Alert;

/**
 * 鏄剧ず纭妗�
 * <pre><code>
 * BUI.Message.Confirm('纭瑕佹洿鏀逛箞锛�',function(){
 *       alert('纭');
 * },'question');
 * </code></pre>
 * @static
 * @method
 * @member BUI.Message
 * @param  {String}   msg      鎻愮ず淇℃伅
 * @param  {Function} callback 纭畾鐨勫洖璋冨嚱鏁�
 * @param  {String}   icon     鍥炬爣锛屾彁渚涗互涓嬪嚑绉嶅浘鏍囷細info,error,success,question,warning
 */
message.Confirm = Confirm;

/**
 * 鑷畾涔夋秷鎭锛屼紶鍏ラ厤缃俊鎭� {@link BUI.Overlay.Dialog} 鍜� {@link BUI.Overlay.Message}
 * @static
 * @method
 * @member BUI.Message
 * @param  {Object}   config  閰嶇疆淇℃伅
 */
message.Show = showMessage;

module.exports = message;

});

define("bui/picker", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview Picker鐨勫叆鍙�
 * @author dxq613@gmail.com
 * @ignore
 */

var BUI = require("bui/common"),
  Picker = BUI.namespace('Picker');

BUI.mix(Picker, {
  Mixin : require("bui/picker/mixin"),
  Picker : require("bui/picker/picker"),
  ListPicker : require("bui/picker/listpicker")
});

module.exports = Picker;

});
define("bui/picker/mixin", ["jquery"], function(require, exports, module){
/**
 * @fileOverview picker鐨勬墿灞�
 * @ignore
 */

var $ = require("jquery");

/**
 * @class BUI.Picker.Mixin
 */
var Mixin = function () {
};

Mixin.ATTRS = {
  /**
   * 鐢ㄤ簬閫夋嫨鐨勬帶浠讹紝榛樿涓虹涓€涓瓙鍏冪礌,姝ゆ帶浠跺疄鐜� @see {BUI.Component.UIBase.Selection} 鎺ュ彛
   * @protected
   * @type {Object|BUI.Component.Controller}
   */
  innerControl : {
    getter:function(){
      return this.get('children')[0];
    }
  },
  /**
   * 鏄剧ず閫夋嫨鍣ㄧ殑浜嬩欢
   * @cfg {String} [triggerEvent='click']
   */
  /**
   * 鏄剧ず閫夋嫨鍣ㄧ殑浜嬩欢
   * @type {String}
   * @default 'click'
   */
  triggerEvent:{
    value:'click'
  },
  /**
   * 閫夋嫨鍣ㄩ€変腑鐨勯」锛屾槸鍚﹂殢鐫€瑙﹀彂鍣ㄦ敼鍙�
   * @cfg {Boolean} [autoSetValue=true]
   */
  /**
   * 閫夋嫨鍣ㄩ€変腑鐨勯」锛屾槸鍚﹂殢鐫€瑙﹀彂鍣ㄦ敼鍙�
   * @type {Boolean}
   */
  autoSetValue : {
    value : true
  },
  /**
   * 閫夋嫨鍙戠敓鏀瑰彉鐨勪簨浠�
   * @cfg {String} [changeEvent='selectedchange']
   */
  /**
   * 閫夋嫨鍙戠敓鏀瑰彉鐨勪簨浠�
   * @type {String}
   */
  changeEvent : {
    value:'selectedchange'
  },
  /**
   * 鑷姩闅愯棌
   * @type {Boolean}
   * @override
   */
  autoHide:{
    value : true
  },
  /**
   * 闅愯棌閫夋嫨鍣ㄧ殑浜嬩欢
   * @protected
   * @type {String}
   */
  hideEvent:{
    value:'itemclick'
  },
  /**
   * 杩斿洖鐨勬枃鏈斁鍦ㄧ殑DOM锛屼竴鑸槸input
   * @cfg {String|HTMLElement|jQuery} textField
   */
  /**
   * 杩斿洖鐨勬枃鏈斁鍦ㄧ殑DOM锛屼竴鑸槸input
   * @type {String|HTMLElement|jQuery}
   */
  textField : {

  },
  align : {
    value : {
       points: ['bl','tl'], // ['tr', 'tl'] 琛ㄧず overlay 鐨� tl 涓庡弬鑰冭妭鐐圭殑 tr 瀵归綈
       offset: [0, 0]      // 鏈夋晥鍊间负 [n, m]
    }
  },
  /**
   * 杩斿洖鐨勫€兼斁缃瓺OM ,涓€鑸槸input
   * @cfg {String|HTMLElement|jQuery} valueField
   */
  /**
   * 杩斿洖鐨勫€兼斁缃瓺OM ,涓€鑸槸input
   * @type {String|HTMLElement|jQuery}
   */
  valueField:{

  }
  /**
   * @event selectedchange
   * 閫変腑鍊兼敼鍙樹簨浠�
   * @param {Object} e 浜嬩欢瀵硅薄
   * @param {String} text 閫変腑鐨勬枃鏈�
   * @param {string} value 閫変腑鐨勫€�
   * @param {jQuery} curTrigger 褰撳墠瑙﹀彂picker鐨勫厓绱�
   */
}

Mixin.prototype = {

  __bindUI : function(){
    var _self = this,
      //innerControl = _self.get('innerControl'),
      hideEvent = _self.get('hideEvent'),
      trigger = $(_self.get('trigger'));

    _self.on('show',function(ev){
    //trigger.on(_self.get('triggerEvent'),function(e){
      if(!_self.get('isInit')){
        _self._initControl();
      }
      if(_self.get('autoSetValue')){
        var valueField = _self.get('valueField') || _self.get('textField') || _self.get('curTrigger'),
          val = $(valueField).val();
        _self.setSelectedValue(val);
      }
    });

    //_self.initControlEvent();
  },
  _initControl : function(){
    var _self = this;
    if(_self.get('isInit')){ //宸茬粡鍒濆鍖栬繃
      return ;
    }
    if(!_self.get('innerControl')){
      var control = _self.createControl();
      _self.get('children').push(control);
    }
    _self.initControlEvent();
    _self.set('isInit',true);
  },
  /**
   * 鍒濆鍖栧唴閮ㄦ帶浠讹紝缁戝畾浜嬩欢
   */
  initControl : function(){
    this._initControl();
  },  
  /**
   * @protected
   * 鍒濆鍖栧唴閮ㄦ帶浠�
   */
  createControl : function(){
    
  },
  //鍒濆鍖栧唴閮ㄦ帶浠剁殑浜嬩欢
  initControlEvent : function(){
    var _self = this,
      innerControl = _self.get('innerControl'),
      trigger = $(_self.get('trigger')),
      hideEvent = _self.get('hideEvent');

    innerControl.on(_self.get('changeEvent'),function(e){
      var curTrigger = _self.get('curTrigger'),
        textField = _self.get('textField') || curTrigger || trigger,
        valueField = _self.get('valueField'),
        selValue = _self.getSelectedValue(),
        isChange = false;

      if(textField){
        var selText = _self.getSelectedText(),
          preText = $(textField).val();
        if(selText != preText){
          $(textField).val(selText);
          isChange = true;
          $(textField).trigger('change');
        }
      }
      
      if(valueField && _self.get('autoSetValue')){
        var preValue = $(valueField).val();  
        if(valueField != preValue){
          $(valueField).val(selValue);
          isChange = true;
          $(valueField).trigger('change');
        }
      }
      if(isChange){
        _self.onChange(selText,selValue,e);
      }
    });
    
    if(hideEvent){
      innerControl.on(_self.get('hideEvent'),function(){
        var curTrigger = _self.get('curTrigger');
        try{ //闅愯棌鏃讹紝鍦╥e6,7涓嬩細鎶ラ敊
          if(curTrigger){
            curTrigger.focus();
          }
        }catch(e){
          BUI.log(e);
        }
        _self.hide();
      });
    }
  },
  /**
   * 璁剧疆閫変腑鐨勫€�
   * @template
   * @protected
   * @param {String} val 璁剧疆鍊�
   */
  setSelectedValue : function(val){
    
  },
  /**
   * 鑾峰彇閫変腑鐨勫€硷紝澶氶€夌姸鎬佷笅锛屽€间互','鍒嗗壊
   * @template
   * @protected
   * @return {String} 閫変腑鐨勫€�
   */
  getSelectedValue : function(){
    
  },
  /**
   * 鑾峰彇閫変腑椤圭殑鏂囨湰锛屽閫夌姸鎬佷笅锛屾枃鏈互','鍒嗗壊
   * @template
   * @protected
   * @return {String} 閫変腑鐨勬枃鏈�
   */
  getSelectedText : function(){

  },
  /**
   * 閫夋嫨鍣ㄨ幏鍙栫劍鐐规椂锛岄粯璁ら€変腑鍐呴儴鎺т欢
   */
  focus : function(){
    this.get('innerControl').focus();
  },
  /**
   * @protected
   * 鍙戠敓鏀瑰彉
   */
  onChange : function(selText,selValue,ev){
    var _self = this,
      curTrigger = _self.get('curTrigger');
    //curTrigger && curTrigger.trigger('change'); //瑙﹀彂鏀瑰彉浜嬩欢
    _self.fire('selectedchange',{value : selValue,text : selText,curTrigger : curTrigger});
  },
  /**
   * 澶勭悊 esc 閿�
   * @protected
   * @param  {jQuery.Event} ev 浜嬩欢瀵硅薄
   */
  handleNavEsc : function (ev) {
    this.hide();
  },
  _uiSetValueField : function(v){
    var _self = this;
    if(v != null && v !== '' && _self.get('autoSetValue')){ //if(v)闂澶
      _self.setSelectedValue($(v).val());
    }
  },
  _getTextField : function(){
    var _self = this;
    return _self.get('textField') || _self.get('curTrigger');
  }
}

module.exports = Mixin;

});
define("bui/picker/picker", ["jquery","bui/overlay","bui/common"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨鍣�
 * @ignore
 */

  
var $ = require("jquery"),
  Overlay = require("bui/overlay").Overlay,
  Mixin = require("bui/picker/mixin");

/**
 * 閫夋嫨鍣ㄦ帶浠剁殑鍩虹被锛屽脊鍑轰竴涓眰鏉ラ€夋嫨鏁版嵁锛屼笉瑕佷娇鐢ㄦ绫诲垱寤烘帶浠讹紝浠呯敤浜庣户鎵垮疄鐜版帶浠�
 * xclass : 'picker'
 * <pre><code>
 * BUI.use(['bui/picker','bui/list'],function(Picker,List){
 *
 * var items = [
 *       {text:'閫夐」1',value:'a'},
 *       {text:'閫夐」2',value:'b'},
 *      {text:'閫夐」3',value:'c'}
 *     ],
 *   list = new List.SimpleList({
 *     elCls:'bui-select-list',
 *     items : items
 *   }),
 *   picker = new Picker.ListPicker({
 *     trigger : '#show',  
 *     valueField : '#hide', //濡傛灉闇€瑕佸垪琛ㄨ繑鍥炵殑value锛屾斁鍦ㄩ殣钘忓煙锛岄偅涔堟寚瀹氶殣钘忓煙
 *     width:100,  //鎸囧畾瀹藉害
 *     children : [list] //閰嶇疆picker鍐呯殑鍒楄〃
 *   });
 * picker.render();
 * });
 * </code></pre>
 * @abstract
 * @class BUI.Picker.Picker
 * @mixins BUI.Picker.Mixin
 * @extends BUI.Overlay.Overlay
 */
var picker = Overlay.extend([Mixin], {
  
},{
  ATTRS : {

  }
},{
  xclass:'picker'
});

module.exports = picker;

});
define("bui/picker/listpicker", ["jquery","bui/list","bui/common","bui/data","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 鍒楄〃椤圭殑閫夋嫨鍣�
 * @ignore
 */


var $ = require("jquery"),
  List = require("bui/list"),
  Picker = require("bui/picker/picker"),
  /**
   * 鍒楄〃閫夋嫨鍣�,xclass = 'list-picker'
   * <pre><code>
   * BUI.use(['bui/picker'],function(Picker){
   *
   * var items = [
   *       {text:'閫夐」1',value:'a'},
   *       {text:'閫夐」2',value:'b'},
   *      {text:'閫夐」3',value:'c'}
   *     ],
   *   picker = new Picker.ListPicker({
   *     trigger : '#show',  
   *     valueField : '#hide', //濡傛灉闇€瑕佸垪琛ㄨ繑鍥炵殑value锛屾斁鍦ㄩ殣钘忓煙锛岄偅涔堟寚瀹氶殣钘忓煙
   *     width:100,  //鎸囧畾瀹藉害
   *     children : [{
   *        elCls:'bui-select-list',
   *        items : items
   *     }] //閰嶇疆picker鍐呯殑鍒楄〃
   *   });
   * picker.render();
   * });
   * </code></pre>
   * @class BUI.Picker.ListPicker
   * @extends BUI.Picker.Picker
   */
  listPicker = Picker.extend({
    initializer : function(){
      var _self = this,
        children = _self.get('children'),
        list = _self.get('list');
      if(!list){
        children.push({

        });
      }
    },
    /**
     * 璁剧疆閫変腑鐨勫€�
     * @override
     * @param {String} val 璁剧疆鍊�
     */
    setSelectedValue : function(val){
      val = val ? val.toString() : '';
      if(!this.get('isInit')){
        this._initControl();
      }
      var _self = this,
        list = _self.get('list'),
        selectedValue = _self.getSelectedValue();
      if(val !== selectedValue && list.getCount()){
        if(list.get('multipleSelect')){
          list.clearSelection();
        }
        list.setSelectionByField(val.split(','));
      }   
    },
    /**
     * @protected
     * @ignore
     */
    onChange : function(selText,selValue,ev){
      var _self = this,
        curTrigger = _self.get('curTrigger');
      //curTrigger && curTrigger.trigger('change'); //瑙﹀彂鏀瑰彉浜嬩欢
      _self.fire('selectedchange',{value : selValue,text : selText,curTrigger : curTrigger,item : ev.item});
    },
    /**
     * 鑾峰彇閫変腑鐨勫€硷紝澶氶€夌姸鎬佷笅锛屽€间互','鍒嗗壊
     * @return {String} 閫変腑鐨勫€�
     */
    getSelectedValue : function(){
      if(!this.get('isInit')){
        this._initControl();
      }
      return this.get('list').getSelectionValues().join(',');
    },
    /**
     * 鑾峰彇閫変腑椤圭殑鏂囨湰锛屽閫夌姸鎬佷笅锛屾枃鏈互','鍒嗗壊
     * @return {String} 閫変腑鐨勬枃鏈�
     */
    getSelectedText : function(){
      if(!this.get('isInit')){
        this._initControl();
      }
      return this.get('list').getSelectionText().join(',');
    }
  },{
    ATTRS : {
      /**
       * 榛樿瀛愭帶浠剁殑鏍峰紡,榛樿涓�'simple-list'
       * @type {String}
       * @override
       */
      defaultChildClass:{
        value : 'simple-list'
      },
      /**
       * 閫夋嫨鐨勫垪琛�
       * <pre><code>
       *  var list = picker.get('list');
       *  list.getSelected();
       * </code></pre>
       * @type {BUI.List.SimpleList}
       * @readOnly
       */
      list : {
        getter:function(){
          return this.get('children')[0];
        }
      }
      /**
       * @event selectedchange
       * 閫夋嫨鍙戠敓鏀瑰彉浜嬩欢
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {String} e.text 閫変腑鐨勬枃鏈�
       * @param {string} e.value 閫変腑鐨勫€�
       * @param {Object} e.item 鍙戠敓鏀瑰彉鐨勯€夐」
       * @param {jQuery} e.curTrigger 褰撳墠瑙﹀彂picker鐨勫厓绱�
       */
    }
  },{
    xclass : 'list-picker'
  });

module.exports = listPicker;

});

define("bui/toolbar", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 宸ュ叿鏍忓懡鍚嶇┖闂村叆鍙�
 * @ignore
 */

var BUI = require("bui/common"),
  Toolbar = BUI.namespace('Toolbar');

BUI.mix(Toolbar,{
  BarItem : require("bui/toolbar/baritem"),
  Bar : require("bui/toolbar/bar"),
  PagingBar : require("bui/toolbar/pagingbar"),
  NumberPagingBar : require("bui/toolbar/numberpagingbar")
});
module.exports = Toolbar;

});
define("bui/toolbar/baritem", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview buttons or controls of toolbar
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */

/**
 * @name BUI.Toolbar
 * @namespace 宸ュ叿鏍忓懡鍚嶇┖闂�
 * @ignore
 */
var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  Component = BUI.Component,
  UIBase = Component.UIBase;
  
/**
 * barItem鐨勮鍥剧被
 * @class BUI.Toolbar.BarItemView
 * @extends BUI.Component.View
 * @mixins BUI.Component.UIBase.ListItemView
 * @private
 */
var BarItemView = Component.View.extend([UIBase.ListItemView]);
/**
   * 宸ュ叿鏍忕殑瀛愰」锛屽寘鎷寜閽€佹枃鏈€侀摼鎺ュ拰鍒嗛殧绗︾瓑
   * @class BUI.Toolbar.BarItem
   * @extends BUI.Component.Controller
   */
var BarItem = Component.Controller.extend([UIBase.ListItem],{
  
  /**
  * render baritem 's dom
  * @protected
  */
  renderUI:function() {
      var el = this.get('el');
      el.addClass(PREFIX + 'inline-block');
      if (!el.attr('id')) {
          el.attr('id', this.get('id'));
      }
  }
},{
  ATTRS:
  {
    elTagName :{
        view : true,
        value : 'li'
    },
    /**
     * 鏄惁鍙€夋嫨
     * <pre><code>
     * 
     * </code></pre>
     * @cfg {Object} [selectable = false]
     */
    selectable : {
      value : false
    },
    /**
    * 鏄惁鑾峰彇鐒︾偣
    * @default {boolean} false
    */
    focusable : {
      value : false
    },
    xview: {
      value : BarItemView
    }
  }
},{
  xclass : 'bar-item',
  priority : 1  
});

/**
   * 宸ュ叿鏍忕殑瀛愰」锛屾坊鍔犳寜閽�
   * xclass : 'bar-item-button'
   * @extends  BUI.Toolbar.BarItem
   * @class BUI.Toolbar.BarItem.Button
   */
var ButtonBarItem = BarItem.extend({
  
  _uiSetDisabled : function(value){
    var _self = this,
      el = _self.get('el'),
      method = value ? 'addClass' : 'removeClass';
    
    el.find('button').attr('disabled',value)[method](PREFIX + 'button-disabled');
  },
  _uiSetChecked: function(value){
    var _self = this,
      el = _self.get('el'),
      method = value ? 'addClass' : 'removeClass';

      el.find('button')[method](PREFIX + 'button-checked');
  },
  _uiSetText : function(v){
    var _self = this,
      el = _self.get('el');
    el.find('button').text(v);
  },
  _uiSetbtnCls : function(v){
    var _self = this,
      el = _self.get('el');
    el.find('button').addClass(v);
  }
  
},{
  ATTRS:
  {
    /**
     * 鏄惁閫変腑
     * @type {Boolean}
     */
    checked : {
      value :false
    },
    /**
     * 妯℃澘
     * @type {String}
     */
    tpl : {
      view : true,
      value : '<button type="button" class="{btnCls}">{text}</button>'
    },
    /**
     * 鎸夐挳鐨勬牱寮�
     * @cfg {String} btnCls
     */
    /**
     * 鎸夐挳鐨勬牱寮�
     * @type {String}
     */
    btnCls:{
      sync:false
    },
    /**
    * The text to be used as innerHTML (html tags are accepted).
    * @cfg {String} text
    */
    /**
    * The text to be used as innerHTML (html tags are accepted).
    * @type {String} 
    */
    text : {
      sync:false,
      value : ''
    }
  }
},{
  xclass : 'bar-item-button',
  priority : 2  
});

/**
   * 宸ュ叿鏍忛」涔嬮棿鐨勫垎闅旂
   * xclass:'bar-item-separator'
   * @extends  BUI.Toolbar.BarItem
   * @class BUI.Toolbar.BarItem.Separator
   */
var SeparatorBarItem = BarItem.extend({
  /* render separator's dom
  * @protected
      *
  */
  renderUI:function() {
          var el = this.get('el');
          el .attr('role', 'separator');
      }
},
{
  xclass : 'bar-item-separator',
  priority : 2  
});


/**
   * 宸ュ叿鏍忛」涔嬮棿鐨勭┖鐧�
   * xclass:'bar-item-spacer'
   * @extends  BUI.Toolbar.BarItem
   * @class BUI.Toolbar.BarItem.Spacer
   */
var SpacerBarItem = BarItem.extend({
  
},{
  ATTRS:
  {
    /**
    * 绌虹櫧瀹藉害
    * @type {Number}
    */
    width : {
      view:true,
      value : 2
    }
  }
},{
  xclass : 'bar-item-spacer',
  priority : 2  
});


/**
   * 鏄剧ず鏂囨湰鐨勫伐鍏锋爮椤�
   * xclass:'bar-item-text'
   * @extends  BUI.Toolbar.BarItem
   * @class BUI.Toolbar.BarItem.Text
   */
var TextBarItem = BarItem.extend({
  _uiSetText : function(text){
    var _self = this,
      el = _self.get('el');
    el.html(text);
  }
},{
  ATTRS:
  {
    
    /**
    * 鏂囨湰鐢ㄤ綔 innerHTML (html tags are accepted).
    * @cfg {String} text
    */
    /**
    * 鏂囨湰鐢ㄤ綔 innerHTML (html tags are accepted).
    * @default {String} ""
    */
    text : {
      value : ''
    }
  }
},{
  xclass : 'bar-item-text',
  priority : 2  
});


BarItem.types = {
  'button' : ButtonBarItem,
  'separator' : SeparatorBarItem,
  'spacer' : SpacerBarItem,
  'text'  : TextBarItem
};

module.exports = BarItem;

});
define("bui/toolbar/bar", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview A collection of commonly used function buttons or controls represented in compact visual form.
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Component = BUI.Component,
  UIBase = Component.UIBase;
	
/**
 * bar鐨勮鍥剧被
 * @class BUI.Toolbar.BarView
 * @extends BUI.Component.View
 * @private
 */
var barView = Component.View.extend({

	renderUI:function() {
      var el = this.get('el');
      el.attr('role', 'toolbar');
         
      if (!el.attr('id')) {
          el.attr('id', BUI.guid('bar'));
      }
  }
});

/**
 * 宸ュ叿鏍�
 * 鍙互鏀剧疆鎸夐挳銆佹枃鏈€侀摼鎺ョ瓑锛屾槸鍒嗛〉鏍忕殑鍩虹被
 * xclass : 'bar'
 * <p>
 * <img src="../assets/img/class-toolbar.jpg"/>
 * </p>
 * ## 鎸夐挳缁�
 * <pre><code>
 *   BUI.use('bui/toolbar',function(Toolbar){
 *     var buttonGroup = new Toolbar.Bar({
 *       elCls : 'button-group',
 *       defaultChildCfg : {
 *         elCls : 'button button-small'
 *       },
 *       children : [{content : '澧炲姞'},{content : '淇敼'},{content : '鍒犻櫎'}],
 *       
 *       render : '#b1'
 *     });
 *
 *     buttonGroup.render();
 *   });
 * </code></pre>
 * @class BUI.Toolbar.Bar
 * @extends BUI.Component.Controller
 * @mixins BUI.Component.UIBase.ChildList
 */
var Bar = Component.Controller.extend([UIBase.ChildList],	
{
	/**
	* 閫氳繃id 鑾峰彇椤�
	* @param {String|Number} id the id of item 
	* @return {BUI.Toolbar.BarItem}
	*/
	getItem : function(id){
		return this.getChild(id);
	}
},{
	ATTRS:
	{
    elTagName :{
        view : true,
        value : 'ul'
    },
    /**
     * 榛樿瀛愰」鐨勬牱寮�
     * @type {String}
     * @override
     */
    defaultChildClass: {
      value : 'bar-item'
    },
		/**
		* 鑾峰彇鐒︾偣
    * @protected
    * @ignore
		*/
		focusable : {
			value : false
		},
		/**
		* @private
    * @ignore
		*/
		xview : {
			value : barView	
		}
	}
},{
	xclass : 'bar',
	priority : 1	
});

module.exports = Bar;

});
define("bui/toolbar/pagingbar", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview  a specialized toolbar that is bound to a Grid.Store and provides automatic paging control.
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */

var $ = require("jquery"),
    BUI = require("bui/common"),
    Bar = require("bui/toolbar/bar"),
    Component = BUI.Component,
    Bindable = Component.UIBase.Bindable;

var PREFIX = BUI.prefix,
	ID_FIRST = 'first',
    ID_PREV = 'prev',
    ID_NEXT = 'next',
    ID_LAST = 'last',
    ID_SKIP = 'skip',
    ID_REFRESH = 'refresh',
    ID_TOTAL_PAGE = 'totalPage',
    ID_CURRENT_PAGE = 'curPage',
    ID_TOTAL_COUNT = 'totalCount',
    ID_BUTTONS = [ID_FIRST,ID_PREV,ID_NEXT,ID_LAST,ID_SKIP,ID_REFRESH],
    ID_TEXTS = [ID_TOTAL_PAGE,ID_CURRENT_PAGE,ID_TOTAL_COUNT];

/**
 * 鍒嗛〉鏍�
 * xclass:'pagingbar'
 * @extends BUI.Toolbar.Bar
 * @mixins BUI.Component.UIBase.Bindable
 * @class BUI.Toolbar.PagingBar
 */
var PagingBar = Bar.extend([Bindable],
    {
        /**
         * From Bar, Initialize this paging bar items.
         *
         * @protected
         */
        initializer:function () {
            var _self = this,
                children = _self.get('children'),
                items = _self.get('items'),
                store = _self.get('store');
            if(!items){
                items = _self._getItems();
                BUI.each(items, function (item) {
                    children.push(item);//item
                });
            }else{
                BUI.each(items, function (item,index) { //杞崲瀵瑰簲鐨勫垎椤垫爮
                    if(BUI.isString(item)){
                        if(BUI.Array.contains(item,ID_BUTTONS)){
                            item = _self._getButtonItem(item);
                        }else if(BUI.Array.contains(item,ID_TEXTS)){
                        
                            item = _self._getTextItem(item);
                        }else{
                            item = {xtype : item};
                        }

                    }
                    children.push(item);
                }); 
            }
            
            if (store && store.get('pageSize')) {
                _self.set('pageSize', store.get('pageSize'));
            }
        },
        /**
         * bind page change and store events
         *
         * @protected
         */
        bindUI:function () {
            var _self = this;
            _self._bindButtonEvent();
            //_self._bindStoreEvents();

        },
        /**
         * skip to page
         * this method can fire "beforepagechange" event,
         * if you return false in the handler the action will be canceled
         * @param {Number} page target page
         */
        jumpToPage:function (page) {
            if (page <= 0 || page > this.get('totalPage')) {
                return;
            }
            var _self = this,
                store = _self.get('store'),
                pageSize = _self.get('pageSize'),
                index = page - 1,
                start = index * pageSize;
            var result = _self.fire('beforepagechange', {from:_self.get('curPage'), to:page});
            if (store && result !== false) {
                store.load({ start:start, limit:pageSize, pageIndex:index });
            }
        },
        //after store loaded data,reset the information of paging bar and buttons state
        _afterStoreLoad:function (store, params) {
            var _self = this,
                pageSize = _self.get('pageSize'),
                start = 0, //椤甸潰鐨勮捣濮嬭褰�
                end, //椤甸潰鐨勭粨鏉熻褰�
                totalCount, //璁板綍鐨勬€绘暟
                curPage, //褰撳墠椤�
                totalPage;//鎬婚〉鏁�;

            start = store.get('start');
            
            //璁剧疆鍔犺浇鏁版嵁鍚庣炕椤垫爮鐨勭姸鎬�
            totalCount = store.getTotalCount();
            end = totalCount - start > pageSize ? start + store.getCount() - 1: totalCount;
            totalPage = parseInt((totalCount + pageSize - 1) / pageSize, 10);
            totalPage = totalPage > 0 ? totalPage : 1;
            curPage = parseInt(start / pageSize, 10) + 1;

            _self.set('start', start);
            _self.set('end', end);
            _self.set('totalCount', totalCount);
            _self.set('curPage', curPage);
            _self.set('totalPage', totalPage);

            //璁剧疆鎸夐挳鐘舵€�
            _self._setAllButtonsState();
            _self._setNumberPages();
        },

        //bind page change events
        _bindButtonEvent:function () {
            var _self = this;

            //first page handler
            _self._bindButtonItemEvent(ID_FIRST, function () {
                _self.jumpToPage(1);
            });

            //previous page handler
            _self._bindButtonItemEvent(ID_PREV, function () {
                _self.jumpToPage(_self.get('curPage') - 1);
            });

            //previous page next
            _self._bindButtonItemEvent(ID_NEXT, function () {
                _self.jumpToPage(_self.get('curPage') + 1);
            });

            //previous page next
            _self._bindButtonItemEvent(ID_LAST, function () {
                _self.jumpToPage(_self.get('totalPage'));
            });
            //skip to one page
            _self._bindButtonItemEvent(ID_SKIP, function () {
                handleSkip();
            });

            //refresh
            _self._bindButtonItemEvent(ID_REFRESH, function () {
                _self.jumpToPage(_self.get('curPage'));
            });
            //input page number and press key "enter"
            var curPage = _self.getItem(ID_CURRENT_PAGE);
            if(curPage){
                curPage.get('el').on('keyup', function (event) {
                    event.stopPropagation();
                    if (event.keyCode === 13) {
                        handleSkip();
                    }
                });
            }
            
            //when click skip button or press key "enter",cause an action of skipping page
            /**
             * @private
             * @ignore
             */
            function handleSkip() {
                var value = parseInt(_self._getCurrentPageValue(), 10);
                if (_self._isPageAllowRedirect(value)) {
                    _self.jumpToPage(value);
                } else {
                    _self._setCurrentPageValue(_self.get('curPage'));
                }
            }
        },
        // bind button item event
        _bindButtonItemEvent:function (id, func) {
            var _self = this,
                item = _self.getItem(id);
            if (item) {
                item.on('click', func);
            }
        },
        onLoad:function (params) {
            var _self = this,
                store = _self.get('store');
            _self._afterStoreLoad(store, params);
        },
        //get the items of paging bar
        _getItems:function () {
            var _self = this,
                items = _self.get('items');
            if (items && items.length) {
                return items;
            }
            //default items
            items = [];
            //first item
            items.push(_self._getButtonItem(ID_FIRST));
            //previous item
            items.push(_self._getButtonItem(ID_PREV));
            //separator item
            items.push(_self._getSeparator());
            //total page of store
            items.push(_self._getTextItem(ID_TOTAL_PAGE));
            //current page of store
            items.push(_self._getTextItem(ID_CURRENT_PAGE));
            //button for skip to
            items.push(_self._getButtonItem(ID_SKIP));
            //separator item
            items.push(_self._getSeparator());
            //next item
            items.push(_self._getButtonItem(ID_NEXT));
            //last item
            items.push(_self._getButtonItem(ID_LAST));
            //separator item
            items.push(_self._getSeparator());
            //current page of store
            items.push(_self._getTextItem(ID_TOTAL_COUNT));
            return items;
        },
        //get item which the xclass is button
        _getButtonItem:function (id) {
            var _self = this;
            return {
                id:id,
                xclass:'bar-item-button',
                text:_self.get(id + 'Text'),
                disabled:true,
                elCls:_self.get(id + 'Cls')
            };
        },
        //get separator item
        _getSeparator:function () {
            return {xclass:'bar-item-separator'};
        },
        //get text item
        _getTextItem:function (id) {
            var _self = this;
            return {
                id:id,
                xclass:'bar-item-text',
                text:_self._getTextItemTpl(id)
            };
        },
        //get text item's template
        _getTextItemTpl:function (id) {
            var _self = this,
                obj = _self.getAttrVals();
            return BUI.substitute(this.get(id + 'Tpl'), obj);
        },
        //Whether to allow jump, if it had been in the current page or not within the scope of effective page, not allowed to jump
        _isPageAllowRedirect:function (value) {
            var _self = this;
            return value && value > 0 && value <= _self.get('totalPage') && value !== _self.get('curPage');
        },
        //when page changed, reset all buttons state
        _setAllButtonsState:function () {
            var _self = this,
                store = _self.get('store');
            if (store) {
                _self._setButtonsState([ID_PREV, ID_NEXT, ID_FIRST, ID_LAST, ID_SKIP], true);
            }

            if (_self.get('curPage') === 1) {
                _self._setButtonsState([ID_PREV, ID_FIRST], false);
            }
            if (_self.get('curPage') === _self.get('totalPage')) {
                _self._setButtonsState([ID_NEXT, ID_LAST], false);
            }
        },
        //if button id in the param buttons,set the button state
        _setButtonsState:function (buttons, enable) {
            var _self = this,
                children = _self.get('children');
            BUI.each(children, function (child) {
                if (BUI.Array.indexOf(child.get('id'), buttons) !== -1) {
                    child.set('disabled', !enable);
                }
            });
        },
        //show the information of current page , total count of pages and total count of records
        _setNumberPages:function () {
            var _self = this,
                items = _self.getItems();/*,
                totalPageItem = _self.getItem(ID_TOTAL_PAGE),
                totalCountItem = _self.getItem(ID_TOTAL_COUNT);
            if (totalPageItem) {
                totalPageItem.set('content', _self._getTextItemTpl(ID_TOTAL_PAGE));
            }
            _self._setCurrentPageValue(_self.get(ID_CURRENT_PAGE));
            if (totalCountItem) {
                totalCountItem.set('content', _self._getTextItemTpl(ID_TOTAL_COUNT));
            }*/
            BUI.each(items,function(item){
                if(item.__xclass === 'bar-item-text'){
                    item.set('content', _self._getTextItemTpl(item.get('id')));
                }
            });

        },
        _getCurrentPageValue:function (curItem) {
            var _self = this;
            curItem = curItem || _self.getItem(ID_CURRENT_PAGE);
            if(curItem){
                var textEl = curItem.get('el').find('input');
                return textEl.val();
            }
            
        },
        //show current page in textbox
        _setCurrentPageValue:function (value, curItem) {
            var _self = this;
            curItem = curItem || _self.getItem(ID_CURRENT_PAGE);
            if(curItem){
                var textEl = curItem.get('el').find('input');
                textEl.val(value);
            }
            
        }
    }, {
        ATTRS:
 
        {
           
            /**
             * the text of button for first page
             * @default {String} "棣� 椤�"
             */
            firstText:{
                value:'棣� 椤�'
            },
            /**
             * the cls of button for first page
             * @default {String} "bui-pb-first"
             */
            firstCls:{
                value:PREFIX + 'pb-first'
            },
            /**
             * the text for previous page button
             * @default {String} "鍓嶄竴椤�"
             */
            prevText:{
                value:'涓婁竴椤�'
            },
            /**
             * the cls for previous page button
             * @default {String} "bui-pb-prev"
             */
            prevCls:{
                value: PREFIX + 'pb-prev'
            },
            /**
             * the text for next page button
             * @default {String} "涓嬩竴椤�"
             */
            nextText:{
                value:'涓嬩竴椤�'
            },
            /**
             * the cls for next page button
             * @default {String} "bui-pb-next"
             */
            nextCls:{
                value: PREFIX + 'pb-next'
            },
            /**
             * the text for last page button
             * @default {String} "鏈� 椤�"
             */
            lastText:{
                value:'鏈� 椤�'
            },
            /**
             * the cls for last page button
             * @default {String} "bui-pb-last"
             */
            lastCls:{
                value:PREFIX + 'pb-last'
            },
            /**
             * the text for skip page button
             * @default {String} "璺� 杞�"
             */
            skipText:{
                value:'纭畾'
            },
            /**
             * the cls for skip page button
             * @default {String} "bui-pb-last"
             */
            skipCls:{
                value:PREFIX + 'pb-skip'
            },
            refreshText : {
                value : '鍒锋柊'
            },
            refreshCls : {
                value:PREFIX + 'pb-refresh'
            },
            /**
             * the template of total page info
             * @default {String} '鍏� {totalPage} 椤�'
             */
            totalPageTpl:{
                value:'鍏� {totalPage} 椤�'
            },
            /**
             * the template of current page info
             * @default {String} '绗� &lt;input type="text" autocomplete="off" class="bui-pb-page" size="20" name="inputItem"&gt; 椤�'
             */
            curPageTpl:{
                value:'绗� <input type="text" '+
                    'autocomplete="off" class="'+PREFIX+'pb-page" size="20" value="{curPage}" name="inputItem"> 椤�'
            },
            /**
             * the template of total count info
             * @default {String} '鍏眥totalCount}鏉¤褰�'
             */
            totalCountTpl:{
                value:'鍏眥totalCount}鏉¤褰�'
            },
            autoInitItems : {
                value : false
            },
            /**
             * current page of the paging bar
             * @private
             * @default {Number} 0
             */
            curPage:{
                value:0
            },
            /**
             * total page of the paging bar
             * @private
             * @default {Number} 0
             */
            totalPage:{
                value:0
            },
            /**
             * total count of the store that the paging bar bind to
             * @private
             * @default {Number} 0
             */
            totalCount:{
                value:0
            },
            /**
             * The number of records considered to form a 'page'.
             * if store set the property ,override this value by store's pageSize
             * @private
             */
            pageSize:{
                value:30
            },
            /**
             * The {@link BUI.Data.Store} the paging toolbar should use as its data source.
             * @protected
             */
            store:{

            }
        },
        ID_FIRST:ID_FIRST,
        ID_PREV:ID_PREV,
        ID_NEXT:ID_NEXT,
        ID_LAST:ID_LAST,
        ID_SKIP:ID_SKIP,
        ID_REFRESH: ID_REFRESH,
        ID_TOTAL_PAGE:ID_TOTAL_PAGE,
        ID_CURRENT_PAGE:ID_CURRENT_PAGE,
        ID_TOTAL_COUNT:ID_TOTAL_COUNT
    }, {
        xclass:'pagingbar',
        priority:2
    });
module.exports = PagingBar;

});
define("bui/toolbar/numberpagingbar", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview  a specialized toolbar that is bound to a Grid.Store and provides automatic paging control.
 * @author 
 * @ignore
 */

var $ = require("jquery"),
    BUI = require("bui/common"),
    Component = BUI.Component,
    PBar = require("bui/toolbar/pagingbar");

var PREFIX = BUI.prefix,
    NUMBER_CONTAINER = 'numberContainer',
    CLS_NUMBER_BUTTON = PREFIX + 'button-number';

/**
 * 鏁板瓧鍒嗛〉鏍�
 * xclass:'pagingbar-number'
 * @extends BUI.Toolbar.PagingBar
 * @class BUI.Toolbar.NumberPagingBar
 */
var NumberPagingBar = PBar.extend(
    {
    /**
    * get the initial items of paging bar
    * @protected
    *
    */
    _getItems : function(){
        var _self = this,
            items = _self.get('items');

        if(items){
            return items;
        }
        //default items
        items = [];
        //previous item
        items.push(_self._getButtonItem(PBar.ID_PREV));
        //next item
        items.push(_self._getButtonItem(PBar.ID_NEXT));
        return items;
    },
    _getButtonItem : function(id){
      var _self = this;

      return {
          id:id,
          content:'<a href="javascript:;">'+_self.get(id + 'Text')+'</a>',
          disabled:true
      };
    },
    /**
    * bind buttons event
    * @protected
    *
    */
    _bindButtonEvent : function(){
        var _self = this,
            cls = _self.get('numberButtonCls');
        NumberPagingBar.superclass._bindButtonEvent.call(this);
        _self.get('el').delegate('a','click',function(ev){
          ev.preventDefault();
        });
        _self.on('click',function(ev){
          var item = ev.target;
          if(item && item.get('el').hasClass(cls)){
            var page = item.get('id');
            _self.jumpToPage(page);
          }
        });
    },
    //璁剧疆椤电爜淇℃伅锛岃缃� 椤垫暟 鎸夐挳
    _setNumberPages : function(){
        var _self = this;

        _self._setNumberButtons();
    },
    //璁剧疆 椤垫暟 鎸夐挳
    _setNumberButtons : function(){
        var _self = this,
            curPage = _self.get('curPage'),
            totalPage = _self.get('totalPage'),
            numberItems = _self._getNumberItems(curPage,totalPage),
            curItem;

        _self._clearNumberButtons();

        BUI.each(numberItems,function(item){
            _self._appendNumberButton(item);
        });
        curItem = _self.getItem(curPage);
        if(curItem){
            curItem.set('selected',true);
        }
           
    },
    _appendNumberButton : function(cfg){
      var _self = this,
        count = _self.getItemCount();
      var item = _self.addItemAt(cfg,count - 1);
    },
    _clearNumberButtons : function(){
      var _self = this,
        items = _self.getItems(),
        count = _self.getItemCount();

      while(count > 2){
        _self.removeItemAt(count-2);  
        count = _self.getItemCount();          
      }
    },
    //鑾峰彇鎵€鏈夐〉鐮佹寜閽殑閰嶇疆椤�
    _getNumberItems : function(curPage, totalPage){
        var _self = this,
            result = [],
            maxLimitCount = _self.get('maxLimitCount'),
            showRangeCount = _self.get('showRangeCount'),
            maxPage;

        function addNumberItem(from,to){
            for(var i = from ;i<=to;i++){
                result.push(_self._getNumberItem(i));
            }
        }

        function addEllipsis(){
            result.push(_self._getEllipsisItem());
        }

        if(totalPage < maxLimitCount){
            maxPage = totalPage;
            addNumberItem(1,totalPage);
        }else{
            var startNum = (curPage <= maxLimitCount) ? 1 : (curPage - showRangeCount),
                lastLimit = curPage + showRangeCount,
                endNum = lastLimit < totalPage ? (lastLimit > maxLimitCount ? lastLimit : maxLimitCount) : totalPage;
            if (startNum > 1) {
                addNumberItem(1, 1);
                if(startNum > 2){
                    addEllipsis();
                }
            }
            maxPage = endNum;
            addNumberItem(startNum, endNum);
        }

        if (maxPage < totalPage) {
            if(maxPage < totalPage -1){
                addEllipsis();
            }
            addNumberItem(totalPage, totalPage);
        }

        return result;
    },
    //鑾峰彇鐪佺暐鍙�
    _getEllipsisItem : function(){
        var _self = this;
        return {
            disabled: true,           
            content : _self.get('ellipsisTpl')
        };
    },
    //鐢熸垚椤甸潰鎸夐挳閰嶇疆椤�
    _getNumberItem : function(page){
        var _self = this;
        return {
            id : page,
            elCls : _self.get('numberButtonCls')
        };
    }
    
},{
    ATTRS:{
        itemStatusCls : {
          value : {
            selected : 'active',
            disabled : 'disabled'
          }
        },
        itemTpl : {
          value : '<a href="">{id}</a>'
        },
        prevText : {
          value : '<<'
        },
        nextText : {
          value : '>>'
        },
        /**
        * 褰撻〉鐮佽秴杩囪璁剧疆椤电爜鏃跺€欐樉绀虹渷鐣ュ彿
        * @default {Number} 4
        */
        maxLimitCount : {
            value : 4
        },
        showRangeCount : {
            value : 1   
        },
        /**
        * the css used on number button
        */
        numberButtonCls:{
            value : CLS_NUMBER_BUTTON
        },
        /**
        * the template of ellipsis which represent the omitted pages number
        */
        ellipsisTpl : {
            value : '<a href="#">...</a>'
        }
    }
},{
    xclass : 'pagingbar-number',
    priority : 3    
});

module.exports = NumberPagingBar;

});

define("bui/calendar", ["bui/common","jquery","bui/picker","bui/overlay","bui/list","bui/data","bui/toolbar"], function(require, exports, module){
/**
 * @fileOverview 鏃ュ巻鍛藉悕绌洪棿鍏ュ彛
 * @ignore
 */

  var BUI = require("bui/common"),
    Calendar = BUI.namespace('Calendar');

  BUI.mix(Calendar, {
    Calendar: require("bui/calendar/calendar"),
    MonthPicker: require("bui/calendar/monthpicker"),
    DatePicker: require("bui/calendar/datepicker"),
    Resource : require("bui/calendar/resource")
  });

  module.exports = Calendar;

});
define("bui/calendar/calendar", ["bui/common","jquery","bui/picker","bui/overlay","bui/list","bui/data","bui/toolbar"], function(require, exports, module){
/**
 * @fileOverview 鏃ユ湡鎺т欢
 * @author dxq613@gmail.com
 * @ignore
 */


var BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  CLS_PICKER_TIME = 'x-datepicker-time',
  CLS_PICKER_HOUR = 'x-datepicker-hour',
  CLS_PICKER_MINUTE = 'x-datepicker-minute',
  CLS_PICKER_SECOND = 'x-datepicker-second',
  CLS_TIME_PICKER = 'x-timepicker',
  Picker = require("bui/picker").ListPicker,
  MonthPicker = require("bui/calendar/monthpicker"),
  Header = require("bui/calendar/header"),
  Panel = require("bui/calendar/panel"),
  Toolbar = require("bui/toolbar"),
  Component = BUI.Component,
  DateUtil = BUI.Date,
  Resource = require("bui/calendar/resource");

function today(){
  var now = new Date();
  return new Date(now.getFullYear(),now.getMonth(),now.getDate());
}

function fixedNumber(n){
  if( n< 10 ){
    return '0'+n;
  }
  return n.toString();
}
function getNumberItems(end){
  var items = [];
  for (var i = 0; i < end; i++) {
    items.push({text:fixedNumber(i),value:fixedNumber(i)});
  }
  return items;
}

function getTimeUnit (self,cls){
  var inputEl = self.get('el').find('.' + cls);
  return parseInt(inputEl.val(),10);

}

function setTimeUnit (self,cls,val){
  var inputEl = self.get('el').find('.' + cls);
  if(BUI.isNumber(val)){
    val = fixedNumber(val);
  }
  inputEl.val(val);
}



/**
 * 鏃ユ湡鎺т欢
 * <p>
 * <img src="../assets/img/class-calendar.jpg"/>
 * </p>
 * xclass:'calendar'
 * <pre><code>
 *  BUI.use('bui/calendar',function(Calendar){
 *    var calendar = new Calendar.Calendar({
 *      render:'#calendar'
 *    });
 *    calendar.render();
 *    calendar.on('selectedchange',function (ev) {
 *      alert(ev.date);
 *    });
 * });
 * </code></pre>
 * @class BUI.Calendar.Calendar
 * @extends BUI.Component.Controller
 */
var calendar = Component.Controller.extend({

  //璁剧疆鍐呭
  initializer: function(){
    var _self = this,
      children = _self.get('children'),
      header = new Header(),
      panel = new Panel(),
      footer = _self.get('footer') || _self._createFooter();/*,
      monthPicker = _self.get('monthPicker') || _self._createMonthPicker();*/


    //娣诲姞澶�
    children.push(header);
    //娣诲姞panel
    children.push(panel);
    children.push(footer);
    //children.push(monthPicker);

    _self.set('header',header);
    _self.set('panel',panel);
    _self.set('footer',footer);
    //_self.set('monthPicker',monthPicker);
  },
  renderUI : function(){
    var _self = this,
    children = _self.get('children');
    if(_self.get('showTime')){
      var  timepicker = _self.get('timepicker') || _self._initTimePicker();
      children.push(timepicker);
      _self.set('timepicker',timepicker);
    }
  },
  //缁戝畾浜嬩欢
  bindUI : function(){
    var _self = this,
      header = _self.get('header'),
      panel = _self.get('panel');

    panel.on('selectedchange',function(e){
      var date = e.date;
      if(!DateUtil.isDateEquals(date,_self.get('selectedDate'))){
        _self.set('selectedDate',date);
      }
    });
    if(!_self.get('showTime')){
      panel.on('click',function(){
        _self.fire('accept');
      });
    }else{
      _self._initTimePickerEvent();
    }

    header.on('monthchange',function(e){
      //_self.get('header').setMonth(e.year,e.month);
      _self._setYearMonth(e.year,e.month);
    });

    header.on('headerclick',function(){
      var monthPicker = _self.get('monthpicker') || _self._createMonthPicker();
      monthPicker.set('year',header.get('year'));
      monthPicker.set('month',header.get('month'));
      monthPicker.show();
    });
  },
  _initTimePicker : function(){
    var _self = this,
      lockTime = _self.get('lockTime'),
      _timePickerEnum={hour:CLS_PICKER_HOUR,minute:CLS_PICKER_MINUTE,second:CLS_PICKER_SECOND};
    if(lockTime){
        for(var key in lockTime){
            var noCls = _timePickerEnum[key.toLowerCase()];
            _self.set(key,lockTime[key]);
            if(!lockTime.editable){
              _self.get('el').find("."+noCls).attr("disabled","");
            }
        }
    }
    var  picker = new Picker({
        elCls : CLS_TIME_PICKER,
        children:[{
          itemTpl : '<li><a href="#">{text}</a></li>'
        }],
        autoAlign : false,
        align : {
          node : _self.get('el').find('.bui-calendar-footer'),
          points:['tl','bl'],
          offset:[-1,1]
        },
        trigger : _self.get('el').find('.' +CLS_PICKER_TIME)
      });
    picker.render();
    _self._initTimePickerEvent(picker);
    return picker;
  },
  _initTimePickerEvent : function(picker){
    var _self = this,
      picker= _self.get('timepicker');

    if(!picker){
      return;
    }

    picker.get('el').delegate('a','click',function(ev){
      ev.preventDefault();
    });
    picker.on('triggerchange',function(ev){
      var curTrigger = ev.curTrigger;
      if(curTrigger.hasClass(CLS_PICKER_HOUR)){
        picker.get('list').set('items',getNumberItems(24));
      }else{
        picker.get('list').set('items',getNumberItems(60));
      }
    });

    picker.on('selectedchange',function(ev){
      var curTrigger = ev.curTrigger,
        val = ev.value;
      if(curTrigger.hasClass(CLS_PICKER_HOUR)){
        _self.setInternal('hour',val);
      }else if(curTrigger.hasClass(CLS_PICKER_MINUTE)){
        _self.setInternal('minute',val);
      }else{
        _self.setInternal('second',val);
      }
    });
  },
  //鏇存敼骞村拰鏈�
  _setYearMonth : function(year,month){
    var _self = this,
      selectedDate = _self.get('selectedDate'),
      date = selectedDate.getDate();
    if(year !== selectedDate.getFullYear() || month !== selectedDate.getMonth()){
      var newDate = new Date(year,month,date);
      if(newDate.getMonth() != month){ //涓嬩竴涓湀娌℃湁瀵瑰簲鐨勬棩鏈�,瀹氫綅鍒颁笅涓€涓湀鏈€鍚庝竴澶�
        newDate = DateUtil.addDay(-1,new Date(year,month + 1));
      }
      _self.set('selectedDate',newDate);
    }
  },
  //鍒涘缓閫夋嫨鏈堢殑鎺т欢
  _createMonthPicker: function(){
    var _self = this,
      monthpicker;
    monthpicker = new MonthPicker({
      render : _self.get('el'),
      effect : {
        effect:'slide',
        duration:300
      },
      visibleMode:'display',
      success : function(){
        var picker = this;
        _self._setYearMonth(picker.get('year'),picker.get('month'));
        picker.hide();
      },
      cancel : function(){
        this.hide();
      }
    });
    _self.set('monthpicker',monthpicker);
    _self.get('children').push(monthpicker);
    return monthpicker;
  },
  //鍒涘缓搴曢儴鎸夐挳鏍�
  _createFooter : function(){
    var _self = this,
      showTime = this.get('showTime'),
      items = [];

    if(showTime){
      items.push({
        content : _self.get('timeTpl')
      });
      items.push({
        xclass:'bar-item-button',
        text:Resource.submit,
        btnCls: 'button button-small button-primary',
        listeners:{
          click:function(){
            _self.fire('accept');
          }
        }
      });
    }else{
      items.push({
        xclass:'bar-item-button',
        text:Resource.today,
        btnCls: 'button button-small',
	      id:'todayBtn',
        listeners:{
          click:function(){
            var day = today();
            _self.set('selectedDate',day);
            _self.fire('accept');
          }
        }
      });
      items.push({
        xclass:'bar-item-button',
        text:Resource.clean,
        btnCls: 'button button-small',
        id:'clsBtn',
        listeners:{
          click:function(){
            _self.fire('clear');
          }
        }
      });
    }

    return new Toolbar.Bar({
        elCls : PREFIX + 'calendar-footer',
        children:items
      });
  },
//鏇存柊浠婂ぉ鎸夐挳鐨勭姸鎬�
  _updateTodayBtnAble: function () {
          var _self = this;
          if (!_self.get('showTime')) {
              var footer = _self.get("footer"),
                  panelView = _self.get("panel").get("view"),
                  now = today(),
                  btn = footer.getItem("todayBtn");
              panelView._isInRange(now) ? btn.enable() : btn.disable();
          }
  },
  //璁剧疆鎵€閫夋棩鏈�
  _uiSetSelectedDate : function(v){
    var _self = this,
      year = v.getFullYear(),
      month = v.getMonth();

    _self.get('header').setMonth(year,month);
    _self.get('panel').set('selected',v);
    _self.fire('datechange',{date:v});
  },
  _uiSetHour : function(v){
    setTimeUnit(this,CLS_PICKER_HOUR,v);
  },
  _uiSetMinute : function(v){
    setTimeUnit(this,CLS_PICKER_MINUTE,v);
  },
  _uiSetSecond : function(v){
    setTimeUnit(this,CLS_PICKER_SECOND,v);
  },
  //璁剧疆鏈€澶у€�
  _uiSetMaxDate : function(v){
    var _self = this;
    _self.get('panel').set('maxDate',v);
  _self._updateTodayBtnAble();
  },
  //璁剧疆鏈€灏忓€�
  _uiSetMinDate : function(v){
    var _self = this;
    _self.get('panel').set('minDate',v);
  _self._updateTodayBtnAble();
  }

},{
  ATTRS :
  {
    /**
     * 鏃ュ巻鎺т欢澶撮儴锛岄€夋嫨骞存湀
     * @private
     * @type {Object}
     */
    header:{

    },

    /**
     * 鏃ュ巻鎺т欢閫夋嫨鏃�
     * @private
     * @type {Object}
     */
    panel:{

    },
    /**
     * 鏈€澶ф棩鏈�
     * <pre><code>
     *   calendar.set('maxDate','2013-07-29');
     * </code></pre>
     * @type {Date}
     */
    maxDate : {

    },
    /**
     * 鏈€灏忔棩鏈�
     * <pre><code>
     *   calendar.set('minDate','2013-07-29');
     * </code></pre>
     * @type {Date}
     */
    minDate : {

    },
    /**
     * 閫夋嫨鏈堜唤鎺т欢
     * @private
     * @type {Object}
     */
    monthPicker : {

    },
    /**
     * 閫夋嫨鏃堕棿鎺т欢
     * @private
     * @type {Object}
     */
    timepicker:{

    },
    width:{
      value:180
    },
    events:{
      value:{
         /**
         * @event
         * @name BUI.Calendar.Calendar#click
         * @param {Object} e 鐐瑰嚮浜嬩欢
         * @param {Date} e.date
         */
        'click' : false,
        /**
         * 纭鏃ユ湡鏇存敼锛屽鏋滀笉鏄剧ず鏃ユ湡鍒欏綋鐐瑰嚮鏃ユ湡鎴栬€呯偣鍑讳粖澶╂寜閽椂瑙﹀彂锛屽鏋滄樉绀烘棩鏈燂紝鍒欏綋鐐瑰嚮纭鎸夐挳鏃惰Е鍙戙€�
         * @event
         */
        'accept' : false,
        /**
         * @event
         * @name BUI.Calendar.Calendar#datechange
         * @param {Object} e 閫変腑鐨勬棩鏈熷彂鐢熸敼鍙�
         * @param {Date} e.date
         */
        'datechange' : false,
         /**
         * @event
         * @name BUI.Calendar.Calendar#monthchange
         * @param {Object} e 鏈堜唤鍙戠敓鏀瑰彉
         * @param {Number} e.year
         * @param {Number} e.month
         */
        'monthchange' : false
      }
    },
    /**
     * 鏄惁閫夋嫨鏃堕棿,姝ら€夐」鍐冲畾鏄惁鍙互閫夋嫨鏃堕棿
     *
     * @cfg {Boolean} showTime
     */
    showTime : {
      value : false
    },
    /**
    * 閿佸畾鏃堕棿閫夋嫨
    *<pre><code>
    *  var calendar = new Calendar.Calendar({
    *  render:'#calendar',
    *  lockTime : {hour:00,minute:30} //琛ㄧず閿佸畾鏃朵负00,鍒嗕负30鍒�,绉掓棤閿佺敤鎴峰彲閫夋嫨
    * });
    * </code></pre>
     *
     * @type {Object}
    */
    lockTime :{
    },
    timeTpl : {
      value : '<input type="text" readonly class="' + CLS_PICKER_TIME + ' ' + CLS_PICKER_HOUR + '" />:<input type="text" readonly class="' + CLS_PICKER_TIME + ' ' + CLS_PICKER_MINUTE + '" />:<input type="text" readonly class="' + CLS_PICKER_TIME + ' ' + CLS_PICKER_SECOND + '" />'
    },
    /**
     * 閫夋嫨鐨勬棩鏈�,榛樿涓哄綋澶�
     * <pre><code>
     *  var calendar = new Calendar.Calendar({
     *  render:'#calendar',
     *   selectedDate : new Date('2013/07/01') //涓嶈兘浣跨敤瀛楃涓�
     * });
     * </code></pre>
     * @cfg {Date} selectedDate
     */
    /**
     * 閫夋嫨鐨勬棩鏈�
     * <pre><code>
     *   calendar.set('selectedDate',new Date('2013-9-01'));
     * </code></pre>
     * @type {Date}
     * @default today
     */
    selectedDate : {
      value : today()
    },
    /**
     * 灏忔椂,榛樿涓哄綋鍓嶅皬鏃�
     * @type {Number}
     */
    hour : {
      value : new Date().getHours()
    },
    /**
     * 鍒�,榛樿涓哄綋鍓嶅垎
     * @type {Number}
     */
    minute:{
      value : new Date().getMinutes()
    },
    /**
     * 绉�,榛樿涓哄綋鍓嶇
     * @type {Number}
     */
    second : {
      value : 0
    }
  }
},{
  xclass : 'calendar',
  priority : 0
});

module.exports = calendar;

});
define("bui/calendar/monthpicker", ["jquery","bui/common","bui/overlay","bui/list","bui/data","bui/toolbar"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨骞存湀
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Component = BUI.Component,
  Overlay = require("bui/overlay").Overlay,
  List = require("bui/list").SimpleList,
  Toolbar = require("bui/toolbar"),
  PREFIX = BUI.prefix,
  CLS_MONTH = 'x-monthpicker-month',
  DATA_MONTH = 'data-month',
  DATA_YEAR = 'data-year',
  CLS_YEAR = 'x-monthpicker-year',
  CLS_YEAR_NAV = 'x-monthpicker-yearnav',
  CLS_SELECTED = 'x-monthpicker-selected',
  CLS_ITEM = 'x-monthpicker-item',
  Resource = require("bui/calendar/resource");

function getMonths(){
  return $.map(Resource.months,function(month,index){
    return {text:month,value:index};
  });
}

var MonthPanel = List.extend({

  
  bindUI : function(){
    var _self = this;
    _self.get('el').delegate('a','click',function(ev){
      ev.preventDefault();
    }).delegate('.' + CLS_MONTH,'dblclick',function(){
      _self.fire('monthdblclick');
    });
  }
},{
  ATTRS:{
    itemTpl:{
      view:true,
      value : '<li class="'+CLS_ITEM+' x-monthpicker-month"><a href="#" hidefocus="on">{text}</a></li>'
    },
    
    itemCls : {
      value : CLS_ITEM
    },
    items:{
      view:true,
      valueFn: function(){
        return getMonths();
      }
      
    },
    elCls : {
      view:true,
      value:'x-monthpicker-months'
    }
  }
},{
  xclass:'calendar-month-panel'
});


var YearPanel = List.extend({

  bindUI : function(){
    var _self = this,
      el = _self.get('el');
    el.delegate('a','click',function(ev){
      ev.preventDefault();
    });

    el.delegate('.' + CLS_YEAR,'dblclick',function(){
      _self.fire('yeardblclick');
    });

    el.delegate('.x-icon','click',function(ev){
      var sender = $(ev.currentTarget);

      if(sender.hasClass(CLS_YEAR_NAV + '-prev')){
        _self._prevPage();
      }else if(sender.hasClass(CLS_YEAR_NAV + '-next')){
        _self._nextPage();
      }
    });
    _self.on('itemselected',function(ev){
      if(ev.item){
        _self.setInternal('year',ev.item.value);
      }
      
    });
  },
  _prevPage : function(){
    var _self = this,
      start = _self.get('start'),
      yearCount = _self.get('yearCount');
    _self.set('start',start - yearCount);
  },
  _nextPage : function(){
    var _self = this,
      start = _self.get('start'),
      yearCount = _self.get('yearCount');
    _self.set('start',start + yearCount);
  },
  _uiSetStart : function(){
    var _self = this;
    _self._setYearsContent();
  },
  _uiSetYear : function(v){
    var _self = this,
      item = _self.findItemByField('value',v);
    if(item){
      _self.setSelectedByField(v);
    }else{
      _self.set('start',v);
    }
  },
  _setYearsContent : function(){
    var _self = this,
      year = _self.get('year'),
      start = _self.get('start'),
      yearCount = _self.get('yearCount'),
      items = [];

    for(var i = start;i< start + yearCount;i++){
      var text = i.toString();

      items.push({text:text,value:i});
    }
    _self.set('items',items);
    _self.setSelectedByField(year);
  }

},{
  ATTRS:{
    items:{
      view:true,
      value:[]
    },
    elCls : {
      view:true,
      value:'x-monthpicker-years'
    },
    itemCls : {
      value : CLS_ITEM
    },
    year:{

    },
    /**
     * 璧峰骞�
     * @private
     * @ignore
     * @type {Number}
     */
    start:{
      value: new Date().getFullYear()
    },
    /**
     * 骞存暟
     * @private
     * @ignore
     * @type {Number}
     */
    yearCount:{
      value:10
    },
    itemTpl : {
      view:true,
      value : '<li class="'+CLS_ITEM+' '+CLS_YEAR+'"><a href="#" hidefocus="on">{text}</a></li>'
    },
    tpl : {
      view:true,
      value:'<div class="'+CLS_YEAR_NAV+'">'+
            '<span class="'+CLS_YEAR_NAV+'-prev x-icon x-icon-normal x-icon-small"><span class="icon icon-caret icon-caret-left"></span></span>'+
            '<span class="'+CLS_YEAR_NAV+'-next x-icon x-icon-normal x-icon-small"><span class="icon icon-caret icon-caret-right"></span></span>'+
            '</div>'+
            '<ul></ul>'
    }
  }
},{
  xclass:'calendar-year-panel'
});

/**
 * 鏈堜唤閫夋嫨鍣�
 * xclass : 'calendar-monthpicker'
 * @class BUI.Calendar.MonthPicker
 * @extends BUI.Overlay.Overlay
 */
var monthPicker = Overlay.extend({

  initializer : function(){
    var _self = this,
      children = _self.get('children'),
      monthPanel = new MonthPanel(),
      yearPanel = new YearPanel(),
      footer = _self._createFooter();

    children.push(monthPanel);
    children.push(yearPanel);
    children.push(footer);

    _self.set('yearPanel',yearPanel);
    _self.set('monthPanel',monthPanel);
  },
  bindUI : function(){
    var _self = this;

    _self.get('monthPanel').on('itemselected',function(ev){
      if(ev.item){
        _self.setInternal('month',ev.item.value);
      }
    }).on('monthdblclick',function(){
      _self._successCall();
    });

    _self.get('yearPanel').on('itemselected',function(ev){
      if(ev.item){
        _self.setInternal('year',ev.item.value);
      }
    }).on('yeardblclick',function(){
      _self._successCall();
    });

  },
  _successCall : function(){
    var _self = this,
      callback = _self.get('success');

    if(callback){
      callback.call(_self);
    }
  },
  _createFooter : function(){
    var _self = this;
    return new Toolbar.Bar({
        elCls : PREFIX + 'clear x-monthpicker-footer',
        children:[
          {
            xclass:'bar-item-button',
            text:Resource.submit,
            btnCls: 'button button-small button-primary',
            handler:function(){
              _self._successCall();
            }
          },{
            xclass:'bar-item-button',
            text:Resource.cancel,
            btnCls:'button button-small last',
            handler:function(){
              var callback = _self.get('cancel');
              if(callback){
                callback.call(_self);
              }
            }
          }
        ]
      });
  },
  _uiSetYear : function(v){
    this.get('yearPanel').set('year',v);
  },
  _uiSetMonth:function(v){
    this.get('monthPanel').setSelectedByField(v);
  }
},{
  ATTRS:
  {
    /**
     * 涓嬮儴宸ュ叿鏍�
     * @private
     * @type {Object}
     */
    footer : {

    },
    align : {
      value : {}
    },
    /**
     * 閫変腑鐨勫勾
     * @type {Number}
     */
    year : {
      
    },
    /**
     * 鎴愬姛鐨勫洖璋冨嚱鏁�
     * @type {Function}
     */
    success:{
      value : function(){

      }
    },
    /**
     * 鍙栨秷鐨勫洖璋冨嚱鏁�
     * @type {Function}
     */
    cancel :{

    value : function(){} 

    },
    width:{
      value:180
    },
    /**
     * 閫変腑鐨勬湀
     * @type {Number}
     */
    month:{
      
    },
    /**
     * 閫夋嫨骞寸殑鎺т欢
     * @private
     * @type {Object}
     */
    yearPanel : {

    },
    /**
     * 閫夋嫨鏈堢殑鎺т欢
     * @private
     * @type {Object}
     */
    monthPanel:{

    }

  }
},{
  xclass :'monthpicker'
});

module.exports = monthPicker;

});
define("bui/calendar/resource", ["bui/common","jquery"], function(require, exports, module){

var BUI = require("bui/common");

var Res = {

	'zh-CN': {
		yearMonthMask: 'yyyy 骞� mm 鏈�',
		months : ['涓€鏈�','浜屾湀','涓夋湀','鍥涙湀','浜旀湀','鍏湀','涓冩湀','鍏湀','涔濇湀','鍗佹湀','鍗佷竴鏈�','鍗佷簩鏈�'],
		weekDays : ['鏃�','涓€','浜�','涓�','鍥�','浜�','鍏�'],
		today : "浠婂ぉ",
		clean : "娓呴櫎",
		submit : "纭畾",
		cancel : "鍙栨秷"
	},
	en: {
		yearMonthMask: "MMM yyyy",
		months : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'],
		weekDays : ['Su','Mo','Tu','We','Th','Fr','Sa'],
		today : "today",
		clean : "clean",
		submit : "submit",
		cancel : "cancel"
	},

	setLanguage: function  (type) {
	   if (Res[type]) {
	   	 BUI.mix(this,Res[type]);
	   }
	}
	
};

Res.setLanguage('zh-CN');
module.exports = Res;
});
define("bui/calendar/header", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鏃ユ湡鎺т欢鏉ラ€夋嫨骞存湀鐨勯儴鍒�
 * @ignore
 */

  
var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  Component = BUI.Component,
  CLS_TEXT_YEAR = 'year-text',
  CLS_TEXT_MONTH = 'month-text',
  CLS_ARROW = 'x-datepicker-arrow',
  CLS_PREV = 'x-datepicker-prev',
  CLS_NEXT = 'x-datepicker-next',
  Resource = require("bui/calendar/resource"),
  DateUtil = BUI.Date;
    
/**
 * 鏃ュ巻鎺т欢鏄剧ず閫夋嫨骞存湀
 * xclass:'calendar-header'
 * @class BUI.Calendar.Header
 * @private
 * @extends BUI.Component.Controller
 */
var header = Component.Controller.extend({

  bindUI : function(){
    var _self = this,
      el = _self.get('el');
	
    el.delegate('.' + CLS_ARROW,'click',function(e){
      e.preventDefault();
      var sender = $(e.currentTarget);
      if(sender.hasClass(CLS_NEXT)){
        _self.nextMonth();
      }else if(sender.hasClass(CLS_PREV)){
        _self.prevMonth();
      }
    });

    el.delegate('.x-datepicker-month','click',function(){
      _self.fire('headerclick');
    });
  
  },
  /**
   * 璁剧疆骞存湀
   * @ignore
   * @param {Number} year  骞�
   * @param {Number} month 鏈�
   */
  setMonth : function(year,month){
    var _self = this,
      curYear = _self.get('year'),
      curMonth = _self.get('month');
    if(year !== curYear || month !== curMonth){
      _self.set('year',year);
      _self.set('month',month);
      _self.fire('monthchange',{year:year,month:month});
    }
  },
  /**
   * 涓嬩竴鏈�
   * @ignore
   */
  nextMonth : function(){
    var _self = this,
      date = new Date(_self.get('year'),_self.get('month') + 1);

    _self.setMonth(date.getFullYear(),date.getMonth());
  },
  /**
   * 涓婁竴鏈�
   * @ignore
   */
  prevMonth : function(){
    var _self = this,
      date = new Date(_self.get('year'),_self.get('month') - 1);

     _self.setMonth(date.getFullYear(),date.getMonth());
  },
  _uiSetYear : function(v){
    var _self = this;
    var month = _self.get('month');
    if (!isNaN(month)){
      _self._setYearMonth(v,month);
    }
  },
  _uiSetMonth : function(v){
    var _self = this;
    var year = _self.get('year');
    if (!isNaN(year)){
      _self._setYearMonth(year,v);
    }
  },
  _setYearMonth: function(year,month) {
    var _self = this;
    var date = new Date(year,month);
    var str = DateUtil.format(date,Resource.yearMonthMask);
    if (str.indexOf('000') !== -1) {
      var months = Resource.months;
      str = str.replace('000',months[month]);
    }
    //_self.get('el').find('.' + PREFIX + 'year-month-text').empty();
    _self.get('el').find('.' + PREFIX + 'year-month-text').html(str);

  }

},{
  ATTRS : {
    /**
     * 骞�
     * @type {Number}
     */
    year:{
      sync:true
    },
    /**
     * 鏈�
     * @type {Number}
     */
    month:{
      sync:true,
      setter:function(v){
        this.set('monthText',v+1);
      }
    },
    
    /**
     * @private
     * @type {Object}
     */
    monthText : {
      
    },
    tpl:{
      view:true,
      valueFn: function  () {
        return '<div class="'+CLS_ARROW+' ' + CLS_PREV + '"><span class="icon icon-white icon-caret  icon-caret-left"></span></div>'+
        '<div class="x-datepicker-month">'+
          '<div class="month-text-container">'+
            '<span class="' + PREFIX + 'year-month-text ">'+
            '</span>'+
            '<span class="' + PREFIX + 'caret ' + PREFIX + 'caret-down"></span>'+
          '</div>'+
        '</div>' +
        '<div class="'+CLS_ARROW+' ' + CLS_NEXT + '"><span class="icon icon-white icon-caret  icon-caret-right"></span></div>';
      }
    }, 
   elCls:{
      view:true,
      value:'x-datepicker-header'
    },
	  events:{
  		value:{
        /**
         * 鏈堝彂鐢熸敼鍙橈紝骞村彂鐢熸敼鍙樹篃鎰忓懗鐫€鏈堝彂鐢熸敼鍙�
         * @event
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {Number} e.year 骞�
         * @param {Number} e.month 鏈�
         */
  			'monthchange' : true
  		}
	  }
  }
},{
  xclass:'calendar-header'
});

module.exports = header;

});
define("bui/calendar/panel", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鏃ュ巻鎺т欢鏄剧ず涓€鏈堢殑鏃ユ湡
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Component = BUI.Component,
  DateUtil = BUI.Date,
  CLS_DATE = 'x-datepicker-date',
  CLS_TODAY = 'x-datepicker-today',
  CLS_DISABLED = 'x-datepicker-disabled',
  CLS_ACTIVE = 'x-datepicker-active',
  DATA_DATE = 'data-date',//瀛樺偍鏃ユ湡瀵硅薄
  DATE_MASK = 'isoDate',
  CLS_SELECTED = 'x-datepicker-selected',
  SHOW_WEEKS = 6,//褰撳墠瀹瑰櫒鏄剧ず6鍛�
  dateTypes = {
    deactive : 'prevday',
    active : 'active',
    disabled : 'disabled'
  },
  resource = require("bui/calendar/resource"),
 // currentWeekDays = resource.weekDays,
  weekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * 鏃ュ巻闈㈡澘鐨勮鍥剧被
 * @class BUI.Calendar.PanelView
 * @extends BUI.Component.View
 * @private
 */
var panelView = Component.View.extend({

  renderUI : function(){
    this.updatePanel();
  },

  //鏇存柊瀹瑰櫒锛屽綋鏈堛€佸勾鍙戠敓鏀瑰彉鏃�
  updatePanel : function(){
    var _self = this,
      el = _self.get('el'),
      bodyEl = el.find('tbody'),
      innerTem = _self._getPanelInnerTpl();

    bodyEl.empty();
    $(innerTem).appendTo(bodyEl);
  },
  //鑾峰彇瀹瑰櫒鍐呭
  _getPanelInnerTpl : function(){
    var _self = this,
      startDate = _self._getFirstDate(),
      temps = [];

    for (var i = 0; i < SHOW_WEEKS; i++) {
      var weekStart = DateUtil.addWeek(i,startDate);
      temps.push(_self._getWeekTpl(weekStart));
    };

    return temps.join('');
  },
  //鑾峰彇鍛ㄦā鐗�
  _getWeekTpl : function(startDate){
    var _self = this,
      weekTpl = _self.get('weekTpl'),
      daysTemps = [];
    for (var i = 0; i < weekDays.length; i++) {
      var date = DateUtil.addDay(i,startDate);
      daysTemps.push(_self._getDayTpl(date));  
    }

    return BUI.substitute(weekTpl,{
      daysTpl:daysTemps.join('')
    });
  },
  //鑾峰彇鏃ユā鐗�
  _getDayTpl : function(date){
    var _self = this,
      dayTpl = _self.get('dayTpl'),
      day = date.getDay(),
      todayCls = _self._isToday(date) ? CLS_TODAY:'',
      dayOfWeek = weekDays[day],
      dateNumber = date.getDate(),
      //涓嶆槸鏈湀鍒欏浜庝笉娲诲姩鐘舵€�
      //涓嶅湪鎸囧畾鐨勬渶澶ф渶灏忚寖鍥村唴锛岀姝㈤€変腑
      dateType = _self._isInRange(date) ? (_self._isCurrentMonth(date) ? dateTypes.active : dateTypes.deactive) : dateTypes.disabled;

    return BUI.substitute(dayTpl,{
      dayOfWeek : dayOfWeek,
      dateType : dateType,
      dateNumber : dateNumber,
      todayCls : todayCls,
      date : DateUtil.format(date,DATE_MASK)
    });
  },
  //鑾峰彇褰撳墠瀹瑰櫒鐨勭涓€澶�
  _getFirstDate : function(year,month){
    var _self = this,
      monthFirstDate = _self._getMonthFirstDate(year,month),
      day = monthFirstDate.getDay();
    return DateUtil.addDay(day * -1,monthFirstDate);
  },
  //鑾峰彇褰撴湀鐨勭涓€澶�
  _getMonthFirstDate : function(year,month){
    var _self = this,
      year = year || _self.get('year'),
      month = month || _self.get('month');
    return new Date(year,month);
  },
  //鏄惁鏄綋鍓嶆樉绀虹殑鏈�
  _isCurrentMonth : function(date){
    return date.getMonth() === this.get('month');
  },
  //鏄惁鏄粖澶�
  _isToday : function(date){
    var tody = new Date();
    return tody.getFullYear() === date.getFullYear() && tody.getMonth() === date.getMonth() && tody.getDate() === date.getDate();
  },
  //鏄惁鍦ㄥ厑璁哥殑鑼冨洿鍐�
  _isInRange : function(date){
    var _self = this,
      maxDate = _self.get('maxDate'),
      minDate = _self.get('minDate');

    if(minDate && date < minDate){
      return false;
    }
    if(maxDate && date > maxDate){
      return false;
    }
    return true;
  },
  //娓呴櫎閫変腑鐨勬棩鏈�
  _clearSelectedDate : function(){
    var _self = this;
    _self.get('el').find('.'+CLS_SELECTED).removeClass(CLS_SELECTED);
  },
  //鏌ユ壘鏃ユ湡瀵瑰簲鐨凞OM鑺傜偣
  _findDateElement : function(date){
    var _self = this,
      dateStr = DateUtil.format(date,DATE_MASK),
      activeList = _self.get('el').find('.' + CLS_DATE),
      result = null;
    if(dateStr){
      activeList.each(function(index,item){
        if($(item).attr('title') === dateStr){
          result = $(item);
          return false;
        }
      });
    }
    return result;
  },
  //璁剧疆閫変腑鐨勬棩鏈�
  _setSelectedDate : function(date){
    var _self = this,
      dateEl = _self._findDateElement(date);

    _self._clearSelectedDate();
    if(dateEl){
      dateEl.addClass(CLS_SELECTED);
    }
  }
},{
  ATTRS : {

  }
});

/**
 * 鏃ュ巻鎺т欢鏄剧ず鏃ユ湡鐨勫鍣�
 * xclass:'calendar-panel'
 * @class BUI.Calendar.Panel
 * @private
 * @extends BUI.Component.Controller
 */
var panel = Component.Controller.extend(
{

  /**
   * 璁剧疆榛樿骞存湀
   * @protected
   */
  initializer : function(){
    var _self = this,
      now = new Date();
    if(!_self.get('year')){
      _self.set('year',now.getFullYear());
    }

    if(!_self.get('month')){
      _self.set('month',now.getMonth());
    }
  },
  /**
   * @protected
   * @ignore
   */
  bindUI : function(){
    var _self = this,
      el = _self.get('el');
    el.delegate('.' + CLS_DATE,'click',function(e){
      e.preventDefault();
    });
    //闃绘绂佺敤鐨勬棩鏈熻閫夋嫨
    el.delegate('.' + CLS_DISABLED,'mouseup',function(e){
      e.stopPropagation();
    });
  },
  /**
   * @protected
   * @ignore
   */
  performActionInternal : function(ev){
    var _self = this,
      sender = $(ev.target).closest('.' + CLS_DATE);
    if(sender){
      var date = sender.attr('title');
      if(date){
        date = DateUtil.parse(date);
        if(_self.get('view')._isInRange(date)){
          _self.set('selected',date);
        }
        //_self.fire('click',{date:date});
      }
    }
  },
  /**
   * 璁剧疆骞存湀
   * @param {Number} year  骞�
   * @param {Number} month 鏈�
   */
  setMonth : function(year,month){
    var _self = this,
      curYear = _self.get('year'),
      curMonth = _self.get('month');
    if(year !== curYear || month !== curMonth){
      _self.set('year',year);
      _self.set('month',month);
  		//if(_self.get('rendered')){
  			_self.get('view').updatePanel();
  		//}
    }
  },
  //閫変腑鏃ユ湡
  _uiSetSelected : function(date,ev){
    var _self = this;
    
    if(!(ev && ev.prevVal && DateUtil.isDateEquals(date,ev.prevVal))){
      _self.setMonth(date.getFullYear(),date.getMonth());
      _self.get('view')._setSelectedDate(date);
      _self.fire('selectedchange',{date:date});
    } 
  },
  //璁剧疆鏈€鏃ユ湡
  _uiSetMaxDate : function(v){
    if(v){
      this.get('view').updatePanel();
    }
  },
  //璁剧疆鏈€灏忔棩鏈�
  _uiSetMinDate : function(v){
    if(v){
      this.get('view').updatePanel();
    }
  }
},{
  ATTRS:
  {
    /**
     * 灞曠ず鐨勬湀鎵€灞炲勾
     * @type {Number}
     */
    year : {
      view :true
    },
    /**
     * 灞曠ず鐨勬湀
     * @type {Number}
     */
    month:{
      view :true
    },
    /**
     * 閫変腑鐨勬棩鏈�
     * @type {Date}
     */
    selected : {

    },
    focusable:{
      value:true
    },
    /**
     * 鏃ユ湡鐨勬ā鏉�
     * @private
     * @type {Object}
     */
    dayTpl:{
      view : true,
      value:'<td class="x-datepicker-date x-datepicker-{dateType} {todayCls} day-{dayOfWeek}" title="{date}">'+
              '<a href="#" hidefocus="on" tabindex="1">'+
                '<em><span>{dateNumber}</span></em>'+
              '</a>'+
            '</td>'
    },
    events:{
      value : {
        /**
         * @event
         * @name BUI.Calendar.Panel#click
         * @param {Object} e 鐐瑰嚮浜嬩欢
         * @param {Date} e.date
         */
        'click' : false,
        /**
         * @name BUI.Calendar.Panel#selectedchange
         * @param {Object} e 鐐瑰嚮浜嬩欢
         * @param {Date} e.date
         */
        'selectedchange' : true
      }
    },
    /**
     * 鏈€灏忔棩鏈�
     * @type {Date | String}
     */
    maxDate : {
      view : true,
      setter : function(val){
        if(val){
          if(BUI.isString(val)){
            return DateUtil.parse(val);
          }
          return val;
        }
      }
    },
    /**
     * 鏈€灏忔棩鏈�
     * @type {Date | String}
     */
    minDate : {
      view : true,
      setter : function(val){
        if(val){
          if(BUI.isString(val)){
            return DateUtil.parse(val);
          }
          return val;
        }
      }
    },
    /**
     * 鍛ㄧ殑妯℃澘
     * @private
     * @type {Object}
     */
    weekTpl:{
      view : true,
      value : '<tr>{daysTpl}</tr>'
    },
    tpl:{
      view:true,
      valueFn: function  () {
        return '<table class="x-datepicker-inner" cellspacing="0">' +
              '<thead>' +
                 '<tr>' +
                  '<th  title="Sunday"><span>'+resource.weekDays[0]+'</span></th>' +
                  '<th  title="Monday"><span>'+resource.weekDays[1]+'</span></th>' +
                  '<th  title="Tuesday"><span>'+resource.weekDays[2]+'</span></th>' +
                  '<th  title="Wednesday"><span>'+resource.weekDays[3]+'</span></th>' +
                  '<th  title="Thursday"><span>'+resource.weekDays[4]+'</span></th>' +
                  '<th  title="Friday"><span>'+resource.weekDays[5]+'</span></th>' +
                  '<th  title="Saturday"><span>'+resource.weekDays[6]+'</span></th>' +
                '</tr>' +
              '</thead>' +
              '<tbody class="x-datepicker-body">' +
              '</tbody>' +
            '</table>'
      }
    },
    xview : {value : panelView}
  }
},{
  xclass:'calendar-panel',
  priority:0
});

module.exports = panel;

});
define("bui/calendar/datepicker", ["bui/common","jquery","bui/picker","bui/overlay","bui/list","bui/data","bui/toolbar"], function(require, exports, module){
/**
 * @fileOverview 鏃ユ湡閫夋嫨鍣�
 * @author dxq613@gmail.com
 * @ignore
 */
  
var BUI = require("bui/common"),
  Picker = require("bui/picker").Picker,
  Calendar = require("bui/calendar/calendar"),
  DateUtil = BUI.Date;

/**
 * 鏃ユ湡閫夋嫨鍣紝鍙互鐢辫緭鍏ユ绛夎Е鍙�
 * <p>
 * <img src="../assets/img/class-calendar.jpg"/>
 * </p>
 * xclass : 'calendar-datepicker'
 * <pre><code>
 *   BUI.use('bui/calendar',function(Calendar){
 *      var datepicker = new Calendar.DatePicker({
 *        trigger:'.calendar',
 *        //delegateTrigger : true, //濡傛灉璁剧疆姝ゅ弬鏁帮紝閭ｄ箞鏂板鍔犵殑.calendar鍏冪礌涔熶細鏀寔鏃ュ巻閫夋嫨
 *        autoRender : true
 *      });
 *    });
 * </code></pre>
 * @class BUI.Calendar.DatePicker
 * @extends BUI.Picker.Picker
 */
var datepicker = Picker.extend({

  initializer:function(){
    
  },
  /**
   * @protected
   * 鍒濆鍖栧唴閮ㄦ帶浠�
   */
  createControl : function(){
    var _self = this,
      children = _self.get('children'),
      calendar = new Calendar({
        render : _self.get('el'),
        showTime : _self.get('showTime'),
        lockTime : _self.get('lockTime'),
        minDate: _self.get('minDate'),
        maxDate: _self.get('maxDate'),
        autoRender : true
      });

    calendar.on('clear', function(){
      var curTrigger = _self.get('curTrigger'),
        oldValue = curTrigger.val();

      if(oldValue){
        curTrigger.val('');
        curTrigger.trigger('change');
      }
    });

    if (!_self.get('dateMask')) {
      if (_self.get('showTime')) {
          _self.set('dateMask', 'yyyy-mm-dd HH:MM:ss');
      } else {
          _self.set('dateMask', 'yyyy-mm-dd');
      }
     }  
    children.push(calendar);
    _self.set('calendar',calendar);
    return calendar;
  },
  /**
   * 璁剧疆閫変腑鐨勫€�
   * <pre><code>
   *   datePicker.setSelectedValue('2012-01-1');
   * </code></pre>
   * @param {String} val 璁剧疆鍊�
   * @protected
   */
  setSelectedValue : function(val){
    if(!this.get('calendar')){
      return;
    }
    var _self = this,
      calendar = this.get('calendar'),
      date = DateUtil.parse(val,_self.get("dateMask"));
    date = date || _self.get('selectedDate');
    calendar.set('selectedDate',DateUtil.getDate(date));

    if(_self.get('showTime')){

        var lockTime = this.get("lockTime"),
          hour = date.getHours(),
          minute = date.getMinutes(),
          second = date.getSeconds();

        if(lockTime){
          if(!val || !lockTime.editable){
            hour = lockTime['hour'] != null ?lockTime['hour']:hour;
            minute = lockTime['minute'] != null ?lockTime['minute']:minute;
            second = lockTime['second'] != null ?lockTime['second']:second;
          }
        }

      calendar.set('hour',hour);
      calendar.set('minute',minute);
      calendar.set('second',second);
    }
  },
  /**
   * 鑾峰彇閫変腑鐨勫€�
   * @protected
   * @return {String} 閫変腑鐨勫€�
   */
  getSelectedValue : function(){
    if(!this.get('calendar')){
      return null;
    }
    var _self = this, 
      calendar = _self.get('calendar'),
    date =  DateUtil.getDate(calendar.get('selectedDate'));
    if(_self.get('showTime')){
      date = DateUtil.addHour(calendar.get('hour'),date);
      date = DateUtil.addMinute(calendar.get('minute'),date);
      date = DateUtil.addSecond(calendar.get('second'),date);
    }
    return date;
  },
  /**
   * 鑾峰彇閫変腑椤圭殑鏂囨湰锛屽閫夌姸鎬佷笅锛屾枃鏈互','鍒嗗壊
   * @protected
   * @return {String} 閫変腑鐨勬枃鏈�
   */
  getSelectedText : function(){
    if(!this.get('calendar')){
      return '';
    }
    return DateUtil.format(this.getSelectedValue(),this._getFormatType());
  },
  _getFormatType : function(){
    return this.get('dateMask');
  },
  //璁剧疆鏈€澶у€�
  _uiSetMaxDate : function(v){
    if(!this.get('calendar')){
      return null;
    }
    var _self = this;
    _self.get('calendar').set('maxDate',v);
  },
  //璁剧疆鏈€灏忓€�
  _uiSetMinDate : function(v){
    if(!this.get('calendar')){
      return null;
    }
    var _self = this;
    _self.get('calendar').set('minDate',v);
  }

},{
  ATTRS : 
  {
    /**
     * 鏄惁鏄剧ず鏃ユ湡
     * <pre><code>
     *  var datepicker = new Calendar.DatePicker({
     *    trigger:'.calendar',
     *    showTime : true, //鍙互閫夋嫨鏃ユ湡
     *    autoRender : true
     *  });
     * </code></pre>
     * @type {Boolean}
     */
    showTime : {
      value:false
    },
     /**
     * 閿佸畾鏃堕棿閫夋嫨锛岄粯璁ら攣瀹氱殑鏃堕棿涓嶈兘淇敼鍙互閫氳繃 editable : true 鏉ュ厑璁镐慨鏀归攣瀹氱殑鏃堕棿
     *<pre><code>
     *  var calendar = new Calendar.Calendar({
     *  render:'#calendar',
     *  lockTime : {hour:00,minute:30} //琛ㄧず閿佸畾鏃朵负00,鍒嗕负30鍒�,绉掓棤閿佺敤鎴峰彲閫夋嫨
     * });
     * </code></pre>
     *
     * @type {Object}
     */
    lockTime :{

    },
    /**
     * 鏈€澶ф棩鏈�
     * <pre><code>
     *   var datepicker = new Calendar.DatePicker({
     *     trigger:'.calendar',
     *     maxDate : '2014-01-01',
     *     minDate : '2013-7-25',
     *     autoRender : true
     *   });
     * </code></pre>
     * @type {Date}
     */
    maxDate : {

    },
    /**
     * 鏈€灏忔棩鏈�
     * <pre><code>
     *   var datepicker = new Calendar.DatePicker({
     *     trigger:'.calendar',
     *     maxDate : '2014-01-01',
     *     minDate : '2013-7-25',
     *     autoRender : true
     *   });
     * </code></pre>
     * @type {Date}
     */
    minDate : {

    },
  /**
     * 杩斿洖鏃ユ湡鏍煎紡锛屽鏋滀笉璁剧疆榛樿涓� yyyy-mm-dd锛屾椂闂撮€夋嫨涓簍rue鏃朵负 yyyy-mm-dd HH:MM:ss
     * <pre><code>
     *   calendar.set('dateMask','yyyy-mm-dd');
     * </code></pre>
     * @type {String}
    */
    dateMask: {

    },
    changeEvent:{
      value:'accept'
    },
    hideEvent:{
      value:'accept clear'
    },
    /**
     * 鏃ュ巻瀵硅薄,鍙互杩涜鏇村鐨勬搷浣滐紝鍙傜湅{@link BUI.Calendar.Calendar}
     * @type {BUI.Calendar.Calendar}
     */
    calendar:{

    },
    /**
     * 榛樿閫変腑鐨勬棩鏈�
     * @type {Date}
     */
    selectedDate: {
    	value: new Date(new Date().setSeconds(0))
    }
  }
},{
  xclass : 'datepicker',
  priority : 0
});

module.exports = datepicker;

});

define("bui/select", ["bui/common","jquery","bui/picker","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨妗嗗懡鍚嶇┖闂村叆鍙ｆ枃浠�
 * @ignore
 */

var BUI = require("bui/common"),
  Select = BUI.namespace('Select');

BUI.mix(Select,{
  Select : require("bui/select/select"),
  Combox : require("bui/select/combox"),
  Suggest: require("bui/select/suggest")
});

module.exports = Select;

});
define("bui/select/select", ["jquery","bui/common","bui/picker","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨鎺т欢
 * @author dxq613@gmail.com
 * @ignore
 */

'use strict';
var $ = require("jquery"),
  BUI = require("bui/common"),
  ListPicker = require("bui/picker").ListPicker,
  PREFIX = BUI.prefix;

function formatItems(items){
 
  if($.isPlainObject(items)){
    var tmp = [];
    BUI.each(items,function(v,n){
      tmp.push({value : n,text : v});
    });
    return tmp;
  }
  var rst = [];
  BUI.each(items,function(item,index){
    if(BUI.isString(item)){
      rst.push({value : item,text:item});
    }else{
      rst.push(item);
    }
  });
  return rst;
}

var Component = BUI.Component,
  Picker = ListPicker,
  CLS_INPUT = PREFIX + 'select-input',
  /**
   * 閫夋嫨鎺т欢
   * xclass:'select'
   * <pre><code>
   *  BUI.use('bui/select',function(Select){
   * 
   *   var items = [
   *         {text:'閫夐」1',value:'a'},
   *         {text:'閫夐」2',value:'b'},
   *         {text:'閫夐」3',value:'c'}
   *       ],
   *       select = new Select.Select({  
   *         render:'#s1',
   *         valueField:'#hide',
   *         //multipleSelect: true, //鏄惁澶氶€�
   *         items:items
   *       });
   *   select.render();
   *   select.on('change', function(ev){
   *     //ev.text,ev.value,ev.item
   *   });
   *   
   * });
   * </code></pre>
   * @class BUI.Select.Select
   * @extends BUI.Component.Controller
   */
  select = Component.Controller.extend({
    //鍒濆鍖�
    initializer:function(){
      var _self = this,
        multipleSelect = _self.get('multipleSelect'),
        xclass,
        picker = _self.get('picker'),
        list;
      if(!picker){
        xclass = multipleSelect ? 'listbox' : 'simple-list';
        list = _self.get('list') || {};
        list = BUI.mix(list,{
          xclass : xclass,
          elCls:PREFIX + 'select-list',
          store : _self.get('store'),
          items : formatItems(_self.get('items'))/**/
        });

        picker = new Picker({
          children:[
            list
          ],
          valueField : _self.get('valueField')
        });
        
        _self.set('picker',picker);
      }else{
        if(_self.get('valueField')){
          picker.set('valueField',_self.get('valueField'));
        }
      }
      if(multipleSelect){
        picker.set('hideEvent','');
      }
      
    },
    //娓叉煋DOM浠ュ強閫夋嫨鍣�
    renderUI : function(){
      var _self = this,
        picker = _self.get('picker'),
        textEl = _self._getTextEl();
      picker.set('trigger',_self.getTrigger());
      picker.set('triggerEvent', _self.get('triggerEvent'));
      picker.set('autoSetValue', _self.get('autoSetValue'));
      picker.set('textField',textEl);
      picker.render();
      _self.set('list',picker.get('list'));
    },
    //缁戝畾浜嬩欢
    bindUI : function(){
      var _self = this,
        picker = _self.get('picker'),
        list = picker.get('list'),
        store = list.get('store');
        
      //閫夐」鍙戠敓鏀瑰彉鏃�
      picker.on('selectedchange',function(ev){
        if(ev.item){
          _self.fire('change',{text : ev.text,value : ev.value,item : ev.item});
        }
      });
      if(_self.get('autoSetValue')){
        list.on('itemsshow',function(){
          _self._syncValue();
        });
      }
      
      picker.on('show',function(){
        if(_self.get('forceFit')){
          picker.set('width',_self.get('el').outerWidth());
        }
      });
    },
    /**
     * 鏄惁鍖呭惈鍏冪礌
     * @override
     */
    containsElement : function(elem){
      var _self = this,
        picker = _self.get('picker');

      return Component.Controller.prototype.containsElement.call(this,elem) || picker.containsElement(elem);
    },
    /**
     * @protected
     * 鑾峰彇瑙﹀彂鐐�
     */
    getTrigger : function(){
      return this.get('el');
    },
    //璁剧疆瀛愰」
    _uiSetItems : function(items){
      if(!items){
        return;
      }
      var _self = this,
        picker = _self.get('picker'),
        list = picker.get('list');
      list.set('items',formatItems(items));
      _self._syncValue();
    },
    _syncValue : function(){
      var _self = this,
        picker = _self.get('picker'),
        valueField = _self.get('valueField');
      if(valueField){
        picker.setSelectedValue($(valueField).val());
      }
    },
    //璁剧疆Form琛ㄥ崟涓殑鍚嶇О
    _uiSetName:function(v){
      var _self = this,
        textEl = _self._getTextEl();
      if(v){
        textEl.attr('name',v);
      }
    },
    _uiSetWidth : function(v){
      var _self = this;
      if(v != null){
        if(_self.get('inputForceFit')){
          var textEl = _self._getTextEl(),
          iconEl = _self.get('el').find('.x-icon'),
          appendWidth = textEl.outerWidth() - textEl.width(),
          
          width = v - iconEl.outerWidth() - appendWidth;
          textEl.width(width);
        }
        
        if(_self.get('forceFit')){
          var picker = _self.get('picker');
          picker.set('width',v);
        }
        
      }
    },
    //绂佺敤
    _uiSetDisabled : function(v){
      var _self = this,
        picker = _self.get('picker'),
        textEl = _self._getTextEl();
      picker.set('disabled',v);
      textEl && textEl.attr('disabled',v);
    },
    _getTextEl : function(){
       var _self = this,
        el = _self.get('el');
      return el.is('input') ? el : el.find('input');
    },
    /**
     * 鏋愭瀯鍑芥暟
     */
    destructor:function(){
      var _self = this,
        picker = _self.get('picker');
      if(picker){
        picker.destroy();
      }
    },
    //鑾峰彇List鎺т欢
    _getList:function(){
      var _self = this,
        picker = _self.get('picker'),
        list = picker.get('list');
      return list;
    },
    /**
     * 鑾峰彇閫変腑椤圭殑鍊硷紝濡傛灉鏄閫夊垯锛岃繑鍥炵殑'1,2,3'褰㈠紡鐨勫瓧绗︿覆
     * <pre><code>
     *  var value = select.getSelectedValue();
     * </code></pre>
     * @return {String} 閫変腑椤圭殑鍊�
     */
    getSelectedValue:function(){
      return this.get('picker').getSelectedValue();
    },
    /**
     * 璁剧疆閫変腑鐨勫€�
     * <pre><code>
     * select.setSelectedValue('1'); //鍗曢€夋ā寮忎笅
     * select.setSelectedValue('1,2,3'); //澶氶€夋ā寮忎笅
     * </code></pre>
     * @param {String} value 閫変腑鐨勫€�
     */
    setSelectedValue : function(value){
      var _self = this,
        picker = _self.get('picker');
      picker.setSelectedValue(value);
    },
    /**
     * 鑾峰彇閫変腑椤圭殑鏂囨湰锛屽鏋滄槸澶氶€夊垯锛岃繑鍥炵殑'text1,text2,text3'褰㈠紡鐨勫瓧绗︿覆
     * <pre><code>
     *  var value = select.getSelectedText();
     * </code></pre>
     * @return {String} 閫変腑椤圭殑鏂囨湰
     */
    getSelectedText:function(){
      return this.get('picker').getSelectedText();
    }
  },{
    ATTRS : 
    {

      /**
       * 閫夋嫨鍣紝娴姩鍑虹幇锛屼緵鐢ㄦ埛閫夋嫨
       * @cfg {BUI.Picker.ListPicker} picker
       * <pre><code>
       * var columns = [
       *       {title : '琛ㄥご1(30%)',dataIndex :'a', width:'30%'},
       *       {id: '123',title : '琛ㄥご2(30%)',dataIndex :'b', width:'30%'},
       *       {title : '琛ㄥご3(40%)',dataIndex : 'c',width:'40%'}
       *     ],   
       *   data = [{a:'123',b:'閫夋嫨鏂囨湰1'},{a:'cdd',b:'閫夋嫨鏂囨湰2'},{a:'1333',b:'閫夋嫨鏂囨湰3',c:'eee',d:2}],
       *   grid = new Grid.SimpleGrid({
       *     idField : 'a', //璁剧疆浣滀负key 鐨勫瓧娈碉紝鏀惧埌valueField涓�
       *     columns : columns,
       *     textGetter: function(item){ //杩斿洖閫変腑鐨勬枃鏈�
       *       return item.b;
       *     }
       *   }),
       *   picker = new Picker.ListPicker({
       *     width:300,  //鎸囧畾瀹藉害
       *     children : [grid] //閰嶇疆picker鍐呯殑鍒楄〃
       *   }),
       *   select = new Select.Select({  
       *     render:'#s1',
       *     picker : picker,
       *     forceFit:false, //涓嶅己杩垪琛ㄨ窡閫夋嫨鍣ㄥ搴︿竴鑷�
       *     valueField:'#hide',
       *     items : data
       *   });
       * select.render();
       * </code></pre>
       */
      /**
       * 閫夋嫨鍣紝娴姩鍑虹幇锛屼緵鐢ㄦ埛閫夋嫨
       * @readOnly
       * @type {BUI.Picker.ListPicker}
       */
      picker:{

      },
      /**
       * Picker涓殑鍒楄〃
       * <pre>
       *   var list = select.get('list');
       * </pre>
       * @readOnly
       * @type {BUI.List.SimpleList}
       */
      list : {

      },
      /**
       * 瀛樻斁鍊煎緱瀛楁锛屼竴鑸槸涓€涓猧nput[type='hidden'] ,鐢ㄤ簬瀛樻斁閫夋嫨妗嗙殑鍊�
       * @cfg {Object} valueField
       */
      /**
       * @ignore
       */
      valueField : {

      },
      /**
       * 鏁版嵁缂撳啿绫�
       * <pre><code>
       *  var store = new Store({
       *    url : 'data.json',
       *    autoLoad : true
       *  });
       *  var select = new Select({
       *    render : '#s',
       *    store : store//璁剧疆浜唖tore鍚庯紝涓嶈鍐嶈缃甶tems锛屼細杩涜瑕嗙洊
       *  });
       *  select.render();
       * </code></pre>
       * @cfg {BUI.Data.Store} Store
       */
      store : {

      },
      focusable:{
        value:true
      },
      /**
       * 鏄惁璺焩alueField鑷姩鍚屾
       * @type {Boolean}
       */
      autoSetValue : {
        value : true
      },
      /**
       * 鏄惁鍙互澶氶€�
       * @cfg {Boolean} [multipleSelect=false]
       */
      /**
       * 鏄惁鍙互澶氶€�
       * @type {Boolean}
       */
      multipleSelect:{
        value:false
      },
      /**
       * 鍐呴儴鐨刬nput鏄惁璺熼殢瀹藉害鐨勫彉鍖栬€屽彉鍖�
       * @type {Object}
       */
      inputForceFit : {
        value : true
      },  
      /**
       * 鎺т欢鐨刵ame锛岀敤浜庡瓨鏀鹃€変腑鐨勬枃鏈紝渚夸簬琛ㄥ崟鎻愪氦
       * @cfg {Object} name
       */
      /**
       * 鎺т欢鐨刵ame锛屼究浜庤〃鍗曟彁浜�
       * @type {Object}
       */
      name:{

      },
      /**
       * 閫夐」
       * @cfg {Array} items
       * <pre><code>
       *  BUI.use('bui/select',function(Select){
       * 
       *   var items = [
       *         {text:'閫夐」1',value:'a'},
       *         {text:'閫夐」2',value:'b'},
       *         {text:'閫夐」3',value:'c'}
       *       ],
       *       select = new Select.Select({  
       *         render:'#s1',
       *         valueField:'#hide',
       *         //multipleSelect: true, //鏄惁澶氶€�
       *         items:items
       *       });
       *   select.render();
       *   
       * });
       * </code></pre>
       */
      /**
       * 閫夐」
       * @type {Array}
       */
      items:{
        sync:false
      },
      /**
       * 鏍囩ず閫夋嫨瀹屾垚鍚庯紝鏄剧ず鏂囨湰鐨凞OM鑺傜偣鐨勬牱寮�
       * @type {String}
       * @protected
       * @default 'bui-select-input'
       */
      inputCls:{
        value:CLS_INPUT
      },
      /**
       * 鏄惁浣块€夋嫨鍒楄〃璺熼€夋嫨妗嗗悓绛夊搴�
       * <pre><code>
       *   picker = new Picker.ListPicker({
       *     width:300,  //鎸囧畾瀹藉害
       *     children : [grid] //閰嶇疆picker鍐呯殑鍒楄〃
       *   }),
       *   select = new Select.Select({  
       *     render:'#s1',
       *     picker : picker,
       *     forceFit:false, //涓嶅己杩垪琛ㄨ窡閫夋嫨鍣ㄥ搴︿竴鑷�
       *     valueField:'#hide',
       *     items : data
       *   });
       * select.render();
       * </code></pre>
       * @cfg {Boolean} [forceFit=true]
       */
      forceFit : {
        value : true
      },
      events : {
        value : {
          /**
           * 閫夋嫨鍊煎彂鐢熸敼鍙樻椂
           * @event
           * @param {Object} e 浜嬩欢瀵硅薄
           * @param {String} e.text 閫変腑鐨勬枃鏈�
           * @param {String} e.value 閫変腑鐨剉alue
           * @param {Object} e.item 鍙戠敓鏀瑰彉鐨勯€夐」
           */
          'change' : false
        }
      },
      /**
       * 鎺т欢鐨勯粯璁ゆā鐗�
       * @type {String}
       * @default 
       * '&lt;input type="text" readonly="readonly" class="bui-select-input"/&gt;&lt;span class="x-icon x-icon-normal"&gt;&lt;span class="bui-caret bui-caret-down"&gt;&lt;/span&gt;&lt;/span&gt;'
       */
      tpl : {
        view:true,
        value : '<input type="text" readonly="readonly" class="'+CLS_INPUT+'"/><span class="x-icon x-icon-normal"><i class="icon icon-caret icon-caret-down"></i></span>'
      },
      /**
       * 瑙﹀彂鐨勪簨浠�
       * @cfg {String} triggerEvent
       * @default 'click'
       */
      triggerEvent:{
        value:'click'
      }  
    }
  },{
    xclass : 'select'
  });

module.exports = select;

});
define("bui/select/combox", ["jquery","bui/common","bui/picker","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 缁勫悎妗嗗彲鐢ㄤ簬閫夋嫨杈撳叆鏂囨湰
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  Select = require("bui/select/select"),
  Tag = require("bui/select/tag"),
  CLS_INPUT = BUI.prefix + 'combox-input';

/**
 * 缁勫悎妗� 鐢ㄤ簬鎻愮ず杈撳叆
 * xclass:'combox'
 * <pre><code>
 * BUI.use('bui/select',function(Select){
 * 
 *  var select = new Select.Combox({
 *    render:'#c1',
 *    name:'combox',
 *    items:['閫夐」1','閫夐」2','閫夐」3','閫夐」4']
 *  });
 *  select.render();
 * });
 * </code></pre>
 * @class BUI.Select.Combox
 * @extends BUI.Select.Select
 */
var combox = Select.extend([Tag],{

  renderUI : function(){
    var _self = this,
      picker = _self.get('picker');
    picker.set('autoFocused',false);

  },
  _uiSetItems : function(v){
    var _self = this;

    for(var i = 0 ; i < v.length ; i++){
      var item = v[i];
      if(BUI.isString(item)){
        v[i] = {value:item,text:item};
      }
    }
    combox.superclass._uiSetItems.call(_self,v);
  },
  bindUI: function(){
    var _self = this,
      picker = _self.get('picker'),
      list = picker.get('list'),
      textField = picker.get('textField');

    //淇鎵嬪姩娓呯┖textField閲岄潰鐨勫€硷紝鍐嶉€夋椂涓嶅～鍏呯殑bug
    $(textField).on('keyup', function(ev){
      var item = list.getSelected();
      if(item){
        list.clearItemStatus(item);
      }
    });

    picker.on('show',function(){
      list.clearSelected();
    });

  },
  //瑕嗗啓姝ゆ柟娉�
  _uiSetValueField : function(){

  },
  /**
   * @protected
   * 鑾峰彇瑙﹀彂鐐�
   */
  getTrigger : function(){
    return this._getTextEl();
  }
},{
  ATTRS : 
  {
    /*focusable : {
      value : false
    },*/
    /**
     * 鎺т欢鐨勬ā鐗�
     * @type {String}
     * @default  
     * '&lt;input type="text" class="'+CLS_INPUT+'"/&gt;'
     */
    tpl:{
      view:true,
      value:'<input type="text" class="'+CLS_INPUT+'"/>'
    },
    /**
     * 鏄剧ず閫夋嫨鍥炵殑鏂囨湰DOM鑺傜偣鐨勬牱寮�
     * @type {String}
     * @protected
     * @default 'bui-combox-input'
     */
    inputCls:{
      value:CLS_INPUT
    },
    autoSetValue : {
      value : false
    }
  }
},{
  xclass:'combox'
});

module.exports = combox;

});
define("bui/select/tag", ["jquery","bui/common","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 杈撳叆銆侀€夋嫨瀹屾瘯鍚庢樉绀簍ag
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  List = require("bui/list"),
  KeyCode = BUI.KeyCode,
  WARN = 'warn';

function html_decode(str)   
{   
  var s = "";   
  if (str.length == 0) return "";   
  s = str.replace(/>/g, "&gt;");   
  s = s.replace(/</g, "&lt;");   
  return s;   
}    

/**
 * @class BUI.Select.Tag
 * 鏄剧ずtag鐨勬墿灞�
 */
var Tag = function(){

};

Tag.ATTRS = {
  /**
   * 鏄剧ずtag
   * @type {Boolean}
   */
  showTag : {
    value : false
  },
  /**
   * tag鐨勬ā鏉�
   * @type {String}
   */
  tagItemTpl : {
    value : '<li>{text}<button>脳</button></li>'
  },
  /**
   * @private
   * tag 鐨勫垪琛�
   * @type {Object}
   */
  tagList : {
    value : null
  },
  limit : {
    value : null
  },
  forbitInput : {
    value : false
  },
  tagPlaceholder : {
    value : '杈撳叆鏍囩'
  },
  tagFormatter : {
    value : null
  },
  /**
   * 榛樿鐨剉alue鍒嗛殧绗︼紝灏嗗€煎垎鍓叉樉绀烘垚tag
   * @type {String}
   */
  separator : {
    value : ';'
  }
};

BUI.augment(Tag,{

  __renderUI : function(){
    var _self = this,
      showTag = _self.get('showTag'),
      tagPlaceholder = _self.get('tagPlaceholder'),
      tagInput = _self.getTagInput();
    if(showTag && !tagInput.attr('placeholder')){
      tagInput.attr('placeholder',tagPlaceholder);
      _self.set('inputForceFit',false);
    }
  },
  __bindUI : function(){
    var _self = this,
      showTag = _self.get('showTag'),
      tagInput = _self.getTagInput();
    if(showTag){
      tagInput.on('keydown',function(ev){
        if(!tagInput.val()){
          var tagList =  _self.get('tagList'),
            last = tagList.getLastItem(),
            picker = _self.get('picker');
          if(ev.which == KeyCode.DELETE || ev.which == KeyCode.BACKSPACE){
            if(tagList.hasStatus(last,WARN)){
              _self._delTag(last);
            }else{
              tagList.setItemStatus(last,WARN,true);
            }
            picker.hide();
          }else{
            tagList.setItemStatus(last,WARN,false);
          }
        }
      });

      var handler;
      function setTag(){
        var tagList =  _self.get('tagList'),
          last = tagList.getLastItem();
        if(last && tagList.hasStatus(last,WARN)){ //濡傛灉鏈€鍚庝竴椤瑰浜庤鍛婄姸鎬�
          tagList.setItemStatus(last,WARN,false);
        }

        var val = tagInput.val();
        if(val){
          _self._addTag(val);
        }
        
      }
      if(!_self.get('forbitInput')){
        tagInput.on('change',function(){
          handler = setTimeout(function(){
            setTag();
            handler = null;
          },50);
        });
      }
      

      _self.on('change',function(ev){
        setTimeout(function(){
          if(handler){
            clearTimeout(handler);
          }
          setTag();
        });
      });
    }
  },
  __syncUI : function(){
    var _self = this,
      showTag = _self.get('showTag'),
      valueField = _self.get('valueField');
    if(showTag && valueField){
      _self._setTags($(valueField).val());
    }
  },
  //璁剧疆tags锛屽垵濮嬪寲鏃跺鐞�
  _setTags : function(value){
    
    var _self = this,
      tagList = _self.get('tagList'),
      separator = _self.get('separator'),
      formatter = _self.get('tagFormatter'),
      values = value.split(separator);
    if(!tagList){
      tagList = _self._initTagList();
    }
    if(value){
      BUI.each(values,function(val){
        var text = val;
        if(formatter){
          text = formatter(text);
        }
        tagList.addItem({value : val,text : text});
      });
    }
  },
  //娣诲姞tag
  _addTag : function(value){
    value = html_decode(value);
    var _self = this,
      tagList = _self.get('tagList'),
      tagInput = _self.getTagInput(),
      limit = _self.get('limit'),
      formatter = _self.get('tagFormatter'),
      preItem = tagList.getItem(value);
    if(limit){
      if(tagList.getItemCount() >= limit){
        return;
      }
    }
    if(!preItem){
      var text = value;
      if(formatter){
        text = formatter(text);
      }
      tagList.addItem({value : value,text : text});
      _self._synTagsValue();
    }else{
      _self._blurItem(tagList,preItem);
    }
    tagInput.val('');

  },
  //鎻愮ず鐢ㄦ埛閫夐」宸茬粡瀛樺湪
  _blurItem : function(list,item){
    list.setItemStatus(item,'active',true);
    setTimeout(function(){
      list.setItemStatus(item,'active',false);
    },400);
  },
  //鍒犻櫎tag
  _delTag : function(item){
    var _self = this,
      tagList = _self.get('tagList');

    tagList.removeItem(item);
    _self._synTagsValue();
  },

  /**
   * 鑾峰彇tag 鍒楄〃鐨勫€�
   * @return {String} 鍒楄〃瀵瑰簲鐨勫€�
   */
  getTagsValue : function(){
    var _self = this,
      tagList = _self.get('tagList'),
      items = tagList.getItems(),
      vals = [];

    BUI.each(items,function(item){
      vals.push(item.value);
    });
    return vals.join(_self.get('separator'));
  },
  //鍒濆鍖杢agList
  _initTagList : function(){
    var _self = this,
      tagInput = _self.getTagInput(),
      tagList = new List.SimpleList({
        elBefore : tagInput,
        itemTpl : _self.get('tagItemTpl'),
        idField : 'value'
      });
    tagList.render();
    _self._initTagEvent(tagList);
    _self.set('tagList',tagList);
    return tagList;
  },
  //鍒濆鍖杢ag鍒犻櫎浜嬩欢
  _initTagEvent : function(list){
    var _self = this;
    list.on('itemclick',function(ev){
      var sender = $(ev.domTarget);
      if(sender.is('button')){
        _self._delTag(ev.item);
      }
    });
  },
  /**
   * 鑾峰彇杈撳叆鐨勬枃鏈
   * @protected
   * @return {jQuery} 杈撳叆妗�
   */
  getTagInput : function(){
    var _self = this,
        el = _self.get('el');
    return el.is('input') ? el : el.find('input');
  },
  _synTagsValue : function(){
    var _self = this,
      valueEl = _self.get('valueField');
     valueEl && $(valueEl).val(_self.getTagsValue());
  }
});

module.exports = Tag;

});
define("bui/select/suggest", ["jquery","bui/common","bui/picker","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 缁勫悎妗嗗彲鐢ㄤ簬閫夋嫨杈撳叆鏂囨湰
 * @ignore
 */

'use strict';
var $ = require("jquery"),
  BUI = require("bui/common"),
  Combox = require("bui/select/combox"),
  TIMER_DELAY = 200,
  EMPTY = '';

/**
 * 缁勫悎妗� 鐢ㄤ簬鎻愮ず杈撳叆
 * xclass:'suggest'
 * ** 绠€鍗曚娇鐢ㄩ潤鎬佹暟鎹� **
 * <pre><code>
 * BUI.use('bui/select',function (Select) {
 *
 *  var suggest = new Select.Suggest({
 *     render:'#c2',
 *     name:'suggest', //褰㈡垚杈撳叆妗嗙殑name
 *     data:['1222224','234445','122','1111111']
 *   });
 *   suggest.render();
 *   
 * });
 * </code></pre>
 * ** 鏌ヨ鏈嶅姟鍣ㄦ暟鎹� **
 * <pre><code>
 * BUI.use('bui/select',function(Select){
 *
 *  var suggest = new Select.Suggest({
 *    render:'#s1',
 *    name:'suggest', 
 *    url:'server-data.php'
 *  });
 *  suggest.render();
 *
 * });
 * </code></pre>
 * @class BUI.Select.Suggest
 * @extends BUI.Select.Combox
 */
var suggest = Combox.extend({
  bindUI : function(){
    var _self = this,
      textEl = _self.get('el').find('input'),
      triggerEvent = (_self.get('triggerEvent') === 'keyup') ? 'keyup' : 'keyup click';

    //鐩戝惉 keyup 浜嬩欢
    textEl.on(triggerEvent, function(){
      _self._start();
    });
  },
  //鍚姩璁℃椂鍣紝寮€濮嬬洃鍚敤鎴疯緭鍏�
  _start:function(){
    var _self = this;
    _self._timer = _self.later(function(){
      _self._updateContent();
     // _self._timer = _self.later(arguments.callee, TIMER_DELAY);
    }, TIMER_DELAY);
  },
  //鏇存柊鎻愮ず灞傜殑鏁版嵁
  _updateContent:function(){
    var _self = this,
      isStatic = _self.get('data'),
      textEl = _self.get('el').find('input'),
      text;

    //妫€娴嬫槸鍚﹂渶瑕佹洿鏂般€傛敞鎰忥細鍔犲叆绌烘牸涔熺畻鏈夊彉鍖�
    if (!isStatic && (textEl.val() === _self.get('query'))) {
      return;
    }

    _self.set('query', textEl.val());
    text = textEl.val();
    //杈撳叆涓虹┖鏃�,鐩存帴杩斿洖
    if (!isStatic && !text) {
      /*        _self.set('items',EMPTY_ARRAY);
      picker.hide();*/
      return;
    }

    //3绉嶅姞杞芥柟寮忛€夋嫨
    var cacheable = _self.get('cacheable'),
      store = _self.get('store'),
      url = _self.get('url'),
      data = _self.get('data');

    if (cacheable && (url || store)) {
      var dataCache = _self.get('dataCache');
      if (dataCache[text] !== undefined) {
        //浠庣紦瀛樿鍙�
        //BUI.log('use cache');
        _self._handleResponse(dataCache[text]);
      }else{
        //璇锋眰鏈嶅姟鍣ㄦ暟鎹�
        //BUI.log('no cache, data from server');
        _self._requestData();
      }
    }else if (url || store) {
      //浠庢湇鍔″櫒鑾峰彇鏁版嵁
      //BUI.log('no cache, data always from server');
      _self._requestData();
    }else if (data) {
      //浣跨敤闈欐€佹暟鎹簮
      //BUI.log('use static datasource');
      _self._handleResponse(data,true);
    }
  },
  //濡傛灉瀛樺湪鏁版嵁婧�
  _getStore : function(){
    var _self = this,
      picker = _self.get('picker'),
      list = picker.get('list');
    if(list){
      return list.get('store');
    }
  },
  //閫氳繃 script 鍏冪礌寮傛鍔犺浇鏁版嵁
  _requestData:function(){
    var _self = this,
      textEl = _self.get('el').find('input'),
      callback = _self.get('callback'),
      store = _self.get('store'),
      param = {};

    param[textEl.attr('name')] = textEl.val();
    if(store){
      param.start = 0; //鍥炴粴鍒扮涓€椤�
      store.load(param,callback);
    }else{
      $.ajax({
        url:_self.get('url'),
        type:'post',
        dataType:_self.get('dataType'),
        data:param,
        success:function(data){
          _self._handleResponse(data);
          if(callback){
            callback(data);
          }
        }
      });
    }
    
  },
  //澶勭悊鑾峰彇鐨勬暟鎹�
  _handleResponse:function(data,filter){
    var _self = this,
      items = filter ? _self._getFilterItems(data) : data;
    _self.set('items',items);

    if(_self.get('cacheable')){
      _self.get('dataCache')[_self.get('query')] = items;
    }
  },
  //濡傛灉鍒楄〃璁板綍鏄璞¤幏鍙栨樉绀虹殑鏂囨湰
  _getItemText : function(item){
    var _self = this,
      picker = _self.get('picker'),
      list = picker.get('list');
    if(list){
      return list.getItemText(item);
    }
    return '';
  },
  //鑾峰彇杩囨护鐨勬枃鏈�
  _getFilterItems:function(data){
    var _self = this,
      result = [],
      textEl = _self.get('el').find('input'),
      text = textEl.val(),
      isStatic = _self.get('data');
    data = data || [];
    /**
     * @private
     * @ignore
     */
    function push(str,item){
      if(BUI.isString(item)){
        result.push(str);
      }else{
        result.push(item);
      }
    }
    BUI.each(data, function(item){
      var str = BUI.isString(item) ? item : _self._getItemText(item);
      if(isStatic){
        if(str.indexOf($.trim(text)) !== -1){
          push(str,item);
        }
      }else{
        push(str,item);
      }
    });
    
    return result;
  },
  /**
   * 寤惰繜鎵ц鎸囧畾鍑芥暟 fn
   * @protected
   * @return {Object} 鎿嶄綔瀹氭椂鍣ㄧ殑瀵硅薄
   */
  later:function (fn, when, periodic) {
    when = when || 0;
    var r = periodic ? setInterval(fn, when) : setTimeout(fn, when);

    return {
      id:r,
      interval:periodic,
      cancel:function () {
        if (this.interval) {
          clearInterval(r);
        } else {
          clearTimeout(r);
        }
      }
    };
  }
},{
  ATTRS : 
  {
    /**
     * 鐢ㄤ簬鏄剧ず鎻愮ず鐨勬暟鎹簮
     * <pre><code>
     *   var suggest = new Select.Suggest({
     *     render:'#c2',
     *     name:'suggest', //褰㈡垚杈撳叆妗嗙殑name
     *     data:['1222224','234445','122','1111111']
     *   });
     * </code></pre>
     * @cfg {Array} data
     */
    /**
     * 鐢ㄤ簬鏄剧ず鎻愮ず鐨勬暟鎹簮
     * @type {Array}
     */
    data:{
      value : null
    },
    /**
     * 杈撳叆妗嗙殑鍊�
     * @type {String}
     * @private
     */
    query:{
      value : EMPTY
    },
    /**
     * 鏄惁鍏佽缂撳瓨
     * @cfg {Boolean} cacheable
     */
    /**
     * 鏄惁鍏佽缂撳瓨
     * @type {Boolean}
     */
    cacheable:{
      value:false
    },
    /**
     * 缂撳瓨鐨勬暟鎹�
     * @private
     */
    dataCache:{
      shared:false,
      value:{}
    },
    /**
     * 璇锋眰杩斿洖鐨勬暟鎹牸寮忛粯璁や负'jsonp'
     * <pre><code>
     *  var suggest = new Select.Suggest({
     *    render:'#s1',
     *    name:'suggest', 
     *    dataType : 'json',
     *    url:'server-data.php'
     *  }); 
     * </code></pre>
     * @cfg {Object} [dataType = 'jsonp']
     */
    dataType : {
      value : 'jsonp'
    },
    /**
     * 璇锋眰鏁版嵁鐨剈rl
     * <pre><code>
     *  var suggest = new Select.Suggest({
     *    render:'#s1',
     *    name:'suggest', 
     *    dataType : 'json',
     *    url:'server-data.php'
     *  }); 
     * </code></pre>
     * @cfg {String} url
     */
    url : {

    },
   
    /**
     * 璇锋眰瀹屾暟鎹殑鍥炶皟鍑芥暟
     * <pre><code>
     *  var suggest = new Select.Suggest({
     *    render:'#s1',
     *    name:'suggest', 
     *    dataType : 'json',
     *    callback : function(data){
     *      //do something
     *    },
     *    url:'server-data.php'
     *  }); 
     * </code></pre>
     * @type {Function}
     */
    callback : {

    },
    /**
     * 瑙﹀彂鐨勪簨浠�
     * @cfg {String} triggerEvent
     * @default 'click'
     */
    triggerEvent:{
      valueFn:function(){
        if(this.get('data')){
          return 'click';
        }
        return 'keyup';
      }
    },
    /**
     * suggest涓嶆彁渚涜嚜鍔ㄨ缃€変腑鏂囨湰鍔熻兘
     * @type {Boolean}
     */
    autoSetValue:{
      value:false
    }
  }
},{
  xclass:'suggest'
});

module.exports = suggest;

});

define("bui/form", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview form 鍛藉悕绌洪棿鍏ュ彛
 * @ignore
 */
var BUI = require("bui/common"),
  Form = BUI.namespace('Form'),
  Tips = require("bui/form/tips");

BUI.mix(Form, {
  Tips : Tips,
  TipItem : Tips.Item,
  FieldContainer : require("bui/form/fieldcontainer"),
  Form : require("bui/form/form"),
  Row : require("bui/form/row"),
  Group : require("bui/form/fieldgroup"),
  HForm : require("bui/form/hform"),
  Rules : require("bui/form/rules"),
  Field : require("bui/form/field"),
  FieldGroup : require("bui/form/fieldgroup")
});

module.exports = Form;

});
define("bui/form/tips", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 杈撳叆鎻愮ず淇℃伅
 * @author dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  prefix = BUI.prefix,
  Overlay = require("bui/overlay").Overlay,
  FIELD_TIP = 'data-tip',
  CLS_TIP_CONTAINER = prefix + 'form-tip-container';

/**
 * 琛ㄥ崟鎻愮ず淇℃伅绫�
 * xclass:'form-tip'
 * @class BUI.Form.TipItem
 * @extends BUI.Overlay.Overlay
 */
var tipItem = Overlay.extend(

{
  initializer : function(){
    var _self = this,
      render = _self.get('render');
    if(!render){
      var parent = $(_self.get('trigger')).parent();
      _self.set('render',parent);
    }
  },
  renderUI : function(){
    var _self = this;

    _self.resetVisible();
    
  },
  /**
   * 閲嶇疆鏄惁鏄剧ず
   */
  resetVisible : function(){
    var _self = this,
      triggerEl = $(_self.get('trigger'));

    if(triggerEl.val()){//濡傛灉榛樿鏈夋枃鏈垯涓嶆樉绀猴紝鍚﹀垯鏄剧ず
      _self.set('visible',false);
    }else{
      _self.set('align',{
        node:$(_self.get('trigger')),
        points: ['cl','cl']
      });
      _self.set('visible',true);
    }
  },
  bindUI : function(){
    var _self = this,
      triggerEl = $(_self.get('trigger'));

    _self.get('el').on('click',function(){
      _self.hide();
      triggerEl.focus();
    });
    triggerEl.on('click focus',function(){
      _self.hide();
    });

    triggerEl.on('blur',function(){
      _self.resetVisible();
    });
  }
},{
  ATTRS : 
  {
    /**
     * 鎻愮ず鐨勮緭鍏ユ 
     * @cfg {String|HTMLElement|jQuery} trigger
     */
    /**
     * 鎻愮ず鐨勮緭鍏ユ
     * @type {String|HTMLElement|jQuery}
     */
    trigger:{

    },
    /**
     * 鎻愮ず鏂囨湰
     * @cfg {String} text
     */
    /**
     * 鎻愮ず鏂囨湰
     * @type {String}
     */
    text : {

    },
    /**
     * 鎻愮ず鏂囨湰涓婃樉绀虹殑icon鏍峰紡
     * @cfg {String} iconCls
     *     iconCls : icon-ok
     */
    /**
     * 鎻愮ず鏂囨湰涓婃樉绀虹殑icon鏍峰紡
     * @type {String}
     *     iconCls : icon-ok
     */
    iconCls:{

    },
    /**
     * 榛樿鐨勬ā鐗�
     * @type {String}
     * @default '<span class="{iconCls}"></span><span class="tip-text">{text}</span>'
     */
    tpl:{
      value:'<span class="{iconCls}"></span><span class="tip-text">{text}</span>'
    }
  }
},{
  xclass : 'form-tip'
});

/**
 * 琛ㄥ崟鎻愮ず淇℃伅鐨勭鐞嗙被
 * @class BUI.Form.Tips
 * @extends BUI.Base
 */
var Tips = function(config){
  if (this.constructor !== Tips){
    return new Tips(config);
  }

  Tips.superclass.constructor.call(this,config);
  this._init();
};

Tips.ATTRS = 
{

  /**
   * 琛ㄥ崟鐨勯€夋嫨鍣�
   * @cfg {String|HTMLElement|jQuery} form
   */
  /**
   * 琛ㄥ崟鐨勯€夋嫨鍣�
   * @type {String|HTMLElement|jQuery}
   */
  form : {

  },
  /**
   * 琛ㄥ崟鎻愮ず椤瑰璞� {@link BUI.Form.TipItem}
   * @readOnly
   * @type {Array} 
   */
  items : {
    valueFn:function(){
      return [];
    }
  }
};

BUI.extend(Tips,BUI.Base);

BUI.augment(Tips,{
  _init : function(){
    var _self = this,
      form = $(_self.get('form'));
    if(form.length){
      BUI.each($.makeArray(form[0].elements),function(elem){
        var tipConfig = $(elem).attr(FIELD_TIP);
        if(tipConfig){
          _self._initFormElement(elem,$.parseJSON(tipConfig));
        }
      });
      form.addClass(CLS_TIP_CONTAINER);
    }
  },
  _initFormElement : function(element,config){
    if(config){
      config.trigger = element;
      //config.render = this.get('form');
    }
    var _self = this,
      items = _self.get('items'),
      item = new tipItem(config);
    items.push(item);
  },
  /**
   * 鑾峰彇鎻愮ず椤�
   * @param {String} name 瀛楁鐨勫悕绉�
   * @return {BUI.Form.TipItem} 鎻愮ず椤�
   */
  getItem : function(name){
    var _self = this,
      items = _self.get('items'),
      result = null;
    BUI.each(items,function(item){

      if($(item.get('trigger')).attr('name') === name){
        result = item;
        return false;
      }

    });

    return result;
  },
  /**
   * 閲嶇疆鎵€鏈夋彁绀虹殑鍙鐘舵€�
   */
  resetVisible : function(){
    var _self = this,
      items = _self.get('items');

    BUI.each(items,function(item){
      item.resetVisible();
    });
  },
  /**
   * 鐢熸垚 琛ㄥ崟鎻愮ず
   */
  render:function(){
     var _self = this,
      items = _self.get('items');
    BUI.each(items,function(item){
      item.render();
    });
  },
  /**
   * 鍒犻櫎鎵€鏈夋彁绀�
   */
  destroy:function(){
    var _self = this,
      items = _self.get(items);

    BUI.each(items,function(item){
      item.destroy();
    });
  }
});

Tips.Item = tipItem;

module.exports = Tips;

});
define("bui/form/fieldcontainer", ["jquery","bui/common","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟瀛楁鐨勫鍣ㄦ墿灞�
 * @ignore
 */
var $ = require("jquery"),
  BUI = require("bui/common"),
  Field = require("bui/form/field"),
  GroupValid = require("bui/form/groupvalid"),
  PREFIX = BUI.prefix;

var FIELD_XCLASS = 'form-field',
  CLS_FIELD = PREFIX + FIELD_XCLASS,
  CLS_GROUP = PREFIX + 'form-group',
  FIELD_TAGS = 'input,select,textarea';

function isField(node){
  return node.is(FIELD_TAGS);
}
/**
 * 鑾峰彇鑺傜偣闇€瑕佸皝瑁呯殑瀛愯妭鐐�
 * @ignore
 */
function getDecorateChilds(node,srcNode){

  if(node != srcNode){

    if(isField(node)){
      return [node];
    }
    var cls = node.attr('class');
    if(cls && (cls.indexOf(CLS_GROUP) !== -1 || cls.indexOf(CLS_FIELD) !== -1)){
      return [node];
    }
  }
  var rst = [],
    children = node.children();
  BUI.each(children,function(subNode){
    rst = rst.concat(getDecorateChilds($(subNode),srcNode));
  });
  return rst;
}

var containerView = BUI.Component.View.extend([GroupValid.View]);

/**
 * 琛ㄥ崟瀛楁瀹瑰櫒鐨勬墿灞曠被
 * @class BUI.Form.FieldContainer
 * @extends BUI.Component.Controller
 * @mixins BUI.Form.GroupValid
 */
var container = BUI.Component.Controller.extend([GroupValid],
  {
    //鍚屾鏁版嵁
    syncUI : function(){
      var _self = this,
        fields = _self.getFields(),
        validators = _self.get('validators');

      BUI.each(fields,function(field){
        var name = field.get('name');
        if(validators[name]){
          field.set('validator',validators[name]);
        }
      });
      BUI.each(validators,function(item,key){
        //鎸夌収ID鏌ユ壘
        if(key.indexOf('#') == 0){
          var id = key.replace('#',''),
            child = _self.getChild(id,true);
          if(child){
            child.set('validator',item);
          }
        }
      });
    },
    /**
     * 鑾峰彇灏佽鐨勫瓙鎺т欢鑺傜偣
     * @protected
     * @override
     */
    getDecorateElments : function(){
      var _self = this,
        el = _self.get('el');
      var items = getDecorateChilds(el,el);
      return items;
    },
    /**
     * 鏍规嵁瀛愯妭鐐硅幏鍙栧搴旂殑瀛愭帶浠� xclass
     * @protected
     * @override
     */
    findXClassByNode : function(childNode, ignoreError){


      if(childNode.attr('type') === 'checkbox'){
        return FIELD_XCLASS + '-checkbox';
      }

      if(childNode.attr('type') === 'radio'){
        return FIELD_XCLASS + '-radio';
      }

      if(childNode.attr('type') === 'number'){
        return FIELD_XCLASS + '-number';
      }

      if(childNode.hasClass('calendar')){
        return FIELD_XCLASS + '-date';
      }

      if(childNode[0].tagName == "SELECT"){
        return FIELD_XCLASS + '-select';
      }

      if(isField(childNode)){
        return FIELD_XCLASS;
      }

      return BUI.Component.Controller.prototype.findXClassByNode.call(this,childNode, ignoreError);
    },
    /**
     * 鑾峰彇琛ㄥ崟缂栬緫鐨勫璞�
     * @return {Object} 缂栬緫鐨勫璞�
     */
    getRecord : function(){
      var _self = this,
        rst = {},
        fields = _self.getFields();
      BUI.each(fields,function(field){
        var name = field.get('name'),
          value = _self._getFieldValue(field);

        if(!rst[name]){//娌℃湁鍊硷紝鐩存帴璧嬪€�
          rst[name] = value;
        }else if(BUI.isArray(rst[name]) && value != null){//宸茬粡瀛樺湪鍊硷紝骞朵笖鏄暟缁勶紝鍔犲叆鏁扮粍
          rst[name].push(value);
        }else if(value != null){          //鍚﹀垯灏佽鎴愭暟缁勶紝骞跺姞鍏ユ暟缁�
          var arr = [rst[name]]
          arr.push(value);
          rst[name] = arr; 
        }
      });
      return rst;
    },
    /**
     * 鑾峰彇琛ㄥ崟瀛楁
     * @return {Array} 琛ㄥ崟瀛楁
     */
    getFields : function(name){
      var _self = this,
        rst = [],
        children = _self.get('children');
      BUI.each(children,function(item){
        if(item instanceof Field){
          if(!name || item.get('name') == name){
            rst.push(item);
          }
        }else if(item.getFields){
          rst = rst.concat(item.getFields(name));
        }
      });
      return rst;
    },
    /**
     * 鏍规嵁name 鑾峰彇琛ㄥ崟瀛楁
     * @param  {String} name 瀛楁鍚�
     * @return {BUI.Form.Field}  琛ㄥ崟瀛楁鎴栬€� null
     */
    getField : function(name){
      var _self = this,
        fields = _self.getFields(),
        rst = null;

      BUI.each(fields,function(field){
        if(field.get('name') === name){
          rst = field;
          return false;
        }
      });
      return rst;
    },
    /**
     * 鏍规嵁绱㈠紩鑾峰彇瀛楁鐨刵ame
     * @param  {Number} index 瀛楁鐨勭储寮�
     * @return {String}   瀛楁鍚嶇О
     */
    getFieldAt : function (index) {
      return this.getFields()[index];
    },
    /**
     * 鏍规嵁瀛楁鍚�
     * @param {String} name 瀛楁鍚�
     * @param {*} value 瀛楁鍊�
     */
    setFieldValue : function(name,value){
      var _self = this,
        fields = _self.getFields(name);
        BUI.each(fields,function(field){
          _self._setFieldValue(field,value);
        });
    },
    //璁剧疆瀛楁鍩熺殑鍊�
    _setFieldValue : function(field,value){
      //濡傛灉瀛楁涓嶅彲鐢紝鍒欎笉鑳借缃€�
      if(field.get('disabled')){
        return;
      }
      //濡傛灉鏄彲鍕鹃€夌殑
      if(field instanceof Field.Check){
        var fieldValue = field.get('value');
        if(value && (fieldValue === value || (BUI.isArray(value) && BUI.Array.contains(fieldValue,value)))){
          field.set('checked',true);
        }else{
          field.set('checked',false);
        }
      }else{
        if(value == null){
          value = '';
        }
        field.clearErrors(true);//娓呯悊閿欒
        field.set('value',value);
      }
    },
    /**
     * 鑾峰彇瀛楁鍊�,涓嶅瓨鍦ㄥ瓧娈垫椂杩斿洖null,澶氫釜鍚屽悕瀛楁鏃讹紝checkbox杩斿洖涓€涓暟缁�
     * @param  {String} name 瀛楁鍚�
     * @return {*}  瀛楁鍊�
     */
    getFieldValue : function(name){
      var _self = this,
        fields = _self.getFields(name),
        rst = [];

      BUI.each(fields,function(field){
        var value = _self._getFieldValue(field);
        if(value){
          rst.push(value);
        }
      });
      if(rst.length === 0){
        return null;
      }
      if(rst.length === 1){
        return rst[0]
      }
      return rst;
    },
    //鑾峰彇瀛楁鍩熺殑鍊�
    _getFieldValue : function(field){
      if(!(field instanceof Field.Check) || field.get('checked')){
        return field.get('value');
      }
      return null;
    },
    /**
     * 娓呴櫎鎵€鏈夎〃鍗曞煙鐨勫€�
     */
    clearFields : function(){
      this.clearErrors(true);
      this.setRecord({})
    },
    /**
     * 璁剧疆琛ㄥ崟缂栬緫鐨勫璞�
     * @param {Object} record 缂栬緫鐨勫璞�
     */
    setRecord : function(record){
      var _self = this,
        fields = _self.getFields();

      BUI.each(fields,function(field){
        var name = field.get('name');
        _self._setFieldValue(field,record[name]);
      });
    },
    /**
     * 鏇存柊琛ㄥ崟缂栬緫鐨勫璞�
     * @param  {Object} record 缂栬緫鐨勫璞�
     */
    updateRecord : function(record){
      var _self = this,
        fields = _self.getFields();

      BUI.each(fields,function(field){
        var name = field.get('name');
        if(record.hasOwnProperty(name)){
          _self._setFieldValue(field,record[name]);
        }
      });
    },
    /**
     * 璁剧疆鎺т欢鑾峰彇鐒︾偣锛岃缃涓€涓瓙鎺т欢鑾峰彇鐒︾偣
     */
    focus : function(){
      var _self = this,
        fields = _self.getFields(),
        firstField = fields[0];
      if(firstField){
        firstField.focus();
      }
    },
    //绂佺敤鎺т欢
    _uiSetDisabled : function(v){
      var _self = this,
        children = _self.get('children');

      BUI.each(children,function(item){
        item.set('disabled',v);
      });
    }
  },
  {
    ATTRS : {
      /**
       * 琛ㄥ崟鐨勬暟鎹褰曪紝浠ラ敭鍊煎鐨勫舰寮忓瓨鍦�
       * @type {Object}
       */
      record : {
        setter : function(v){
          this.setRecord(v);
        },
        getter : function(){
          return this.getRecord();
        }
      },
      /**
       * 鍐呴儴鍏冪礌鐨勯獙璇佸嚱鏁帮紝鍙互浣跨敤2涓€夋嫨鍣�
       * <ol>
       *   <li>id: 浣跨敤浠�'#'涓哄墠缂€鐨勯€夋嫨鍣紝鍙互鏌ユ壘瀛楁鎴栬€呭垎缁勶紝娣诲姞鑱斿悎鏍￠獙</li>
       *   <li>name: 涓嶄娇鐢ㄤ换浣曞墠缂€锛屾病鏌ユ壘琛ㄥ崟瀛楁</li>
       * </ol>
       * @type {Object}
       */
      validators : {
        value : {

        }
      },
      /**
       * 榛樿鐨勫姞杞芥帶浠跺唴瀹圭殑閰嶇疆,榛樿鍊硷細
       * <pre>
       *  {
       *   property : 'children',
       *   dataType : 'json'
       * }
       * </pre>
       * @type {Object}
       */
      defaultLoaderCfg  : {
        value : {
          property : 'children',
          dataType : 'json'
        }
      },
      disabled : {
        sync : false
      },
      isDecorateChild : {
        value : true
      },
      xview : {
        value : containerView
      }
    }
  },{
    xclass : 'form-field-container'
  }
); 
container.View = containerView;

module.exports = container;

});
define("bui/form/field", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鍩熺殑鍏ュ彛鏂囦欢
 * @ignore
 */
var BUI = require("bui/common"),
  Field = require("bui/form/fields/base");

BUI.mix(Field, {
  Text : require("bui/form/fields/text"),
  Date : require("bui/form/fields/date"),
  Select : require("bui/form/fields/select"),
  Hidden : require("bui/form/fields/hidden"),
  Number : require("bui/form/fields/number"),
  Check : require("bui/form/fields/check"),
  Radio : require("bui/form/fields/radio"),
  Checkbox : require("bui/form/fields/checkbox"),
  Plain : require("bui/form/fields/plain"),
  List : require("bui/form/fields/list"),
  TextArea : require("bui/form/fields/textarea"),
  Uploader : require("bui/form/fields/uploader"),
  CheckList : require("bui/form/fields/checklist"),
  RadioList : require("bui/form/fields/radiolist")
});

module.exports = Field;

});
define("bui/form/fields/base", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鍏冪礌
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  Component = BUI.Component,
  TipItem = require("bui/form/tips").Item,
  Valid = require("bui/form/valid"),
  Remote = require("bui/form/remote"),
  CLS_FIELD_ERROR = BUI.prefix + 'form-field-error',
  CLS_TIP_CONTAINER = 'bui-form-tip-container',
  DATA_ERROR = 'data-error';

/**
 * 瀛楁瑙嗗浘绫�
 * @class BUI.Form.FieldView
 * @private
 */
var fieldView = Component.View.extend([Remote.View,Valid.View],{
  //娓叉煋DOM
  renderUI : function(){
    var _self = this,
      control = _self.get('control');

    if(!control){
      var controlTpl = _self.get('controlTpl'),
        container = _self.getControlContainer();
        
      if(controlTpl){
        var control = $(controlTpl).appendTo(container);
        _self.set('control',control);
      }
    }else{
      //var controlContainer = control.parent();
      _self.set('controlContainer',control.parent());
    }
  },
  /**
   * 娓呯悊鏄剧ず鐨勯敊璇俊鎭�
   * @protected
   */
  clearErrors : function(){
    var _self = this,
      msgEl = _self.get('msgEl');
    if(msgEl){
      msgEl.remove();
      _self.set('msgEl',null);
    }
    _self.get('el').removeClass(CLS_FIELD_ERROR);
  },
  /**
   * 鏄剧ず閿欒淇℃伅
   * @param {String} msg 閿欒淇℃伅
   * @protected
   */
  showError : function(msg,errorTpl){
    var _self = this,
      control = _self.get('control'),
      errorMsg = BUI.substitute(errorTpl,{error : msg}),
      el = $(errorMsg);
    //_self.clearErrorMsg();
    
    el.appendTo(control.parent());
    _self.set('msgEl',el);
    _self.get('el').addClass(CLS_FIELD_ERROR);
  },
  /**
   * @internal 鑾峰彇鎺т欢鐨勫鍣�
   * @return {jQuery} 鎺т欢瀹瑰櫒
   */
  getControlContainer : function(){
    var _self = this,
      el = _self.get('el'),
      controlContainer = _self.get('controlContainer');
    if(controlContainer){
      if(BUI.isString(controlContainer)){
        controlContainer = el.find(controlContainer);
      }
    }
    return (controlContainer && controlContainer.length) ? controlContainer : el;
  },
  /**
   * 鑾峰彇鏄剧ず鍔犺浇鐘舵€佺殑瀹瑰櫒
   * @protected
   * @override
   * @return {jQuery} 鍔犺浇鐘舵€佺殑瀹瑰櫒
   */
  getLoadingContainer : function () {
    return this.getControlContainer();
  },
  //璁剧疆鍚嶇О
  _uiSetName : function(v){
    var _self = this;
    _self.get('control').attr('name',v);
  }
},
{
  ATTRS : {
    error:{},
    controlContainer : {},
    msgEl: {},
    control : {}
  }
});

/**
 * 琛ㄥ崟瀛楁鍩虹被
 * @class BUI.Form.Field
 * @mixins BUI.Form.Remote
 * @mixins BUI.Form.Valid
 * @extends BUI.Component.Controller
 */
var field = Component.Controller.extend([Remote,Valid],{
  isField : true,
  initializer : function(){
    var _self = this;
    _self.on('afterRenderUI',function(){
      var tip = _self.get('tip');
      if(tip){
        var trigger = _self.getTipTigger();
        trigger && trigger.parent().addClass(CLS_TIP_CONTAINER);
        tip.trigger = trigger;
        tip.autoRender = true;
        tip = new TipItem(tip);
        _self.set('tip',tip);
      }
    });
  },
  //缁戝畾浜嬩欢
  bindUI : function(){
    var _self = this,
      validEvent = _self.get('validEvent'),
      changeEvent = _self.get('changeEvent'),
      firstValidEvent = _self.get('firstValidEvent'),
      innerControl = _self.getInnerControl();

    //閫夋嫨妗嗗彧浣跨敤 select浜嬩欢
    if(innerControl.is('select')){
      validEvent = 'change';
    }
    //楠岃瘉浜嬩欢
    innerControl.on(validEvent,function(){
      var value = _self.getControlValue(innerControl);
      _self.validControl(value);
    });
    if(firstValidEvent){
      //鏈彂鐢熼獙璇佹椂锛岄娆¤幏鍙栫劍鐐�/涓㈠け鐒︾偣/鐐瑰嚮锛岃繘琛岄獙璇�
      innerControl.on(firstValidEvent,function(){
        if(!_self.get('hasValid')){
          var value = _self.getControlValue(innerControl);
          _self.validControl(value);
        }
      });
    }
    

    //鏈潵鏄洃鍚帶浠剁殑change浜嬩欢锛屼絾鏄紝濡傛灉鎺т欢杩樻湭瑙﹀彂change,浣嗘槸閫氳繃get('value')鏉ュ彇鍊硷紝鍒欎細鍑虹幇閿欒锛�
    //鎵€浠ュ綋閫氳繃楠岃瘉鏃讹紝鍗宠Е鍙戞敼鍙樹簨浠�
    _self.on(changeEvent,function(){
      _self.onValid();
    });

    _self.on('remotecomplete',function (ev) {
      _self._setError(ev.error);
    });

  },
  /**
   * 楠岃瘉鎴愬姛鍚庢墽琛岀殑鎿嶄綔
   * @protected
   */
  onValid : function(){
    var _self = this,
      value =  _self.getControlValue();

    value = _self.parseValue(value);
    if(!_self.isCurrentValue(value)){
      _self.setInternal('value',value);
      _self.onChange();
    }
  },
  onChange : function () {
    this.fire('change');
  },
  /**
   * @protected
   * 鏄惁褰撳墠鍊硷紝涓昏鐢ㄤ簬鏃ユ湡绛夌壒娈婂€肩殑姣旇緝锛屼笉鑳界敤 == 杩涜姣旇緝
   * @param  {*}  value 杩涜姣旇緝鐨勫€�
   * @return {Boolean}  鏄惁褰撳墠鍊�
   */
  isCurrentValue : function (value) {
    return value == this.get('value');
  },
  //娓呯悊閿欒淇℃伅
  _clearError : function(){
    this.set('error',null);
    this.get('view').clearErrors();
  },
  //璁剧疆閿欒淇℃伅
  _setError : function(msg){
    this.set('error',msg);
    this.showErrors();
  },

  /**
   * 鑾峰彇鍐呴儴琛ㄥ崟鍏冪礌鐨勫€�
   * @protected
   * @param  {jQuery} [innerControl] 鍐呴儴琛ㄥ崟鍏冪礌
   * @return {String|Boolean} 琛ㄥ崟鍏冪礌鐨勫€�,checkbox锛宺adio鐨勮繑鍥炲€间负 true,false
   */
  getControlValue : function(innerControl){
    var _self = this;
    innerControl = innerControl || _self.getInnerControl();
    return innerControl.val();
  },
  /**
   * @protected
   * 鑾峰彇鍐呴儴鎺т欢鐨勫鍣�
   */
  getControlContainer : function(){
    return this.get('view').getControlContainer();
  },
  /**
   * 鑾峰彇寮傛楠岃瘉鐨勫弬鏁帮紝瀵逛簬琛ㄥ崟瀛楁鍩熻€岃█锛屾槸{[name] : [value]}
   * @protected
   * @override
   * @return {Object} 鍙傛暟閿€煎
   */
  getRemoteParams : function  () {
    var _self = this,
      rst = {};
    rst[_self.get('name')] = _self.getControlValue();
    return rst;
  },
  /**
   * 璁剧疆瀛楁鐨勫€�
   * @protected
   * @param {*} value 瀛楁鍊�
   */
  setControlValue : function(value){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.val(value);
  },
  /**
   * 灏嗗瓧绗︿覆绛夋牸寮忚浆鎹㈡垚
   * @protected
   * @param  {String} value 鍘熷鏁版嵁
   * @return {*}  璇ュ瓧娈垫寚瀹氱殑绫诲瀷
   */
  parseValue : function(value){
    return value;
  },
  valid : function(){
    var _self = this;
    _self.validControl();
  },
  /**
   * 楠岃瘉鎺т欢鍐呭
   * @return {Boolean} 鏄惁閫氳繃楠岃瘉
   */
  validControl : function(value){
    var _self = this, 
      errorMsg;
      value = value || _self.getControlValue(),
      preError = _self.get('error');
    errorMsg = _self.getValidError(value);
    _self.setInternal('hasValid',true);
    if (errorMsg) {
        _self._setError(errorMsg);
        _self.fire('error', {msg:errorMsg, value:value});
        if(preError !== errorMsg){//楠岃瘉閿欒淇℃伅鏀瑰彉锛岃鏄庨獙璇佹敼鍙�
          _self.fire('validchange',{ valid : false });
        }
    } else {
        _self._clearError();
        _self.fire('valid');
        if(preError){//濡傛灉浠ュ墠瀛樺湪閿欒锛岄偅涔堥獙璇佺粨鏋滄敼鍙�
          _self.fire('validchange',{ valid : true });
        }
    }
    
    return !errorMsg;
  },
  /**
   * 瀛楁鑾峰緱鐒︾偣
   */
  focus : function(){
    this.getInnerControl().focus();
  },
  /**
   * 瀛楁鍙戠敓鏀瑰彉
   */
  change : function(){
    var control = this.getInnerControl();
    control.change();
  },
  /**
   * 瀛楁涓㈠け鐒︾偣
   */
  blur : function(){
    this.getInnerControl().blur();
  },

  /**
   * 鏄惁閫氳繃楠岃瘉,濡傛灉鏈彂鐢熻繃鏍￠獙锛屽垯杩涜鏍￠獙锛屽惁鍒欎笉杩涜鏍￠獙锛岀洿鎺ユ牴鎹凡鏍￠獙鐨勭粨鏋滃垽鏂€�
   * @return {Boolean} 鏄惁閫氳繃楠岃瘉
   */
  isValid : function(){
    var _self = this;
    if(!_self.get('hasValid')){
      _self.validControl();
    }
    return !_self.get('error');
  },
  /**
   * 鑾峰彇楠岃瘉鍑洪敊淇℃伅
   * @return {String} 鍑洪敊淇℃伅
   */
  getError : function(){
    return this.get('error');
  },
  /**
   * 鑾峰彇楠岃瘉鍑洪敊淇℃伅闆嗗悎
   * @return {Array} 鍑洪敊淇℃伅闆嗗悎
   */
  getErrors : function(){
    var error = this.getError();
    if(error){
      return [error];
    }
    return [];
  },
  /**
   * 娓呯悊鍑洪敊淇℃伅锛屽洖婊氬埌鏈嚭閿欑姸鎬�
   * @param {Boolean} reset 娓呴櫎閿欒鏃讹紝鏄惁鍥炴粴涓婃姝ｇ‘鐨勫€�
   */
  clearErrors : function(reset){
    var _self = this;
    _self._clearError();
    if(reset && _self.getControlValue()!= _self.get('value')){
      _self.setControlValue(_self.get('value'));
    }
  },
  /**
   * 鑾峰彇鍐呴儴鐨勮〃鍗曞厓绱犳垨鑰呭唴閮ㄦ帶浠�
   * @protected
   * @return {jQuery|BUI.Component.Controller} 
   */
  getInnerControl : function(){
    return this.get('view').get('control');
  },
  /**
   * 鎻愮ず淇℃伅鎸夌収姝ゅ厓绱犲榻�
   * @protected
   * @return {HTMLElement}
   */
  getTipTigger : function(){
    return this.getInnerControl();
  },
  //鏋愭瀯鍑芥暟
  destructor : function(){
    var _self = this,
      tip = _self.get('tip');
    if(tip && tip.destroy){
      tip.destroy();
    }
  },
  /**
   * @protected
   * 璁剧疆鍐呴儴鍏冪礌瀹藉害
   */
  setInnerWidth : function(width){
    var _self = this,
      innerControl = _self.getInnerControl(),
      siblings = innerControl.siblings(),
      appendWidth = innerControl.outerWidth() - innerControl.width();

    BUI.each(siblings,function(dom){
      appendWidth += $(dom).outerWidth();
    });
    
    innerControl.width(width - appendWidth);
  },
  //閲嶇疆 鎻愮ず淇℃伅鏄惁鍙
  _resetTip :function(){
    var _self = this,
      tip = _self.get('tip');
    if(tip){
      tip.resetVisible();
    }
  },
  /**
   * 閲嶇疆鏄剧ず鎻愮ず淇℃伅
   * field.resetTip();
   */
  resetTip : function(){
    this._resetTip();
  },
  //璁剧疆鍊�
  _uiSetValue : function(v){
    var _self = this;
    //v = v ? v.toString() : '';
    _self.setControlValue(v);
    if(_self.get('rendered')){
      _self.validControl();
      _self.onChange();
    } 
    _self._resetTip();
  },
  //绂佺敤鎺т欢
  _uiSetDisabled : function(v){
    var _self = this,
      innerControl = _self.getInnerControl(),
      children = _self.get('children');
    innerControl.attr('disabled',v);
    if(_self.get('rendered')){
      if(v){//鎺т欢涓嶅彲鐢紝娓呴櫎閿欒
        _self.clearErrors();
      }
      if(!v){//鎺т欢鍙敤锛屾墽琛岄噸鏂伴獙璇�
        _self.valid();
      }
    }

    BUI.each(children,function(child){
      child.set('disabled',v);
    });

  },
  _uiSetWidth : function(v){
    var _self = this;
    if(v != null && _self.get('forceFit')){
      _self.setInnerWidth(v);
    }
  }
},{
  ATTRS : {
    /**
     * 鏄惁鍙戠敓杩囨牎楠岋紝鍒濆鍊间负绌烘椂锛屾湭杩涜璧嬪€硷紝涓嶈繘琛屾牎楠�
     * @type {Boolean}
     */
    hasValid : {
      value : false
    },
    /**
     * 鍐呴儴鍏冪礌鏄惁鏍规嵁鎺т欢瀹藉害璋冩暣瀹藉害
     * @type {Boolean}
     */
    forceFit : {
      value : false
    },
    /**
     * 鏄惁鏄剧ず鎻愮ず淇℃伅
     * @type {Object}
     */
    tip : {

    },
    /**
     * 琛ㄥ崟鍏冪礌鎴栬€呮帶浠跺唴瀹规敼鍙樼殑浜嬩欢
     * @type {String}
     */
    changeEvent : {
      value : 'valid'
    },
    /**
     * 鏈彂鐢熼獙璇佹椂锛岄娆¤幏鍙�/涓㈠け鐒︾偣锛岃繘琛岄獙璇�
     */
    firstValidEvent : {
      value : 'blur'
    },
    /**
     * 琛ㄥ崟鍏冪礌鎴栬€呮帶浠惰Е鍙戞浜嬩欢鏃讹紝瑙﹀彂楠岃瘉
     * @type {String}
     */
    validEvent : {
      value : 'keyup change'
    },
    /**
     * 瀛楁鐨刵ame鍊�
     * @type {Object}
     */
    name : {
      view :true
    },
    /**
     * 鏄惁鏄剧ず閿欒
     * @type {Boolean}
     */
    showError : {
      view : true,
      value : true
    },
    /**
     * 瀛楁鐨勫€�,绫诲瀷鏍规嵁瀛楁绫诲瀷鍐冲畾
     * @cfg {*} value
     */
    value : {
      view : true
    },
    /**
     * 鏍囬
     * @type {String}
     */
    label : {

    },
    /**
     * 鎺т欢瀹瑰櫒锛屽鏋滀负绌虹洿鎺ユ坊鍔犲湪鎺т欢瀹瑰櫒涓�
     * @type {String|HTMLElement}
     */
    controlContainer : {
      view : true
    },
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勬帶浠�
     * @protected
     * @type {jQuery}
     */
    control : {
      view : true
    },
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      view : true,
      value : '<input type="text"/>'
    },
    events: {
      value : {
        /**
         * 鏈€氳繃楠岃瘉
         * @event
         */
        error : false,
        /**
         * 閫氳繃楠岃瘉
         * @event
         */
        valid : false,
        /**
         * @event
         * 鍊兼敼鍙橈紝浠呭綋閫氳繃楠岃瘉鏃惰Е鍙�
         */
        change : true,

        /**
         * @event
         * 楠岃瘉鏀瑰彉
         * @param {Object} e 浜嬩欢瀵硅薄
         * @param {Object} e.target 瑙﹀彂浜嬩欢鐨勫璞�
         * @param {Boolean} e.valid 鏄惁閫氳繃楠岃瘉
         */
        validchange : true
      }  
    },
    tpl: {
      value : '<label>{label}</label>'
    },
    xview : {
      value : fieldView 
    }
  },
  PARSER : {
    control : function(el){
      var control = el.find('input,select,textarea');
      if(control.length){
        return control;
      }
      return el;
    },
    disabled : function(el){
      return !!el.attr('disabled');
    },
    value : function(el){
      var _self = this,
        selector = 'select,input,textarea',
        value = _self.get('value');
      if(!value){
        if(el.is(selector)){
          value = el.val();
          if(!value && el.is('select')){
            value = el.attr('value');
          }
        }else{
          value = el.find(selector).val(); 
        }
        
      }
      return  value;
    },
    name : function(el){
      var _self = this,
        selector = 'select,input,textarea',
        name = _self.get('name');
      if(!name){
        if(el.is(selector)){
          name = el.attr('name');
        }else{
          name = el.find(selector).attr('name'); 
        }
        
      }
      return  name;
    }
    
  }
},{
  xclass:'form-field'
});

field.View = fieldView;

module.exports = field;

});
define("bui/form/valid", ["bui/common","jquery"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟楠岃瘉
 * @ignore
 */

var BUI = require("bui/common"),
  Rules = require("bui/form/rules");

/**
 * @class BUI.Form.ValidView
 * @private
 * 瀵规帶浠跺唴鐨勫瓧娈靛煙杩涜楠岃瘉鐨勮鍥�
 */
var ValidView = function(){

};

ValidView.prototype = {
  /**
   * 鑾峰彇閿欒淇℃伅鐨勫鍣�
   * @protected
   * @return {jQuery} 
   */
  getErrorsContainer : function(){
    var _self = this,
      errorContainer = _self.get('errorContainer');
    if(errorContainer){
      if(BUI.isString(errorContainer)){
        return _self.get('el').find(errorContainer);
      }
      return errorContainer;
    }
    return _self.getContentElement();
  },
  /**
   * 鏄剧ず閿欒
   */
  showErrors : function(errors){
    var _self = this,
      errorsContainer = _self.getErrorsContainer(),
      errorTpl = _self.get('errorTpl');     
    _self.clearErrors(); 

    if(!_self.get('showError')){
      return ;
    }
    //濡傛灉浠呮樉绀虹涓€鏉￠敊璇褰�
    if(_self.get('showOneError')){
      if(errors && errors.length){
        _self.showError(errors[0],errorTpl,errorsContainer);
      }
      return ;
    }

    BUI.each(errors,function(error){
      if(error){
        _self.showError(error,errorTpl,errorsContainer);
      }
    });
  },
  /**
   * 鏄剧ず涓€鏉￠敊璇�
   * @protected
   * @template
   * @param  {String} msg 閿欒淇℃伅
   */
  showError : function(msg,errorTpl,container){

  },
  /**
   * @protected
   * @template
   * 娓呴櫎閿欒
   */
  clearErrors : function(){

  }
};
/**
 * 瀵规帶浠跺唴鐨勫瓧娈靛煙杩涜楠岃瘉
 * @class  BUI.Form.Valid
 */
var Valid = function(){

};

Valid.ATTRS = {

  /**
   * 鎺т欢鍥烘湁鐨勯獙璇佽鍒欙紝渚嬪锛屾棩鏈熷瓧娈靛煙锛屾湁鐨刣ate绫诲瀷鐨勯獙璇�
   * @protected
   * @type {Object}
   */
  defaultRules : {
    value : {}
  },
  /**
   * 鎺т欢鍥烘湁鐨勯獙璇佸嚭閿欎俊鎭紝渚嬪锛屾棩鏈熷瓧娈靛煙锛屼笉鏄湁鏁堟棩鏈熺殑楠岃瘉瀛楁
   * @protected
   * @type {Object}
   */
  defaultMessages : {
    value : {}
  },
  /**
   * 楠岃瘉瑙勫垯
   * @type {Object}
   */
  rules : {
    shared : false,
    value : {}
  },
  /**
   * 楠岃瘉淇℃伅闆嗗悎
   * @type {Object}
   */
  messages : {
    shared : false,
    value : {}
  },
  /**
   * 楠岃瘉鍣� 楠岃瘉瀹瑰櫒鍐呯殑琛ㄥ崟瀛楁鏄惁閫氳繃楠岃瘉
   * @type {Function}
   */
  validator : {

  },
  /**
   * 瀛樻斁閿欒淇℃伅瀹瑰櫒鐨勯€夋嫨鍣紝濡傛灉鏈彁渚涘垯榛樿鏄剧ず鍦ㄦ帶浠朵腑
   * @private
   * @type {String}
   */
  errorContainer : {
    view : true
  },
  /**
   * 鏄剧ず閿欒淇℃伅鐨勬ā鏉�
   * @type {Object}
   */
  errorTpl : {
    view : true,
    value : '<span class="x-field-error"><span class="x-icon x-icon-mini x-icon-error">!</span><label class="x-field-error-text">{error}</label></span>'
  },
  /**
   * 鏄剧ず閿欒
   * @type {Boolean}
   */
  showError : {
    view : true,
    value : true
  },
  /**
   * 鏄惁浠呮樉绀轰竴涓敊璇�
   * @type {Boolean}
   */
  showOneError: {

  },
  /**
   * 閿欒淇℃伅锛岃繖涓獙璇侀敊璇笉鍖呭惈瀛愭帶浠剁殑楠岃瘉閿欒
   * @type {String}
   */
  error : {

  },
  /**
   * 鏆傚仠楠岃瘉
   * <pre><code>
   *   field.set('pauseValid',true); //鍙互璋冪敤field.clearErrors()
   *   field.set('pauseValid',false); //鍙互鍚屾椂璋冪敤field.valid()
   * </code></pre>
   * @type {Boolean}
   */
  pauseValid : {
    value : false
  }
};

Valid.prototype = {

  __bindUI : function(){
    var _self = this;
    //鐩戝惉鏄惁绂佺敤
    _self.on('afterDisabledChange',function(ev){
      
        var disabled = ev.newVal;
        if(disabled){
          _self.clearErrors(false,false);
        }else{
          _self.valid();
        }
    });
  },
  /**
   * 鏄惁閫氳繃楠岃瘉
   * @template
   * @return {Boolean} 鏄惁閫氳繃楠岃瘉
   */
  isValid : function(){

  },
  /**
   * 杩涜楠岃瘉
   */
  valid : function(){

  },
  /**
   * @protected
   * @template
   * 楠岃瘉鑷韩鐨勮鍒欏拰楠岃瘉鍣�
   */
  validControl : function(){

  },
  //楠岃瘉瑙勫垯
  validRules : function(rules,value){
    if(!rules){
      return null;
    }
    if(this.get('pauseValid')){
      return null;
    }
    var _self = this,
      messages = _self._getValidMessages(),
      error = null;

    for(var name in rules){
      if(rules.hasOwnProperty(name)){
        var baseValue = rules[name];
        error = Rules.valid(name,value,baseValue,messages[name],_self);
        if(error){
          break;
        }
      }
    }
    return error;
  },
  //鑾峰彇楠岃瘉閿欒淇℃伅
  _getValidMessages : function(){
    var _self = this,
      defaultMessages = _self.get('defaultMessages'),
      messages = _self.get('messages');
    return BUI.merge(defaultMessages,messages);
  },
  /**
   * @template
   * @protected
   * 鎺т欢鏈韩鏄惁閫氳繃楠岃瘉锛屼笉鑰冭檻瀛愭帶浠�
   * @return {String} 楠岃瘉鐨勯敊璇�
   */
  getValidError : function(value){
    var _self = this,
      validator = _self.get('validator'),
      error = null;

    error = _self.validRules(_self.get('defaultRules'),value) || _self.validRules(_self.get('rules'),value);

    if(!error && !this.get('pauseValid')){
      if(_self.parseValue){
        value = _self.parseValue(value);
      }
      error = validator ? validator.call(this,value) : '';
    }

    return error;
  },
  /**
   * 鑾峰彇楠岃瘉鍑洪敊淇℃伅锛屽寘鎷嚜韬拰瀛愭帶浠剁殑楠岃瘉閿欒淇℃伅
   * @return {Array} 鍑洪敊淇℃伅
   */
  getErrors : function(){

  },
  /**
   * 鏄剧ず閿欒
   * @param {Array} errors 鏄剧ず閿欒
   */
  showErrors : function(errors){
    var _self = this,
      errors = errors || _self.getErrors();
    _self.get('view').showErrors(errors);
  },
  /**
   * 娓呴櫎閿欒
   * @param {Boolean} reset 娓呴櫎閿欒鏃舵槸鍚﹂噸缃�
   * @param {Boolean} [deep = true] 鏄惁娓呯悊瀛愭帶浠剁殑閿欒 
   */
  clearErrors : function(reset,deep){
    deep = deep == null ? true : deep;
    var _self = this,
      children = _self.get('children');
    if(deep){
      BUI.each(children,function(item){
        if(item.clearErrors){
          if(item.field){
            item.clearErrors(reset);
          }else{
            item.clearErrors(reset,deep);
          }
        }
      });
    }
    
    _self.set('error',null);
    _self.get('view').clearErrors();
  },
  /**
   * 娣诲姞楠岃瘉瑙勫垯
   * @param {String} name 瑙勫垯鍚嶇О
   * @param {*} [value] 瑙勫垯杩涜鏍￠獙鐨勮繘琛屽姣旂殑鍊硷紝濡俶ax : 10 
   * @param {String} [message] 鍑洪敊淇℃伅,鍙互浣挎ā鏉�
   * <ol>
   *   <li>濡傛灉 value 鏄崟涓€硷紝渚嬪鏈€澶у€� value = 10,閭ｄ箞妯℃澘鍙互鍐欐垚锛� '杈撳叆鍊间笉鑳藉ぇ浜巤0}!'</li>
   *   <li>濡傛灉 value 鏄釜澶嶆潅瀵硅薄锛屾暟缁勬椂锛屾寜鐓х储寮曪紝瀵硅薄鏃舵寜鐓� key 闃绘銆傚锛歷alue= {max:10,min:5} 锛屽垯'杈撳叆鍊间笉鑳藉ぇ浜巤max},涓嶈兘灏忎簬{min}'</li>
   * </ol>
   *         var field = form.getField('name');
   *         field.addRule('required',true);
   *
   *         field.addRule('max',10,'涓嶈兘澶т簬{0}');
   */
  addRule : function(name,value,message){
    var _self = this,
      rules = _self.get('rules'),
      messages = _self.get('messages');
    rules[name] = value;
    if(message){
      messages[name] = message;
    }
    
  },
  /**
   * 娣诲姞澶氫釜楠岃瘉瑙勫垯
   * @param {Object} rules 澶氫釜楠岃瘉瑙勫垯
   * @param {Object} [messages] 楠岃瘉瑙勫垯鐨勫嚭閿欎俊鎭�
   *         var field = form.getField('name');
   *         field.addRules({
   *           required : true,
   *           max : 10
   *         });
   */
  addRules : function(rules,messages){
    var _self = this;

    BUI.each(rules,function(value,name){
      var msg = messages ? messages[name] : null;
      _self.addRule(name,value,msg);
    });
  },
  /**
   * 绉婚櫎鎸囧畾鍚嶇О鐨勯獙璇佽鍒�
   * @param  {String} name 楠岃瘉瑙勫垯鍚嶇О
   *         var field = form.getField('name');
   *         field.remove('required');   
   */
  removeRule : function(name){
    var _self = this,
      rules = _self.get('rules');
    delete rules[name];
  },
  /**
   * 娓呯悊楠岃瘉瑙勫垯
   */
  clearRules : function(){
    var _self = this;
    _self.set('rules',{});
  }
};

Valid.View = ValidView;

module.exports = Valid;

});
define("bui/form/rules", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 楠岃瘉闆嗗悎
 * @ignore
 */


var $ = require("jquery"),
  Rule = require("bui/form/rule");

function toNumber(value){
  return parseFloat(value);
}

function toDate(value){
  return BUI.Date.parse(value);
}

var ruleMap = {

};

/**
 * @class BUI.Form.Rules
 * @singleton
 * 琛ㄥ崟楠岃瘉鐨勯獙璇佽鍒欑鐞嗗櫒
 */
var rules = {
  /**
   * 娣诲姞楠岃瘉瑙勫垯
   * @param {Object|BUI.Form.Rule} rule 楠岃瘉瑙勫垯閰嶇疆椤规垨鑰呴獙璇佽鍒欏璞�
   * @param  {String} name 瑙勫垯鍚嶇О
   */
  add : function(rule){
    var name;
    if($.isPlainObject(rule)){
      name = rule.name;
      ruleMap[name] = new Rule(rule);        
    }else if(rule.get){
      name = rule.get('name'); 
      ruleMap[name] = rule;
    }
    return ruleMap[name];
  },
  /**
   * 鍒犻櫎楠岃瘉瑙勫垯
   * @param  {String} name 瑙勫垯鍚嶇О
   */
  remove : function(name){
    delete ruleMap[name];
  },
  /**
   * 鑾峰彇楠岃瘉瑙勫垯
   * @param  {String} name 瑙勫垯鍚嶇О
   * @return {BUI.Form.Rule}  楠岃瘉瑙勫垯
   */
  get : function(name){
    return ruleMap[name];
  },
  /**
   * 楠岃瘉鎸囧畾鐨勮鍒�
   * @param  {String} name 瑙勫垯绫诲瀷
   * @param  {*} value 楠岃瘉鍊�
   * @param  {*} [baseValue] 鐢ㄤ簬楠岃瘉鐨勫熀纭€鍊�
   * @param  {String} [msg] 鏄剧ず閿欒鐨勬ā鏉�
   * @param  {BUI.Form.Field|BUI.Form.Group} [control] 鏄剧ず閿欒鐨勬ā鏉�
   * @return {String} 閫氳繃楠岃瘉杩斿洖 null,鍚﹀垯杩斿洖閿欒淇℃伅
   */
  valid : function(name,value,baseValue,msg,control){
    var rule = rules.get(name);
    if(rule){
      return rule.valid(value,baseValue,msg,control);
    }
    return null;
  },
  /**
   * 楠岃瘉鎸囧畾鐨勮鍒�
   * @param  {String} name 瑙勫垯绫诲瀷
   * @param  {*} values 楠岃瘉鍊�
   * @param  {*} [baseValue] 鐢ㄤ簬楠岃瘉鐨勫熀纭€鍊�
   * @param  {BUI.Form.Field|BUI.Form.Group} [control] 鏄剧ず閿欒鐨勬ā鏉�
   * @return {Boolean} 鏄惁閫氳繃楠岃瘉
   */
  isValid : function(name,value,baseValue,control){
    return rules.valid(name,value,baseValue,control) == null;
  }
};

/**
 * 闈炵┖楠岃瘉,浼氬鍊煎幓闄ょ┖鏍�
 * <ol>
 *  <li>name: required</li>
 *  <li>msg: 涓嶈兘涓虹┖锛�</li>
 *  <li>required: boolean 绫诲瀷</li>
 * </ol>
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var required = rules.add({
  name : 'required',
  msg : '涓嶈兘涓虹┖锛�',
  validator : function(value,required,formatedMsg){
    if(required !== false && /^\s*$/.test(value)){
      return formatedMsg;
    }
  }
});

/**
 * 鐩哥瓑楠岃瘉
 * <ol>
 *  <li>name: equalTo</li>
 *  <li>msg: 涓ゆ杈撳叆涓嶄竴鑷达紒</li>
 *  <li>equalTo: 涓€涓瓧绗︿覆锛宨d锛�#id_name) 鎴栬€� name</li>
 * </ol>
 *         {
 *           equalTo : '#password'
 *         }
 *         //鎴栬€�
 *         {
 *           equalTo : 'password'
 *         } 
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var equalTo = rules.add({
  name : 'equalTo',
  msg : '涓ゆ杈撳叆涓嶄竴鑷达紒',
  validator : function(value,equalTo,formatedMsg){
    var el = $(equalTo);
    if(el.length){
      equalTo = el.val();
    } 
    return value === equalTo ? undefined : formatedMsg;
  }
});


/**
 * 涓嶅皬浜庨獙璇�
 * <ol>
 *  <li>name: min</li>
 *  <li>msg: 杈撳叆鍊间笉鑳藉皬浜巤0}锛�</li>
 *  <li>min: 鏁板瓧锛屽瓧绗︿覆</li>
 * </ol>
 *         {
 *           min : 5
 *         }
 *         //瀛楃涓�
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var min = rules.add({
  name : 'min',
  msg : '杈撳叆鍊间笉鑳藉皬浜巤0}锛�',
  validator : function(value,min,formatedMsg){
    if(BUI.isString(value)){
      value = value.replace(/\,/g,'');
    }
    if(value !== '' && toNumber(value) < toNumber(min)){
      return formatedMsg;
    }
  }
});

/**
 * 涓嶅皬浜庨獙璇�,鐢ㄤ簬鏁板€兼瘮杈�
 * <ol>
 *  <li>name: max</li>
 *  <li>msg: 杈撳叆鍊间笉鑳藉ぇ浜巤0}锛�</li>
 *  <li>max: 鏁板瓧銆佸瓧绗︿覆</li>
 * </ol>
 *         {
 *           max : 100
 *         }
 *         //瀛楃涓�
 *         {
 *           max : '100'
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var max = rules.add({
  name : 'max',
  msg : '杈撳叆鍊间笉鑳藉ぇ浜巤0}锛�',
  validator : function(value,max,formatedMsg){
    if(BUI.isString(value)){
      value = value.replace(/\,/g,'');
    }
    if(value !== '' && toNumber(value) > toNumber(max)){
      return formatedMsg;
    }
  }
});

/**
 * 杈撳叆闀垮害楠岃瘉锛屽繀椤绘槸鎸囧畾鐨勯暱搴�
 * <ol>
 *  <li>name: length</li>
 *  <li>msg: 杈撳叆鍊奸暱搴︿负{0}锛�</li>
 *  <li>length: 鏁板瓧</li>
 * </ol>
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var length = rules.add({
  name : 'length',
  msg : '杈撳叆鍊奸暱搴︿负{0}锛�',
  validator : function(value,len,formatedMsg){
    if(value != null){
      value = $.trim(value.toString());
      if(len != value.length){
        return formatedMsg;
      }
    }
  }
});
/**
 * 鏈€鐭暱搴﹂獙璇�,浼氬鍊煎幓闄ょ┖鏍�
 * <ol>
 *  <li>name: minlength</li>
 *  <li>msg: 杈撳叆鍊奸暱搴︿笉灏忎簬{0}锛�</li>
 *  <li>minlength: 鏁板瓧</li>
 * </ol>
 *         {
 *           minlength : 5
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var minlength = rules.add({
  name : 'minlength',
  msg : '杈撳叆鍊奸暱搴︿笉灏忎簬{0}锛�',
  validator : function(value,min,formatedMsg){
    if(value != null){
      value = $.trim(value.toString());
      var len = value.length;
      if(len < min){
        return formatedMsg;
      }
    }
  }
});

/**
 * 鏈€鐭暱搴﹂獙璇�,浼氬鍊煎幓闄ょ┖鏍�
 * <ol>
 *  <li>name: maxlength</li>
 *  <li>msg: 杈撳叆鍊奸暱搴︿笉澶т簬{0}锛�</li>
 *  <li>maxlength: 鏁板瓧</li>
 * </ol>
 *         {
 *           maxlength : 10
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}   
 */
var maxlength = rules.add({
  name : 'maxlength',
  msg : '杈撳叆鍊奸暱搴︿笉澶т簬{0}锛�',
  validator : function(value,max,formatedMsg){
    if(value){
      value = $.trim(value.toString());
      var len = value.length;
      if(len > max){
        return formatedMsg;
      }
    }
  }
});

/**
 * 姝ｅ垯琛ㄨ揪寮忛獙璇�,濡傛灉姝ｅ垯琛ㄨ揪寮忎负绌猴紝鍒欎笉杩涜鏍￠獙
 * <ol>
 *  <li>name: regexp</li>
 *  <li>msg: 杈撳叆鍊间笉绗﹀悎{0}锛�</li>
 *  <li>regexp: 姝ｅ垯琛ㄨ揪寮�</li>
 * </ol> 
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var regexp = rules.add({
  name : 'regexp',
  msg : '杈撳叆鍊间笉绗﹀悎{0}锛�',
  validator : function(value,regexp,formatedMsg){
    if(regexp){
      return regexp.test(value) ? undefined : formatedMsg;
    }
  }
});

/**
 * 閭楠岃瘉,浼氬鍊煎幓闄ょ┖鏍硷紝鏃犳暟鎹笉杩涜鏍￠獙
 * <ol>
 *  <li>name: email</li>
 *  <li>msg: 涓嶆槸鏈夋晥鐨勯偖绠卞湴鍧€锛�</li>
 * </ol>
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var email = rules.add({
  name : 'email',
  msg : '涓嶆槸鏈夋晥鐨勯偖绠卞湴鍧€锛�',
  validator : function(value,baseValue,formatedMsg){
    value = $.trim(value);
    if(value){
      return /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(value) ? undefined : formatedMsg;
    }
  }
});

/**
 * 鏃ユ湡楠岃瘉锛屼細瀵瑰€煎幓闄ょ┖鏍硷紝鏃犳暟鎹笉杩涜鏍￠獙锛�
 * 濡傛灉浼犲叆鐨勫€间笉鏄瓧绗︿覆锛岃€屾槸鏁板瓧锛屽垯璁や负鏄湁鏁堝€�
 * <ol>
 *  <li>name: date</li>
 *  <li>msg: 涓嶆槸鏈夋晥鐨勬棩鏈燂紒</li>
 * </ol>
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var date = rules.add({
  name : 'date',
  msg : '涓嶆槸鏈夋晥鐨勬棩鏈燂紒',
  validator : function(value,baseValue,formatedMsg){
    if(BUI.isNumber(value)){ //鏁板瓧璁や负鏄棩鏈�
      return;
    }
    if(BUI.isDate(value)){
      return;
    }
    value = $.trim(value);
    if(value){
      return BUI.Date.isDateString(value) ? undefined : formatedMsg;
    }
  }
});

/**
 * 涓嶅皬浜庨獙璇�
 * <ol>
 *  <li>name: minDate</li>
 *  <li>msg: 杈撳叆鏃ユ湡涓嶈兘灏忎簬{0}锛�</li>
 *  <li>minDate: 鏃ユ湡锛屽瓧绗︿覆</li>
 * </ol>
 *         {
 *           minDate : '2001-01-01';
 *         }
 *         //瀛楃涓�
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var minDate = rules.add({
  name : 'minDate',
  msg : '杈撳叆鏃ユ湡涓嶈兘灏忎簬{0}锛�',
  validator : function(value,minDate,formatedMsg){
    if(value){
      var date = toDate(value);
      if(date && date < toDate(minDate)){
         return formatedMsg;
      }
    }
  }
});

/**
 * 涓嶅皬浜庨獙璇�,鐢ㄤ簬鏁板€兼瘮杈�
 * <ol>
 *  <li>name: maxDate</li>
 *  <li>msg: 杈撳叆鍊间笉鑳藉ぇ浜巤0}锛�</li>
 *  <li>maxDate: 鏃ユ湡銆佸瓧绗︿覆</li>
 * </ol>
 *         {
 *           maxDate : '2001-01-01';
 *         }
 *         //鎴栨棩鏈�
 *         {
 *           maxDate : new Date('2001-01-01');
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var maxDate = rules.add({
  name : 'maxDate',
  msg : '杈撳叆鏃ユ湡涓嶈兘澶т簬{0}锛�',
  validator : function(value,maxDate,formatedMsg){
    if(value){
      var date = toDate(value);
      if(date && date > toDate(maxDate)){
         return formatedMsg;
      }
    }
  }
});

/**
 * 鎵嬫満楠岃瘉锛�11浣嶆墜鏈烘暟瀛�
 * <ol>
 *  <li>name: mobile</li>
 *  <li>msg: 涓嶆槸鏈夋晥鐨勬墜鏈哄彿鐮侊紒</li>
 * </ol>
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var mobile = rules.add({
  name : 'mobile',
  msg : '涓嶆槸鏈夋晥鐨勬墜鏈哄彿鐮侊紒',
  validator : function(value,baseValue,formatedMsg){
    value = $.trim(value);
    if(value){
      return /^\d{11}$/.test(value) ? undefined : formatedMsg;
    }
  }
});

/**
 * 鏁板瓧楠岃瘉锛屼細瀵瑰€煎幓闄ょ┖鏍硷紝鏃犳暟鎹笉杩涜鏍￠獙
 * 鍏佽鍗冨垎绗︼紝渚嬪锛� 12,000,000鐨勬牸寮�
 * <ol>
 *  <li>name: number</li>
 *  <li>msg: 涓嶆槸鏈夋晥鐨勬暟瀛楋紒</li>
 * </ol>
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}
 */
var number = rules.add({
  name : 'number',
  msg : '涓嶆槸鏈夋晥鐨勬暟瀛楋紒',
  validator : function(value,baseValue,formatedMsg){
    if(BUI.isNumber(value)){
      return;
    }
    value = value.replace(/\,/g,'');
    return !isNaN(value) ? undefined : formatedMsg;
  }
});

//娴嬭瘯鑼冨洿
function testRange (baseValue,curVal,prevVal) {
  var allowEqual = baseValue && (baseValue.equals !== false);

  if(allowEqual){
    return prevVal <= curVal;
  }

  return prevVal < curVal;
}
function isEmpty(value){
  return value == '' || value == null;
}
//娴嬭瘯鏄惁鍚庨潰鐨勬暟鎹ぇ浜庡墠闈㈢殑
function rangeValid(value,baseValue,formatedMsg,group){
  var fields = group.getFields(),
    valid = true;
  for(var i = 1; i < fields.length ; i ++){
    var cur = fields[i],
      prev = fields[i-1],
      curVal,
      prevVal;
    if(cur && prev){
      curVal = cur.get('value');
      prevVal = prev.get('value');
      if(!isEmpty(curVal) && !isEmpty(prevVal) && !testRange(baseValue,curVal,prevVal)){
        valid = false;
        break;
      }
    }
  }
  if(!valid){
    return formatedMsg;
  }
  return null;
}
/**
 * 璧峰缁撴潫鏃ユ湡楠岃瘉锛屽墠闈㈢殑鏃ユ湡涓嶈兘澶т簬鍚庨潰鐨勬棩鏈�
 * <ol>
 *  <li>name: dateRange</li>
 *  <li>msg: 璧峰鏃ユ湡涓嶈兘澶т簬缁撴潫鏃ユ湡锛�</li>
 *  <li>dateRange: 鍙互浣縯rue鎴栬€厈equals : fasle}锛屾爣绀烘槸鍚﹀厑璁哥浉绛�</li>
 * </ol>
 *         {
 *           dateRange : true
 *         }
 *         {
 *           dateRange : {equals : false}
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}   
 */
var dateRange = rules.add({
  name : 'dateRange',
  msg : '缁撴潫鏃ユ湡涓嶈兘灏忎簬璧峰鏃ユ湡锛�',
  validator : rangeValid
});

/**
 * 鏁板瓧鑼冨洿
 * <ol>
 *  <li>name: numberRange</li>
 *  <li>msg: 璧峰鏁板瓧涓嶈兘澶т簬缁撴潫鏁板瓧锛�</li>
 *  <li>numberRange: 鍙互浣縯rue鎴栬€厈equals : fasle}锛屾爣绀烘槸鍚﹀厑璁哥浉绛�</li>
 * </ol>
 *         {
 *           numberRange : true
 *         }
 *         {
 *           numberRange : {equals : false}
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}   
 */
var numberRange = rules.add({
  name : 'numberRange',
  msg : '缁撴潫鏁板瓧涓嶈兘灏忎簬寮€濮嬫暟瀛楋紒',
  validator : rangeValid
});

function getFieldName (self) {
  var firstField = self.getFieldAt(0);
  if(firstField){
    return firstField.get('name');
  }
  return '';
}

function testCheckRange(value,range){
  if(!BUI.isArray(range)){
    range = [range];
  }
  //涓嶅瓨鍦ㄥ€�
  if(!value || !range.length){
    return false;
  }
  var len = !value ? 0 : !BUI.isArray(value) ? 1 : value.length;
  //濡傛灉鍙湁涓€涓檺瀹氬€�
  if(range.length == 1){
    var number = range [0];
    if(!number){//range = [0],鍒欎笉蹇呴€�
      return true;
    }
    if(number > len){
      return false;
    }
  }else{
    var min = range [0],
      max = range[1];
    if(min > len || max < len){
      return false;
    }
  }
  return true;
}

/**
 * 鍕鹃€夌殑鑼冨洿
 * <ol>
 *  <li>name: checkRange</li>
 *  <li>msg: 蹇呴』閫変腑{0}椤癸紒</li>
 *  <li>checkRange: 鍕鹃€夌殑椤硅寖鍥�</li>
 * </ol>
 *         //鑷冲皯鍕鹃€変竴椤�
 *         {
 *           checkRange : 1
 *         }
 *         //鍙兘鍕鹃€変袱椤�
 *         {
 *           checkRange : [2,2]
 *         }
 *         //鍙互鍕鹃€�2-4椤�
 *         {
 *           checkRange : [2,4
 *           ]
 *         }
 * @member BUI.Form.Rules
 * @type {BUI.Form.Rule}   
 */
var checkRange = rules.add({
  name : 'checkRange',
  msg : '蹇呴』閫変腑{0}椤癸紒',
  validator : function(record,baseValue,formatedMsg,group){
    var name = getFieldName(group),
      value,
      range = baseValue;
      
    if(name && range){
      value = record[name];
      if(!testCheckRange(value,range)){
        return formatedMsg;
      }
    }
    return null;
  }
});

module.exports = rules;

});
define("bui/form/rule", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 楠岃瘉瑙勫垯
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common");
/**
 * @class BUI.Form.Rule
 * 楠岃瘉瑙勫垯
 * @extends BUI.Base
 */
var Rule = function (config){
  Rule.superclass.constructor.call(this,config);
}

BUI.extend(Rule,BUI.Base);

Rule.ATTRS = {
  /**
   * 瑙勫垯鍚嶇О
   * @type {String}
   */
  name : {

  },
  /**
   * 楠岃瘉澶辫触淇℃伅
   * @type {String}
   */
  msg : {

  },
  /**
   * 楠岃瘉鍑芥暟
   * @type {Function}
   */
  validator : {
    value : function(value,baseValue,formatedMsg,control){

    }
  }
}

//鏄惁閫氳繃楠岃瘉
function valid(self,value,baseValue,msg,control){
  if(BUI.isArray(baseValue) && BUI.isString(baseValue[1])){
    if(baseValue[1]){
      msg = baseValue[1];
    }
    baseValue = baseValue[0];
  }
  var _self = self,
    validator = _self.get('validator'),
    formatedMsg = formatError(self,baseValue,msg),
    valid = true;
  value = value == null ? '' : value;
  return validator.call(_self,value,baseValue,formatedMsg,control);
}

function parseParams(values){

  if(values == null){
    return {};
  }

  if($.isPlainObject(values)){
    return values;
  }

  var ars = values,
      rst = {};
  if(BUI.isArray(values)){

    for(var i = 0; i < ars.length; i++){
      rst[i] = ars[i];
    }
    return rst;
  }

  return {'0' : values};
}

function formatError(self,values,msg){
  var ars = parseParams(values); 
  msg = msg || self.get('msg');
  return BUI.substitute(msg,ars);
}

BUI.augment(Rule,{

  /**
   * 鏄惁閫氳繃楠岃瘉锛岃鍑芥暟鍙互鎺ユ敹澶氫釜鍙傛暟
   * @param  {*}  [value] 楠岃瘉鐨勫€�
   * @param  {*} [baseValue] 璺熶紶鍏ュ€肩浉姣旇緝鐨勫€�
   * @param {String} [msg] 楠岃瘉澶辫触鍚庣殑閿欒淇℃伅锛屾樉绀虹殑閿欒涓彲浠ユ樉绀� baseValue涓殑淇℃伅
   * @param {BUI.Form.Field|BUI.Form.Group} [control] 鍙戠敓楠岃瘉鐨勬帶浠�
   * @return {String}   閫氳繃楠岃瘉杩斿洖 null ,鏈€氳繃楠岃瘉杩斿洖閿欒淇℃伅
   * 
   *         var msg = '杈撳叆鏁版嵁蹇呴』鍦▄0}鍜寋1}涔嬮棿锛�',
   *           rangeRule = new Rule({
   *             name : 'range',
   *             msg : msg,
   *             validator :function(value,range,msg){
   *               var min = range[0], //姝ゅ鎴戜滑鎶妑ange瀹氫箟涓烘暟缁勶紝涔熷彲浠ュ畾涔変负{min:0,max:200},閭ｄ箞鍦ㄤ紶鍏ユ牎楠屾椂璺熸澶勪竴鑷村嵆鍙�
   *                 max = range[1];   //鍦ㄩ敊璇俊鎭腑锛屼娇鐢ㄧ敤 '杈撳叆鏁版嵁蹇呴』鍦▄min}鍜寋max}涔嬮棿锛�',楠岃瘉鍑芥暟涓殑瀛楃涓插凡缁忚繘琛屾牸寮忓寲
   *               if(value < min || value > max){
   *                 return false;
   *               }
   *               return true;
   *             }
   *           });
   *         var range = [0,200],
   *           val = 100,
   *           error = rangeRule.valid(val,range);//msg鍙互鍦ㄦ澶勯噸鏂颁紶鍏�
   *         
   */
  valid : function(value,baseValue,msg,control){
    var _self = this;
    return valid(_self,value,baseValue,msg,control);
  }
});

module.exports = Rule;

});
define("bui/form/remote", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟寮傛璇锋眰锛屽紓姝ユ牎楠屻€佽繙绋嬭幏鍙栨暟鎹�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common");

/**
 * @class BUI.Form.RemoteView
 * @private
 * 琛ㄥ崟寮傛璇锋眰绫荤殑瑙嗗浘绫�
 */
var RemoteView = function () {
  // body...
};

RemoteView.ATTRS = {
  isLoading : {},
  loadingEl : {}
};

RemoteView.prototype = {

  /**
   * 鑾峰彇鏄剧ず鍔犺浇鐘舵€佺殑瀹瑰櫒
   * @protected
   * @template
   * @return {jQuery} 鍔犺浇鐘舵€佺殑瀹瑰櫒
   */
  getLoadingContainer : function () {
    // body...
  },
  _setLoading : function () {
    var _self = this,
      loadingEl = _self.get('loadingEl'),
      loadingTpl = _self.get('loadingTpl');
    if(loadingTpl && !loadingEl){
      loadingEl = $(loadingTpl).appendTo(_self.getLoadingContainer());
      _self.setInternal('loadingEl',loadingEl);
    }
  },
  _clearLoading : function () {
    var _self = this,
      loadingEl = _self.get('loadingEl');
    if(loadingEl){
      loadingEl.remove();
      _self.setInternal('loadingEl',null);
    }
  },
  _uiSetIsLoading : function (v) {
    var _self = this;
    if(v){
      _self._setLoading();
    }else{
      _self._clearLoading();
    }
  }
};

/**
 * @class  BUI.Form.Remote
 * 琛ㄥ崟寮傛璇锋眰锛屾墍鏈夐渶瑕佸疄鐜板紓姝ユ牎楠屻€佸紓姝ヨ姹傜殑绫诲彲浠ヤ娇鐢ㄣ€�
 */
var Remote = function(){

};

Remote.ATTRS = {

  /**
   * 榛樿鐨勫紓姝ヨ姹傞厤缃」锛�
   * method : 'GET',
   * cache : true,
   * dataType : 'text'
   * @protected
   * @type {Object}
   */
  defaultRemote : {
    value : {
      method : 'GET',
      cache : true,
      callback : function (data) {
        return data;
      }
    }
  },
  /**
   * 寮傛璇锋眰寤惰繜鐨勬椂闂达紝褰撳瓧娈甸獙璇侀€氳繃鍚庯紝涓嶉┈涓婅繘琛屽紓姝ヨ姹傦紝绛夊緟缁х画杈撳叆锛�
   * 300锛堥粯璁わ級姣鍚庯紝鍙戦€佽姹傦紝鍦ㄨ繖涓繃绋嬩腑锛岀户缁緭鍏ワ紝鍒欏彇娑堝紓姝ヨ姹傘€�
   * @type {Object}
   */
  remoteDaly : {
    value : 500
  },
  /**
   * @private
   * 缂撳瓨楠岃瘉缁撴灉锛屽鏋滈獙璇佽繃瀵瑰簲鐨勫€硷紝鍒欑洿鎺ヨ繑鍥�
   * @type {Object}
   */
  cacheMap : {
    value : {

    }
  },
  /**
   * 鍔犺浇鐨勬ā鏉�
   * @type {String}
   */
  loadingTpl : {
    view : true,
    value : '<img src="http://img02.taobaocdn.com/tps/i2/T1NU8nXCVcXXaHNz_X-16-16.gif" alt="loading"/>'
  },
  /**
   * 鏄惁姝ｅ湪绛夊緟寮傛璇锋眰缁撴灉
   * @type {Boolean}
   */
  isLoading : {
    view : true,
    value : false
  },
  /**
   * 寮傛璇锋眰鐨勯厤缃」锛屽弬鑰僯Query鐨� ajax閰嶇疆椤癸紝濡傛灉涓哄瓧绗︿覆鍒欎负 url銆�
   * 璇蜂笉瑕佽鐩杝uccess灞炴€э紝濡傛灉闇€瑕佸洖璋冨垯浣跨敤 callback 灞炴€�
   *
   *        {
   *          remote : {
   *            url : 'test.php',
   *            dataType:'json',//榛樿涓哄瓧绗︿覆
   *            callback : function(data){
   *              if(data.success){ //data涓洪粯璁よ繑鍥炵殑鍊�
   *                return ''  //杩斿洖鍊间负绌烘椂锛岄獙璇佹垚鍔�
   *              }else{
   *                return '楠岃瘉澶辫触锛孹X閿欒锛�' //鏄剧ず杩斿洖鐨勫瓧绗︿覆涓洪敊璇�
   *              }
   *            }
   *          }
   *        }
   * @type {String|Object}
   */
  remote : {
    setter : function  (v) {
      if(BUI.isString(v)){
        v = {url : v}
      }
      return v;
    }
  },
  /**
   * 寮傛璇锋眰鐨勫嚱鏁版寚閽堬紝浠呭唴閮ㄤ娇鐢�
   * @private
   * @type {Number}
   */
  remoteHandler : {

  },
  events : {
    value : {
      /**
       * 寮傛璇锋眰缁撴潫
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {*} e.error 鏄惁楠岃瘉鎴愬姛
       */
      remotecomplete : false,
      /**
       * 寮傛璇锋眰寮€濮�
       * @event
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.data 鍙戦€佺殑瀵硅薄锛屾槸涓€涓敭鍊煎锛屽彲浠ヤ慨鏀规瀵硅薄锛岄檮鍔犱俊鎭�
       */
      remotestart : false
    }
  }
};

Remote.prototype = {

  __bindUI : function(){
    var _self = this;

    _self.on('valid',function (ev) {
      if(_self.get('remote') && _self.isValid() && !_self.get('pauseValid')){
        var value = _self.getControlValue(),
          data = _self.getRemoteParams();
        _self._startRemote(data,value);
      }
    });

    _self.on('error',function (ev) {
      if(_self.get('remote')){
        _self._cancelRemote();
      }
    });

  },
  //寮€濮嬪紓姝ヨ姹�
  _startRemote : function(data,value){
    var _self = this,
      remoteHandler = _self.get('remoteHandler'),
      cacheMap = _self.get('cacheMap'),
      remoteDaly = _self.get('remoteDaly');
    if(remoteHandler){
      //濡傛灉鍓嶉潰宸茬粡鍙戦€佽繃寮傛璇锋眰锛屽彇娑堟帀
      _self._cancelRemote(remoteHandler);
    }
    if(cacheMap[value] != null){
      _self._validResult(_self._getCallback(),cacheMap[value]);
      return;
    }
    //浣跨敤闂寘杩涜寮傛璇锋眰
    function dalayFunc(){
      _self._remoteValid(data,remoteHandler,value);
      _self.set('isLoading',true);
    }
    remoteHandler = setTimeout(dalayFunc,remoteDaly);
    _self.setInternal('remoteHandler',remoteHandler);
    
  },
  _validResult : function(callback,data){
    var _self = this,
      error = callback(data);
    _self.onRemoteComplete(error,data);
  },
  onRemoteComplete : function(error,data,remoteHandler){
    var _self = this;
    //纭褰撳墠杩斿洖鐨勯敊璇槸褰撳墠璇锋眰鐨勭粨鏋滐紝闃叉瑕嗙洊鍚庨潰鐨勮姹�
    if(remoteHandler == _self.get('remoteHandler')){
        _self.fire('remotecomplete',{error : error,data : data});
        _self.set('isLoading',false);
        _self.setInternal('remoteHandler',null);
    } 
  },
  _getOptions : function(data){
    var _self = this,
      remote = _self.get('remote'),
      defaultRemote = _self.get('defaultRemote'),
      options = BUI.merge(defaultRemote,remote,{data : data});
    return options;
  },
  _getCallback : function(){
    return this._getOptions().callback;
  },
  //寮傛璇锋眰
  _remoteValid : function(data,remoteHandler,value){
    var _self = this,
      cacheMap = _self.get('cacheMap'),
      options = _self._getOptions(data);
    options.success = function (data) {
      var callback = options.callback,
        error = callback(data);
      cacheMap[value] = data; //缂撳瓨寮傛缁撴灉
      _self.onRemoteComplete(error,data,remoteHandler);
    };

    options.error = function (jqXHR, textStatus,errorThrown){
      _self.onRemoteComplete(errorThrown,null,remoteHandler);
    };

    _self.fire('remotestart',{data : data});
    $.ajax(options);
  },
  /**
   * 鑾峰彇寮傛璇锋眰鐨勯敭鍊煎
   * @template
   * @protected
   * @return {Object} 杩滅▼楠岃瘉鐨勫弬鏁帮紝閿€煎
   */
  getRemoteParams : function() {

  },
  /**
   * 娓呮寮傛楠岃瘉鐨勭紦瀛�
   */
  clearCache : function(){
    this.set('cacheMap',{});
  },
  //鍙栨秷寮傛璇锋眰
  _cancelRemote : function(remoteHandler){
    var _self = this;

    remoteHandler = remoteHandler || _self.get('remoteHandler');
    if(remoteHandler){
      clearTimeout(remoteHandler);
      _self.setInternal('remoteHandler',null);
    }
    _self.set('isLoading',false);
  }

};

Remote.View = RemoteView;

module.exports = Remote;

});
define("bui/form/fields/text", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鏂囨湰鍩�
 * @author dxq613@gmail.com
 * @ignore
 */

var Field = require("bui/form/fields/base");

/**
 * 琛ㄥ崟鏂囨湰鍩�
 * @class BUI.Form.Field.Text
 * @extends BUI.Form.Field
 */
var textField = Field.extend({

},{
  xclass : 'form-field-text'
});

module.exports = textField;

});
define("bui/form/fields/date", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鏃ュ巻鍩�
 * @author dxq613@gmail.com
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  Field = require("bui/form/fields/base"),
  DateUtil = BUI.Date;/*,
  DatePicker = require('bui-calendar').DatePicker*/

/**
 * 琛ㄥ崟鏂囨湰鍩�
 * @class BUI.Form.Field.Date
 * @extends BUI.Form.Field
 */
var dateField = Field.extend({
  //鐢熸垚鏃ユ湡鎺т欢
  renderUI : function(){
    
    var _self = this,
      datePicker = _self.get('datePicker');
    if($.isPlainObject(datePicker)){
      _self.initDatePicker(datePicker);
    }
    if((datePicker.get && datePicker.get('showTime'))|| datePicker.showTime){
      _self.getInnerControl().addClass('calendar-time');
    }

  },
  //鍒濆鍖栨棩鍘嗘帶浠�
  initDatePicker : function(datePicker){
    var _self = this;

    require.async('bui/calendar', function(Calendar){
      datePicker.trigger = _self.getInnerControl();
      datePicker.autoRender = true;
      datePicker = new Calendar.DatePicker(datePicker);
      _self.set('datePicker',datePicker);
      _self.set('isCreatePicker',true);
      _self.get('children').push(datePicker);
    });
  },
  /**
   * 璁剧疆瀛楁鐨勫€�
   * @protected
   * @param {Date} value 瀛楁鍊�
   */
  setControlValue : function(value){
    var _self = this,
      innerControl = _self.getInnerControl();
    if(BUI.isDate(value)){
      value = DateUtil.format(value,_self._getFormatMask());
    }
    innerControl.val(value);
  },
  //鑾峰彇鏍煎紡鍖栧嚱鏁�
  _getFormatMask : function(){
    var _self = this,
      datePicker = _self.get('datePicker');

    if(datePicker.showTime || (datePicker.get && datePicker.get('showTime'))){
      return 'yyyy-mm-dd HH:MM:ss';
    }
    return 'yyyy-mm-dd';
  },
   /**
   * 灏嗗瓧绗︿覆绛夋牸寮忚浆鎹㈡垚鏃ユ湡
   * @protected
   * @override
   * @param  {String} value 鍘熷鏁版嵁
   * @return {Date}  璇ュ瓧娈垫寚瀹氱殑绫诲瀷
   */
  parseValue : function(value){
    if(BUI.isNumber(value)){
      return new Date(value);
    }
    return DateUtil.parse(value);
  },
  /**
   * @override
   * @protected
   * 鏄惁褰撳墠鍊�
   */
  isCurrentValue : function (value) {
    return DateUtil.isEquals(value,this.get('value'));
  },
  //璁剧疆鏈€澶у€�
  _uiSetMax : function(v){
    this.addRule('max',v);
    var _self = this,
      datePicker = _self.get('datePicker');
    if(datePicker){
      if(datePicker.set){
        datePicker.set('maxDate',v);
      }else{
        datePicker.maxDate = v;
      }
      
    }
  },
  //璁剧疆鏈€灏忓€�
  _uiSetMin : function(v){
    this.addRule('min',v);
    var _self = this,
      datePicker = _self.get('datePicker');
    if(datePicker){
      if(datePicker.set){
        datePicker.set('minDate',v);
      }else{
        datePicker.minDate = v;
      }
    }
  }
},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<input type="text" class="calendar"/>'
    },
    defaultRules : {
      value : {
        date : true
      }
    },
    /**
     * 鏈€澶у€�
     * @type {Date|String}
     */
    max : {

    },
    /**
     * 鏈€灏忓€�
     * @type {Date|String}
     */
    min : {

    },
    value : {
      setter : function(v){
        if(BUI.isNumber(v)){//灏嗘暟瀛楄浆鎹㈡垚鏃ユ湡绫诲瀷
          return new Date(v);
        }
        return v;
      }
    },
    /**
     * 鏃堕棿閫夋嫨鎺т欢
     * @type {Object|BUI.Calendar.DatePicker}
     */
    datePicker : {
      shared : false,
      value : {
        
      }
    },
    /**
     * 鏃堕棿閫夋嫨鍣ㄦ槸鍚︽槸鐢辨鎺т欢鍒涘缓
     * @type {Boolean}
     * @readOnly
     */
    isCreatePicker : {
      value : true
    }
  },
  PARSER : {
    datePicker : function(el){
      var _self = this,
        cfg = _self.get('datePicker') || {};
      if(el.hasClass('calendar-time')){
        BUI.mix(cfg,{
          showTime : true
        }) ;
      }
      return cfg;
    }
  }
},{
  xclass : 'form-field-date'
});

module.exports = dateField;

});
define("bui/form/fields/select", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 妯℃嫙閫夋嫨妗嗗湪琛ㄥ崟涓�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Field = require("bui/form/fields/base");

function resetOptions (select,options,self) {
  select.children().remove();
  var emptyText = self.get('emptyText');
  if(emptyText && self.get('showBlank')){
    appendItem('',emptyText,select);
  }
  BUI.each(options,function (option) {
    appendItem(option.value,option.text,select);
  });
}

function appendItem(value,text,select){
  // var str = '<option value="' + value +'">'+text+'</option>'
  // $(str).appendTo(select);
  
  // 涓婇潰閭ｇ鍐欐硶鍦╥e6涓嬩細鎶ヤ竴涓鎬殑閿欒锛屼娇鐢╪ew Option鍒欎笉浼氭湁杩欎釜闂
  var option = new Option(text, value),
    options = select[0].options;
  options[options.length] = option;
}
/**
 * 琛ㄥ崟閫夋嫨鍩�
 * @class BUI.Form.Field.Select
 * @extends BUI.Form.Field
 */
var selectField = Field.extend({
  //鐢熸垚select
  renderUI : function(){
    var _self = this,
      innerControl = _self.getInnerControl(),
      select = _self.get('select');
    if(_self.get('srcNode') && innerControl.is('select')){ //濡傛灉浣跨敤鐜版湁DOM鐢熸垚锛屼笉浣跨敤鑷畾涔夐€夋嫨妗嗘帶浠�
      return;
    }
    //select = select || {};
    if($.isPlainObject(select)){
      _self._initSelect(select);
    }
  },
  _initSelect : function(select){
    var _self = this,
      items = _self.get('items');
    require.async('bui/select',function(Select){
      select.render = _self.getControlContainer();
      select.valueField = _self.getInnerControl();
      select.autoRender = true;
     
      select = new Select.Select(select);
      _self.set('select',select);
      _self.set('isCreate',true);
      _self.get('children').push(select);
      select.on('change',function(ev){
        var val = select.getSelectedValue();
        _self.set('value',val);
      });
    })
  },
  /**
   * 閲嶆柊璁剧疆閫夐」闆嗗悎
   * @param {Array} items 閫夐」闆嗗悎
   */
  setItems : function (items) {
    var _self = this,
      select = _self.get('select');

    if($.isPlainObject(items)){
      var tmp = [];
      BUI.each(items,function(v,n){
        tmp.push({value : n,text : v});
      });
      items = tmp;
    }

    var control = _self.getInnerControl();
    if(control.is('select')){
      resetOptions(control,items,_self);
      _self.setControlValue(_self.get('value'));
      if(!_self.getControlValue()){
        _self.setInternal('value','');
      }
    }

    if(select){
      if(select.set){
        select.set('items',items);
      }else{
        select.items = items;
      }
    }
  },
  /**
   * 璁剧疆瀛楁鐨勫€�
   * @protected
   * @param {*} value 瀛楁鍊�
   */
  setControlValue : function(value){
    var _self = this,
      select = _self.get('select'),
      innerControl = _self.getInnerControl();
    innerControl.val(value);
    if(select && select.set &&  select.getSelectedValue() !== value){
      select.setSelectedValue(value);
    }
  },
  /**
   * 鑾峰彇閫変腑鐨勬枃鏈�
   * @return {String} 閫変腑鐨勬枃鏈�
   */
  getSelectedText : function(){
    var _self = this,
      select = _self.get('select'),
      innerControl = _self.getInnerControl();
    if(innerControl.is('select')){
      var dom = innerControl[0],
        item = dom.options[dom.selectedIndex];
      return item ? item.text : '';
    }else{
      return select.getSelectedText();
    }
  },
  /**
   * 鑾峰彇tip鏄剧ず瀵瑰簲鐨勫厓绱�
   * @protected
   * @override
   * @return {HTMLElement} 
   */
  getTipTigger : function(){
    var _self = this,
      select = _self.get('select');
    if(select && select.rendered){
      return select.get('el').find('input');
    }
    return _self.get('el');
  },
  //璁剧疆閫夐」
  _uiSetItems : function(v){
    if(v){
      this.setItems(v);
    }
  },
  /**
   * @protected
   * 璁剧疆鍐呴儴鍏冪礌瀹藉害
   */
  setInnerWidth : function(width){
    var _self = this,
      innerControl = _self.getInnerControl(),
      select = _self.get('select'),
      appendWidth = innerControl.outerWidth() - innerControl.width();
    innerControl.width(width - appendWidth);
    if(select && select.set){
      select.set('width',width);
    }
  }
},{
  ATTRS : {
    /**
     * 閫夐」
     * @type {Array}
     */
    items : {

    },
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<input type="hidden"/>'
    },
    /**
     * 鏄惁鏄剧ず涓虹┖鐨勬枃鏈�
     * @type {Boolean}
     */
    showBlank : {
      value : true
    },
    /**
     * 閫夋嫨涓虹┖鏃剁殑鏂囨湰
     * @type {String}
     */
    emptyText : {
      value : '璇烽€夋嫨'
    },
    /**
     * 鍐呴儴鐨凷elect鎺т欢鐨勯厤缃」
     * @cfg {Object} select
     */
    /**
     * 鍐呴儴鐨凷elect鎺т欢
     * @type {BUI.Select.Select}
     */
    select : {
      shared : false,
      value : {}
    }
  },
  PARSER : {
    emptyText : function(el){
      if(!this.get('showBlank')){
        return '';
      }
      var options = el.find('option'),
        rst = this.get('emptyText');
      if(options.length){
        rst = $(options[0]).text();
      }
      return rst;
    }
  }
},{
  xclass : 'form-field-select'
});

module.exports = selectField;

});
define("bui/form/fields/hidden", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
* @fileOverview 闅愯棌瀛楁
* @ignore
* @author dxq613@gmail.com
*/

var Field = require("bui/form/fields/base");
/**
 * 琛ㄥ崟闅愯棌鍩�
 * @class BUI.Form.Field.Hidden
 * @extends BUI.Form.Field
 */
var hiddenField = Field.extend({

},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<input type="hidden"/>'
    },
    tpl : {
      value : ''
    }
  }
},{
  xclass : 'form-field-hidden'
});

module.exports = hiddenField;

});
define("bui/form/fields/number", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鏂囨湰鍩�
 * @author dxq613@gmail.com
 * @ignore
 */

/**
 * 琛ㄥ崟鏁板瓧鍩�
 * @class BUI.Form.Field.Number
 * @extends BUI.Form.Field
 */
var Field = require("bui/form/fields/base"),
  numberField = Field.extend({

   /**
   * 灏嗗瓧绗︿覆绛夋牸寮忚浆鎹㈡垚鏁板瓧
   * @protected
   * @param  {String} value 鍘熷鏁版嵁
   * @return {Number}  璇ュ瓧娈垫寚瀹氱殑绫诲瀷
   */
  parseValue : function(value){
    if(value == '' || value == null){
      return null;
    }
    if(BUI.isNumber(value)){
      return value;
    }
    var _self = this,
      allowDecimals = _self.get('allowDecimals');
    value = value.replace(/\,/g,'');
    if(!allowDecimals){
      return parseInt(value,10);
    }
    return parseFloat(parseFloat(value).toFixed(_self.get('decimalPrecision')));
  },
  _uiSetMax : function(v){
    this.addRule('max',v);
  },
  _uiSetMin : function(v){
    this.addRule('min',v);
  }
},{
  ATTRS : {
    /**
     * 鏈€澶у€�
     * @type {Number}
     */
    max : {

    },
    /**
     * 鏈€灏忓€�
     * @type {Number}
     */
    min : {

    },
    decorateCfgFields : {
      value : {
        min : true,
        max : true
      }
    },
    /**
     * 琛ㄥ崟鍏冪礌鎴栬€呮帶浠惰Е鍙戞浜嬩欢鏃讹紝瑙﹀彂楠岃瘉
     * @type {String}
     */
    validEvent : {
      value : 'keyup change'
    },
    defaultRules : {
      value : {
        number : true
      }
    },
    /**
     * 鏄惁鍏佽灏忔暟锛屽鏋滀笉鍏佽锛屽垯鏈€缁堢粨鏋滆浆鎹㈡垚鏁存暟
     * @type {Boolean}
     */
    allowDecimals : {
      value : true
    },
    /**
     * 鍏佽灏忔暟鏃剁殑锛屽皬鏁颁綅
     * @type {Number}
     */
    decimalPrecision : {
      value : 2
    },
    /**
     * 瀵规暟瀛楄繘琛屽井璋冩椂锛屾瘡娆″鍔犳垨鍑忓皬鐨勬暟瀛�
     * @type {Object}
     */
    step : {
      value : 1
    }
  }
},{
  xclass : 'form-field-number'
});

module.exports = numberField;

});
define("bui/form/fields/check", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview  鍙嬀閫夊瓧娈�
 * @ignore
 */

var $ = require("jquery"),
  Field = require("bui/form/fields/base");

/**
 * 鍙€変腑鑿滃崟鍩�
 * @class BUI.Form.Field.Check
 * @extends BUI.Form.Field
 */
var checkField = Field.extend({
  /**
   * 楠岃瘉鎴愬姛鍚庢墽琛岀殑鎿嶄綔
   * @protected
   */
  onValid : function(){
    var _self = this,
      checked = _self._getControlChecked();
    _self.setInternal('checked',checked);
    _self.fire('change');
    if(checked){
      _self.fire('checked');
    }else{
      _self.fire('unchecked');
    }
  },
  //璁剧疆鏄惁鍕鹃€�
  _setControlChecked : function(checked){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.attr('checked',!!checked);
  },
  //鑾峰彇鏄惁鍕鹃€�
  _getControlChecked : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    return !!innerControl.attr('checked');
  },
  //瑕嗙洊 璁剧疆鍊肩殑鏂规硶
  _uiSetValue : function(v){
    this.setControlValue(v);
  },
  //瑕嗙洊涓嶈缃搴�
  _uiSetWidth : function(v){

  },
  //璁剧疆鏄惁鍕鹃€�
  _uiSetChecked : function(v){
    var _self = this;
    _self._setControlChecked(v);
    if(_self.get('rendered')){
      _self.onValid();
    }
  }
},{
  ATTRS : {
    /**
     * 瑙﹀彂楠岃瘉浜嬩欢锛岃繘鑰屽紩璧穋hange浜嬩欢
     * @override
     * @type {String}
     */
    validEvent : {
      value : 'click'
    },
    /**
     * 鏄惁閫変腑
     * @cfg {String} checked
     */
    /**
     * 鏄惁閫変腑
     * @type {String}
     */
    checked : {
      value : false
    },
    events : {
      value : {
        /**
         * @event
         * 閫変腑浜嬩欢
         */
        'checked' : false,
        /**
         * @event
         * 鍙栨秷閫変腑浜嬩欢
         */
        'unchecked' : false
      }
    }
  },
  PARSER : {
    checked : function(el){
      return !!el.attr('checked');
    }
  }
},{
  xclass : 'form-check-field'
});

module.exports = checkField;

});
define("bui/form/fields/radio", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview  鍗曢€夋琛ㄥ崟鍩�
 * @ignore
 */

  
var CheckField = require("bui/form/fields/check");

/**
 * 琛ㄥ崟鍗曢€夊煙
 * @class BUI.Form.Field.Radio
 * @extends BUI.Form.Field.Check
 */
var RadioField = CheckField.extend({
  bindUI : function(){
    var _self = this,
      parent = _self.get('parent'),
      name = _self.get('name');

    if(parent){
      _self.getInnerControl().on('click',function(ev){
        var fields = parent.getFields(name);
        BUI.each(fields,function(field){
          if(field != _self){
            field.set('checked',false);
          }
        });
      });
    }
  }
},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      view : true,
      value : '<input type="radio"/>'
    },
    /**
     * 鎺т欢瀹瑰櫒锛屽鏋滀负绌虹洿鎺ユ坊鍔犲湪鎺т欢瀹瑰櫒涓�
     * @type {String|HTMLElement}
     */
    controlContainer : {
      value : '.radio'
    },
    tpl : {
      value : '<label><span class="radio"></span>{label}</label>'
    }
  }
},{
  xclass : 'form-field-radio'
});

module.exports = RadioField;

});
define("bui/form/fields/checkbox", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview  澶嶉€夋琛ㄥ崟鍩�
 * @ignore
 */

var CheckField = require("bui/form/fields/check");

 /**
 * 琛ㄥ崟澶嶉€夊煙
 * @class BUI.Form.Field.Checkbox
 * @extends BUI.Form.Field.Check
 */
var CheckBoxField = CheckField.extend({

},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      view : true,
      value : '<input type="checkbox"/>'
    },
     /**
     * 鎺т欢瀹瑰櫒锛屽鏋滀负绌虹洿鎺ユ坊鍔犲湪鎺т欢瀹瑰櫒涓�
     * @type {String|HTMLElement}
     */
    controlContainer : {
      value : '.checkbox'
    },
    tpl : {
      value : '<label><span class="checkbox"></span>{label}</label>'
    }
  }
},{
  xclass : 'form-field-checkbox'
});

module.exports = CheckBoxField;

});
define("bui/form/fields/plain", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 浠呬粎鐢ㄤ簬鏄剧ず鏂囨湰锛屼笉鑳界紪杈戠殑瀛楁
 * @ignore
 */

var $ = require("jquery"),
  Field = require("bui/form/fields/base");


var PlainFieldView = Field.View.extend({

  _uiSetValue : function(v){
    var _self = this,
      textEl = _self.get('textEl'),
      container = _self.getControlContainer(),
      renderer = _self.get('renderer'), 
      text = renderer ? renderer(v) : v,
      width = _self.get('width'),
      appendWidth = 0,
      textTpl;
    if(textEl){
      
      textEl.remove();
    }
    text = text || '&nbsp;';
    textTpl = BUI.substitute(_self.get('textTpl'),{text : text});
    textEl = $(textTpl).appendTo(container);
    appendWidth = textEl.outerWidth() - textEl.width();
    textEl.width(width - appendWidth);
    _self.set('textEl',textEl);
  }

},{
  ATTRS : {
    textEl : {},
    value : {}
  }
},{
  xclass : 'form-field-plain-view'
});

/**
 * 琛ㄥ崟鏂囨湰鍩燂紝涓嶈兘缂栬緫
 * @class BUI.Form.Field.Plain
 * @extends BUI.Form.Field
 */
var PlainField = Field.extend({

},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<input type="hidden"/>'
    },
    /**
     * 鏄剧ず鏂囨湰鐨勬ā鏉�
     * @type {String}
     */
    textTpl : {
      view : true,
      value : '<span class="x-form-text">{text}</span>'
    },
    /**
     * 灏嗗瓧娈电殑鍊兼牸寮忓寲杈撳嚭
     * @type {Function}
     */
    renderer : {
      view : true,
      value : function(value){
        return value;
      }
    },
    tpl : {
      value : ''
    },
    xview : {
      value : PlainFieldView
    }
  }
},{
  xclass : 'form-field-plain'
});

module.exports = PlainField;

});
define("bui/form/fields/list", ["jquery","bui/common","bui/list","bui/data","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟涓殑鍒楄〃锛屾瘡涓垪琛ㄥ悗鏈変釜闅愯棌鍩熺敤鏉ュ瓨鍌ㄦ暟鎹�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  List = require("bui/list"),
  Field = require("bui/form/fields/base");

function parseItems(items){
  var rst = items;
  if($.isPlainObject(items)){
    rst = [];
    BUI.each(items,function(v,k){
      rst.push({text : v,value : k});
    });
  }
  return rst;
}

/**
 * @class BUI.Form.Field.List
 * 琛ㄥ崟涓殑鍒楄〃
 * @extends BUI.Form.Field
 */
var List = Field.extend({

  initializer : function(){
    var _self = this;
    //if(!_self.get('srcNode')){
      _self._initList();
    //}
  },
  _getList : function(){
    var _self = this,
      children = _self.get('children');
    return children[0];
  },
  bindUI : function(){
    var _self = this,
      list = _self._getList();
    if(list){
      list.on('selectedchange',function(){
        var value = _self._getListValue(list);
        _self.set('value',value);
      });
    }
  },
  //鑾峰彇鍒楄〃鍊�
  _getListValue : function(list){
    var _self = this;
    list = list || _self._getList();
    return list.getSelectionValues().join(',');
  },
  /**
   * 璁剧疆瀛楁鐨勫€�
   * @protected
   * @param {*} value 瀛楁鍊�
   */
  setControlValue : function(value){
    var _self = this,
      innerControl = _self.getInnerControl(),
      list = _self._getList();
    innerControl.val(value);
    if(_self._getListValue(list) !== value && list.getCount()){
      if(list.get('multipleSelect')){
        list.clearSelection();
      }
      list.setSelectionByField(value.split(','));
    }
  },
  //鍚屾鏁版嵁
  syncUI : function(){
     this.set('list',this._getList());
  },
  //鍒濆鍖栧垪琛�
  _initList : function(){
    var _self = this,
      defaultListCfg = _self.get('defaultListCfg'),
      children = _self.get('children'),
      list = _self.get('list') || {};
    if(children[0]){
      return;
    }
    if($.isPlainObject(list)){
      BUI.mix(list,defaultListCfg);
    }
    children.push(list);
  },
  /**
   * 璁剧疆閫夐」
   * @param {Array} items 閫夐」璁板綍
   */
  setItems : function(items){
    var _self = this,
      value = _self.get('value'),
      list = _self._getList();
    list.set('items',parseItems(items));
    list.setSelectionByField(value.split(','));
  },
  //璁剧疆閫夐」闆嗗悎
  _uiSetItems : function(v){
    if(v){
      this.setItems(v);
    }
  }
},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<input type="hidden"/>'
    },
    /**
     * @protected
     * 榛樿鐨勫垪琛ㄩ厤缃�
     * @type {Object}
     */
    defaultListCfg : {
      value : {
        xclass : 'simple-list'
      }
    },
    /**
     * 閫夐」
     * @type {Array}
     */
    items : {
      setter : function(v){
        if($.isPlainObject(v)){
          var rst = [];
          BUI.each(v,function(v,k){
            rst.push({value : k,text :v});
          });
          v = rst;
        }
        return v;
      }
    },
    /**
     * 鍒楄〃
     * @type {BUI.List.SimpleList}
     */
    list : {

    }
  },
  PARSER : {
    list : function(el){
      var listEl = el.find('.bui-simple-list');
      if(listEl.length){
        return {
          srcNode : listEl
        };
      }
    }
  }
},{
  xclass : 'form-field-list'
});

module.exports = List;

});
define("bui/form/fields/textarea", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鏂囨湰鍩�
 * @author dxq613@gmail.com
 * @ignore
 */

var Field = require("bui/form/fields/base");

/**
 * 琛ㄥ崟鏂囨湰鍩�
 * @class BUI.Form.Field.TextArea
 * @extends BUI.Form.Field
 */
var TextAreaField = Field.extend({
  //璁剧疆琛�
  _uiSetRows : function(v){
    var _self = this,
      innerControl = _self.getInnerControl();
    if(v){
      innerControl.attr('rows',v);
    }
  },
  //璁剧疆鍒�
  _uiSetCols : function(v){
    var _self = this,
      innerControl = _self.getInnerControl();
    if(v){
      innerControl.attr('cols',v);
    }
  }
},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<textarea></textarea>'
    },
    /**
     * 琛�
     * @type {Number}
     */
    rows : {

    },
    /**
     * 鍒�
     * @type {Number}
     */
    cols : {

    },
    decorateCfgFields : {
      value : {
        'rows' : true,
        'cols' : true
      }
    }
  }
},{
  xclass : 'form-field-textarea'
});

module.exports = TextAreaField;

});
define("bui/form/fields/uploader", ["bui/common","jquery","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 妯℃嫙閫夋嫨妗嗗湪琛ㄥ崟涓�
 * @ignore
 */


var BUI = require("bui/common"),
  JSON = BUI.JSON,
  Field = require("bui/form/fields/base"),
  Rules = require("bui/form/rules");

/**
 * 琛ㄥ崟涓婁紶鍩�
 * @class BUI.Form.Field.Upload
 * @extends BUI.Form.Field
 */
var uploaderField = Field.extend({
  //鐢熸垚upload
  renderUI : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    if(_self.get('srcNode') && innerControl.get(0).type === 'file'){ //濡傛灉浣跨敤鐜版湁DOM鐢熸垚锛屼笉浣跨敤涓婁紶缁勪欢
      return;
    }
    _self._initControlValue();
    _self._initUpload();
  },
  _initUpload: function(){
    var _self = this,
      children = _self.get('children'),
      uploader = _self.get('uploader') || {};

    require.async('bui/uploader', function(Uploader){
      uploader.render = _self.getControlContainer();
      uploader.autoRender = true;
      uploader = new Uploader.Uploader(uploader);
      _self.set('uploader', uploader);
      _self.set('isCreate',true);
      _self.get('children').push(uploader);

      
      _self._initQueue(uploader.get('queue'));
      
      uploader.on('success', function(ev){
        var result = _self._getUploaderResult();
        _self.setControlValue(result);
      });
      uploader.get('queue').on('itemremoved', function(){
        var result = _self._getUploaderResult();
        _self.setControlValue(result);
      })
    });
  },
  _getUploaderResult: function(){
    var _self = this,
      uploader = _self.get('uploader'),
      queue = uploader.get('queue'),
      items = queue.getItems(),
      result = [];

    BUI.each(items, function(item){
      item.result && result.push(item.result);
    });
    return result;
  },
  setControlValue: function(items){
    var _self = this,
      innerControl = _self.getInnerControl();
    // _self.fire('change');
    innerControl.val(JSON.stringify(items));
  },
  _initControlValue: function(){
    var _self = this,
      textValue = _self.getControlValue(),
      value;
    if(textValue){
      value = BUI.JSON.parse(textValue);
      _self.set('value', value);
    }
  },
  _initQueue: function(queue){
    var _self = this,
      value = _self.get('value'),
      result = [];
    //鍒濆鍖栧鍒楅粯璁ゆ垚鍔�
    BUI.each(value, function(item){
      var newItem = BUI.cloneObject(item);
      newItem.success = true;
      newItem.result = item;
      result.push(newItem);
    });
    queue && queue.setItems(result);
  }//,
  // valid: function(){
  //   var _self = this,
  //     uploader = _self.get('uploader');
  //   uploaderField.superclass.valid.call(_self);
  //   uploader.valid();
  // }
},{
  ATTRS : {
    /**
     * 鍐呴儴琛ㄥ崟鍏冪礌鐨勫鍣�
     * @type {String}
     */
    controlTpl : {
      value : '<input type="hidden"/>'
    },
    uploader: {
      setter: function(v){
        var disabled = this.get('disabled');
        v && v.isController && v.set('disabled', disabled);
        return v;
      }
    },

    disabled: {
      setter: function(v){
        var _self = this,
          uploader = _self.get('uploader');
        uploader && uploader.isController && uploader.set('disabled', v);
      }
    },
    value:{
      shared : false,
      value: []
    },
    defaultRules: function(){
      uploader: true
    }
  }
},{
  xclass : 'form-field-uploader'
});


Rules.add({
  name : 'uploader',  //瑙勫垯鍚嶇О
  msg : '涓婁紶鏂囦欢閫夋嫨鏈夎锛�',//榛樿鏄剧ず鐨勯敊璇俊鎭�
  validator : function(value, baseValue, formatMsg, field){ //楠岃瘉鍑芥暟锛岄獙璇佸€笺€佸熀鍑嗗€笺€佹牸寮忓寲鍚庣殑閿欒淇℃伅
    var uploader = field.get('uploader');
    if(uploader && !uploader.isValid()){
      return formatMsg;
    }
  }
}); 
module.exports = uploaderField;

});
define("bui/form/fields/checklist", ["bui/common","jquery","bui/list","bui/data","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 鍙嬀閫夌殑鍒楄〃锛屾ā鎷熷涓猚heckbox
 * @ignore
 */

'use strict';
var BUI = require("bui/common"),
  ListField = require("bui/form/fields/list");

/**
 * @class BUI.Form.Field.CheckList
 * 鍙嬀閫夌殑鍒楄〃锛屾ā鎷熷涓猚heckbox
 * @extends BUI.Form.Field.List
 */
var CheckList = ListField.extend({

},{
  ATTRS : {
    /**
     * @protected
     * 榛樿鐨勫垪琛ㄩ厤缃�
     * @type {Object}
     */
    defaultListCfg : {
      value : {
        itemTpl : '<li><span class="x-checkbox"></span>{text}</li>',
        multipleSelect : true,
        allowTextSelection : false
      }
    }
  }
},{
  xclass : 'form-field-checklist'
});

module.exports = CheckList;

});
define("bui/form/fields/radiolist", ["bui/common","jquery","bui/list","bui/data","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 鍙嬀閫夌殑鍒楄〃锛屾ā鎷熷涓猺adio
 * @ignore
 */

'use strict';
var BUI = require("bui/common"),
  ListField = require("bui/form/fields/list");

/**
 * @class BUI.Form.Field.RadioList
 * 鍙嬀閫夌殑鍒楄〃锛屾ā鎷熷涓猺adio
 * @extends BUI.Form.Field.List
 */
var RadioList = ListField.extend({

},{
  ATTRS : {
    /**
     * @protected
     * 榛樿鐨勫垪琛ㄩ厤缃�
     * @type {Object}
     */
    defaultListCfg : {
      value : {
        itemTpl : '<li><span class="x-radio"></span>{text}</li>',
        allowTextSelection : false
      }
    }
  }
},{
  xclass : 'form-field-radiolist'
});

module.exports = RadioList;

});
define("bui/form/groupvalid", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鍒嗙粍楠岃瘉
 * @ignore
 */

var $ = require("jquery"),
  CLS_ERROR = 'x-form-error',
  Valid = require("bui/form/valid");

 /**
 * @class BUI.Form.GroupValidView
 * @private
 * 琛ㄥ崟鍒嗙粍楠岃瘉瑙嗗浘
 * @extends BUI.Form.ValidView
 */
function GroupValidView(){

}

BUI.augment(GroupValidView,Valid.View,{
  /**
   * 鏄剧ず涓€鏉￠敊璇�
   * @private
   * @param  {String} msg 閿欒淇℃伅
   */
  showError : function(msg,errorTpl,container){
    var errorMsg = BUI.substitute(errorTpl,{error : msg}),
         el = $(errorMsg);
      el.appendTo(container);
      el.addClass(CLS_ERROR);
  },
  /**
   * 娓呴櫎閿欒
   */
  clearErrors : function(){
    var _self = this,
      errorContainer = _self.getErrorsContainer();
    errorContainer.children('.' + CLS_ERROR).remove();
  }
});

/**
 * @class BUI.Form.GroupValid
 * 琛ㄥ崟鍒嗙粍楠岃瘉
 * @extends BUI.Form.Valid
 */
function GroupValid(){

}

GroupValid.ATTRS = ATTRS =BUI.merge(true,Valid.ATTRS,{
  events: {
    value : {
      /**
       * @event
       * 楠岃瘉缁撴灉鍙戠敓鏀瑰彉锛屼粠true鍙樻垚false鎴栬€呯浉鍙�
       * @param {Object} ev 浜嬩欢瀵硅薄
       * @param {Object} ev.target 瑙﹀彂浜嬩欢鐨勫瓙鎺т欢
       * @param {Boolean} ev.valid 鏄惁閫氳繃楠岃瘉
       */
      validchange : true,
      /**
       * @event
       * 鍊兼敼鍙橈紝浠呭綋閫氳繃楠岃瘉鏃惰Е鍙�
       * @param {Object} ev 浜嬩欢瀵硅薄
       * @param {Object} ev.target 瑙﹀彂浜嬩欢鐨勫瓙鎺т欢
       */
      change : true
    }
  }
});

BUI.augment(GroupValid,Valid,{
  __bindUI : function(){
    var _self = this,
      validEvent =  'validchange change';

    //褰撲笉闇€瑕佹樉绀哄瓙鎺т欢閿欒鏃讹紝浠呴渶瑕佺洃鍚�'change'浜嬩欢鍗冲彲
    _self.on(validEvent,function(ev){
      var sender = ev.target;
      if(sender != this && _self.get('showError')){

        var valid = sender.isValid();
        //鏄惁鎵€鏈夌殑瀛愯妭鐐归兘杩涜杩囬獙璇�
        if(_self._hasAllChildrenValid()){
          valid = valid && _self.isChildrenValid();
          if(valid){
            _self.validControl(_self.getRecord());
            valid = _self.isSelfValid();
          }
        }
        
        if(!valid){
          _self.showErrors();
        }else{
          _self.clearErrors();
        }
      }
    });
  },
  /**
   * 鏄惁閫氳繃楠岃瘉
   */
  isValid : function(){
    if(this.get('disabled')){ //濡傛灉琚鐢紝鍒欎笉杩涜楠岃瘉锛屽苟涓旇涓簍rue
      return true;
    }
    var _self = this,
      isValid = _self.isChildrenValid();
    return isValid && _self.isSelfValid();
  },
  /**
   * 杩涜楠岃瘉
   */
  valid : function(){
    var _self = this,
      children = _self.get('children');
    if(_self.get('disabled')){ //绂佺敤鏃朵笉杩涜楠岃瘉
      return;
    }
    BUI.each(children,function(item){
      if(!item.get('disabled')){
        item.valid();
      }
    });
  },
  /**
   * 鏄惁鎵€鏈夌殑瀛愯妭鐐硅繘琛岃繃鏍￠獙,濡傛灉瀛愯妭鐐�
   * @private
   */
  _hasAllChildrenValid : function(){
    var _self = this,
      children = _self.get('children'),
      rst = true;
    BUI.each(children,function(item){
      if(!item.get('disabled') && item.get('hasValid') === false){
        rst = false;
        return false;
      }
    });  
    return rst;
  },
  /**
   * 鎵€鏈夊瓙鎺т欢鏄惁閫氳繃楠岃瘉
   * @protected
   * @return {Boolean} 鎵€鏈夊瓙鎺т欢鏄惁閫氳繃楠岃瘉
   */
  isChildrenValid : function(){
    var _self = this,
      children = _self.get('children'),
      isValid = true;

    BUI.each(children,function(item){
      if(!item.get('disabled') && !item.isValid()){
        isValid = false;
        return false;
      }
    });
    return isValid;
  },
  isSelfValid : function () {
    return !this.get('error');
  },
  /**
   * 楠岃瘉鎺т欢鍐呭
   * @protected
   * @return {Boolean} 鏄惁閫氳繃楠岃瘉
   */
  validControl : function (record) {
    var _self = this,
      error = _self.getValidError(record);
    _self.set('error',error);
  },
  /**
   * 鑾峰彇楠岃瘉鍑洪敊淇℃伅锛屽寘鎷嚜韬拰瀛愭帶浠剁殑楠岃瘉閿欒淇℃伅
   * @return {Array} 鍑洪敊淇℃伅
   */
  getErrors : function(){
    var _self = this,
      children = _self.get('children'),
      showChildError = _self.get('showChildError'),
      validError = null,
      rst = [];
    if(showChildError){
      BUI.each(children,function(child){
        if(child.getErrors){
          rst = rst.concat(child.getErrors());
        }
      });
    }
    //濡傛灉鎵€鏈夊瓙鎺т欢閫氳繃楠岃瘉锛屾墠鏄剧ず鑷繁鐨勯敊璇�
    if(_self._hasAllChildrenValid() && _self.isChildrenValid()){
      validError = _self.get('error');
      if(validError){
        rst.push(validError);
      }
    }
    
    return rst;
  },  
  //璁剧疆閿欒妯℃澘鏃讹紝瑕嗙洊瀛愭帶浠惰缃殑閿欒妯℃澘
  _uiSetErrorTpl : function(v){
    var _self = this,
      children = _self.get('children');

    BUI.each(children,function(item){
      if(!item.get('userConfig')['errorTpl']){ //鏈畾涔夐敊璇ā鏉挎椂
        item.set('errorTpl',v);
      }
    });
  }
});

GroupValid.View = GroupValidView;

module.exports = GroupValid;

});
define("bui/form/form", ["jquery","bui/common","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 鍒涘缓琛ㄥ崟
 * @ignore
 */

  
var $ = require("jquery"),
  BUI = require("bui/common"),
  FieldContainer = require("bui/form/fieldcontainer"),
  Component = BUI.Component,
  TYPE_SUBMIT = {
    NORMAL : 'normal',
    AJAX : 'ajax',
    IFRAME : 'iframe'
  };

var FormView = FieldContainer.View.extend({
  _uiSetMethod : function(v){
    this.get('el').attr('method',v);
  },
  _uiSetAction : function(v){
    this.get('el').attr('action',v);
  }
},{
  ATTRS : {
    method : {},
    action : {}
  }
},{
  xclass: 'form-view'
});

/**
 * @class BUI.Form.Form
 * 琛ㄥ崟鎺т欢,琛ㄥ崟鐩稿叧鐨勭被鍥撅細
 * <img src="../assets/img/class-form.jpg"/>
 * @extends BUI.Form.FieldContainer
 */
var Form = FieldContainer.extend({
  renderUI : function(){
    var _self = this,
      buttonBar = _self.get('buttonBar'),
      cfg;
    if($.isPlainObject(buttonBar) && _self.get('buttons')){
      cfg = BUI.merge(_self.getDefaultButtonBarCfg(),buttonBar);
      _self._initButtonBar(cfg);
    }
    _self._initSubmitMask();
  },
  _initButtonBar : function(cfg){
    var _self = this;

    require.async('bui/toolbar', function(Toolbar){
      buttonBar = new Toolbar.Bar(cfg);
      _self.set('buttonBar',buttonBar);
    });
  },
  bindUI : function(){
    var _self = this,
      formEl = _self.get('el');

    formEl.on('submit',function(ev){
      _self.valid();
      if(!_self.isValid() || _self.onBeforeSubmit() === false){
        ev.preventDefault();
        _self.focusError();
        return;
      }
      if(_self.isValid() && _self.get('submitType') === TYPE_SUBMIT.AJAX){
        ev.preventDefault();
        _self.ajaxSubmit();
      }

    });
  },
  /**
   * 鑾峰彇鎸夐挳鏍忛粯璁ょ殑閰嶇疆椤�
   * @protected
   * @return {Object} 
   */
  getDefaultButtonBarCfg : function(){
    var _self = this,
      buttons = _self.get('buttons');
    return {
      autoRender : true,
      elCls :'toolbar',
      render : _self.get('el'),
      items : buttons,
      defaultChildClass : 'bar-item-button'
    };
  },
  /**
   * 灏嗙劍鐐瑰畾浣嶅埌绗竴涓敊璇瓧娈�
   */
  focusError : function(){
    var _self = this,
      fields = _self.getFields();
    
    BUI.each(fields,function(field){
      if(field.get('visible') && !field.get('disabled') && !field.isValid()){
        try{
          field.focus();
        }catch(e){
          BUI.log(e);
        }
        
        return false;
      }
    });
  },
  /**
   * 琛ㄥ崟鎻愪氦锛屽鏋滄湭閫氳繃楠岃瘉锛屽垯闃绘鎻愪氦
   */
  submit : function(options){
    var _self = this,
      submitType = _self.get('submitType');
    _self.valid();
    if(_self.isValid()){
      if(_self.onBeforeSubmit() == false){
        return;
      }
      if(submitType === TYPE_SUBMIT.NORMAL){
        _self.get('el')[0].submit();
      }else if(submitType === TYPE_SUBMIT.AJAX){
        _self.ajaxSubmit(options);
      }
    }else{
      _self.focusError();
    }
  },
  /**
   * 寮傛鎻愪氦琛ㄥ崟
   */
  ajaxSubmit : function(options){
    var _self = this,
      method = _self.get('method'),
      action = _self.get('action'),
      callback = _self.get('callback'),
      submitMask = _self.get('submitMask'),
      data = _self.serializeToObject(), //鑾峰彇琛ㄥ崟鏁版嵁
      success,
      ajaxParams = BUI.merge(true,{ //鍚堝苟璇锋眰鍙傛暟
        url : action,
        type : method,
        dataType : 'json',
        data : data
      },options);

    if(options && options.success){
      success = options.success;
    }
    ajaxParams.success = function(data){ //灏佽success鏂规硶
      if(submitMask && submitMask.hide){
        submitMask.hide();
      }
      if(success){
        success(data);
      }
      callback && callback.call(_self,data);
    } 
    if(submitMask && submitMask.show){
      submitMask.show();
    }
    $.ajax(ajaxParams); 
  },
  //鑾峰彇鎻愪氦鐨勫睆钄藉眰
  _initSubmitMask : function(){
    var _self = this,
      submitType = _self.get('submitType'),
      submitMask = _self.get('submitMask');
    if(submitType === TYPE_SUBMIT.AJAX && submitMask){
      require.async('bui/mask',function(Mask){
        var cfg = $.isPlainObject(submitMask) ? submitMask : {};
        submitMask = new Mask.LoadMask(BUI.mix({el : _self.get('el')},cfg));
        _self.set('submitMask',submitMask);
      });
    }
  },
  /**
   * 搴忓垪鍖栬〃鍗曟垚瀵硅薄锛屾墍鏈夌殑閿€奸兘鏄瓧绗︿覆
   * @return {Object} 搴忓垪鍖栨垚瀵硅薄
   */
  serializeToObject : function(){
    return BUI.FormHelper.serializeToObject(this.get('el')[0]);
  },
  /**
   * serializeToObject 鐨勭缉鍐欙紝鎵€鏈夌殑閿€奸兘鏄瓧绗︿覆
   * @return {Object} 搴忓垪鍖栨垚瀵硅薄
   */
  toObject : function(){
    return this.serializeToObject();
  },
  /**
   * 琛ㄥ崟鎻愪氦鍓�
   * @protected
   * @return {Boolean} 鏄惁鍙栨秷鎻愪氦
   */
  onBeforeSubmit : function(){
    return this.fire('beforesubmit');
  },
  /**
   * 琛ㄥ崟鎭㈠鍒濆鍊�
   */
  reset : function(){
    var _self = this,
      initRecord = _self.get('initRecord');
    _self.setRecord(initRecord);
  },
  /**
   * 閲嶇疆鎻愮ず淇℃伅锛屽洜涓哄湪琛ㄥ崟闅愯棌鐘舵€佷笅锛屾彁绀轰俊鎭畾浣嶉敊璇�
   * <pre><code>
   * dialog.on('show',function(){
   *   form.resetTips();
   * });
   *   
   * </code></pre>
   */
  resetTips : function(){
    var _self = this,
      fields = _self.getFields();
    BUI.each(fields,function(field){
      field.resetTip();
    });
  },
  /**
   * @protected
   * @ignore
   */
  destructor : function(){
    var _self = this,
      buttonBar = _self.get('buttonBar'),
      submitMask = _self.get('submitMask');
    if(buttonBar && buttonBar.destroy){
      buttonBar.destroy();
    }
    if(submitMask && submitMask.destroy){
      submitMask.destroy();
    }
  },
  //璁剧疆琛ㄥ崟鐨勫垵濮嬫暟鎹�
  _uiSetInitRecord : function(v){
    //if(v){
      this.setRecord(v);
    //}
    
  }
},{
  ATTRS : {
    /**
     * 鎻愪氦鐨勮矾寰�
     * @type {String}
     */
    action : {
      view : true,
      value : ''
    },
    allowTextSelection:{
      value : true
    },
    events : {
      value : {
        /**
         * @event
         * 琛ㄥ崟鎻愪氦鍓嶈Е鍙戯紝濡傛灉杩斿洖false浼氶樆姝㈣〃鍗曟彁浜�
         */
        beforesubmit : false
      }
    },
    /**
     * 鎻愪氦鐨勬柟寮�
     * @type {String}
     */
    method : {
      view : true,
      value : 'get'
    },
    /**
     * 榛樿鐨刲oader閰嶇疆
     * <pre>
     * {
     *   autoLoad : true,
     *   property : 'record',
     *   dataType : 'json'
     * }
     * </pre>
     * @type {Object}
     */
    defaultLoaderCfg : {
      value : {
        autoLoad : true,
        property : 'record',
        dataType : 'json'
      }
    },
    /**
     * 寮傛鎻愪氦琛ㄥ崟鏃剁殑灞忚斀
     * @type {BUI.Mask.LoadMask|Object}
     */
    submitMask : {
      value : {
        msg : '姝ｅ湪鎻愪氦銆傘€傘€�'
      }
    },
    /**
     * 鎻愪氦琛ㄥ崟鐨勬柟寮�
     *
     *  - normal 鏅€氭柟寮忥紝鐩存帴鎻愪氦琛ㄥ崟
     *  - ajax 寮傛鎻愪氦鏂瑰紡锛屽湪submit鎸囧畾鍙傛暟
     *  - iframe 浣跨敤iframe鎻愪氦,寮€鍙戜腑銆傘€傘€�
     * @cfg {String} [submitType='normal']
     */
    submitType : {
      value : 'normal'
    },
    /**
     * 琛ㄥ崟鎻愪氦鍓嶏紝濡傛灉瀛樺湪閿欒锛屾槸鍚﹀皢鐒︾偣瀹氫綅鍒扮涓€涓敊璇�
     * @type {Object}
     */
    focusError : {
      value : true
    },
    /**
     * 琛ㄥ崟鎻愪氦鎴愬姛鍚庣殑鍥炶皟鍑芥暟锛屾櫘閫氭彁浜ゆ柟寮� submitType = 'normal'锛屼笉浼氳皟鐢�
     * @type {Object}
     */
    callback : {

    },
    decorateCfgFields : {
      value : {
        'method' : true,
        'action' : true
      }
    },
    /**
     * 榛樿鐨勫瓙鎺т欢鏃舵枃鏈煙
     * @type {String}
     */
    defaultChildClass : {
      value : 'form-field'
    },
    /**
     * 浣跨敤鐨勬爣绛撅紝涓篺orm
     * @type {String}
     */
    elTagName : {
      value : 'form'
    },
    /**
     * 琛ㄥ崟鎸夐挳
     * @type {Array}
     */
    buttons : {

    },
    /**
     * 鎸夐挳鏍�
     * @type {BUI.Toolbar.Bar}
     */
    buttonBar : {
      shared : false,
      value : {}
    },
    childContainer : {
      value : '.x-form-fields'
    },
    /**
     * 琛ㄥ崟鍒濆鍖栫殑鏁版嵁锛岀敤浜庡垵濮嬪寲鎴栬€呰〃鍗曞洖婊�
     * @type {Object}
     */
    initRecord : {

    },
    /**
     * 琛ㄥ崟榛樿涓嶆樉绀洪敊璇紝涓嶅奖鍝嶈〃鍗曞垎缁勫拰琛ㄥ崟瀛楁
     * @type {Boolean}
     */
    showError : {
      value : false
    },
    xview : {
      value : FormView
    },
    tpl : {
      value : '<div class="x-form-fields"></div>'
    }
  }
},{
  xclass : 'form'
});

Form.View = FormView;

module.exports = Form;

});
define("bui/form/row", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟閲岀殑涓€琛屽厓绱�
 * @ignore
 */

var BUI = require("bui/common"),
  FieldContainer = require("bui/form/fieldcontainer");

/**
 * @class BUI.Form.Row
 * 琛ㄥ崟琛�
 * @extends BUI.Form.FieldContainer
 */
var Row = FieldContainer.extend({

},{
  ATTRS : {
    elCls : {
      value : 'row'
    },
    defaultChildCfg:{
      value : {
        tpl : ' <label class="control-label">{label}</label>\
              <div class="controls">\
              </div>',
        childContainer : '.controls',
        showOneError : true,
        controlContainer : '.controls',
        elCls : 'control-group span8',
        errorTpl : '<span class="valid-text"><span class="estate error"><span class="x-icon x-icon-mini x-icon-error">!</span><em>{error}</em></span></span>'
      }
      
    },
    defaultChildClass : {
      value : 'form-field-text'
    }
  }
},{
  xclass:'form-row'
});

module.exports = Row;

});
define("bui/form/fieldgroup", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鏂囨湰鍩熺粍锛屽彲浠ュ寘鍚竴涓嚦澶氫釜瀛楁
 * @author dxq613@gmail.com
 * @ignore
 */

var BUI = require("bui/common"),
  Group = require("bui/form/group/base");

BUI.mix(Group,{
  Range : require("bui/form/group/range"),
  Check : require("bui/form/group/check"),
  Select : require("bui/form/group/select")
});
return Group;

});
define("bui/form/group/base", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 琛ㄥ崟鏂囨湰鍩熺粍锛屽彲浠ュ寘鍚竴涓嚦澶氫釜瀛楁
 * @author dxq613@gmail.com
 * @ignore
 */

var BUI = require("bui/common"),
  FieldContainer = require("bui/form/fieldcontainer");

/**
 * @class BUI.Form.Group
 * 琛ㄥ崟瀛楁鍒嗙粍
 * @extends BUI.Form.FieldContainer
 */
var Group = FieldContainer.extend({
  
},{
  ATTRS : {
    /**
     * 鏍囬
     * @type {String}
     */
    label : {
      view : true
    },
    defaultChildClass : {
      value : 'form-field'
    }
  }
},{
  xclass:'form-group'
});

module.exports = Group;

});
define("bui/form/group/range", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 鑼冨洿鐨勫瓧娈电粍锛屾瘮濡傛棩鏈熻寖鍥寸瓑
 * @ignore
 */

var Group = require("bui/form/group/base");

function testRange (self,curVal,prevVal) {
  var allowEqual = self.get('allowEqual');

  if(allowEqual){
    return prevVal <= curVal;
  }

  return prevVal < curVal;
}
/**
 * @class BUI.Form.Group.Range
 * 瀛楁鑼冨洿鍒嗙粍锛岀敤浜庢棩鏈熻寖鍥达紝鏁板瓧鑼冨洿绛夊満鏅�
 * @extends BUI.Form.Group
 */
var Range = Group.extend({

},{
  ATTRS : {
    /**
     * 榛樿鐨勯獙璇佸嚱鏁板け璐ュ悗鏄剧ず鐨勬枃鏈€�
     * @type {Object}
     */
    rangeText : {
      value : '寮€濮嬩笉鑳藉ぇ浜庣粨鏉燂紒'
    },
    /**
     * 鏄惁鍏佽鍓嶅悗鐩哥瓑
     * @type {Boolean}
     */
    allowEqual : {
      value : true
    },
    /**
     * 楠岃瘉鍣�
     * @override
     * @type {Function}
     */
    validator : {
      value : function (record) {
        var _self = this,
          fields = _self.getFields(),
          valid = true;
        for(var i = 1; i < fields.length ; i ++){
          var cur = fields[i],
            prev = fields[i-1],
            curVal,
            prevVal;
          if(cur && prev){
            curVal = cur.get('value');
            prevVal = prev.get('value');
            if(!testRange(_self,curVal,prevVal)){
              valid = false;
              break;
            }
          }
        }
        if(!valid){
          return _self.get('rangeText');
        }
        return null;
      }
    }
  }
},{
  xclass : 'form-group-range'
});

module.exports = Range;

});
define("bui/form/group/check", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨鍒嗙粍锛屽寘鍚紝checkbox,radio
 * @ignore
 */

var Group = require("bui/form/group/base");

function getFieldName (self) {
  var firstField = self.getFieldAt(0);
  if(firstField){
    return firstField.get('name');
  }
  return '';
}
/**
 * @class BUI.Form.Group.Check
 * 鍗曢€夛紝澶嶉€夊垎缁勶紝鍙兘鍖呭惈鍚宯ame鐨刢heckbox,radio
 * @extends BUI.Form.Group
 */
var Check = Group.extend({
  bindUI : function(){
    var _self = this;
    _self.on('change',function(ev){
      var name = getFieldName(_self),
        range = _self.get('range'),
        record = _self.getRecord(),
        value = record[name],
        max = range[1];
      if(value && value.length >= max){
        _self._setFieldsEnable(name,false);
      }else{
        _self._setFieldsEnable(name,true);
      }
    });
  },
  _setFieldsEnable : function(name,enable){

    var _self = this,
      fields = _self.getFields(name);
    BUI.each(fields,function(field){
      if(enable){
        field.enable();
      }else{
        if(!field.get('checked')){
          field.disable();
        }
      }
    });
  },
  _uiSetRange : function(v){
    this.addRule('checkRange',v);
  }

},{
  ATTRS : {
    /**
     * 闇€瑕侀€変腑鐨勫瓧娈�,
     * <ol>
     *   <li>濡傛灉 range:1锛宺ange:2 鏈€灏戝嬀閫�1涓紝2涓€�</li>
     *   <li>濡傛灉 range :0,鍙互鍏ㄩ儴涓嶉€変腑銆�</li>
     *   <li>濡傛灉 range:[1,2],鍒欏繀椤婚€変腑1-2涓€�</li>
     * </ol>
     * @type {Array|Number}
     */
    range : {
      setter : function (v) {
        if(BUI.isString(v) || BUI.isNumber(v)){
          v = [parseInt(v,10)];
        }
        return v;
      }
    }
  }
},{
  xclass : 'form-group-check'
});

module.exports = Check;

});
define("bui/form/group/select", ["bui/common","jquery","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨妗嗗垎缁�
 * @ignore
 */

var Group = require("bui/form/group/base"),
  Data = require("bui/data"),
  Bindable = BUI.Component.UIBase.Bindable;

function getItems(nodes){
  var items = [];
  BUI.each(nodes,function(node){
    items.push({
      text : node.text,
      value : node.id
    });
  });
  return items;
}

/**
 * @class BUI.Form.Group.Select
 * 绾ц仈閫夋嫨妗嗗垎缁�
 * @extends BUI.Form.Group
 * @mixins BUI.Component.UIBase.Bindable
 */
var Select = Group.extend([Bindable],{
  initializer : function(){
    var _self = this,
      url = _self.get('url'),
      store = _self.get('store') || _self._getStore();
    if(!store.isStore){
      store.autoLoad = true;
      if(url){
        store.url = url;
      }
      store = new Data.TreeStore(store);
    }
    _self.set('store',store);
  },
  bindUI : function  () {
    var _self = this;
    _self.on('change',function (ev) {
      var target = ev.target;
      if(target != _self){
        var field = target,
          value = field.get('value'),
          level = _self._getFieldIndex(field) + 1;
        _self._valueChange(value,level);
      }
    });
  },
  onLoad : function(e){
    var _self = this,
      node = e ? e.node : _self.get('store').get('root');
    _self._setFieldItems(node.level,node.children); 
  },
  //鑾峰彇store鐨勯厤缃」
  _getStore : function(){
    var _self = this,
      type = _self.get('type');
    if(type && TypeMap[type]){
      return TypeMap[type];
    }
    return {};
  },
  _valueChange : function(value,level){
    var _self = this,
      store = _self.get('store');
    if(value){
      var node = store.findNode(value);
      if(!node){
        return;
      }
      if(store.isLoaded(node)){
        _self._setFieldItems(level,node.children);
      }else{
        store.loadNode(node);
      }
    }else{
      _self._setFieldItems(level,[]);
    }
  },
  _setFieldItems : function(level,nodes){
    var _self = this,
      field = _self.getFieldAt(level),
      items = getItems(nodes);
    if(field){
      field.setItems(items);
      _self._valueChange(field.get('value'),level + 1);
    }
  },
  //鑾峰彇瀛楁鐨勭储寮曚綅缃�
  _getFieldIndex : function (field) {
    var _self = this,
      fields = _self.getFields();
    return  BUI.Array.indexOf(field,fields);
  }
},{
  ATTRS : {
    /**
     * 绾ц仈閫夋嫨妗嗙殑绫诲瀷,鐩墠浠呭唴缃簡 'city'涓€涓被鍨嬶紝鐢ㄤ簬閫夋嫨鐪併€佸競銆佸幙,
     * 鍙互鑷畾涔夋坊鍔犵被鍨�
     *         Select.addType('city',{
     *           proxy : {
     *             url : 'http://lp.taobao.com/go/rgn/citydistrictdata.php',
     *             dataType : 'jsonp'
     *           },
     *           map : {
     *             isleaf : 'leaf',
     *             value : 'text'
     *           }
     *         });
     * @type {String}
     */
    type : {

    },
    store : {

    }
  }
},{
  xclass : 'form-group-select'
});

var TypeMap = {};

/**
 * 娣诲姞涓€涓被鍨嬬殑绾ц仈閫夋嫨妗嗭紝鐩墠浠呭唴缃簡 'city'涓€涓被鍨嬶紝鐢ㄤ簬閫夋嫨鐪併€佸競銆佸幙
 * @static
 * @param {String} name 绫诲瀷鍚嶇О
 * @param {Object} cfg  閰嶇疆椤癸紝璇︾粏淇℃伅璇峰弬鐪嬶細 @see{BUI.Data.TreeStore}
 */
Select.addType = function(name,cfg){
  TypeMap[name] = cfg;
};

Select.addType('city',{
  proxy : {
    url : 'http://lp.taobao.com/go/rgn/citydistrictdata.php',
    dataType : 'jsonp'
  },
  map : {
    isleaf : 'leaf',
    value : 'text'
  }
});

module.exports = Select;

});
define("bui/form/hform", ["jquery","bui/common","bui/overlay","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 鍨傜洿琛ㄥ崟
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Form = require("bui/form/form");

/**
 * @class BUI.Form.HForm
 * 姘村钩琛ㄥ崟锛屽瓧娈垫按骞虫帓鍒�
 * @extends BUI.Form.Form
 * 
 */
var Horizontal = Form.extend({
  /**
   * 鑾峰彇鎸夐挳鏍忛粯璁ょ殑閰嶇疆椤�
   * @protected
   * @return {Object} 
   */
  getDefaultButtonBarCfg : function(){
    var _self = this,
      buttons = _self.get('buttons');
    return {
      autoRender : true,
      elCls : 'actions-bar toolbar row',
      tpl : '<div class="form-actions span21 offset3"></div>',
      childContainer : '.form-actions',
      render : _self.get('el'),
      items : buttons,
      defaultChildClass : 'bar-item-button'
    };
  }
},{
  ATTRS : {
    defaultChildClass : {
      value : 'form-row'
    },
    errorTpl : {
      value : '<span class="valid-text"><span class="estate error"><span class="x-icon x-icon-mini x-icon-error">!</span><em>{error}</em></span></span>'
    },
    elCls : {
      value : 'form-horizontal'
    }
  },
  PARSER : {
    
  }
},{
  xclass : 'form-horizontal'
});

module.exports = Horizontal;

});

define("bui/editor", ["bui/common","jquery","bui/form","bui/overlay","bui/list","bui/data"], function(require, exports, module){
var BUI = require("bui/common"),
  Form = require("bui/form"),
  Editor = BUI.namespace('Editor');

BUI.mix(Editor,{
  Editor : require("bui/editor/editor"),
  RecordEditor : require("bui/editor/record"),
  DialogEditor : require("bui/editor/dialog")
});

return Editor;

});
define("bui/editor/editor", ["bui/common","jquery","bui/overlay"], function(require, exports, module){
/**
 * @ignore
 * @fileOverview 缂栬緫鍣�
 * @author dxq613@gmail.com
 */

var BUI = require("bui/common"),
  Overlay = require("bui/overlay").Overlay
  CLS_TIPS = 'x-editor-tips',
  Mixin = require("bui/editor/mixin");

/**
 * @class BUI.Editor.Editor
 * @extends BUI.Overlay.Overlay
 * @mixins BUI.Editor.Mixin
 * 缂栬緫鍣�
 * <p>
 * <img src="../assets/img/class-editor.jpg"/>
 * </p>
 * <pre><code>
 * var editor = new Editor.Editor({
 *   trigger : '.edit-text',
 *   field : {
 *     rules : {
 *       required : true
 *     }
 *   }
 * });
 * </code></pre>
 */
var editor = Overlay.extend([Mixin],{
  bindUI : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    _self.on('validchange',function(ev){
      if(!_self.isValid() && _self.get('visible')){
        _self._showError(_self.getErrors());
      }else{
        _self._hideError();
      }
    });
    _self.on('hide',function(){
      _self._hideError();
    });

    _self.on('show',function(){
      if(!_self.isValid()){
        _self._showError(_self.getErrors());
      }
    });
  },
  _initOverlay : function(){
    var _self = this,
      tooltip = _self.get('tooltip'),
      overlay = new Overlay(tooltip);
    overlay.render();
    _self.set('overlay',overlay);
    return overlay;
  },
  //鑾峰彇鏄剧ず閿欒鍒楄〃
  _getErrorList : function(){
    var _self = this,
      overlay = _self.get('overlay');
    return overlay && overlay.get('children')[0];
  },
  _showError : function(errors){
    var _self = this,
      overlay = _self.get('overlay') || _self._initOverlay(),
      list = _self._getErrorList(),
      align = _self.get('errorAlign'),
      items = BUI.Array.map(errors,function(text){
        return {error : text};
      });
    list.set('items',items);
    align.node = _self.get('el');
    overlay.set('align',align);
    overlay.show();
  },
  //闅愯棌閿欒
  _hideError : function(){
    var _self = this,
      overlay = _self.get('overlay');
    overlay && overlay.hide();
  },

  /**
   * 娓呴櫎閿欒
   */
  clearErrors : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.clearErrors();
    _self._hideError();
  },
  /**
   * @protected
   * @override
   * 鑾峰彇缂栬緫鐨勬簮鏁版嵁
   * @return {String} 杩斿洖闇€瑕佺紪杈戠殑鏂囨湰
   */
  getSourceValue : function(){
    var _self = this,
      trigger = _self.get('curTrigger'),
      parser = _self.get('parser'),
      text = trigger.text();
    if(parser){
      text = parser.call(this,text,trigger);
    }
    return text;
  },
  /**
   * @protected
   * 鏇存柊鏂囨湰
   * @param  {String} text 缂栬緫鍣ㄧ殑鍊�
   */
  updateSource : function(text){
    var _self = this,
      trigger = _self.get('curTrigger');
    if(trigger && trigger.length){
      text = _self._formatText(text);
      trigger.text(text);
    }
  },
  //鏍煎紡鍖栨枃鏈�
  _formatText : function(text){
    var _self = this,
      formatter = _self.get('formatter');
    if(formatter){
      text = formatter.call(_self,text);
    }
    return text;
  },
  _uiSetWidth : function(v){
    var _self = this;
    if(v != null){
      var innerControl = _self.getInnerControl();
      if(innerControl.set){
        innerControl.set('width',v);
      }
    }
  }
},{
  ATTRS : {
    /**
     * 鍐呴儴鎺т欢鐨勪唬琛╒alue鐨勫瓧娈�
     * @protected
     * @override
     * @type {String}
     */
    innerValueField : {
      value : 'value'
    },
    /**
     * 绌哄€肩殑鏁版嵁锛屾竻绌虹紪杈戝櫒鏃朵娇鐢�
     * @protected
     * @type {*}
     */
    emptyValue : {
      value : ''
    },
    /**
     * 鏄惁鑷姩闅愯棌
     * @override
     * @type {Boolean}
     */
    autoHide : {
      value : true
    },
    /**
     * 鍐呴儴鎺т欢閰嶇疆椤圭殑瀛楁
     * @protected
     * @type {String}
     */
    controlCfgField : {
      value : 'field'
    },
    /**
     * 榛樿鐨勫瓧娈靛煙閰嶇疆椤�
     * @type {Object}
     */
    defaultChildCfg : {
      value : {
        tpl : '',
        forceFit : true,
        errorTpl : ''//
      }
    },
    /**
     * 閿欒鎻愮ず淇℃伅鐨勯厤缃俊鎭�
     * @cfg {Object} tooltip
     */
    tooltip : {
      valueFn : function(){
        return  {
          children : [{
            xclass : 'simple-list',
            itemTpl : '<li><span class="x-icon x-icon-mini x-icon-error" title="{error}">!</span>&nbsp;<span>{error}</span></li>'
          }],
          elCls : CLS_TIPS
        };
      }
    },
    defaultChildClass : {
      value : 'form-field'
    },
    /**
     * 缂栬緫鍣ㄨ窡鎵€缂栬緫鍐呭鐨勫榻愭柟寮�
     * @type {Object}
     */
    align : {
      value : {
        points: ['tl','tl']
      }
    },
    /**
     * 灏嗙紪杈戠殑鏂囨湰杞崲鎴愮紪杈戝櫒闇€瑕佺殑鏍煎紡,<br>
     * 鍑芥暟鍘熷瀷锛�
     * function(text,trigger){}
     *
     * - text 缂栬緫鐨勬枃鏈�
     * - trigger 缂栬緫鐨凞OM锛屾湁鏃跺€檛rigger.text()涓嶇瓑鍚屼簬缂栬緫鐨勫唴瀹癸紝鍙互鍦ㄦ澶勪慨鏀�
     * 
     * @cfg {Function} parser
     */
    parser : {

    },
    /**
     * 杩斿洖鏁版嵁鐨勬牸寮忓寲鍑芥暟
     * @cfg {Object} formatter
     */
    formatter : {

    },
    /**
     * 閿欒淇℃伅鐨勫榻愭柟寮�
     * @type {Object}
     */
    errorAlign : {
      value : {
        points: ['bl','tl'],
        offset : [0,10]
      }
    },
    /**
     * 鏄剧ず閿欒鐨勫脊鍑哄眰
     * @type {BUI.Overlay.Overlay}
     */
    overlay : {

    },
    /**
     * 缂栬緫鍣ㄤ腑榛樿浣跨敤鏂囨湰瀛楁鍩熸潵缂栬緫鏁版嵁
     * @type {Array}
     */
    field : {
      value : {}
    }
  }
},{
  xclass : 'editor'
});

module.exports = editor;

});
define("bui/editor/mixin", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 缂栬緫鍣ㄦ墿灞曠被锛屽紩鍏ヨ繖涓墿灞曪紝鎺т欢鍙互鏀寔缂栬緫鍣ㄥ姛鑳姐€�
 * @ignore
 */

var $ = require("jquery");

function initEditor (self) {
 var _self = self,
    controlCfgField = _self.get('controlCfgField'),
    control = _self.get(controlCfgField),
    c = _self.addChild(control);
  _self.setInternal(controlCfgField,c);
}

/**
 * @class BUI.Editor.Mixin
 * 缂栬緫鍣ㄦ墿灞曠被
 */
var Mixin = function () {
  initEditor(this);
};

Mixin.ATTRS = {
  /**
   * 鎺ュ彈鏇存敼鐨勪簨浠�
   * @protected
   * @type {String}
   */
  acceptEvent : {
    value : 'autohide'
  },
  /**
   * 褰撳彂鐢熼敊璇椂鏄惁闃绘缂栬緫鍣ㄦ秷澶�
   * @type {Boolean}
   */
  preventHide : {
    value : true
  },
  /**
   * 閲嶇疆鏁版嵁鏃剁殑浜嬩欢
   * @type {String}
   */
  changeSourceEvent : {
    value : 'show triggerchange'
  },
  /**
   * 鏄惁蹇界暐鎺夎緭鍏ユ涔嬬被鐨勯敭鐩樹簨浠�
   * @protected
   * @type {Boolean}
   */
  ignoreInputFields: {
    value :false
  },
  /**
   * 鍐呴儴鎺т欢鐨勪唬琛╒alue鐨勫瓧娈�
   * @protected
   * @type {String}
   */
  innerValueField : {

  },
  /**
   * 绌哄€肩殑鏁版嵁锛屾竻绌虹紪杈戝櫒鏃朵娇鐢�
   * @protected
   * @type {*}
   */
  emptyValue : {

  },
  /**
   * 鍐呴儴鎺т欢閰嶇疆椤圭殑瀛楁
   * @protected
   * @type {String}
   */
  controlCfgField : {

  },
  focusable : {
    value : true
  },
  autoUpdate : {
    value : true
  },
  events : {
    value : {
      /**
       * @event
       * 鎺ュ彈鏇存敼
       */
      accept : false,
      /**
       * @event
       * 鍙栨秷鏇存敼
       */
      cancel : false
    }
  }
};

Mixin.prototype = {
  //缁戝畾浜嬩欢
  __bindUI : function(){
    var _self = this,
    acceptEvent = _self.get('acceptEvent'),
    changeSourceEvent = _self.get('changeSourceEvent');

    if(acceptEvent){
      _self.on(acceptEvent,function(){
        if(_self.accept()){
          return ;
        }else if(_self.get('preventHide')){
          return false;
        }else{
          _self.cancel();
        }
      });
    }
    if(changeSourceEvent){
      _self.on(changeSourceEvent,function(){
        _self.setValue(_self.getSourceValue());
        if(_self.get('visible')){
          _self.focus();
        }
      });
    }
  },
  /**
   * @protected
   * 鑾峰彇缂栬緫鍣ㄧ殑鍐呴儴鎺т欢
   * @return {BUI.Component.Controller} 鐢ㄤ簬缂栬緫鏁版嵁鐨勫唴閮ㄦ暟鎹�
   */
  getInnerControl : function(){
    var _self = this,
      children = _self.get('children');
    return children[0];
  },
  /**
   * 璁剧疆鍊硷紝鍊肩殑绫诲瀷鍙栧喅浜庣紪杈戝櫒缂栬緫鐨勬暟鎹�
   * @param {String|Object} value 缂栬緫鍣ㄦ樉绀虹殑鍊�
   * @param {Boolean} [hideError=true] 璁剧疆鍊兼椂鏄惁闅愯棌閿欒
   */
  setValue : function(value,hideError){
    var _self = this,
      innerControl = _self.getInnerControl();
    _self.set('editValue',value);
    _self.clearControlValue();
    innerControl.set(_self.get('innerValueField'),value);
    if(!value){//缂栬緫鐨勫€肩瓑浜庣┖锛屽垯鍙兘涓嶄細瑙﹀彂楠岃瘉
      _self.valid();
    }
    if(hideError){
      _self.clearErrors();
    }
  },
  /**
   * 鑾峰彇缂栬緫鍣ㄧ殑鍊�
   * @return {String|Object} 缂栬緫鍣ㄧ殑鍊�
   */
  getValue :function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    return innerControl.get(_self.get('innerValueField'));
  },
  /**
   * 缂栬緫鐨勫唴瀹规槸鍚﹂€氳繃楠岃瘉
   * @return {Boolean} 鏄惁閫氳繃楠岃瘉
   */
  isValid : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    return innerControl.isValid ? innerControl.isValid() : true;
  },
  /**
   * 楠岃瘉鍐呭鏄惁閫氳繃楠岃瘉
   */
  valid : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.valid && innerControl.valid();
  },
  /**
   * 鑾峰彇閿欒淇℃伅
   * @return {Array} 閿欒淇℃伅
   */
  getErrors : function(){
     var _self = this,
      innerControl = _self.getInnerControl();
    return innerControl.getErrors ? innerControl.getErrors() : [];
  },
  /**
   * 缂栬緫鐨勫唴瀹规槸鍚﹀彂鐢熸敼鍙�
   * @return {Boolean}
   */
  isChange : function(){
    var _self = this,
      editValue = _self.get('editValue'),
      value = _self.getValue();
    return editValue !== value;
  },
  /**
   * 娓呴櫎缂栬緫鐨勫€�
   */
  clearValue : function(){
    this.clearControlValue();
    this.clearErrors();
  },
  /**
   * 娓呴櫎缂栬緫鐨勬帶浠剁殑鍊�
   * @protected
   * @template
   */
  clearControlValue : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.set(_self.get('innerValueField'),_self.get('emptyValue'));
  },
  /**
   * 娓呴櫎閿欒
   */
  clearErrors : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.clearErrors();
  },
  /**
   * @protected
   * @template
   * 鑾峰彇缂栬緫鐨勬簮鏁版嵁
   */
  getSourceValue : function(){

  },
  /**
   * @protected
   * @template
   * 鏇存柊缂栬緫鐨勬簮鏁版嵁
   */
  updateSource : function(){

  },
  /**
   * @protected
   * @override
   * 澶勭悊esc閿�
   */
  handleNavEsc : function(){
    this.cancel();
  },
  /**
   * @protected
   * @override
   * 澶勭悊enter閿�
   */
  handleNavEnter : function(ev){
    var sender = ev.target;
    if(sender.tagName === 'TEXTAREA'){ //鏂囨湰杈撳叆妗嗭紝涓嶇‘瀹氶殣钘�
      return;
    }
    if(sender.tagName === 'BUTTON'){
      $(sender).trigger('click');
    }
    this.accept();
  },
  /**
   * 璁剧疆鑾峰彇鐒︾偣
   */
  focus : function(){
    var _self = this,
      innerControl = _self.getInnerControl();
    innerControl.focus && innerControl.focus()
  },
  /**
   * 鎺ュ彈缂栬緫鍣ㄧ殑缂栬緫缁撴灉
   * @return {Boolean} 鏄惁鎴愬姛鎺ュ彈缂栬緫
   */
  accept : function(){
    var _self = this,
      value;
    _self.valid();
    if(!_self.isValid()){
      return false;
    }
    value = _self.getValue();

    if(_self.get('autoUpdate')){
      _self.updateSource(value);
    }
    if(_self.fire('beforeaccept',{value :value}) == false){
      return;
    }
    _self.fire('accept',{value :value,editValue : _self.get('editValue')});/**/
    _self.hide();
    return true;
  },
  /**
   * 鍙栨秷缂栬緫
   */
  cancel : function(){
    this.fire('cancel');
    this.clearValue();
    this.close();
  }
};

module.exports = Mixin;

});
define("bui/editor/record", ["bui/common","jquery","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 瀵硅薄缂栬緫鍣�
 * @ignore
 */

var BUI = require("bui/common"),
  Editor = require("bui/editor/editor");

/**
 * @class BUI.Editor.RecordEditor
 * @extends BUI.Editor.Editor
 * 缂栬緫鍣�
 */
var editor = Editor.extend({
  /**
   * @protected
   * @override
   * 鑾峰彇缂栬緫鐨勬簮鏁版嵁
   * @return {String} 杩斿洖闇€瑕佺紪杈戠殑鏂囨湰
   */
  getSourceValue : function(){
    return this.get('record');
  },
  /**
   * @protected
   * 鏇存柊鏂囨湰
   * @param  {Object} value 缂栬緫鍣ㄧ殑鍊�
   */
  updateSource : function(value){
    var _self = this,
      record = _self.get('record');
    BUI.mix(record,value);
  },
  _uiSetRecord : function(v){
    this.setValue(v);
  }
},{
  ATTRS : {

    /**
     * 鍐呴儴鎺т欢鐨勪唬琛╒alue鐨勫瓧娈�
     * @protected
     * @override
     * @type {String}
     */
    innerValueField : {
      value : 'record'
    },
    /**
     * 鎺ュ彈鏇存敼鐨勪簨浠�
     * @type {String}
     */
    acceptEvent : {
      value : ''
    },
    /**
     * 绌哄€肩殑鏁版嵁锛屾竻绌虹紪杈戝櫒鏃朵娇鐢�
     * @protected
     * @type {*}
     */
    emptyValue : {
      value : {}
    },
    /**
     * 鏄惁鑷姩闅愯棌
     * @override
     * @type {Boolean}
     */
    autoHide : {
      value : false
    },
    /**
     * 缂栬緫鐨勮褰�
     * @type {Object}
     */
    record : {
      value : {}
    },
    /**
     * 鍐呴儴鎺т欢閰嶇疆椤圭殑瀛楁
     * @protected
     * @type {String}
     */
    controlCfgField : {
      value : 'form'
    },
    /**
     * 缂栬緫鍣ㄥ唴琛ㄥ崟鐨勯厤缃」
     * @type {Object}
     */
    form : {
      value : {}
    },
    /**
     * 閿欒淇℃伅鐨勫榻愭柟寮�
     * @type {Object}
     */
    errorAlign : {
      value : {
        points: ['tr','tl'],
        offset : [10,0]
      }
    },
    /**
     * 榛樿鐨勫瓧娈靛煙閰嶇疆椤�
     * @type {Object}
     */
    defaultChildCfg : {
      valueFn : function(){
        var _self = this;
        return {
          xclass : 'form',
          errorTpl : '',
          showError : true,
          showChildError : true,
          defaultChildCfg : {
            elCls : 'bui-inline-block',
            tpl : '',
            forceFit : true
          },
          buttons : [
          {
            btnCls : 'button button-primary',
            text : '纭畾',
            handler : function(){
              _self.accept();
            }
          },
          {
            btnCls : 'button',
            text : '鍙栨秷',
            handler : function(){
              _self.cancel();
            }
          }]
        }
      }
    }
  }
},{
  xclass : 'record-editor'
});

module.exports = editor;

});
define("bui/editor/dialog", ["jquery","bui/overlay","bui/common"], function(require, exports, module){
/**
 * @fileOverview 浣跨敤寮瑰嚭妗嗕綔涓虹紪杈戝櫒
 * @ignore
 */

var $ = require("jquery"),
  Dialog = require("bui/overlay").Dialog,
  Mixin = require("bui/editor/mixin");

 /**
 * @class BUI.Editor.DialogEditor
 * @extends BUI.Overlay.Dialog
 * @mixins BUI.Editor.Mixin
 * 缂栬緫鍣�
 */
var editor = Dialog.extend([Mixin],{
  /**
   * @protected
   * @override
   * 鑾峰彇缂栬緫鐨勬簮鏁版嵁
   * @return {String} 杩斿洖闇€瑕佺紪杈戠殑鏂囨湰
   */
  getSourceValue : function(){
    return this.get('record');
  },
  /**
   * @protected
   * @override
   * 澶勭悊enter閿�
   */
  handleNavEnter : function(ev){
    var _self = this,
      success = _self.get('success'),
      sender = ev.target;
    if(sender.tagName === 'TEXTAREA'){ //鏂囨湰杈撳叆妗嗭紝涓嶇‘瀹氶殣钘�
      return;
    }
    if(sender.tagName === 'BUTTON'){
      $(sender).trigger('click');
    }
    if(success){
      success.call(_self);
    }else{
      this.accept();
    }
  },
  /**
   * 鍙栨秷缂栬緫
   */
  cancel : function(){
    //if(this.onCancel()!== false){
      this.fire('cancel');
      this.clearValue();
      this.close();
    //} 
  },
  /**
   * @protected
   * 鏇存柊鏂囨湰
   * @param  {Object} value 缂栬緫鍣ㄧ殑鍊�
   */
  updateSource : function(value){
    var _self = this,
      record = _self.get('record');
    BUI.mix(record,value);
  },
  _uiSetRecord : function(v){
    this.setValue(v);
  }
},{
  ATTRS : {
    /*autoHide : {
      value : false
    },*/
    /**
     * 鍐呴儴鎺т欢鐨勪唬琛╒alue鐨勫瓧娈�
     * @protected
     * @override
     * @type {String}
     */
    innerValueField : {
      value : 'record'
    },
    /**
     * 鎺ュ彈鏇存敼鐨勪簨浠�
     * @type {String}
     */
    acceptEvent : {
      value : ''
    },
    /**
     * 缂栬緫鐨勮褰�
     * @type {Object}
     */
    record : {
      value : {}
    },
    /**
     * 绌哄€肩殑鏁版嵁锛屾竻绌虹紪杈戝櫒鏃朵娇鐢�
     * @protected
     * @type {*}
     */
    emptyValue : {
      shared : false,
      value : {}
    },
    /**
     * 鍐呴儴鎺т欢閰嶇疆椤圭殑瀛楁
     * @protected
     * @type {String}
     */
    controlCfgField : {
      value : 'form'
    },
    /**
     * dialog 缂栬緫鍣ㄤ竴鑸敱鎸夐挳瑙﹀彂锛屽湪瑙﹀彂鏃惰缃暟鎹簮
     * @override
     * @type {String}
     */
    changeSourceEvent : {
      value : ''
    },
    /**
     * 榛樿鐨勫瓧娈靛煙閰嶇疆椤�
     * @type {Object}
     */
    defaultChildCfg : {
      value : {
        xclass : 'form-horizontal'
      }
    },
    /**
     * 璁剧疆鍙互鑾峰彇浜ゅ崟
     * @type {Boolean}
     */
    focusable : {
      value : false
    },
    success : {
      value : function () {
        this.accept();
      }
    },
    cancel : {
      value : function(){
        this.cancel();
      }
    },
    /**
     * 缂栬緫鍣ㄥ唴琛ㄥ崟鐨勯厤缃」
     * @type {Object}
     */
    form : {
      value : {}
    }
  }
},{
  xclass : 'dialog-editor'
});

module.exports = editor;

});

define("bui/tooltip", ["bui/common","jquery","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 鎻愮ず鐨勫叆鍙ｆ枃浠�
 * @ignore
 */

var BUI = require("bui/common"),
  Tooltip = BUI.namespace('Tooltip'),
  Tip = require("bui/tooltip/tip"),
  Tips = require("bui/tooltip/tips");

BUI.mix(Tooltip, {
  Tip: Tip,
  Tips: Tips
});

module.exports = Tooltip;

});
define("bui/tooltip/tip", ["jquery","bui/common","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 绠€鍗曟槗鐢ㄧ殑鎻愮ず淇℃伅
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Overlay = require("bui/overlay"),
  CLS_ALIGN_PREFIX = 'x-align-',
  MAP_TYPES = {
    left : ['cl','cr'], //灞呭乏
    right : ['cr','cl'], //灞呭彸
    top : ['tc','bc'], //灞呬笂
    bottom : ['bc','tc'], //灞呬笅
    'top-left' : ['tl','bl'],
    'top-right' : ['tr','br'],
    'bottom-left' : ['bl','tl'],
    'bottom-right' : ['br','tr']
  };
//鑾峰彇璺濈
function getOffset(type,offset){
  if(type === 'left'){
    return [-1 * offset,-4];
  }
  if(type === 'right'){
    return [offset,-4];
  }
  if(type.indexOf('top')){
    return [0,offset];
  }

  if(type.indexOf('bottom')){
    return [0,-1 * offset];
  }
}

var TipView = Overlay.OverlayView.extend({
  renderUI : function(){

  },
  //鑾峰彇鏄剧ず鏂囨湰鐨勫鍣�
  _getTitleContainer : function(){
    return  this.get('el');
  },
  //璁剧疆鏂囨湰
  _uiSetTitle : function(title){
    var _self = this,
      titleTpl = _self.get('titleTpl'),
      container = _self._getTitleContainer(),
      titleEl = _self.get('titleEl'),
      tem;
    if(titleEl){
      titleEl.remove();
    }
    title = title || '';
    if(BUI.isString(title)){
      title = {title : title};
    }
    tem = BUI.substitute(titleTpl,title);
    titleEl = $(tem).appendTo(container);
    _self.set('titleEl',titleEl);
  },
  //璁剧疆瀵归綈鏍峰紡
  _uiSetAlignType : function(type,ev){
    var _self = this;
    if(ev && ev.prevVal){
      _self.get('el').removeClass(CLS_ALIGN_PREFIX + ev.prevVal);
    }
    if(type){
      _self.get('el').addClass(CLS_ALIGN_PREFIX + type);
    }
  }
},{
  ATTRS : {
    title : {},
    titleEl : {},
    alignType : {}
  }
},{
  xclass : 'tooltip-view'
});

/**
 * @class BUI.Tooltip.Tip
 * @extends BUI.Overlay.Overlay
 * 绠€鏄撶殑鎻愮ず淇℃伅
 * 
 * ** 浣犲彲浠ョ畝鍗曠殑浣跨敤鍗曚釜tip **
 * <pre><code>
 * BUI.use('bui/tooltip',function (Tooltip) {
 *  //涓嶄娇鐢ㄦā鏉跨殑锛屽乏渚ф樉绀�
 *   var t1 = new Tooltip.Tip({
 *     trigger : '#t1',
 *     alignType : 'left', //鏂瑰悜
 *     showArrow : false, //涓嶆樉绀虹澶�
 *     offset : 5, //璺濈宸﹁竟鐨勮窛绂�
 *     title : '鏃犱换浣曟牱寮忥紝<br>宸﹁竟鐨勬彁绀轰俊鎭�'
 *   });
 *   t1.render();
 *  });
 * </code></pre>
 *
 * ** 涔熷彲浠ラ厤缃ā鏉� **
 * <pre><code>
 * BUI.use('bui/tooltip',function (Tooltip) {
 *  //浣跨敤妯℃澘鐨勶紝宸︿晶鏄剧ず
 *   var t1 = new Tooltip.Tip({
 *     trigger : '#t1',
 *     alignType : 'left', //鏂瑰悜
 *     titleTpl : '&lt;span class="x-icon x-icon-small x-icon-success"&gt;&lt;i class="icon icon-white icon-question"&gt;&lt;/i&gt;&lt;/span&gt;\
 *     &lt;div class="tips-content"&gt;{title}&lt;/div&gt;',
 *     offset : 5, //璺濈宸﹁竟鐨勮窛绂�
 *     title : '鏃犱换浣曟牱寮忥紝&lt;br&gt;宸﹁竟鐨勬彁绀轰俊鎭�'
 *   });
 *   t1.render();
 *  });
 * </code></pre>
 */
var Tip = Overlay.Overlay.extend({
  //璁剧疆瀵归綈鏂瑰紡
  _uiSetAlignType : function(type){
    var _self = this,
      offset = _self.get('offset'),
      align = _self.get('align') || {},
      points = MAP_TYPES[type];
    if(points){
      align.points = points;
      if(offset){
        align.offset = getOffset(type,offset);
      }
      _self.set('align',align);
    }
  }
},{
  ATTRS : {
    //浣跨敤濮旀墭鐨勬柟寮忔樉绀烘彁绀轰俊鎭�
    delegateTrigger : {
      value : true
    },
    /**
     * 瀵归綈绫诲瀷锛屽寘鎷細 top,left,right,bottom鍥涚甯哥敤鏂瑰紡锛屽叾浠栧榻愭柟寮忥紝鍙互浣跨敤@see{BUI.Tooltip.Tip#property-align}灞炴€�
     * 
     * @type {String}
     */
    alignType : {
      view : true
    },
    /**
     * 鏄剧ず鐨勫唴瀹癸紝鏂囨湰鎴栬€呴敭鍊煎
     * <pre><code>
     *     var tip =  new Tip({
     *        title : {a : 'text a',b:'text b'}, //灞炴€ф槸瀵硅薄
     *        titleTpl : '<p>this is {a},because {b}</p>' // <p>this is text a,because text b</p>
     *      });
     * </code></pre>
     * @cfg {String|Object} title
     */
    /**
     * 鏄剧ず鐨勫唴瀹�
     * <pre><code>
     *  //璁剧疆鏂囨湰
     *  tip.set('title','new title');
     *
     *  //璁剧疆瀵硅薄
     *  tip.set('title',{a : 'a',b : 'b'})
     * </code></pre>
     * @type {Object}
     */
    title : {
      view : true
    },
    /**
     * 鏄剧ず瀵归綈绠ご
     * @override
     * @default true
     * @cfg {Boolean} [showArrow = true]
     */
    showArrow : {
      value : true
    },
    /**
     * 绠ご鏀剧疆鍦ㄧ殑浣嶇疆锛屾槸涓€涓€夋嫨鍣紝渚嬪 .arrow-wraper
     * <pre><code>
     *     new Tip({ //鍙互璁剧疆鏁翠釜鎺т欢鐨勬ā鏉�
     *       arrowContainer : '.arrow-wraper',
     *       tpl : '<div class="arrow-wraper"></div>'
     *     });
     *     
     *     new Tip({ //涔熷彲浠ヨ缃畉itle鐨勬ā鏉�
     *       arrowContainer : '.arrow-wraper',
     *       titleTpl : '<div class="arrow-wraper">{title}</div>'
     *     });
     * </code></pre>   
     * @cfg {String} arrowContainer
     */
    arrowContainer : {
      view : true
    },
    //鑷姩鏄剧ず
    autoHide : {
      value : true
    },
    //瑕嗙洊鑷姩闅愯棌绫诲瀷
    autoHideType : {
      value : 'leave'
    },
    /**
    * 鏄剧ず鐨則ip 璺濈瑙﹀彂鍣―om鐨勮窛绂�
    * <pre><code>
    *  var tip =  new Tip({
    *    title : {a : 'text a',b:'text b'}, //灞炴€ф槸瀵硅薄
    *    offset : 10, //璺濈
    *    titleTpl : '<p>this is {a},because {b}</p>' // <p>this is text a,because text b</p>
    *  });
    * </code></pre>
    * @cfg {Number} offset
    */
    offset : {
      value : 0
    },
    /**
     * 瑙﹀彂鏄剧ずtip鐨勪簨浠跺悕绉帮紝榛樿涓簃ouseover
     * @type {String}
     * @protected
     */
    triggerEvent : {
      value : 'mouseover'
    },
    /**
     * 鏄剧ず鏂囨湰鐨勬ā鏉�
     * <pre><code>
     *  var tip =  new Tip({
     *    title : {a : 'text a',b:'text b'}, //灞炴€ф槸瀵硅薄
     *    offset : 10, //璺濈
     *    titleTpl : '<p>this is {a},because {b}</p>' // <p>this is text a,because text b</p>
     *  });
     * </code></pre>
     * @type {String}
     */
    titleTpl : {
      view : true,
      value : '<span>{title}</span>'
    },
    xview : {
      value : TipView
    }
  }
},{
  xclass : 'tooltip'
});

Tip.View = TipView;

module.exports = Tip;

});
define("bui/tooltip/tips", ["bui/common","jquery","bui/overlay"], function(require, exports, module){
/**
 * @fileOverview 鎵归噺鏄剧ず鎻愮ず淇℃伅
 * @ignore
 */


//鏄惁json瀵硅薄鏋勬垚鐨勫瓧绗︿覆
function isObjectString(str){
  return /^{.*}$/.test(str);
}

var BUI = require("bui/common"),
  Tip = require("bui/tooltip/tip"),
  /**
   * @class BUI.Tooltip.Tips
   * 鎵归噺鏄剧ず鎻愮ず淇℃伅
   *  <pre><code>
   * BUI.use('bui/tooltip',function(){
   *   var tips = new Tooltip.Tips({
   *     tip : {
   *       trigger : '#t1 a', //鍑虹幇姝ゆ牱寮忕殑鍏冪礌鏄剧ずtip
   *       alignType : 'top', //榛樿鏂瑰悜
   *       elCls : 'tips tips-no-icon tip1',
   *       titleTpl : '&lt;span class="x-icon x-icon-small x-icon-success"&gt;&lt;i class="icon icon-white icon-question"&gt;&lt;/i&gt;&lt;/span&gt;\
 *           &lt;div class="tips-content"&gt;{title}&lt;/div&gt;',
   *       offset : 10 //璺濈宸﹁竟鐨勮窛绂�
   *     }
   *   });
   *   tips.render();
   * })
   * 
   * </code></pre>
   */
  Tips = function(config){
    Tips.superclass.constructor.call(this,config);
  };

Tips.ATTRS = {

  /**
   * 浣跨敤鐨勬彁绀烘帶浠舵垨鑰呴厤缃俊鎭� @see {BUI.Tooltip.Tip}
   * <pre><code>
   *    //涓嶄娇鐢ㄦā鏉跨殑锛屽乏渚ф樉绀�
   * var tips = new Tooltip.Tips({
   *   tip : {
   *     trigger : '#t1 a', //鍑虹幇姝ゆ牱寮忕殑鍏冪礌鏄剧ずtip
   *     alignType : 'top', //榛樿鏂瑰悜
   *     elCls : 'tips tips-no-icon tip1',
   *     offset : 10 //璺濈宸﹁竟鐨勮窛绂�
   *   }
   * });
   * tips.render();
   * </code></pre>
   * @cfg {BUI.Tooltip.Tip|Object} tip
   */
  /**
   * 浣跨敤鐨勬彁绀烘帶浠� @see {BUI.Tooltip.Tip}
   * <pre><code>
   *    var tip = tips.get('tip');
   * </code></pre>
   * @type {BUI.Tooltip.Tip}
   * @readOnly
   */
  tip : {

  },
  /**
   * 榛樿鐨勫榻愭柟寮�,濡傛灉涓嶆寚瀹歵ip鐨勫榻愭柟寮忥紝閭ｄ箞浣跨敤姝ゅ睘鎬�
   * <pre><code>
   * //涓嶄娇鐢ㄦā鏉跨殑锛屽乏渚ф樉绀�
   * var tips = new Tooltip.Tips({
   *   tip : {
   *     trigger : '#t1 a', //鍑虹幇姝ゆ牱寮忕殑鍏冪礌鏄剧ずtip
   *     defaultAlignType : 'top', //榛樿鏂瑰悜
   *     elCls : 'tips tips-no-icon tip1',
   *     offset : 10 //璺濈宸﹁竟鐨勮窛绂�
   *   }
   * });
   * tips.render();
   * </code></pre>
   * @cfg {Object} defaultAlignType
   */
  defaultAlignType : {

  }
};

BUI.extend(Tips,BUI.Base);

BUI.augment(Tips,{
  //鍒濆鍖�
  _init : function(){
    this._initDom();
    this._initEvent();
  },
  //鍒濆鍖朌OM
  _initDom : function(){
    var _self = this,
      tip = _self.get('tip'),
      defaultAlignType;
    if(tip && !tip.isController){
      defaultAlignType = tip.alignType; //璁剧疆榛樿鐨勫榻愭柟寮�
      tip = new Tip(tip);
      tip.render();
      _self.set('tip',tip);
      if(defaultAlignType){
        _self.set('defaultAlignType',defaultAlignType);
      }
    }
  },
  //鍒濆鍖栦簨浠�
  _initEvent : function(){
    var _self = this,
      tip = _self.get('tip');
    tip.on('triggerchange',function(ev){
      var curTrigger = ev.curTrigger;
      _self._replaceTitle(curTrigger);
      _self._setTitle(curTrigger,tip);
    });
  },
  //鏇挎崲鎺塼itle
  _replaceTitle : function(triggerEl){
    var title = triggerEl.attr('title');
    if(title){
      triggerEl.attr('data-title',title);
      triggerEl[0].removeAttribute('title');
    }
  },
  //璁剧疆title
  _setTitle : function(triggerEl,tip){
    var _self = this,
      title = triggerEl.attr('data-title'),
      alignType = triggerEl.attr('data-align') || _self.get('defaultAlignType');

    if(isObjectString(title)){
      title = BUI.JSON.looseParse(title);
    }
    tip.set('title',title);
    if(alignType){
      tip.set('alignType',alignType);
    }
  },
  /**
   * 娓叉煋鎻愮ず淇℃伅
   * @chainable
   */
  render : function(){
    this._init();
    return this;
  }
});

module.exports = Tips;

});

define("bui/grid", ["bui/common","jquery","bui/list","bui/data","bui/mask","bui/toolbar","bui/menu"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸鍛藉悕绌洪棿鍏ュ彛
 * @ignore
 */

var BUI = require("bui/common"),
  Grid = BUI.namespace('Grid');

BUI.mix(Grid, {
  SimpleGrid : require("bui/grid/simplegrid"),
  Grid : require("bui/grid/grid"),
  Column : require("bui/grid/column"),
  Header : require("bui/grid/header"),
  Format : require("bui/grid/format"),
  Plugins : require("bui/grid/plugins/base")
});

module.exports = Grid;

});
define("bui/grid/simplegrid", ["jquery","bui/common","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 绠€鍗曡〃鏍�,浠呯敤浜庡睍绀烘暟鎹�
 * @author dxq613@gmail.com
 * @ignore
 */
  
var $ = require("jquery"),
  BUI = require("bui/common"),
  List = require("bui/list"),
  Component = BUI.Component,
  UIBase = Component.UIBase,
  PREFIX = BUI.prefix,
  CLS_GRID = PREFIX + 'grid',
  CLS_GRID_ROW = CLS_GRID + '-row',
  CLS_ROW_ODD = PREFIX + 'grid-row-odd',
  CLS_ROW_EVEN = PREFIX + 'grid-row-even',
  CLS_GRID_BORDER = PREFIX + 'grid-border',
  CLS_ROW_FIRST = PREFIX + 'grid-row-first';


/**
 * 绠€鍗曡〃鏍肩殑瑙嗗浘绫�
 * @class BUI.Grid.SimpleGridView
 * @extends BUI.List.SimpleListView
 * @private
 */
var simpleGridView = List.SimpleListView.extend({
  /**
   * 璁剧疆鍒�
   * @internal 
   * @param {Array} columns 鍒楅泦鍚�
   */
  setColumns : function(columns){
    var _self = this,
      headerRowEl = _self.get('headerRowEl');

    columns = columns || _self.get('columns');
    //娓呯┖琛ㄥご
    headerRowEl.empty();

    BUI.each(columns,function(column){
      _self._createColumn(column,headerRowEl);
    });
  },
  //鍒涘缓鍒�
  _createColumn : function(column,parent){
    var _self = this,
      columnTpl = BUI.substitute(_self.get('columnTpl'),column);
    $(columnTpl).appendTo(parent);
  },
  /**
   * 鑾峰彇琛屾ā鏉�
   * @ignore
   */
  getItemTpl : function  (record,index) {
    var _self = this,
        columns = _self.get('columns'),
        rowTpl = _self.get('rowTpl'),
        oddCls = index % 2 === 0 ? CLS_ROW_ODD : CLS_ROW_EVEN,
        cellsTpl = [],
        rowEl;

    BUI.each(columns, function (column) {
        var dataIndex = column['dataIndex'];
        cellsTpl.push(_self._getCellTpl(column, dataIndex, record));
    });

    rowTpl = BUI.substitute(rowTpl,{cellsTpl:cellsTpl.join(''), oddCls:oddCls});
    return rowTpl;
  },
  //get cell template by config and record
  _getCellTpl:function (column, dataIndex, record) {
      var _self = this,
          renderer = column.renderer,
          text = renderer ? renderer(record[dataIndex], record) : record[dataIndex],
          cellTpl = _self.get('cellTpl');
      return BUI.substitute(cellTpl,{elCls : column.elCls,text:text});    
  },
  /**
   * 娓呴櫎鏁版嵁
   * @ignore
   */
  clearData : function(){
    var _self = this,
      tbodyEl = _self.get('itemContainer');
     tbodyEl.empty();
  },
  showData : function(data){

    var _self = this;
    BUI.each(data,function(record,index){
      _self._createRow(record,index);
    });
  },
  //璁剧疆鍗曞厓鏍艰竟妗�
  _uiSetInnerBorder : function(v){
      var _self = this,
          el = _self.get('el');
      if(v){
          el.addClass(CLS_GRID_BORDER);
      }else{
          el.removeClass(CLS_GRID_BORDER);
      }
  },
  _uiSetTableCls : function(v){
    var _self = this,
      tableEl = _self.get('el').find('table');
    tableEl.attr('class',v);
  }
},{
  ATTRS : {
    /**
     * @private
     * @ignore
     */
    headerRowEl : {
      valueFn :function(){
        var _self = this,
          thead = _self.get('el').find('thead');
        return thead.children('tr');
      }
    },
    /**
     * @private 
     * @ignore
     * @type {Object}
     */
    itemContainer :{
      valueFn :function(){
        return this.get('el').find('tbody');
      }
    },
    tableCls : {

    }
  }
},{
  xclass:'simple-grid-veiw'
});

/**
 * 绠€鍗曡〃鏍�
 * xclass:'simple-grid'
 * <pre><code>
 *  BUI.use('bui/grid',function(Grid){
 *     
 *    var columns = [{
 *             title : '琛ㄥご1(10%)',
 *             dataIndex :'a',
 *             width:'10%'
 *           },{
 *             id: '123',
 *             title : '琛ㄥご2(20%)',
 *             dataIndex :'b',
 *             width:'20%'
 *           },{
 *             title : '琛ㄥご3(70%)',
 *             dataIndex : 'c',
 *             width:'70%'
 *         }],
 *         data = [{a:'123'},{a:'cdd',b:'edd'},{a:'1333',c:'eee',d:2}];
 *
 *     var grid = new Grid.SimpleGrid({
 *       render:'#grid',
 *       columns : columns,
 *       items : data,
 *       idField : 'a'
 *     });
 *
 *     grid.render();
 *   });
 * </code></pre>
 * @class BUI.Grid.SimpleGrid
 * @extends BUI.List.SimpleList
 */
var simpleGrid = BUI.List.SimpleList.extend(
{
  renderUI : function(){
    this.get('view').setColumns();
  },
  /**
   * 缁戝畾浜嬩欢
   * @protected
   */
  bindUI : function(){
    var _self = this,
      itemCls = _self.get('itemCls'),
      hoverCls = itemCls + '-hover',
      el = _self.get('el');

    el.delegate('.'+itemCls,'mouseover',function(ev){
      var sender = $(ev.currentTarget);
      sender.addClass(hoverCls);
    }).delegate('.'+itemCls,'mouseout',function(ev){
      var sender = $(ev.currentTarget);
      sender.removeClass(hoverCls);
    });
  },
  /**
   * 鏄剧ず鏁版嵁
   * <pre><code>
   *   var data = [{},{}];
   *   grid.showData(data);
   *
   *   //绛夊悓
   *   grid.set('items',data);
   * </code></pre>
   * @param  {Array} data 瑕佹樉绀虹殑鏁版嵁
   */
  showData : function(data){
    this.clearData();
    //this.get('view').showData(data);
    this.set('items',data);
  },
  /**
   * 娓呴櫎鏁版嵁
   */
  clearData : function(){
    this.get('view').clearData();
  },
  _uiSetColumns : function(columns){
    var _self = this;

    //閲嶇疆鍒楋紝鍏堟竻绌烘暟鎹�
    _self.clearData();
    _self.get('view').setColumns(columns);
  }
},{
  ATTRS : 
  {
    /**
     * 琛ㄦ牸鍙偣鍑婚」鐨勬牱寮�
     * @protected
     * @type {String}
     */
    itemCls : {
      view:true,
      value : CLS_GRID_ROW
    },
    /**
     * 琛ㄦ牸搴旂敤鐨勬牱寮忥紝鏇存敼姝ゅ€硷紝鍒欎笉搴旂敤榛樿琛ㄦ牸鏍峰紡
     * <pre><code>
     * grid = new Grid.SimpleGrid({
     *   render:'#grid',
     *   columns : columns,
     *   innerBorder : false,
     *   tableCls:'table table-bordered table-striped', 
     *   store : store 
     * }); 
     * </code></pre>
     * @type {Object}
     */
    tableCls : {
      view : true,
      value : CLS_GRID + '-table'
    },
    /**
     * 鍒椾俊鎭�
     * @cfg {Array} columns
     */
    /**
     * 鍒椾俊鎭紝浠呮敮鎸佷互涓嬮厤缃」锛�
     * <ol>
     *   <li>title锛氭爣棰�</li>
     *   <li>elCls: 搴旂敤鍒版湰鍒楃殑鏍峰紡</li>
     *   <li>width锛氬搴︼紝鏁板瓧鎴栬€呯櫨鍒嗘瘮</li>
     *   <li>dataIndex: 瀛楁鍚�</li>
     *   <li>renderer: 娓叉煋鍑芥暟</li>
     * </ol>
     * 鍏蜂綋瀛楁鐨勮В閲婃竻鍙傜湅 锛� {@link BUI.Grid.Column}
     * @type {Array}
     */
    columns : {
      view : true,
      sync:false,
      value : []
    },
    /**
     * 妯℃澘
     * @protected
     */
    tpl:{
      view : true,
      value:'<table cellspacing="0" class="{tableCls}" cellpadding="0"><thead><tr></tr></thead><tbody></tbody></table>'
    },
    /**
     * 鍗曞厓鏍煎乏鍙充箣闂存槸鍚﹀嚭鐜拌竟妗�
     * <pre><code>
     * <pre><code>
     * grid = new Grid.SimpleGrid({
     *   render:'#grid',
     *   columns : columns,
     *   innerBorder : false,
     *   store : store 
     * }); 
     * </code></pre>
     * </code></pre>
     * @cfg {Boolean} [innerBorder=true]
     */
    /**
     * 鍗曞厓鏍煎乏鍙充箣闂存槸鍚﹀嚭鐜拌竟妗�
     * @type {Boolean}
     * @default true
     */
    innerBorder : {
        view:true,
        value : true
    },
    /**
     * 琛屾ā鐗�
     * @type {Object}
     */
    rowTpl:{
      view : true,
      value:'<tr class="' + CLS_GRID_ROW + ' {oddCls}">{cellsTpl}</tr>'
    },
    /**
     * 鍗曞厓鏍肩殑妯＄増
     * @type {String}
     */
    cellTpl:{
      view:true,
      value:'<td class="' + CLS_GRID + '-cell {elCls}"><div class="' + CLS_GRID + '-cell-inner"><span class="' + CLS_GRID + '-cell-text">{text}</span></div></td>'
    },
    /**
     * 鍒楃殑閰嶇疆妯＄増
     * @type {String}
     */
    columnTpl : {
      view:true,
      value : '<th class="' + CLS_GRID + '-hd {elCls}" width="{width}"><div class="' + CLS_GRID + '-hd-inner"><span class="' + CLS_GRID + '-hd-title">{title}</span></div></th>'
    },
    /**
     * @private
     */
    events :{ 

        value : {
          
        }
    },
    xview : {
      value : simpleGridView
    }
  }
},{
  xclass:'simple-grid'
});

simpleGrid.View = simpleGridView;

module.exports = simpleGrid;

});
define("bui/grid/grid", ["jquery","bui/common","bui/mask","bui/toolbar","bui/list","bui/data"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸
 * @ignore
 * @author dxq613@gmail.com
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  Mask = require("bui/mask"),
  UA = BUI.UA,
  Component = BUI.Component,
  toolbar = require("bui/toolbar"),
  List = require("bui/list"),
  Header = require("bui/grid/header"),
  Column = require("bui/grid/column");

function isPercent(str){
  if(BUI.isString(str)){
    return str.indexOf('%') !== -1;
  }
  return false;
}

var PREFIX = BUI.prefix,
  CLS_GRID_HEADER_CONTAINER = PREFIX + 'grid-header-container',
  CLS_GRID_BODY = PREFIX + 'grid-body',
  CLS_GRID_WITH = PREFIX + 'grid-width',
  CLS_GRID_HEIGHT = PREFIX + 'grid-height',
  CLS_GRID_BORDER = PREFIX + 'grid-border',
  CLS_GRID_TBAR = PREFIX + 'grid-tbar',
  CLS_GRID_BBAR = PREFIX + 'grid-bbar',
  CLS_BUTTON_BAR= PREFIX + 'grid-button-bar',
  CLS_GRID_STRIPE = PREFIX + 'grid-strip',
  CLS_GRID_ROW = PREFIX + 'grid-row',
  CLS_ROW_ODD = PREFIX + 'grid-row-odd',
  CLS_ROW_EVEN = PREFIX + 'grid-row-even',
  CLS_ROW_FIRST = PREFIX + 'grid-row-first',
  CLS_GRID_CELL = PREFIX + 'grid-cell',
  CLS_GRID_CELL_INNER = PREFIX + 'grid-cell-inner',
  CLS_TD_PREFIX = 'grid-td-',
  CLS_CELL_TEXT = PREFIX + 'grid-cell-text',
  CLS_CELL_EMPTY = PREFIX + 'grid-cell-empty',
  CLS_SCROLL_WITH = '17',
  CLS_HIDE = PREFIX + 'hidden',
  ATTR_COLUMN_FIELD = 'data-column-field',
  WIDTH_BORDER = 2,
  HEIGHT_BAR_PADDING = 1;  

function getInnerWidth(width){
  var _self = this;
    if(BUI.isNumber(width)){
      width -= WIDTH_BORDER;
    }
    return width;
}

/**
 * @class BUI.Grid.GridView
 * @private
 * @extends BUI.List.SimpleListView
 * 琛ㄦ牸鐨勮鍥惧眰
 */
var gridView = List.SimpleListView.extend({

  //璁剧疆 body鍜宼able鐨勬爣绛�
  renderUI : function(){
    var _self = this,
      el = _self.get('el'),
      bodyEl = el.find('.' + CLS_GRID_BODY);
    _self.set('bodyEl',bodyEl);
    _self._setTableTpl();
  },
  /**
   * 鑾峰彇琛屾ā鏉�
   * @ignore
   */
  getItemTpl : function  (record,index) {
    var _self = this,
      columns =  _self._getColumns(),
      tbodyEl = _self.get('tbodyEl'),
      rowTpl = _self.get('rowTpl'),
      oddCls = index % 2 === 0 ? CLS_ROW_ODD : CLS_ROW_EVEN,
      cellsTpl = [],
      rowEl;

    BUI.each(columns, function (column) {
      var dataIndex = column.get('dataIndex');
      cellsTpl.push(_self._getCellTpl(column, dataIndex, record,index));
    });

    if(_self.get('useEmptyCell') /*&& !_self.get('forceFit')*/){
      cellsTpl.push(_self._getEmptyCellTpl());
    }

    rowTpl = BUI.substitute(rowTpl,{cellsTpl:cellsTpl.join(''), oddCls:oddCls});
    return rowTpl;
  },
  /**
   * find the dom by the record in this component
   * @param {Object} record the record used to find row dom
   * @return jQuery
   */
  findRow:function (record) {
      var _self = this;
      return $(_self.findElement(record));
  },
  /**
   * find the cell dom by record and column id
   * @param {String} id the column id
   * @param {jQuery} rowEl the dom that showed in this component
   * @return  {jQuery}
   */
  findCell : function(id,rowEl){
    var cls = CLS_TD_PREFIX + id;
      return rowEl.find('.' + cls);
  },
  /**
   * 閲嶆柊鍒涘缓琛ㄦ牸鐨勯琛岋紝涓€鑸湪琛ㄦ牸鍒濆鍖栧畬鎴愬悗锛屾垨鑰呭垪鍙戠敓鏀瑰彉鏃�
   */
  resetHeaderRow:function () {
    if(!this.get('useHeaderRow')){
      return;
    }
    var _self = this,
      headerRowEl = _self.get('headerRowEl'),
      tbodyEl = _self.get('tbodyEl');
    if(headerRowEl){
      headerRowEl.remove();
    }
    headerRowEl = _self._createHeaderRow();
    headerRowEl.prependTo(tbodyEl);
    _self.set('headerRowEl', headerRowEl);
  },
  /**
   * when header's column width changed, column in this component changed followed
   * @ignore
   */
  resetColumnsWidth:function (column,width) {
    var _self = this,
      headerRowEl = _self.get('headerRowEl'),
      cell = _self.findCell(column.get('id'), headerRowEl);
    width = width || column.get('width');
    if (cell) {
      cell.width(width);
    }
    _self.setTableWidth();
  },
  //set table width
  setTableWidth:function (columnsWidth) {
    if(!columnsWidth && isPercent(this.get('width'))){
      this.get('tableEl').width('100%');
      return;
    }
    var _self = this,
      width = _self._getInnerWidth(),
      height = _self.get('height'),
      tableEl = _self.get('tableEl'),
      forceFit = _self.get('forceFit'),
      headerRowEl = _self.get('headerRowEl');
    //浣跨敤鐧惧垎姣旂殑瀹藉害锛屼笉杩涜璁＄畻
    if(!isPercent(columnsWidth)){
      
      columnsWidth = columnsWidth || _self._getColumnsWidth();
      if (!width) {
        return;
      }
      if (width >= columnsWidth) {
        columnsWidth = width;
        if (height) {
          var scrollWidth = (UA.ie == 6 || UA.ie == 7) ? CLS_SCROLL_WITH + 2 : CLS_SCROLL_WITH;
          columnsWidth = width - scrollWidth;
        }
      }
    }
    
    tableEl.width(columnsWidth);
  },
  /**
   * 琛ㄦ牸琛ㄤ綋鐨勫搴�
   * @param {Number} width 瀹藉害
   */
  setBodyWidth : function(width){
    var _self = this,
      bodyEl = _self.get('bodyEl');
    width = width || _self._getInnerWidth();
    bodyEl.width(width);

  },
  /**
   * 璁剧疆琛ㄤ綋楂樺害
   * @param {Number} height 楂樺害
   */
  setBodyHeight : function(height){
    var _self = this,
      bodyEl = _self.get('bodyEl'),
      bodyHeight = height,
      siblings = bodyEl.siblings();

    BUI.each(siblings,function(item){
      if($(item).css('display') !== 'none'){
        bodyHeight -= $(item).outerHeight();
      }
    });
    bodyEl.height(bodyHeight);
  },
  //show or hide column
  setColumnVisible:function (column) {
    var _self = this,
      hide = !column.get('visible'),
      colId = column.get('id'),
      tbodyEl = _self.get('tbodyEl'),
      cells = $('.' + CLS_TD_PREFIX + colId,tbodyEl);
    if (hide) {
      cells.hide();
    } else {
      cells.show();
    }
  },
  /**
   * 鏇存柊鏁版嵁
   * @param  {Object} record 鏇存柊鐨勬暟鎹�
   */
  updateItem : function(record){
    var _self = this, 
      items = _self.getItems(),
      index = BUI.Array.indexOf(record,items),
      columns = _self._getColumns(),
      element = null,
      tpl;
    if(index >=0 ){
      element = _self.findElement(record);

      BUI.each(columns,function(column){
        var cellEl = _self.findCell(column.get('id'),$(element)),
          innerEl = cellEl.find('.' + CLS_GRID_CELL_INNER),
          textTpl = _self._getCellText(column,record,index);
        innerEl.html(textTpl);
      });
      return element;
    }
  },
  /**
   * 鏄剧ず娌℃湁鏁版嵁鏃剁殑鎻愮ず淇℃伅
   */
  showEmptyText : function(){
    var _self = this,
      bodyEl = _self.get('bodyEl'),
      emptyDataTpl = _self.get('emptyDataTpl'),
      emptyEl = _self.get('emptyEl');
    if(emptyEl){
      emptyEl.remove();
    }
    var emptyEl = $(emptyDataTpl).appendTo(bodyEl);
    _self.set('emptyEl',emptyEl);
  },
  /**
   * 娓呴櫎娌℃湁鏁版嵁鏃剁殑鎻愮ず淇℃伅
   */
  clearEmptyText : function(){
     var _self = this,
      emptyEl = _self.get('emptyEl');
    if(emptyEl){
      emptyEl.remove();
    }
  },
  //璁剧疆绗竴琛岀┖鐧借锛屼笉鏄剧ず浠讳綍鏁版嵁锛屼粎鐢ㄤ簬璁剧疆鍒楃殑瀹藉害
  _createHeaderRow:function () {
    var _self = this,
        columns = _self._getColumns(),
        tbodyEl = _self.get('tbodyEl'),
        rowTpl = _self.get('headerRowTpl'),
        rowEl,
        cellsTpl = [];

    $.each(columns, function (index,column) {
      cellsTpl.push(_self._getHeaderCellTpl(column));
    });

    //if this component set width,add a empty column to fit row width
    if(_self.get('useEmptyCell')/* && !_self.get('forceFit')*/){
      cellsTpl.push(_self._getEmptyCellTpl());
    }
    rowTpl = BUI.substitute(rowTpl,{cellsTpl:cellsTpl.join('')});
    rowEl = $(rowTpl).appendTo(tbodyEl);
    return rowEl;
  },
  //get the sum of the columns' width
  _getColumnsWidth:function () {
    var _self = this,
      columns = _self.get('columns'),
      totalWidth = 0;

    BUI.each(columns, function (column) {
        if (column.get('visible')) {
            totalWidth += column.get('el').outerWidth();
        }
    });
    return totalWidth;
  },
  //鑾峰彇鍒楅泦鍚�
  _getColumns : function(){
    return this.get('columns');
  },
  //get cell text by record and column
  _getCellText:function (column, record,index) {
      var _self = this,
        dataIndex = column.get('dataIndex'),
        textTpl = column.get('cellTpl') || _self.get('cellTextTpl'),
        text = _self._getCellInnerText(column,dataIndex, record,index);
      return BUI.substitute(textTpl,{text:text, tips:_self._getTips(column, dataIndex, record)});
  },
  _getCellInnerText : function(column,dataIndex, record,index){
    //renderer 鏃跺彂鐢熼敊璇彲鑳芥€у緢楂�
    try{
      var _self = this,
        renderer = column.get('renderer'),
        text = renderer ? renderer(record[dataIndex], record,index) : record[dataIndex];
      return text == null ? '' : text;
    }catch(ex){
      throw 'column:' + column.get('title') +' fomat error!';
    }
  },
  //get cell template by config and record
  _getCellTpl:function (column, dataIndex, record,index) {
    var _self = this,
      cellText = _self._getCellText(column, record,index),
      cellTpl = _self.get('cellTpl');
    return BUI.substitute(cellTpl,{
      elCls : column.get('elCls'),
      id:column.get('id'),
      dataIndex:dataIndex,
      cellText:cellText,
      hideCls:!column.get('visible') ? CLS_HIDE : ''
    });
  },
  //鑾峰彇绌虹櫧鍗曞厓鏍肩殑妯℃澘
  _getEmptyCellTpl:function () {
    return '<td class="' + CLS_GRID_CELL + ' ' + CLS_CELL_EMPTY + '">&nbsp;</td>';
  },
  //鑾峰彇绌虹櫧琛屽崟鍏冩牸妯℃澘
  _getHeaderCellTpl:function (column) {
    var _self = this,
      headerCellTpl = _self.get('headerCellTpl');
    return BUI.substitute(headerCellTpl,{
      id:column.get('id'),
      width:column.get('width'),
      hideCls:!column.get('visible') ? CLS_HIDE : ''
    });
  },
  //鑾峰彇琛ㄦ牸鍐呭搴�
  _getInnerWidth : function(){
    return getInnerWidth(this.get('width'));
  },
  //get cell tips
  _getTips:function (column, dataIndex, record) {
    var showTip = column.get('showTip'),
        value = '';
    if (showTip) {
      value = record[dataIndex];
      if (BUI.isFunction(showTip)) {
        value = showTip(value, record);
      }
    }
    return value;
  },
  //璁剧疆鍗曞厓鏍艰竟妗�
  _uiSetInnerBorder : function(v){
    var _self = this,
      el = _self.get('el');
    if(v){
      el.addClass(CLS_GRID_BORDER);
    }else{
      el.removeClass(CLS_GRID_BORDER);
    }
  },
  //璁剧疆琛ㄦ牸妯℃澘
  _setTableTpl : function(tpl){
    var _self = this,
      bodyEl = _self.get('bodyEl');

    tpl = tpl || _self.get('tableTpl');
    $(tpl).appendTo(bodyEl);
    var tableEl = bodyEl.find('table'),
      tbodyEl = bodyEl.find('tbody');
      //headerRowEl = _self._createHeaderRow();
          
    _self.set('tableEl',tableEl);
    _self.set('tbodyEl',tbodyEl);
    //_self.set('headerRowEl', headerRowEl);
    _self.set('itemContainer',tbodyEl);
    _self._setTableCls(_self.get('tableCls'));
  },
  //璁剧疆table涓婄殑鏍峰紡
  _uiSetTableCls : function(v){
    this._setTableCls(v);
  },
  //when set grid's height,the scroll can effect the width of its body and header
  _uiSetHeight:function (h) {
    var _self = this,
      bodyEl = _self.get('bodyEl');
    _self.get('el').height(h);
    _self.get('el').addClass(CLS_GRID_HEIGHT);

  },
  _uiSetWidth:function (w) {
    var _self = this;
    _self.get('el').width(w);
    _self.setBodyWidth(_self._getInnerWidth(w));
    _self.get('el').addClass(CLS_GRID_WITH);
    
  },
  _uiSetStripeRows : function(v){
    var _self = this,
      method = v ? 'addClass' : 'removeClass';
    _self.get('el')[method](CLS_GRID_STRIPE);
  },
  _setTableCls : function(cls){
    var _self = this,
      tableEl = _self.get('tableEl');
    tableEl.attr('class',cls);
  }
},{
  ATTRS : {
    tableCls : {},
    bodyEl : {},
    tbodyEl : {},
    headerRowEl:{},
    tableEl : {},
    emptyEl : {}
  }
},{
  xclass : 'grid-view'
});

/**
 * @class BUI.Grid.Grid
 *
 * 琛ㄦ牸鎺т欢,琛ㄦ牸鎺т欢绫诲浘锛屼竴鑸儏鍐典笅閰嶅悎{@link BUI.Data.Store} 涓€璧蜂娇鐢�
 * <p>
 * <img src="../assets/img/class-grid.jpg"/>
 * </p>
 * <p>琛ㄦ牸鎻掍欢鐨勭被鍥撅細</p>
 * <p>
 * <img src="../assets/img/class-grid-plugins.jpg"/>
 * </p>
 *
 * <pre><code>
 *  BUI.use(['bui/grid','bui/data'],function(Grid,Data){
 *    var Grid = Grid,
 *      Store = Data.Store,
 *      columns = [{  //澹版槑鍒楁ā鍨�
 *          title : '琛ㄥご1(20%)',
 *          dataIndex :'a',
 *          width:'20%'
 *        },{
 *          id: '123',
 *          title : '琛ㄥご2(30%)',
 *          dataIndex :'b',
 *          width:'30%'
 *        },{
 *          title : '琛ㄥご3(50%)',
 *          dataIndex : 'c',
 *          width:'50%'
 *      }],
 *      data = [{a:'123'},{a:'cdd',b:'edd'},{a:'1333',c:'eee',d:2}]; //鏄剧ず鐨勬暟鎹�
 *
 *    var store = new Store({
 *        data : data,
 *        autoLoad:true
 *      }),
 *       grid = new Grid.Grid({
 *         render:'#grid',
 *         width:'100%',//杩欎釜灞炴€т竴瀹氳璁剧疆
 *         columns : columns,
 *         idField : 'a',
 *         store : store
 *       });
 *
 *     grid.render();
 *   });
 * </code></pre>
 * @extends BUI.List.SimpleList
 */
var grid = List.SimpleList.extend({
  /**
   * @protected
   * @ignore
   */
  createDom:function () {
    var _self = this,
          render = _self.get('render'),
          outerWidth = $(render).width(),
          width = _self.get('width');
          
    if(!width && outerWidth){
      var appendWidth = _self.getAppendWidth();
      _self.set('width',outerWidth - appendWidth);
    }

    // 鎻愬墠,涓€旇缃搴︽椂浼氬け璐ワ紒锛�
    if (_self.get('width')) {
        _self.get('el').addClass(CLS_GRID_WITH);
    }

    if (_self.get('height')) {
      _self.get('el').addClass(CLS_GRID_HEIGHT);
    }

    //鍥犱负鍐呴儴鐨勮竟璺濆奖鍝峢eader鐨刦orceFit璁＄畻锛屾墍浠ュ繀椤诲湪header璁＄畻forceFit鍓嶇疆姝ら」
    if(_self.get('innerBorder')){
        _self.get('el').addClass(CLS_GRID_BORDER);
    } 
  },
  /**
   * @protected
   * @ignore
   */
  renderUI : function(){
    var _self = this;
    _self._initHeader();
    _self._initBars();
    _self._initLoadMask();
    _self.get('view').resetHeaderRow();
  },
  /**
   * @private
   */
  bindUI:function () {
    var _self = this;
    _self._bindHeaderEvent();
    _self._bindBodyEvent();
    _self._bindItemsEvent();
  },
  /**
   * 娣诲姞鍒�
   * <pre><code>
   *   //娣诲姞鍒版渶鍚�
   *   grid.addColumn({title : 'new column',dataIndex : 'new',width:100});
   *   //娣诲姞鍒版渶鍓�
   *   grid.addColumn({title : 'new column',dataIndex : 'new',width:100},0);
   * </code></pre>
   * @param {Object|BUI.Grid.Column} column 鍒楃殑閰嶇疆锛屽垪绫荤殑瀹氫箟 {@link BUI.Grid.Column}
   * @param {Number} index 娣诲姞鍒扮殑浣嶇疆
   * @return {BUI.Grid.Column}
   */
  addColumn : function(column, index){
    var _self = this,
      header = _self.get('header');

    if(header){
      column = header.addColumn(column, index);
    }else{
      column = new Column(column);
      _self.get('columns').splice(index,0,column);
    }  
    return column;
  },
  /**
   * 娓呴櫎鏄剧ず鐨勬暟鎹�
   * <pre><code>
   *   grid.clearData();
   * </code></pre>       
   */
  clearData : function(){
    this.clearItems();
  },
  /**
   * 褰撳墠鏄剧ず鍦ㄨ〃鏍间腑鐨勬暟鎹�
   * @return {Array} 绾綍闆嗗悎
   * @private
   */
  getRecords : function(){
    return this.getItems();
  },
  /**
   * 浣跨敤绱㈠紩鎴栬€卛d鏌ユ壘鍒�
   * <pre><code>
   *  //璁剧疆鍒楃殑id,鍚﹀垯浼氳嚜鍔ㄧ敓鎴�
   *  {id : '1',title : '琛ㄥご',dataIndex : 'a'}
   *  //鑾峰彇鍒�
   *  var column = grid.findColumn('id');
   *  //鎿嶄綔鍒�
   *  column.set('visible',false);
   * </code></pre>
   * @param {String|Number} id|index  鏂囨湰鍊间唬琛ㄧ紪鍙凤紝鏁板瓧浠ｈ〃绱㈠紩
   */
  findColumn : function(id){
    var _self = this,
      header = _self.get('header');
    if(BUI.isNumber(id)){
      return header.getColumnByIndex(id);
    }else{
      return header.getColumnById(id);
    }
  },
  /**
   * 浣跨敤瀛楁鍚嶆煡鎵惧垪
   * <pre><code>
   * //璁剧疆鍒梔ataIndex
   *  {id : '1',title : '琛ㄥご',dataIndex : 'a'}
   *  //鑾峰彇鍒�
   *  var column = grid.findColumnByField('a');
   *  //鎿嶄綔鍒�
   *  column.set('visible',false);
   * </code></pre>
   * @param {String} field 鍒楃殑瀛楁鍚� dataIndex
   */
  findColumnByField : function(field){
    var _self = this,
      header = _self.get('header');
    return header.getColumn(function(column){
      return column.get('dataIndex') === field;
    });
  },
  /**
   * 鏍规嵁鍒楃殑Id鏌ユ壘瀵瑰簲鐨勫崟鍏冩牸
   * @param {String|Number} id 鍒梚d
   * @param {Object|jQuery} record 鏈瀵瑰簲鐨勮褰曪紝鎴栬€呮槸鏈鐨勶激锛辑瀵硅薄
   * @protected
   * @return  {jQuery}
   */
  findCell:function (id, record) {
      var _self = this,
          rowEl = null;
      if (record instanceof $) {
          rowEl = record;
      } else {
          rowEl = _self.findRow(record);
      }
      if (rowEl) {
          return _self.get('view').findCell(id, rowEl);
      }
      return null;
  },
  /**
   * find the dom by the record in this component
   * @param {Object} record the record used to find row dom
   * @protected
   * @return jQuery
   */
  findRow:function (record) {
      var _self = this;
      return _self.get('view').findRow(record);
  },
  /**
   * 绉婚櫎鍒�
   * <pre><code>
   *   var column = grid.findColumn('id');
   *   grid.removeColumn(column);
   * </code></pre>
   * @param {BUI.Grid.Column} column 瑕佺Щ闄ょ殑鍒�
   */
  removeColumn:function (column) {
    var _self = this;
      _self.get('header').removeColumn(column);
  },
  /**
   * 鏄剧ず鏁版嵁,褰撲笉浣跨敤store鏃讹紝鍙互鍗曠嫭鏄剧ず鏁版嵁
   * <pre><code>
   *   var data = [{},{}];
   *   grid.showData(data);
   * </code></pre>
   * @param  {Array} data 鏄剧ず鐨勬暟鎹泦鍚�
   */
  showData : function(data){
    var _self = this;
    _self.set('items',data);
  },
  /**
   * 閲嶇疆鍒楋紝褰撳垪鍙戠敓鏀瑰彉鏃跺悓姝OM鍜屾暟鎹�
   * @protected
   */
  resetColumns:function () {
    var _self = this,
        store = _self.get('store');
    //recreate the header row
    _self.get('view').resetHeaderRow();
    //show data
    if (store) {
        _self.onLoad();
    }
  },
  //when body scrolled,the other component of grid also scrolled
  _bindScrollEvent:function () {
    var _self = this,
      el = _self.get('el'),
      bodyEl = el.find('.' + CLS_GRID_BODY),
      header = _self.get('header');

    bodyEl.on('scroll', function () {
      var left = bodyEl.scrollLeft(),
          top = bodyEl.scrollTop();
      header.scrollTo({left:left, top:top});
      _self.fire('scroll', {scrollLeft:left, scrollTop:top,bodyWidth : bodyEl.width(),bodyHeight : bodyEl.height()});
    });
  },
  //bind header event,when column changed,followed this component
  _bindHeaderEvent:function () {
      var _self = this,
        header = _self.get('header'),
        view = _self.get('view'),
        store = _self.get('store');
      header.on('afterWidthChange', function (e) {
        var sender = e.target;
        if (sender !== header) {
            view.resetColumnsWidth(sender);
        }
      });

      header.on('afterSortStateChange', function (e) {
        var column = e.target,
            val = e.newVal;
        if (val && store) {
          store.sort(column.get('dataIndex'), column.get('sortState'));
        }
      });

      header.on('afterVisibleChange', function (e) {
        var sender = e.target;
        if (sender !== header) {
          view.setColumnVisible(sender);
          _self.fire('columnvisiblechange',{column:sender});
        }
      });

      header.on('click', function (e) {
        var sender = e.target;
        if (sender !== header) {
          _self.fire('columnclick',{column:sender,domTarget:e.domTarget});
        }
      });

      header.on('forceFitWidth', function () {
        if (_self.get('rendered')) {
            _self.resetColumns();
        }
      });

      header.on('add', function (e) {
        if (_self.get('rendered')) {
          _self.fire('columnadd',{column:e.column,index:e.index});
            _self.resetColumns();
        }
      });

      header.on('remove', function (e) {
        if (_self.get('rendered')) {
          _self.resetColumns();
          _self.fire('columnremoved',{column:e.column,index:e.index});
        }
      });

  },
  //when body scrolled, header can followed
  _bindBodyEvent:function () {
    var _self = this;
    _self._bindScrollEvent();       
  },
  //缁戝畾璁板綍DOM鐩稿叧鐨勪簨浠�
  _bindItemsEvent : function(){
    var _self = this,
      store = _self.get('store');

    _self.on('itemsshow',function(){
      _self.fire('aftershow');
    });

    _self.on('itemsclear',function(){
      _self.fire('clear');
    });

    _self.on('itemclick',function(ev){
      var target = ev.domTarget,
        record = ev.item,
        cell = $(target).closest('.' + CLS_GRID_CELL),
        rowEl = $(target).closest('.' + CLS_GRID_ROW),
        rst; //鐢ㄤ簬鏄惁闃绘浜嬩欢瑙﹀彂

      if(cell.length){
        rst = _self.fire('cellclick', {record:record, row:rowEl[0], cell:cell[0], field:cell.attr(ATTR_COLUMN_FIELD), domTarget:target,domEvent:ev.domEvent});
      }

      if(rst === false){
        return rst;
      }

      return _self.fire('rowclick', {record:record, row:rowEl[0], domTarget:target});
        
    });

    _self.on('itemunselected',function(ev){
      _self.fire('rowunselected',getEventObj(ev));
    });

    _self.on('itemselected',function(ev){
      _self.fire('rowselected',getEventObj(ev));
    });

    _self.on('itemrendered',function(ev){
      _self.fire('rowcreated',getEventObj(ev));
    });
    
    _self.on('itemremoved',function(ev){
      _self.fire('rowremoved',getEventObj(ev));
    });

    _self.on('itemupdated',function(ev){
      _self.fire('rowupdated',getEventObj(ev));
    });

    function getEventObj(ev){
      return {record : ev.item, row : ev.domTarget, domTarget : ev.domTarget};
    }
  },
  //鑾峰彇琛ㄦ牸鍐呴儴鐨勫搴︼紝鍙楄竟妗嗙殑褰卞搷锛�
  //鍐呴儴鐨勫搴︿笉鑳界瓑浜庤〃鏍煎搴�
  _getInnerWidth : function(width){
    width = width || this.get('width');
    return getInnerWidth(width);
  },
  //init header,if there is not a header property in config,instance it
  _initHeader:function () {
    var _self = this,
      header = _self.get('header'),
      container = _self.get('el').find('.'+ CLS_GRID_HEADER_CONTAINER);
    if (!header) {
      header = new Header({
        columns:_self.get('columns'),
        tableCls:_self.get('tableCls'),
        forceFit:_self.get('forceFit'),
        width:_self._getInnerWidth(),
        render: container,
        parent : _self
      }).render();
      //_self.addChild(header);
      _self.set('header', header);
    }
  },
  //鍒濆鍖� 涓婁笅宸ュ叿鏍�
  _initBars:function () {
    var _self = this,
        bbar = _self.get('bbar'),
        tbar = _self.get('tbar');
    _self._initBar(bbar, CLS_GRID_BBAR, 'bbar');
    _self._initBar(tbar, CLS_GRID_TBAR, 'tbar');
  },
  //set bar's elCls to identify top bar or bottom bar
  _initBar:function (bar, cls, name) {
    var _self = this,
      store = null,
      pagingBarCfg = null;
    if (bar) {
      //鏈寚瀹歺class,鍚屾椂涓嶆槸Controller鏃�
      if(!bar.xclass && !(bar instanceof Component.Controller)){
        bar.xclass = 'bar';
        bar.children = bar.children || [];

        if(bar.items){
          bar.children.push({
              xclass : 'bar',
              defaultChildClass : "bar-item-button",
              elCls : CLS_BUTTON_BAR,
              children : bar.items
          });
          bar.items=null;
        }

        // modify by fuzheng
        if(bar.pagingBar){
          store = _self.get('store');
          pagingBarCfg = {
            xclass : 'pagingbar',
            store : store,
            pageSize : store.pageSize
          };
          if(bar.pagingBar !== true){
            pagingBarCfg = BUI.merge(pagingBarCfg, bar.pagingBar);
          }
          bar.children.push(pagingBarCfg);
        }
      }
      if (bar.xclass) {
        var barContainer = _self.get('el').find('.' + cls);
        barContainer.show();
        bar.render = barContainer;
        //bar.parent=_self;
        bar.elTagName = 'div';
        bar.autoRender = true;
        bar = _self.addChild(bar); //Component.create(bar).create();
      }
      _self.set(name, bar);
    }
    return bar;
  },
  //when set 'loadMask = true' ,create a loadMask instance
  _initLoadMask:function () {
    var _self = this,
      loadMask = _self.get('loadMask');
    if (loadMask && !loadMask.show) {
      loadMask = new BUI.Mask.LoadMask({el:_self.get('el')});
      _self.set('loadMask', loadMask);
    }
  },
  //璋冩暣瀹藉害鏃讹紝璋冩暣鍐呴儴鎺т欢瀹藉害
  _uiSetWidth:function (w) {
    var _self = this;
    if (_self.get('rendered')) {
      if(!isPercent(w)){
        _self.get('header').set('width', _self._getInnerWidth(w));
      }else{
        _self.get('header').set('width','100%');
      }
      
    }
    _self.get('view').setTableWidth();
  },
  //璁剧疆鑷€傚簲瀹藉害
  _uiSetForceFit:function (v) {
    var _self = this;
    _self.get('header').set('forceFit', v);
  },
  //when set grid's height,the scroll can effect the width of its body and header
  _uiSetHeight:function (h,obj) {
    var _self = this,
      header = _self.get('header');
    _self.get('view').setBodyHeight(h);
    if (_self.get('rendered')) {
      if (_self.get('forceFit') && !obj.prevVal) {
        header.forceFitColumns();
        //寮鸿揩瀵归綈鏃讹紝鐢辨湭璁剧疆楂樺害鏀规垚璁剧疆楂樺害锛屽鍔犱簡17鍍忕礌鐨勬粴鍔ㄦ潯瀹藉害锛屾墍浠ラ噸缃〃鏍煎搴�
        _self.get('view').setTableWidth();
      }
      header.setTableWidth();
    }
    
  },
  /**
   * 鍔犺浇鏁版嵁
   * @protected
   */
  onLoad : function(){
    var _self = this,
      store = _self.get('store');
    grid.superclass.onLoad.call(this);
    if(_self.get('emptyDataTpl')){ //鍒濆鍖栫殑鏃跺€欎笉鏄剧ず绌虹櫧鏁版嵁鐨勬枃鏈�
      if(store && store.getCount() == 0){
        _self.get('view').showEmptyText();
      }else{
        _self.get('view').clearEmptyText();
      }
    }
  }
},{
  ATTRS : {
    /**
     * 琛ㄥご瀵硅薄
     * @type {BUI.Grid.Header}
     * @protected
     */
    header:{

    },
    /**
     * @see {BUI.Grid.Grid#tbar}
     * <pre><code>
     * grid = new Grid.Grid({
     *    render:'#grid',
     *    columns : columns,
     *    width : 700,
     *    forceFit : true,
     *    tbar:{ //娣诲姞銆佸垹闄�
     *        items : [{
     *          btnCls : 'button button-small',
     *          text : '<i class="icon-plus"></i>娣诲姞',
     *          listeners : {
     *            'click' : addFunction
     *          }
     *        },
     *        {
     *          btnCls : 'button button-small',
     *          text : '<i class="icon-remove"></i>鍒犻櫎',
     *          listeners : {
     *            'click' : delFunction
     *          }
     *        }]
     *    },
     *    store : store
     *  });
     *
     * grid.render();
     * </code></pre>
     * @cfg {Object|BUI.Toolbar.Bar} bbar
     */
    /**
     * @see {BUI.Grid.Grid#tbar}
     * @type {Object}
     * @ignore
     */
    bbar:{

    },
    itemCls : {
      value : CLS_GRID_ROW
    },
    /**
     * 鍒楃殑閰嶇疆 鐢ㄦ潵閰嶇疆 琛ㄥご 鍜� 琛ㄥ唴瀹广€倇@link BUI.Grid.Column}
     * @cfg {Array} columns
     */
    columns:{
      view : true,
      value:[]
    },
    /**
     * 寮鸿揩鍒楄嚜閫傚簲瀹藉害锛屽鏋滃垪瀹藉害澶т簬Grid鏁翠綋瀹藉害锛岀瓑姣斾緥缂╁噺锛屽惁鍒欑瓑姣斾緥澧炲姞
     * <pre><code>
     *  var grid = new Grid.Grid({
     *    render:'#grid',
     *    columns : columns,
     *    width : 700,
     *    forceFit : true, //鑷€傚簲瀹藉害
     *    store : store
     *  });
     * </code></pre>
     * @cfg {Boolean} [forceFit= false]
     */
    /**
     * 寮鸿揩鍒楄嚜閫傚簲瀹藉害锛屽鏋滃垪瀹藉害澶т簬Grid鏁翠綋瀹藉害锛岀瓑姣斾緥缂╁噺锛屽惁鍒欑瓑姣斾緥澧炲姞
     * <pre><code>
     *  grid.set('forceFit',true);
     * </code></pre>
     * @type {Boolean}
     * @default 'false'
     */
    forceFit:{
      sync:false,
      view : true,
      value:false
    },
    /**
     * 鏁版嵁涓虹┖鏃讹紝鏄剧ず鐨勬彁绀哄唴瀹�
     * <pre><code>
     *  var grid = new Grid({
     *   render:'#J_Grid4',
     *   columns : columns,
     *   store : store,
     *   emptyDataTpl : '&lt;div class="centered"&gt;&lt;img alt="Crying" src="http://img03.taobaocdn.com/tps/i3/T1amCdXhXqXXXXXXXX-60-67.png"&gt;&lt;h2&gt;鏌ヨ鐨勬暟鎹笉瀛樺湪&lt;/h2&gt;&lt;/div&gt;',
     *   width:'100%'
     *
     * });
     * 
     * grid.render();
     * </code></pre>
     ** @cfg {Object} emptyDataTpl
     */
    emptyDataTpl : {
      view : true
    },
    /**
     * 琛ㄦ牸棣栬璁板綍妯℃澘锛岄琛岃褰曪紝闅愯棌鏄剧ず锛岀敤浜庣‘瀹氳〃鏍煎悇鍒楃殑瀹藉害
     * @type {String}
     * @protected
     */
    headerRowTpl:{
      view:true,
      value:'<tr class="' + PREFIX + 'grid-header-row">{cellsTpl}</tr>'
    },
    /**
     * 琛ㄦ牸棣栬璁板綍鐨勫崟鍏冩牸妯℃澘
     * @protected
     * @type {String}
     */
    headerCellTpl:{
      view:true,
      value:'<td class="{hideCls} ' + CLS_TD_PREFIX + '{id}" width="{width}" style="height:0"></td>'
    },
    /**
     * 琛ㄦ牸鏁版嵁琛岀殑妯℃澘
     * @type {String}
     * @default  <pre>'&lt;tr class="' + CLS_GRID_ROW + ' {{oddCls}}"&gt;{{cellsTpl}}&lt;/tr&gt;'</pre>
     */
    rowTpl:{
      view:true,
      value:'<tr class="' + CLS_GRID_ROW + ' {oddCls}">{cellsTpl}</tr>'
    },
    /**
     * 鍗曞厓鏍肩殑妯℃澘
     * @type {String}
     * <pre>
     *     '&lt;td  class="' + CLS_GRID_CELL + ' grid-td-{{id}}" data-column-id="{{id}}" data-column-field = {{dataIndex}}&gt;'+
     *        '&lt;div class="' + CLS_GRID_CELL_INNER + '" &gt;{{cellText}}&lt;/div&gt;'+
     *    '&lt;/td&gt;'
     *</pre>
     */
    cellTpl:{
      view:true,
      value:'<td  class="{elCls} {hideCls} ' + CLS_GRID_CELL + ' ' + CLS_TD_PREFIX + '{id}" data-column-id="{id}" data-column-field = "{dataIndex}" >' +
          '<div class="' + CLS_GRID_CELL_INNER + '" >{cellText}</div>' +
          '</td>'

    },
    /**
     * 鍗曞厓鏍兼枃鏈殑妯℃澘
     * @default &lt;span class="' + CLS_CELL_TEXT + ' " title = "{{tips}}"&gt;{{text}}&lt;/span&gt;
     * @type {String}
     */
    cellTextTpl:{
      view:true,
      value:'<span class="' + CLS_CELL_TEXT + ' " title = "{tips}">{text}</span>'
    },
    /**
     * 浜嬩欢闆嗗悎
     * @type {Object}
     */
    events:{
      value:{
        /**
         * 鏄剧ず瀹屾暟鎹Е鍙�
         * @event
         */
        'aftershow' : false,
         /**
         * 琛ㄦ牸鐨勬暟鎹竻鐞嗗畬鎴愬悗
         * @event
         */
        'clear' : false,
        /**
         * 鐐瑰嚮鍗曞厓鏍兼椂瑙﹀彂,濡傛灉return false,鍒欎細闃绘 'rowclick' ,'rowselected','rowunselected'浜嬩欢
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Object} e.record 姝よ鐨勮褰�
         * @param {String} e.field 鐐瑰嚮鍗曞厓鏍煎垪瀵瑰簲鐨勫瓧娈靛悕绉�
         * @param {HTMLElement} e.row 鐐瑰嚮琛屽搴旂殑DOM
         * @param {HTMLElement} e.cell 鐐瑰嚮瀵瑰簲鐨勫崟鍏冩牸鐨凞OM
         * @param {HTMLElement} e.domTarget 鐐瑰嚮鐨凞OM
         * @param {jQuery.Event} e.domEvent 鐐瑰嚮鐨刯Query浜嬩欢
         */
        'cellclick' : false,
        /**
         * 鐐瑰嚮琛ㄥご
         * @event 
         * @param {jQuery.Event} e 浜嬩欢瀵硅薄
         * @param {BUI.Grid.Column} e.column 鍒楀璞�
         * @param {HTMLElement} e.domTarget 鐐瑰嚮鐨凞OM
         */
        'columnclick' : false,
        /**
         * 鐐瑰嚮琛屾椂瑙﹀彂锛屽鏋渞eturn false,鍒欎細闃绘'rowselected','rowunselected'浜嬩欢
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Object} e.record 姝よ鐨勮褰�
         * @param {HTMLElement} e.row 鐐瑰嚮琛屽搴旂殑DOM
         * @param {HTMLElement} e.domTarget 鐐瑰嚮鐨凞OM
         */
        'rowclick' : false,
        /**
         * 褰撲竴琛屾暟鎹樉绀哄湪琛ㄦ牸涓悗瑙﹀彂
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Object} e.record 姝よ鐨勮褰�
         * @param {HTMLElement} e.row 琛屽搴旂殑DOM
         * @param {HTMLElement} e.domTarget 姝や簨浠朵腑绛変簬琛屽搴旂殑DOM
         */
        'rowcreated' : false,
        /**
         * 绉婚櫎涓€琛岀殑DOM鍚庤Е鍙�
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Object} e.record 姝よ鐨勮褰�
         * @param {HTMLElement} e.row 琛屽搴旂殑DOM
         * @param {HTMLElement} e.domTarget 姝や簨浠朵腑绛変簬琛屽搴旂殑DOM
         */
        'rowremoved' : false,
        /**
         * 閫変腑涓€琛屾椂瑙﹀彂
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Object} e.record 姝よ鐨勮褰�
         * @param {HTMLElement} e.row 琛屽搴旂殑DOM
         * @param {HTMLElement} e.domTarget 姝や簨浠朵腑绛変簬琛屽搴旂殑DOM
         */
        'rowselected' : false,
        /**
         * 娓呴櫎閫変腑涓€琛屾椂瑙﹀彂锛屽彧鏈夊閫夋儏鍐典笅瑙﹀彂
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Object} e.record 姝よ鐨勮褰�
         * @param {HTMLElement} e.row 琛屽搴旂殑DOM
         * @param {HTMLElement} e.domTarget 姝や簨浠朵腑绛変簬琛屽搴旂殑DOM
         */
        'rowunselected' : false,
        /**
         * 琛ㄦ牸鍐呴儴鍙戠敓婊氬姩鏃惰Е鍙�
         * @event
         * @param {jQuery.Event} e  浜嬩欢瀵硅薄
         * @param {Number} e.scrollLeft 婊氬姩鍒扮殑妯潗鏍�
         * @param {Number} e.scrollTop 婊氬姩鍒扮殑绾靛潗鏍�
         * @param {Number} e.bodyWidth 琛ㄦ牸鍐呴儴鐨勫搴�
         * @param {Number} e.bodyHeight 琛ㄦ牸鍐呴儴鐨勯珮搴�
         */
        'scroll' : false
      }
    },
    /**
     * 鏄惁濂囧伓琛屾坊鍔犲垎鍓茶壊
     * @type {Boolean}
     * @default true
     */
    stripeRows:{
      view:true,
      value:true
    },
    /**
     * 椤跺眰鐨勫伐鍏锋爮锛岃窡bbar缁撴瀯涓€鑷�,鍙互鏄伐鍏锋爮瀵硅薄@see {BUI.Toolbar.Bar},涔熷彲浠ユ槸xclass褰㈠紡鐨勯厤缃」锛�
     * 杩樺彲浠ユ槸鍖呭惈浠ヤ笅瀛楁鐨勯厤缃」
     * <ol>
     * <li>items:宸ュ叿鏍忕殑椤癸紝
     *    - 榛樿鏄寜閽�(xtype : button)銆�
     *    - 鏂囨湰(xtype : text)銆�
     *    - 閾炬帴(xtype : link)銆�
     *    - 鍒嗛殧绗�(bar-item-separator)浠ュ強鑷畾涔夐」
     * </li>
     * <li>pagingBar:琛ㄦ槑鍖呭惈鍒嗛〉鏍�</li>
     * </ol>
     * @type {Object|BUI.Toolbar.Bar}
     * @example
     * tbar:{
     *     items:[
     *         {
     *             text:'鍛戒护涓€' //榛樿鏄寜閽�
     *             
     *         },
     *         {
     *             xtype:'text',
     *             text:'鏂囨湰'
     *         }
     *     ],
     *     pagingBar:true
     * }
     */
    tbar:{

    },
    /**
     * 鍙互闄勫姞鍒拌〃鏍间笂鐨勬牱寮�.
     * @cfg {String} tableCls
     * @default 'bui-grid-table' this css cannot be overridden
     */
    tableCls:{
      view : true,
      sync : false,
      value:PREFIX + 'grid-table'
    },
    /**
     * 琛ㄤ綋鐨勬ā鏉�
     * @protected
     * @type {String}
     */
    tableTpl : {
      view:true,
      value:'<table cellspacing="0" cellpadding="0" >' +
          '<tbody></tbody>' +
          '</table>'
    },
    tpl : {
      value : '<div class="'+CLS_GRID_TBAR+'" style="display:none"></div><div class="'+CLS_GRID_HEADER_CONTAINER+'"></div><div class="'+CLS_GRID_BODY+'"></div><div style="display:none" class="' + CLS_GRID_BBAR + '"></div>'
    },
    /**
     * 鍗曞厓鏍煎乏鍙充箣闂存槸鍚﹀嚭鐜拌竟妗�
     * 
     * @cfg {Boolean} [innerBorder=true]
     */
    /**
     * 鍗曞厓鏍煎乏鍙充箣闂存槸鍚﹀嚭鐜拌竟妗�
     * <pre><code>
     *   var  grid = new Grid.Grid({
     *     render:'#grid',
     *     innerBorder: false, // 榛樿涓簍rue
     *     columns : columns,
     *     store : store
     *   });
     * </code></pre>
     * @type {Boolean}
     * @default true
     */
    innerBorder : {
      sync:false,
      value : true
    },
    /**
     * 鏄惁浣跨敤绌虹櫧鍗曞厓鏍肩敤浜庡崰浣嶏紝浣垮垪瀹界瓑浜庤缃殑瀹藉害
     * @type {Boolean}
     * @private
     */
    useEmptyCell : {
      view : true,
      value : true
    },
    /**
     * 鏄惁棣栬浣跨敤绌虹櫧琛岋紝鐢ㄤ互纭畾琛ㄦ牸鍒楃殑瀹藉害
     * @type {Boolean}
     * @private
     */
    useHeaderRow : {
      view : true,
      value : true
    },
    /**
     * Grid 鐨勮鍥剧被鍨�
     * @type {BUI.Grid.GridView}
     */
    xview : {
      value : gridView
    }
  }
},{
  xclass : 'grid'
});

grid.View = gridView;

module.exports = grid;

/**
 * @ignore
 * 2013.1.18 
 *   杩欐槸涓€涓噸鏋勭殑鐗堟湰锛屽皢Body鍙栨秷鎺変簡锛岀洰鐨勬槸涓轰簡鍙互灏咷rid鍜孲impleGrid鑱旂郴璧锋潵锛�
 *   鍚屾椂灏唖election 缁熶竴         
 */

});
define("bui/grid/header", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸鐨勫ご閮�
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  Grid = BUI.namespace('Grid'),
  Column = require("bui/grid/column"),
  View = BUI.Component.View,
  Controller = BUI.Component.Controller,
  CLS_SCROLL_WITH = 17,
  UA = BUI.UA;

/**
* 琛ㄦ牸鎺т欢涓〃澶寸殑瑙嗗浘绫�
* @class BUI.Grid.HeaderView
* @extends BUI.Component.View
* @private
*/
var headerView = View.extend({

  /**
   * @see {Component.Render#getContentElement}
   * @ignore
   */
  getContentElement:function () {
    return this.get('el').find('tr');
  },
  scrollTo:function (obj) {
    var _self = this,
        el = _self.get('el');
    if (obj.top !== undefined) {
        el.scrollTop(obj.top);
    }
    if (obj.left !== undefined) {
        el.scrollLeft(obj.left);
    }
  },
  _uiSetTableCls : function(v){
    var _self = this,
      tableEl = _self.get('el').find('table');
    tableEl.attr('class',v);
  }
}, {
  ATTRS:{
    emptyCellEl:{},
    tableCls : {

    }
  }
},{
  xclass : 'header-view'
});
/**
 * Container which holds headers and is docked at the top or bottom of a Grid.
 * The HeaderContainer drives resizing/moving/hiding of columns within the GridView.
 * As headers are hidden, moved or resized,
 * the header container is responsible for triggering changes within the view.
 * If you are not in the writing plugins, don't direct manipulation this control.
 * @class BUI.Grid.Header
 * @protected
 * xclass:'grid-header'
 * @extends BUI.Component.Controller
 */
var header = Controller.extend(
  {
    /**
     * add a columns to header
     * @param {Object|BUI.Grid.Column} c The column object or column config.
     * @index {Number} index The position of the column in a header,0 based.
     */
    addColumn:function (c, index) {
      var _self = this,
        insertIndex = index,
        columns = _self.get('columns');
      c = _self._createColumn(c);
      if (index === undefined) {
        index = columns.length;
        insertIndex = _self.get('children').length - 1;
      }
      columns.splice(index, 0, c);
      _self.addChild(c, insertIndex);
      _self.fire('add', {column:c, index:index});
      return c;
    },
    /**
     * remove a columns from header
     * @param {BUI.Grid.Column|Number} c is The column object or The position of the column in a header,0 based.
     */
    removeColumn:function (c) {
      var _self = this,
          columns = _self.get('columns'),
          index;
      c = BUI.isNumber(c) ? columns[c] : c;
      index = BUI.Array.indexOf(c, columns);
      columns.splice(index, 1);
      _self.fire('remove', {column:c, index:index});
      return _self.removeChild(c, true);
    },
    /**
     * For overridden.
     * @see Component.Controller#bindUI
     */
    bindUI:function () {
      var _self = this;
      _self._bindColumnsEvent();
    },
    /*
     * For overridden.
     * @protected
     *
     */
    initializer:function () {
      var _self = this,
          children = _self.get('children'),
          columns = _self.get('columns'),
          emptyColumn;
      $.each(columns, function (index,item) {
          var columnControl = _self._createColumn(item);
          children[index] = columnControl;
          columns[index] = columnControl;
      });
      //if(!_self.get('forceFit')){
        emptyColumn = _self._createEmptyColumn();
        children.push(emptyColumn);
        _self.set('emptyColumn',emptyColumn);
      //}
      
    },
    /**
     * get the columns of this header,the result equals the 'children' property .
     * @return {Array} columns
     * @example var columns = header.getColumns();
     *    <br>or<br>
     * var columns = header.get('children');
     */
    getColumns:function () {
      return this.get('columns');
    },
    /**
     * Obtain the sum of the width of all columns
     * @return {Number}
     */
    getColumnsWidth:function () {
      var _self = this,
        columns = _self.getColumns(),
        totalWidth = 0;

      $.each(columns, function (index,column) {
        if (column.get('visible')) {
          totalWidth += column.get('el').outerWidth();//column.get('width')
        }
      });
      return totalWidth;
    },
    getColumnOriginWidth : function(){
      var _self = this,
        columns = _self.getColumns(),
        totalWidth = 0;

      $.each(columns, function (index,column) {
        if (column.get('visible')) {
          var width = column.get('originWidth') || column.get('width');
          totalWidth += width;
        }
      });
      return totalWidth;
    },
    /**
     * get {@link BUI.Grid.Column} instance by index,when column moved ,the index changed.
     * @param {Number} index The index of columns
     * @return {BUI.Grid.Column} the column in the header,if the index outof the range,the result is null
     */
    getColumnByIndex:function (index) {
      var _self = this,
        columns = _self.getColumns(),
        result = columns[index];
      return result;
    },
    /**
     * 鏌ユ壘鍒�
     * @param  {Function} func 鍖归厤鍑芥暟锛宖unction(column){}
     * @return {BUI.Grid.Column}  鏌ユ壘鍒扮殑鍒�
     */
    getColumn:function (func) {
      var _self = this,
        columns = _self.getColumns(),
        result = null;
      $.each(columns, function (index,column) {
        if (func(column)) {
            result = column;
            return false;
        }
      });
      return result;
    },
    /**
     * get {@link BUI.Grid.Column} instance by id,when column rendered ,this id can't to be changed
     * @param {String|Number}id The id of columns
     * @return {BUI.Grid.Column} the column in the header,if the index out of the range,the result is null
     */
    getColumnById:function (id) {
      var _self = this;
      return _self.getColumn(function(column){
        return column.get('id') === id;
      });
    },
    /**
     * get {@link BUI.Grid.Column} instance's index,when column moved ,the index changed.
     * @param {BUI.Grid.Column} column The instance of column
     * @return {Number} the index of column in the header,if the column not in the header,the index is -1
     */
    getColumnIndex:function (column) {
      var _self = this,
          columns = _self.getColumns();
      return BUI.Array.indexOf(column, columns);
    },
    /**
     * move the header followed by body's or document's scrolling
     * @param {Object} obj the scroll object which has two value:top(scrollTop),left(scrollLeft)
     */
    scrollTo:function (obj) {
      this.get('view').scrollTo(obj);
    },
    //when column's event fire ,this header must handle them.
    _bindColumnsEvent:function () {
      var _self = this;

      _self.on('afterWidthChange', function (e) {
        var sender = e.target;
        if (sender !== _self) {
            _self.setTableWidth();
        }
      });
      _self.on('afterVisibleChange', function (e) {
        var sender = e.target;
        if (sender !== _self) {
            _self.setTableWidth();
        }
      });
      _self.on('afterSortStateChange', function (e) {
        var sender = e.target,
          columns = _self.getColumns(),
          val = e.newVal;
        if (val) {
          $.each(columns, function (index,column) {
              if (column !== sender) {
                  column.set('sortState', '');
              }
          });
        }
      });

      _self.on('add',function(){
        _self.setTableWidth();
      });
      _self.on('remove',function(){
        _self.setTableWidth();
      });
    },
    //create the column control
    _createColumn:function (cfg) {
      if (cfg instanceof Column) {
        return cfg;
      }
      if (!cfg.id) {
        cfg.id = BUI.guid('col');
      }
      return new Column(cfg);
    },
    _createEmptyColumn:function () {
      return new Column.Empty();
    },
    //when set grid's height, scroll bar emerged.
    _isAllowScrollLeft:function () {
      var _self = this,
        parent = _self.get('parent');

      return parent && !!parent.get('height');
    },
    /**
     * force every column fit the table's width
     */
    forceFitColumns:function () {
        
      var _self = this,
        columns = _self.getColumns(),
        width = _self.get('width'),
        totalWidth = width,
        totalColumnsWidth = _self.getColumnOriginWidth(),
				realWidth = 0,
				appendWidth = 0,
				lastShowColumn = null,
        allowScroll = _self._isAllowScrollLeft();

			/**
			* @private
			*/
			function setColoumnWidthSilent(column,colWidth){
				var columnEl = column.get('el');
				column.set('width',colWidth , {
					silent:1
				});
				columnEl.width(colWidth);
			}
      //if there is not a width config of grid ,The forceFit action can't work
      if (width) {
        if (allowScroll) {
          width -= CLS_SCROLL_WITH;
          totalWidth = width;
        }

        var adjustCount = 0;

        $.each(columns, function (index,column) {
          if (column.get('visible') && column.get('resizable')) {
            adjustCount++;
          }
          if (column.get('visible') && !column.get('resizable')) {
            var colWidth = column.get('el').outerWidth();
            totalWidth -= colWidth;
            totalColumnsWidth -= colWidth;
          }
        });

        var colWidth = Math.floor(totalWidth / adjustCount),
            ratio = totalWidth / totalColumnsWidth;
        if(ratio ===1){
          return;
        }
        $.each(columns, function (index,column) {
          if (column.get('visible') && column.get('resizable')) {

            var borderWidth = _self._getColumnBorderWith(column,index),
                originWidth = column.get('originWidth');
            if(!originWidth){
                column.set('originWidth',column.get('width'));
                originWidth = column.get('width');
            }
            colWidth = Math.floor((originWidth + borderWidth) * ratio);
               /* parseInt(columnEl.css('border-left-width')) || 0 +
                    parseInt(columnEl.css('border-right-width')) || 0;*/
            // 锛� note
            //
            // 浼氬啀璋冪敤 setTableWidth锛� 寰幆璋冪敤 || 
            setColoumnWidthSilent(column,colWidth - borderWidth);
						realWidth += colWidth;
						lastShowColumn = column;
          }
        });

				if(lastShowColumn){
					appendWidth = totalWidth - realWidth;
					setColoumnWidthSilent(lastShowColumn,lastShowColumn.get('width') + appendWidth);
				}

        _self.fire('forceFitWidth');
      }

    },
    _getColumnBorderWith : function(column,index){
      //chrome 涓媌order-left-width鍙栫殑鍊间笉灏忔暟锛屾墍浠ユ殏鏃朵娇鐢ㄥ浐瀹氳竟妗�
      //绗竴涓竟妗嗘棤瀹藉害锛宨e 涓嬩粛鐒跺瓨鍦˙ug锛屾墍浠ュ仛ie 鐨勫吋瀹�
      var columnEl = column.get('el'),
        borderWidth = Math.round(parseFloat(columnEl.css('border-left-width')) || 0)  + 
             Math.round(parseFloat(columnEl.css('border-right-width')) || 0);
      
      borderWidth = UA.ie && UA.ie < 8 ? (index === 0 ? 1 : borderWidth) : borderWidth;
      return borderWidth;                   
    },
    /**
     * set the header's inner table's width
     */
    setTableWidth:function () {
      var _self = this,
        width = _self.get('width'),
        totalWidth = 0,
        emptyColumn = null;
      if(width == 'auto'){
        //_self.get('el').find('table').width()
        return;
      }
      if(_self.get('forceFit')) {
        _self.forceFitColumns();
      }else if(_self._isAllowScrollLeft()){
        totalWidth = _self.getColumnsWidth();
        emptyColumn = _self.get('emptyColumn');
        if(width < totalWidth){
            emptyColumn.get('el').width(CLS_SCROLL_WITH);
        }else{
            emptyColumn.get('el').width('auto');
        }
      }
    },
    //when header's width changed, it also effects its columns.
    _uiSetWidth:function () {
      var _self = this;
      _self.setTableWidth();
    },
    _uiSetForceFit:function (v) {
      var _self = this;
      if (v) {
        _self.setTableWidth();
      }
    }

  }, {
    ATTRS:
    {
      /**
       * 鍒楅泦鍚�
       * @type {Array}
       */
      columns:{
          value:[]
      },
      /**
       * @private
       */
      emptyColumn:{

      },
      /**
       * 鏄惁鍙互鑾峰彇鐒︾偣
       * @protected
       */
      focusable:{
          value:false
      },
      /**
       * true to force the columns to fit into the available width. Headers are first sized according to configuration, whether that be a specific width, or flex.
       * Then they are all proportionally changed in width so that the entire content width is used.
       * @type {Boolean}
       * @default 'false'
       */
      forceFit:{
          sync:false,
          view:true,
          value:false
      },
      /**
       * 琛ㄥご鐨勬ā鐗�
       * @type {String}
       */
      tpl : {

        view : true,
        value : '<table cellspacing="0" class="' + PREFIX + 'grid-table" cellpadding="0">' +
        '<thead><tr></tr></thead>' +
        '</table>'
      },
      /**
       * 琛ㄦ牸搴旂敤鐨勬牱寮�.
       */
      tableCls:{
          view:true
      },
      /**
       * @private
       */
      xview:{
          value:headerView
      },
      /**
       * the collection of header's events
       * @type {Array}
       * @protected
       */
      events:{
        value:{
        /**
         * @event
         * 娣诲姞鍒楁椂瑙﹀彂
         * @param {jQuery.Event} e the event object
         * @param {BUI.Grid.Column} e.column which column added
         * @param {Number} index the add column's index in this header
         *
         */
            'add' : false,
        /**
         * @event
         * 绉婚櫎鍒楁椂瑙﹀彂
         * @param {jQuery.Event} e the event object
         * @param {BUI.Grid.Column} e.column which column removed
         * @param {Number} index the removed column's index in this header
         */
            'remove' : false
        }
      } 
    }
  }, {
    xclass:'grid-header',
    priority:1
  });

module.exports = header;

});
define("bui/grid/column", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview This class specifies the definition for a column of a grid.
 * @author dxq613@gmail.com
 * @ignore
 */


var	$ = require("jquery"),
    BUI = require("bui/common"),
    PREFIX = BUI.prefix,
	CLS_HD_TITLE = PREFIX + 'grid-hd-title',
    CLS_OPEN = PREFIX + 'grid-hd-open',
    SORT_PREFIX = 'sort-',
    SORT_ASC = 'ASC',
    SORT_DESC = 'DESC',
    CLS_TRIGGER = PREFIX + 'grid-hd-menu-trigger',
    CLS_HD_TRIGGER = 'grid-hd-menu-trigger';

/**
* 琛ㄦ牸鍒楃殑瑙嗗浘绫�
* @class BUI.Grid.ColumnView
* @extends BUI.Component.View
* @private
*/
var columnView = BUI.Component.View.extend({

	/**
	* @protected
    * @ignore
	*/
	setTplContent : function(attrs){
		var _self = this,
			sortTpl = _self.get('sortTpl'),
            triggerTpl = _self.get('triggerTpl'),
			el = _self.get('el'),
            titleEl;

		columnView.superclass.setTplContent.call(_self,attrs);
        titleEl = el.find('.' + CLS_HD_TITLE);
		$(sortTpl).insertAfter(titleEl);
        $(triggerTpl).insertAfter(titleEl);

	},
    //use template to fill the column
    _setContent:function () {
       this.setTplContent();
    },
    _uiSetShowMenu : function(v){
        var _self = this,
            triggerTpl = _self.get('triggerTpl'),
            el = _self.get('el'),
            titleEl = el.find('.' + CLS_HD_TITLE);
        if(v){
            $(triggerTpl).insertAfter(titleEl);
        }else{
            el.find('.' + CLS_TRIGGER).remove();
        }   
    },
    //set the title of column
    _uiSetTitle:function (title) {
        if (!this.get('rendered')) {
            return;
        }
        this._setContent();
    },
    //set the draggable of column
    _uiSetDraggable:function (v) {
        if (!this.get('rendered')) {
            return;
        }
        this._setContent();
    },
    //set the sortableof column
    _uiSetSortable:function (v) {

        if (!this.get('rendered')) {
            return;
        }
        this._setContent();
    },
    //set the template of column
    _uiSetTpl:function (v) {
        if (!this.get('rendered')) {
            return;
        }
        this._setContent();
    },
    //set the sort state of column
    _uiSetSortState:function (v) {
        var _self = this,
            el = _self.get('el'),
            method = v ? 'addClass' : 'removeClass',
            ascCls = SORT_PREFIX + 'asc',
            desCls = SORT_PREFIX + 'desc';
        el.removeClass(ascCls + ' ' + desCls);
        if (v === 'ASC') {
            el.addClass(ascCls);
        } else if (v === 'DESC') {
            el.addClass(desCls);
        }
    },
    //灞曞紑琛ㄥご
    _uiSetOpen : function (v) {
        var _self = this,
            el = _self.get('el');
        if(v){
            el.addClass(CLS_OPEN);
        }else{
            el.removeClass(CLS_OPEN);
        }
    }
}, {
    ATTRS:{
        
        /**
         * @private
         */
        sortTpl : {
            view: true,
            getter: function(){
                var _self = this,
                    sortable = _self.get('sortable');
                if(sortable){
                    return '<span class="' + PREFIX + 'grid-sort-icon">&nbsp;</span>';
                }
                return '';
            }
        },
        tpl:{
        }
    }
});

/**
 * 琛ㄦ牸鐨勫垪瀵硅薄锛屽瓨鍌ㄥ垪淇℃伅锛屾瀵硅薄涓嶄細鐢辩敤鎴峰垱寤猴紝鑰屾槸閰嶇疆鍦℅rid涓�
 * xclass:'grid-column'
 * <pre><code>
 * columns = [{
 *        title : '琛ㄥご1',
 *        dataIndex :'a',
 *        width:100
 *      },{
 *        title : '琛ㄥご2',
 *        dataIndex :'b',
 *        visible : false, //闅愯棌
 *        width:200
 *      },{
 *        title : '琛ㄥご3',
 *        dataIndex : 'c',
 *        width:200
 *    }];
 * </code></pre>
 * @class BUI.Grid.Column
 * @extends BUI.Component.Controller
 */
var column = BUI.Component.Controller.extend(
    {    //toggle sort state of this column ,if no sort state set 'ASC',else toggle 'ASC' and 'DESC'
        _toggleSortState:function () {
            var _self = this,
                sortState = _self.get('sortState'),
                v = sortState ? (sortState === SORT_ASC ? SORT_DESC : SORT_ASC) : SORT_ASC;
            _self.set('sortState', v);
        },
        /**
         * {BUI.Component.Controller#performActionInternal}
         * @ignore
         */
        performActionInternal:function (ev) {
            var _self = this,
                sender = $(ev.target),
                prefix = _self.get('prefixCls');
            if (sender.hasClass(prefix + CLS_HD_TRIGGER)) {

            } else {
                if (_self.get('sortable')) {
                    _self._toggleSortState();
                }
            }
            //_self.fire('click',{domTarget:ev.target});
        },
        _uiSetWidth : function(v){
            if(v){
                this.set('originWidth',v);
            }
        }
    }, {
        ATTRS:
        {
            /**
             * The tag name of the rendered column
             * @private
             */
            elTagName:{
                value:'th'
            },
            /**
             * 琛ㄥご灞曞紑鏄剧ず鑿滃崟锛�
             * @type {Boolean}
             * @protected
             */
            open : {
                view : true,
                value : false
            },
            /**
             * 姝ゅ垪瀵瑰簲鏄剧ず鏁版嵁鐨勫瓧娈靛悕绉�
             * <pre><code>
             * {
             *     title : '琛ㄥご1',
             *     dataIndex :'a', //瀵瑰簲鐨勬暟鎹殑瀛楁鍚嶇О锛屽 锛� {a:'123',b:'456'}
             *     width:100
             * }
             * </code></pre>
             * @cfg {String} dataIndex
             */
            /**
             * 姝ゅ垪瀵瑰簲鏄剧ず鏁版嵁鐨勫瓧娈靛悕绉�
             * @type {String}
             * @default {String} empty string
             */
            dataIndex:{
                view:true,
                value:''
            },
            /**
             * 鏄惁鍙嫋鎷斤紝鏆傛椂鏈敮鎸�
             * @private
             * @type {Boolean}
             * @defalut true
             */
            draggable:{
				sync:false,
                view:true,
                value:true
            },
            /**
             * 缂栬緫鍣�,鐢ㄤ簬鍙紪杈戣〃鏍间腑<br>
             * ** 甯哥敤缂栬緫鍣� **
             *  - xtype 鎸囩殑鏄〃鍗曞瓧娈电殑绫诲瀷 {@link BUI.Form.Field}
             *  - 鍏朵粬鐨勯厤缃」瀵瑰簲浜庤〃鍗曞瓧娈电殑閰嶇疆椤�
             * <pre><code>
             * columns = [
             *   {title : '鏂囨湰',dataIndex :'a',editor : {xtype : 'text'}}, 
             *   {title : '鏁板瓧', dataIndex :'b',editor : {xtype : 'number',rules : {required : true}}},
             *   {title : '鏃ユ湡',dataIndex :'c', editor : {xtype : 'date'},renderer : Grid.Format.dateRenderer},
             *   {title : '鍗曢€�',dataIndex : 'd', editor : {xtype :'select',items : enumObj},renderer : Grid.Format.enumRenderer(enumObj)},
             *   {title : '澶氶€�',dataIndex : 'e', editor : {xtype :'select',select:{multipleSelect : true},items : enumObj},
             *       renderer : Grid.Format.multipleItemsRenderer(enumObj)
             *   }
             * ]
             * </code></pre>
             * @type {Object}
             */
            editor:{

            },
            /**
             * 鏄惁鍙互鑾峰彇鐒︾偣
             * @protected
             */
            focusable:{
                value:false
            },
            /**
             * 鍥哄畾鍒�,涓昏鐢ㄤ簬鍦ㄩ琛屾樉绀轰竴浜涚壒娈婂唴瀹癸紝濡傚崟閫夋锛屽閫夋锛屽簭鍙风瓑銆傛彃浠朵笉鑳藉姝ゅ垪杩涜鐗规畩鎿嶄綔锛屽锛氱Щ鍔ㄤ綅缃紝闅愯棌绛�
             * @cfg {Boolean} fixed
             */
            fixed : {
                value : false
            },
            /**
             * 鎺т欢鐨勭紪鍙�
             * @cfg {String} id
             */
            id:{

            },
            /**
             * 娓叉煋琛ㄦ牸鍗曞厓鏍肩殑鏍煎紡鍖栧嚱鏁�
             * "function(value,obj,index){return value;}"
             * <pre><code>
             * {title : '鎿嶄綔',renderer : function(){
             *     return '<span class="grid-command btn-edit">缂栬緫</span>'
             *   }}
             * </code></pre>
             * @cfg {Function} renderer
             */
            renderer:{

            },
            /**
             * 鏄惁鍙互璋冩暣瀹藉害锛屽簲鐢ㄤ簬鎷栨嫿鎴栬€呰嚜閫傚簲瀹藉害鏃�
             * @type {Boolean}
             * @protected
             * @default true
             */
            resizable:{
                value:true
            },
            /**
             * 鏄惁鍙互鎸夌収姝ゅ垪鎺掑簭锛屽鏋滆缃畉rue,閭ｄ箞鐐瑰嚮鍒楀ご鏃�
             * <pre><code>
             *     {title : '鏁板瓧', dataIndex :'b',sortable : false},
             * </code></pre>
             * @cfg {Boolean} [sortable=true]
             */
            sortable:{
				sync:false,
                view:true,
                value:true
            },
            /**
             * 鎺掑簭鐘舵€侊紝褰撳墠鎺掑簭鏄寜鐓у崌搴忋€侀檷搴忋€傛湁3绉嶅€� null, 'ASC','DESC'
             * @type {String}
             * @protected
             * @default null
             */
            sortState:{
                view:true,
                value:null
            },
            /**
             * 鍒楁爣棰�
             * @cfg {String} [title=&#160;]
             */
            /**
             * 鍒楁爣棰�
             * <pre><code>
             * var column = grid.findColumn('id');
             * column.get('title');
             * </code></pre>
             * Note: to have a clickable header with no text displayed you can use the default of &#160; aka &nbsp;.
             * @type {String}
             * @default {String} &#160;
             */
            title:{
				sync:false,
                view:true,
                value:'&#160;'
            },

            /**
             * 鍒楃殑瀹藉害,鍙互浣挎暟瀛楁垨鑰呯櫨鍒嗘瘮,涓嶈浣跨敤 width : '100'鎴栬€厀idth : '100px'
             * <pre><code>
             *  {title : '鏂囨湰',width:100,dataIndex :'a',editor : {xtype : 'text'}}
             *  
             *  {title : '鏂囨湰',width:'10%',dataIndex :'a',editor : {xtype : 'text'}}
             * </code></pre>
             * @cfg {Number} [width = 80]
             */
            
            /**
             * 鍒楀搴�
             * <pre><code>
             *  grid.findColumn(id).set('width',200);
             * </code></pre>
             * 
             * @type {Number}
             */
            width:{
                value:100
            },
            /**
             * 鏄惁鏄剧ず鑿滃崟
             * @cfg {Boolean} [showMenu=false]
             */
            /**
             * 鏄惁鏄剧ず鑿滃崟
             * @type {Boolean}
             * @default false
             */
            showMenu:{
                view:true,
                value:false
            },
            /**
             * @private
             * @type {Object}
             */
            triggerTpl:{
				view:true,
                value:'<span class="' + CLS_TRIGGER + '"></span>'
                
            },
            /**
             * An template used to create the internal structure inside this Component's encapsulating Element.
             * User can use the syntax of KISSY 's template component.
             * Only in the configuration of the column can set this property.
             * @type {String}
             */
            tpl:{
				sync:false,
                view:true,
                value:'<div class="' + PREFIX + 'grid-hd-inner">' +
                    '<span class="' + CLS_HD_TITLE + '">{title}</span>' +
                    '</div>'
            },
            /**
             * 鍗曞厓鏍肩殑妯℃澘锛屽湪鍒椾笂璁剧疆鍗曞厓鏍肩殑妯℃澘锛屽彲浠ュ湪娓叉煋鍗曞厓鏍兼椂浣跨敤锛屾洿鏀瑰崟鍏冩牸鐨勫唴瀹�
             * @cfg {String} cellTpl
             */
            /**
             * 鍗曞厓鏍肩殑妯℃澘锛屽湪鍒椾笂璁剧疆鍗曞厓鏍肩殑妯℃澘锛屽彲浠ュ湪娓叉煋鍗曞厓鏍兼椂浣跨敤锛屾洿鏀瑰崟鍏冩牸鐨勫唴瀹�
             * @type {String}
             */
            cellTpl:{
                value:''
            },
            /**
             * the collection of column's events
             * @protected
             * @type {Array}
             */
            events:{
                value:{
                /**
                 * @event
                 * Fires when this column's width changed
                 * @param {jQuery.Event} e the event object
                 * @param {BUI.Grid.Column} target
                 */
                    'afterWidthChange' : true,
                /**
                 * @event
                 * Fires when this column's sort changed
                 * @param {jQuery.Event} e the event object
                 * @param {BUI.Grid.Column} e.target
                 */
                    'afterSortStateChange' : true,
                /**
                 * @event
                 * Fires when this column's hide or show
                 * @param {jQuery.Event} e the event object
                 * @param {BUI.Grid.Column} e.target
                 */
                    'afterVisibleChange' : true,
                /**
                 * @event
                 * Fires when use clicks the column
                 * @param {jQuery.Event} e the event object
                 * @param {BUI.Grid.Column} e.target
                 * @param {HTMLElement} domTarget the dom target of this event
                 */
                    'click' : true,
                /**
                 * @event
                 * Fires after the component is resized.
                 * @param {BUI.Grid.Column} target
                 * @param {Number} adjWidth The box-adjusted width that was set
                 * @param {Number} adjHeight The box-adjusted height that was set
                 */
                    'resize' : true,
                /**
                 * @event
                 * Fires after the component is moved.
                 * @param {jQuery.Event} e the event object
                 * @param {BUI.Grid.Column} e.target
                 * @param {Number} x The new x position
                 * @param {Number} y The new y position
                 */
                    'move' : true
                }
            },
            /**
             * @private
             */
            xview:{
                value:columnView
            }

        }
    }, {
        xclass:'grid-hd',
        priority:1
    });

column.Empty = column.extend({

}, {
    ATTRS:{
        type:{
            value:'empty'
        },
        sortable:{
            view:true,
            value:false
        },
        width:{
            view:true,
            value:null
        },
        tpl:{
            view:true,
            value:'<div class="' + PREFIX + 'grid-hd-inner"></div>'
        }
    }
}, {
    xclass:'grid-hd-empty',
    priority:1
});

module.exports = column;

});
define("bui/grid/format", ["jquery"], function(require, exports, module){
/**
 * @fileOverview this class details some util tools of grid,like loadMask, formatter for grid's cell render
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */

var $ = require("jquery");

function formatTimeUnit(v) {
    if (v < 10) {
        return '0' + v;
    }
    return v;
}

/**
 * This class specifies some formatter for grid's cell renderer
 * @class BUI.Grid.Format
 * @singleton
 */
var Format =
{
    /**
     * 鏃ユ湡鏍煎紡鍖栧嚱鏁�
     * @param {Number|Date} d 鏍煎紡璇濈殑鏃ユ湡锛屼竴鑸负1970 骞� 1 鏈� 1 鏃ヨ嚦浠婄殑姣鏁�
     * @return {String} 鏍煎紡鍖栧悗鐨勬棩鏈熸牸寮忎负 2011-10-31
     * @example
     * 涓€鑸敤娉曪細<br>
     * BUI.Grid.Format.dateRenderer(1320049890544);杈撳嚭锛�2011-10-31 <br>
     * 琛ㄦ牸涓敤浜庢覆鏌撳垪锛�<br>
     * {title:"鍑哄簱鏃ユ湡",dataIndex:"date",renderer:BUI.Grid.Format.dateRenderer}
     */
    dateRenderer:function (d) {
        if (!d) {
            return '';
        }
        if (BUI.isString(d)) {
            return d;
        }
        var date = null;
        try {
            date = new Date(d);
        } catch (e) {
            return '';
        }
        if (!date || !date.getFullYear) {
            return '';
        }
        return date.getFullYear() + '-' + formatTimeUnit(date.getMonth() + 1) + '-' + formatTimeUnit(date.getDate());
    },
    /**
     * @description 鏃ユ湡鏃堕棿鏍煎紡鍖栧嚱鏁�
     * @param {Number|Date} d 鏍煎紡璇濈殑鏃ユ湡锛屼竴鑸负1970 骞� 1 鏈� 1 鏃ヨ嚦浠婄殑姣鏁�
     * @return {String} 鏍煎紡鍖栧悗鐨勬棩鏈熸牸寮忔椂闂翠负 2011-10-31 16 : 41 : 02
     */
    datetimeRenderer:function (d) {
        if (!d) {
            return '';
        }
        if (BUI.isString(d)) {
            return d;
        }
        var date = null;
        try {
            date = new Date(d);
        } catch (e) {
            return '';
        }
        if (!date || !date.getFullYear) {
            return '';
        }
        return date.getFullYear() + '-' + formatTimeUnit(date.getMonth() + 1) + '-' + formatTimeUnit(date.getDate()) + ' ' + formatTimeUnit(date.getHours()) + ':' + formatTimeUnit(date.getMinutes()) + ':' + formatTimeUnit(date.getSeconds());
    },
    /**
     * 鏂囨湰鎴彇鍑芥暟锛屽綋鏂囨湰瓒呭嚭涓€瀹氭暟瀛楁椂锛屼細鎴彇鏂囨湰锛屾坊鍔�...
     * @param {Number} length 鎴彇澶氬皯瀛楃
     * @return {Function} 杩斿洖澶勭悊鍑芥暟 杩斿洖鎴彇鍚庣殑瀛楃涓诧紝濡傛灉鏈韩灏忎簬鎸囧畾鐨勬暟瀛楋紝杩斿洖鍘熷瓧绗︿覆銆傚鏋滃ぇ浜庯紝鍒欒繑鍥炴埅鏂悗鐨勫瓧绗︿覆锛屽苟闄勫姞...
     */
    cutTextRenderer:function (length) {
        return function (value) {
            value = value || '';
            if (value.toString().length > length) {
                return value.toString().substring(0, length) + '...';
            }
            return value;
        };
    },
    /**
     * 鏋氫妇鏍煎紡鍖栧嚱鏁�
     * @param {Object} enumObj 閿€煎鐨勬灇涓惧璞� {"1":"澶�","2":"灏�"}
     * @return {Function} 杩斿洖鎸囧畾鏋氫妇鐨勬牸寮忓寲鍑芥暟
     * @example
     * //Grid 鐨勫垪瀹氫箟
     *  {title:"鐘舵€�",dataIndex:"status",renderer:BUI.Grid.Format.enumRenderer({"1":"鍏ュ簱","2":"鍑哄簱"})}
     */
    enumRenderer:function (enumObj) {
        return function (value) {
            return enumObj[value] || '';
        };
    },
    /**
     * 灏嗗涓€艰浆鎹㈡垚涓€涓瓧绗︿覆
     * @param {Object} enumObj 閿€煎鐨勬灇涓惧璞� {"1":"澶�","2":"灏�"}
     * @return {Function} 杩斿洖鎸囧畾鏋氫妇鐨勬牸寮忓寲鍑芥暟
     * @example
     * <code>
     *  //Grid 鐨勫垪瀹氫箟
     *  {title:"鐘舵€�",dataIndex:"status",renderer:BUI.Grid.Format.multipleItemsRenderer({"1":"鍏ュ簱","2":"鍑哄簱","3":"閫€璐�"})}
     *  //鏁版嵁婧愭槸[1,2] 鏃讹紝鍒欒繑鍥� "鍏ュ簱,鍑哄簱"
     * </code>
     */
    multipleItemsRenderer:function (enumObj) {
        var enumFun = Format.enumRenderer(enumObj);
        return function (values) {
            var result = [];
            if (!values) {
                return '';
            }
            if (!BUI.isArray(values)) {
                values = values.toString().split(',');
            }
            $.each(values, function (index,value) {
                result.push(enumFun(value));
            });

            return result.join(',');
        };
    },
    /**
     * 灏嗚储鍔℃暟鎹垎杞崲鎴愬厓
     * @param {Number|String} enumObj 閿€煎鐨勬灇涓惧璞� {"1":"澶�","2":"灏�"}
     * @return {Number} 杩斿洖灏嗗垎杞崲鎴愬厓鐨勬暟瀛�
     */
    moneyCentRenderer:function (v) {
        if (BUI.isString(v)) {
            v = parseFloat(v);
        }
        if ($.isNumberic(v)) {
            return (v * 0.01).toFixed(2);
        }
        return v;
    }
};

module.exports = Format;

});
define("bui/grid/plugins/base", ["bui/common","jquery","bui/menu"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸鎻掍欢鐨勫叆鍙�
 * @author dxq613@gmail.com, yiminghe@gmail.com
 * @ignore
 */
var BUI = require("bui/common"),
  Selection = require("bui/grid/plugins/selection"),

  Plugins = {};

  BUI.mix(Plugins,{
    CheckSelection : Selection.CheckSelection,
    RadioSelection : Selection.RadioSelection,
    Cascade : require("bui/grid/plugins/cascade"),
    CellEditing : require("bui/grid/plugins/cellediting"),
    RowEditing : require("bui/grid/plugins/rowediting"),
    DialogEditing : require("bui/grid/plugins/dialog"),
    AutoFit : require("bui/grid/plugins/autofit"),
    GridMenu : require("bui/grid/plugins/gridmenu"),
    Summary : require("bui/grid/plugins/summary"),
    RowNumber : require("bui/grid/plugins/rownumber"),
    ColumnGroup : require("bui/grid/plugins/columngroup"),
    RowGroup : require("bui/grid/plugins/rowgroup"),
    ColumnResize : require("bui/grid/plugins/columnresize"),
    ColumnChecked : require("bui/grid/plugins/columnchecked")

  });

module.exports = Plugins;

});
define("bui/grid/plugins/selection", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 閫夋嫨鐨勬彃浠�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  CLS_CHECKBOX = PREFIX + 'grid-checkBox',
  CLS_CHECK_ICON = 'x-grid-checkbox',
  CLS_RADIO = PREFIX + 'grid-radio';
  
/**
* 閫夋嫨琛屾彃浠�
* <pre><code>
** var store = new Store({
*       data : data,
*       autoLoad:true
*     }),
*     grid = new Grid.Grid({
*       render:'#grid',
*       columns : columns,
*       itemStatusFields : { //璁剧疆鏁版嵁璺熺姸鎬佺殑瀵瑰簲鍏崇郴
*         selected : 'selected',
*         disabled : 'disabled'
*       },
*       store : store,
*       plugins : [Grid.Plugins.CheckSelection] // 鎻掍欢褰㈠紡寮曞叆澶氶€夎〃鏍�
*      //multiSelect: true  // 鎺у埗琛ㄦ牸鏄惁鍙互澶氶€夛紝浣嗘槸杩欑鏂瑰紡娌℃湁鍓嶉潰鐨勫閫夋 榛樿涓篺alse
*     });
*
*   grid.render();
* </code></pre>
* @class BUI.Grid.Plugins.CheckSelection
* @extends BUI.Base
*/
function checkSelection(config){
  checkSelection.superclass.constructor.call(this, config);
}

BUI.extend(checkSelection,BUI.Base);

checkSelection.ATTRS = 
{
  /**
  * column's width which contains the checkbox
  */
  width : {
    value : 40
  },
  /**
  * @private
  */
  column : {
    
  },
  /**
  * @private
  * <input  class="' + CLS_CHECKBOX + '" type="checkbox">
  */
  cellInner : {
    value : '<div class="'+CLS_CHECKBOX+'-container"><span class="' + CLS_CHECK_ICON +'"></span></div>'
  }
};

BUI.augment(checkSelection, 
{
  createDom : function(grid){
    var _self = this;
    var cfg = {
          title : '',
          width : _self.get('width'),
          fixed : true,
          resizable:false,
          sortable : false,
          tpl : '<div class="' + PREFIX + 'grid-hd-inner">' + _self.get('cellInner') + '',
          cellTpl : _self.get('cellInner')
      },
      checkColumn = grid.addColumn(cfg,0);
    grid.set('multipleSelect',true);
    _self.set('column',checkColumn);
  },
  /**
  * @private
  */
  bindUI : function(grid){
    var _self = this,
      col = _self.get('column'),
      colEl = col.get('el'),
      checkBox = colEl.find('.' + CLS_CHECK_ICON);
    checkBox.on('click',function(){
      var checked = colEl.hasClass('checked');     
      if(!checked){
        grid.setAllSelection();
        colEl.addClass('checked');
      }else{
        grid.clearSelection();
        colEl.removeClass('checked');
      }
    });
    grid.on('rowunselected',function(e){
      
      colEl.removeClass('checked');
    });
    
    //娓呴櫎绾綍鏃跺彇鍏ㄩ€�
    grid.on('clear',function(){
      //checkBox.attr('checked',false);
      colEl.removeClass('checked');
    });
  }
});

/**
 * 琛ㄦ牸鍗曢€夋彃浠�
 * @class BUI.Grid.Plugins.RadioSelection
 * @extends BUI.Base
 */
var radioSelection = function(config){
  radioSelection.superclass.constructor.call(this, config);
};

BUI.extend(radioSelection,BUI.Base);

radioSelection.ATTRS = 
{
  /**
  * column's width which contains the checkbox
  */
  width : {
    value : 40
  },
  /**
  * @private
  */
  column : {
    
  },
  /**
  * @private
  */
  cellInner : {
    value : '<div class="' + PREFIX + 'grid-radio-container"><input  class="' + CLS_RADIO + '" type="radio"></div>'
  }
};

BUI.augment(radioSelection, {
  createDom : function(grid){
    var _self = this;
    var cfg = {
          title : '',
          width : _self.get('width'),
          resizable:false,
          fixed : true,
          sortable : false,
          cellTpl : _self.get('cellInner')
      },
      column = grid.addColumn(cfg,0);
    grid.set('multipleSelect',false);
    _self.set('column',column);
  },
  /**
  * @private
  */
  bindUI : function(grid){
    var _self = this;

    grid.on('rowselected',function(e){
      _self._setRowChecked(e.row,true);
    });

    grid.on('rowunselected',function(e){
      _self._setRowChecked(e.row,false);
    });
  },
  _setRowChecked : function(row,checked){
    var rowEl = $(row),
      radio = rowEl.find('.' + CLS_RADIO);
    radio.attr('checked',checked);
  }
});

/**
* @name BUI.Grid.Plugins
* @namespace 琛ㄦ牸鎻掍欢鍛藉悕绌洪棿
* @ignore
*/
var Selection  = {
  CheckSelection : checkSelection,
  RadioSelection : radioSelection
};

module.exports = Selection;

});
define("bui/grid/plugins/cascade", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 绾ц仈琛ㄦ牸
 * @ignore
 */


var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  CLS_GRID_CASCADE = '',
  DATA_RECORD = 'data-record',
  CLS_CASCADE = PREFIX + 'grid-cascade',
  CLS_CASCADE_EXPAND = CLS_CASCADE + '-expand',
  CLS_CASCADE_ROW = CLS_CASCADE + '-row',
  CLS_CASCADE_CELL = CLS_CASCADE + '-cell',
  CLS_CASCADE_ROW_COLLAPSE = CLS_CASCADE + '-collapse';

/**
 * 绾ц仈琛ㄦ牸
 * <pre><code>
 *  // 瀹炰緥鍖� Grid.Plugins.Cascade 鎻掍欢
 *    var cascade = new Grid.Plugins.Cascade({
 *      renderer : function(record){
 *        return '<div style="padding: 10px 20px;"><h2>璇︽儏淇℃伅</h2><p>' + record.detail + '</p></div>';
 *      }
 *    });
 *    var store = new Store({
 *        data : data,
 *        autoLoad:true
 *      }),
 *      grid = new Grid.Grid({
 *        render:'#grid',
 *        columns : columns,
 *        store: store,
 *        plugins: [cascade]  // Grid.Plugins.Cascade 鎻掍欢
 *      });
 *
 *    grid.render();
 *    
 *    cascade.expandAll();//灞曞紑鎵€鏈�
 * </code></pre>
 * @class BUI.Grid.Plugins.Cascade
 * @extends BUI.Base
 */
var cascade = function(config){
  cascade.superclass.constructor.call(this, config);
};

BUI.extend(cascade,BUI.Base);

cascade.ATTRS = 
{
  /**
   * 鏄剧ず灞曞紑鎸夐挳鍒楃殑瀹藉害
   * @cfg {Number} width
   */
  /**
   * 鏄剧ず灞曞紑鎸夐挳鍒楃殑瀹藉害
   * @type {Number}
   * @default 40
   */
  width:{
    value:40
  },
  /**
   * 灞曞紑鍒楃殑榛樿鍐呭
   * @type {String}
   * @protected
   */
  cellInner:{
    value:'<span class="' + CLS_CASCADE + '"><i class="' + CLS_CASCADE + '-icon"></i></span>'
  },
  /**
   * 灞曞紑琛岀殑妯＄増
   * @protected
   * @type {String}
   */
  rowTpl : {
    value:'<tr class="' + CLS_CASCADE_ROW + '"><td class="'+ CLS_CASCADE_CELL + '"></td></tr>'
  },
  /**
   * 鐢熸垚绾ц仈鍒楁椂闇€瑕佹覆鏌撶殑鍐呭
   * @cfg {Function} renderer
   */
  /**
   * 鐢熸垚绾ц仈鍒楁椂闇€瑕佹覆鏌撶殑鍐呭
   * @type {Function}
   */
  renderer:{

  },
  events : [
    /**
     * 灞曞紑绾ц仈鍐呭鏃惰Е鍙�
     * @name  BUI.Grid.Plugins.Cascade#expand
     * @event
     * @param {jQuery.Event} e  浜嬩欢瀵硅薄
     * @param {Object} e.record 绾ц仈鍐呭瀵瑰簲鐨勭邯褰�
     * @param {HTMLElement} e.row 绾ц仈鐨勮DOM
     */
    'expand',
    /**
     * 鎶樺彔绾ц仈鍐呭鏃惰Е鍙�
     * @name  BUI.Grid.Plugins.Cascade#collapse
     * @event
     * @param {jQuery.Event} e  浜嬩欢瀵硅薄
     * @param {Object} e.record 绾ц仈鍐呭瀵瑰簲鐨勭邯褰�
     * @param {HTMLElement} e.row 绾ц仈鐨勮DOM
     */
    'collapse',
    /**
     * 鍒犻櫎绾ц仈鍐呭鏃惰Е鍙�
     * @name  BUI.Grid.Plugins.Cascade#removed
     * @event
     * @param {jQuery.Event} e  浜嬩欢瀵硅薄
     * @param {Object} e.record 绾ц仈鍐呭瀵瑰簲鐨勭邯褰�
     * @param {HTMLElement} e.row 绾ц仈鐨勮DOM
     */
    'removed'
  ]
};

BUI.augment(cascade,
{
  /**
   * 鍒濆鍖�
   * @protected
   */
  initializer:function(grid){
    var _self = this;
    var cfg = {
          title : '',
          elCls:'center',//灞呬腑瀵归綈
          width : _self.get('width'),
          resizable:false,
          fixed : true,
          sortable : false,
          cellTpl : _self.get('cellInner')
      },
      expandColumn = grid.addColumn(cfg,0);
    //鍒椾箣闂寸殑绾垮幓鎺�
    grid.set('innerBorder',false);

    _self.set('grid',grid);
  },
  /**
   * 缁戝畾浜嬩欢
   * @protected
   */
  bindUI:function(grid){
    var _self = this;
    grid.on('cellclick',function(ev){
      var sender = $(ev.domTarget),
        cascadeEl = sender.closest('.' + CLS_CASCADE);
      //濡傛灉鐐瑰嚮灞曞紑銆佹姌鍙犳寜閽�
      if(cascadeEl.length){
        if(!cascadeEl.hasClass(CLS_CASCADE_EXPAND)){
          _self._onExpand(ev.record,ev.row,cascadeEl);
        }else{
          _self._onCollapse(ev.record,ev.row,cascadeEl);
        }
      }
    });

    grid.on('columnvisiblechange',function(){
      _self._resetColspan();
    });

    grid.on('rowremoved',function(ev){
      _self.remove(ev.record);
    });

    grid.on('clear',function(){
      _self.removeAll();
    });
  },
  /**
   * 灞曞紑鎵€鏈夌骇鑱旀暟鎹�
   * <pre><code>
   *   cascade.expandAll();
   * </code></pre>
   */
  expandAll : function(){
    var _self = this,
      grid = _self.get('grid'),
      records = grid.getRecords();
      $.each(records,function(index,record){
        _self.expand(record);
      });
  },
  /**
   * 灞曞紑鏌愭潯绾綍
   * <pre><code>
   *   var record = grid.getItem('a');
   *   cascade.expand(record);
   * </code></pre>
   * @param  {Object} record 绾綍
   */
  expand : function(record){
    var _self = this,
      grid = _self.get('grid');

    var row = grid.findRow(record);
    if(row){
      _self._onExpand(record,row);
    }
  },
  /**
   * 鎶樺彔鏌愭潯绾綍
   * <pre><code>
   *   var record = grid.getItem('a');
   *   cascade.collapse(record);
   * </code></pre>
   * @param  {Object} record 绾綍
   */
  collapse : function(record){
    var _self = this,
      grid = _self.get('grid');

    var row = grid.findRow(record);
    if(row){
      _self._onCollapse(record,row);
    }
  },
  /**
   * 绉婚櫎鎵€鏈夌骇鑱旀暟鎹殑锛わ集锛�
   * @protected
   */
  removeAll : function(){
    var _self = this,
      rows = _self._getAllCascadeRows();

    rows.each(function(index,row){
    
      _self._removeCascadeRow(row);
    });
  },
  /**
   * 鏍规嵁绾綍鍒犻櫎绾ц仈淇℃伅
   * @protected
   * @param  {Object} record 绾ц仈淇℃伅瀵瑰簲鐨勭邯褰�
   */
  remove : function(record){
    var _self = this,
      cascadeRow = _self._findCascadeRow(record);
    if(cascadeRow){
      _self._removeCascadeRow(cascadeRow);
    }

  },
  /**
   * 鎶樺彔鎵€鏈夌骇鑱旀暟鎹�
   * <pre><code>
   *  cascade.collapseAll();
   * </code></pre>
   */
  collapseAll : function(){
    var _self = this,
      grid = _self.get('grid'),
      records = grid.getRecords();
      $.each(records,function(index,record){
        _self.collapse(record);
      });
  },
  //鑾峰彇绾ц仈鏁版嵁
  _getRowRecord : function(cascadeRow){
    return $(cascadeRow).data(DATA_RECORD);
  },
  //绉婚櫎绾ц仈琛�
  _removeCascadeRow : function(row){

    this.fire('removed',{record: $(row).data(DATA_RECORD),row : row});
    $(row).remove();
  },
  //閫氳繃绾綍鏌ユ壘
  _findCascadeRow: function(record){
    var _self = this,
      rows = _self._getAllCascadeRows(),
      result = null;

    $.each(rows,function(index,row){
      if(_self._getRowRecord(row) === record){
        result = row;
        return false;
      }
    });
    return result;
  },
  _getAllCascadeRows : function(){
    var _self = this,
      grid = _self.get('grid');
    return grid.get('el').find('.' + CLS_CASCADE_ROW);
  },
  //鑾峰彇鐢熸垚鐨勭骇鑱旇
  _getCascadeRow : function(gridRow){
    var nextRow = $(gridRow).next();
    if((nextRow).hasClass(CLS_CASCADE_ROW)){
      return nextRow;
    }
    return null;
    //return $(gridRow).next('.' + CLS_CASCADE_ROW);
  },
  //鑾峰彇绾ц仈鍐呭
  _getRowContent : function(record){
    var _self = this,
      renderer = _self.get('renderer'),
      content = renderer ? renderer(record) : '';
    return content;
  },
  //鍒涘缓绾ц仈琛�
  _createCascadeRow : function(record,gridRow){
    var _self = this,
      rowTpl = _self.get('rowTpl'),
      content = _self._getRowContent(record),
      rowEl = $(rowTpl).insertAfter(gridRow);

    rowEl.find('.' + CLS_CASCADE_CELL).append($(content));
    rowEl.data(DATA_RECORD,record);
    return rowEl;
  },
  //灞曞紑
  _onExpand : function(record,row,cascadeEl){
    var _self = this,
      cascadeRow = _self._getCascadeRow(row),
      colspan = _self._getColumnCount(row);

    cascadeEl = cascadeEl || $(row).find('.'+CLS_CASCADE);
    cascadeEl.addClass(CLS_CASCADE_EXPAND);

    if(!cascadeRow || !cascadeRow.length){
      cascadeRow = _self._createCascadeRow(record,row);
    }
    $(cascadeRow).removeClass(CLS_CASCADE_ROW_COLLAPSE);

    _self._setColSpan(cascadeRow,row);
    
    _self.fire('expand',{record : record,row : cascadeRow[0]});
  },
  //鎶樺彔
  _onCollapse : function(record,row,cascadeEl){

    var _self = this,
      cascadeRow = _self._getCascadeRow(row);
    cascadeEl = cascadeEl || $(row).find('.'+CLS_CASCADE);
    cascadeEl.removeClass(CLS_CASCADE_EXPAND);

    if(cascadeRow && cascadeRow.length){
      $(cascadeRow).addClass(CLS_CASCADE_ROW_COLLAPSE);
      _self.fire('collapse',{record : record,row : cascadeRow[0]});
    }
    
  },
  //鑾峰彇鏄剧ず鐨勫垪鏁�
  _getColumnCount : function(row){
    return $(row).children().filter(function(){
      return $(this).css('display') !== 'none';
    }).length;
  },
  //璁剧疆colspan
  _setColSpan : function(cascadeRow,gridRow){
    gridRow = gridRow || $(cascadeRow).prev();
    var _self = this,
      colspan = _self._getColumnCount(gridRow);

    $(cascadeRow).find('.' + CLS_CASCADE_CELL).attr('colspan',colspan)
  },
  //閲嶇疆鎵€鏈夌殑colspan
  _resetColspan : function(){
    var _self = this,
      cascadeRows =  _self._getAllCascadeRows();
    $.each(cascadeRows,function(index,cascadeRow){
      _self._setColSpan(cascadeRow);
    });
  },
  /**
   * 鏋愭瀯鍑芥暟
   */
  destructor : function(){
    var _self = this;
    _self.removeAll();
    _self.off();
    _self.clearAttrVals();
  }
});

module.exports = cascade;

});
define("bui/grid/plugins/cellediting", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸鍗曞厓鏍肩紪杈�
 * @ignore
 */

var $ = require("jquery"),
  Editing = require("bui/grid/plugins/editing"),
  CLS_BODY = BUI.prefix + 'grid-body',
  CLS_CELL = BUI.prefix + 'grid-cell';

/**
 * @class BUI.Grid.Plugins.CellEditing
 * @extends BUI.Grid.Plugins.Editing
 * 鍗曞厓鏍肩紪杈戞彃浠�
 */
var CellEditing = function(config){
  CellEditing.superclass.constructor.call(this, config);
};

CellEditing.ATTRS = {
  /**
   * 瑙﹀彂缂栬緫鏍峰紡锛屼负绌烘椂榛樿鐐瑰嚮鏁磋閮戒細瑙﹀彂缂栬緫
   * @cfg {String} [triggerCls = 'bui-grid-cell']
   */
  triggerCls : {
    value : CLS_CELL
  }
};

BUI.extend(CellEditing,Editing);

BUI.augment(CellEditing,{
  /**
   * @protected
   * 鑾峰彇缂栬緫鍣ㄧ殑閰嶇疆椤�
   * @param  {Array} fields 瀛楁閰嶇疆
   */ 
  getEditorCfgs : function(fields){
    var _self = this,
      grid = _self.get('grid'),
      bodyNode = grid.get('el').find('.' + CLS_BODY),
      rst = [];
    BUI.each(fields,function(field){
      var cfg = {field : field,changeSourceEvent : null,hideExceptNode : bodyNode,autoUpdate : false,preventHide : false,editableFn : field.editableFn};
      if(field.xtype === 'checkbox'){
        cfg.innerValueField = 'checked';
      }
      rst.push(cfg);
    });

    return rst;
  },
  /**
   * 鑾峰彇缂栬緫鍣�
   * @protected
   * @param  {String} field 瀛楁鍊�
   * @return {BUI.Editor.Editor}  缂栬緫鍣�
   */
  getEditor : function(field){
    if(!field){
      return null;
    }
    var  _self = this,
      editors = _self.get('editors'),
      editor = null;

    BUI.each(editors,function(item){
      if(item.get('field').get('name') === field){
        editor = item;
        return false;
      }
    });
    return editor;
  },
  /**
   * 鏄剧ず缂栬緫鍣ㄥ墠
   * @protected
   * @param  {BUI.Editor.Editor} editor 
   * @param  {Object} options
   */
  beforeShowEditor : function(editor,options){
    var _self = this,
      cell = $(options.cell);
    _self.resetWidth(editor,cell.outerWidth());
    _self._makeEnable(editor,options);
  },
  _makeEnable : function(editor,options){
    var editableFn = editor.get('editableFn'),
      field,
      enable,
      record;
    if(BUI.isFunction(editableFn)){
      field = options.field;
      record = options.record;
      if(record && field){
        enable = editableFn(record[field],record);
        if(enable){
          editor.get('field').enable();
        }else{
          editor.get('field').disable();
        }
      }
      
    }
  },
  resetWidth : function(editor,width){
    editor.set('width',width);
  },
  /**
   * 鏇存柊鏁版嵁
   * @protected
   * @param  {Object} record 缂栬緫鐨勬暟鎹�
   * @param  {*} value  缂栬緫鍊�
   */
  updateRecord : function(store,record,editor){
    var _self = this,
        value = editor.getValue(),
        fieldName = editor.get('field').get('name'),
        preValue = record[fieldName];
      value = BUI.isDate(value) ? value.getTime() : value;
      if(preValue !== value){
        store.setValue(record,fieldName,value);
      }
  },
  /**
   * @protected
   * 鑾峰彇瀵归綈鐨勮妭鐐�
   * @override
   * @param  {Object} options 鐐瑰嚮鍗曞厓鏍肩殑浜嬩欢瀵硅薄
   * @return {jQuery} 
   */
  getAlignNode : function(options){
    return $(options.cell);
  },
  /**
   * 鑾峰彇缂栬緫鐨勫瓧娈�
   * @protected
   * @return {Array}  瀛楁闆嗗悎
   */
  getFields : function(){
    var rst = [],
      _self = this,
      editors = _self.get('editors');
    BUI.each(editors,function(editor){
      rst.push(editor.get('field'));
    });
    return rst;
  },
  /**
   * @protected
   * 鑾峰彇瑕佺紪杈戠殑鍊�
   * @param  {Object} options 鐐瑰嚮鍗曞厓鏍肩殑浜嬩欢瀵硅薄
   * @return {*}   缂栬緫鐨勫€�
   */
  getEditValue : function(options){
    if(options.record && options.field){
      var value = options.record[options.field];
      return value == null ? '' : value;
    }
    return '';
  }
});

module.exports = CellEditing;

});
define("bui/grid/plugins/editing", ["jquery"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸缂栬緫鎻掍欢
 * @ignore
 */

var $ = require("jquery"),
  CLS_CELL_INNER = BUI.prefix + 'grid-cell-inner',
  CLS_CELL_ERROR = BUI.prefix + 'grid-cell-error';
/**
 * 琛ㄦ牸鐨勭紪杈戞彃浠�
 * @class BUI.Grid.Plugins.Editing
 */
function Editing(config){
  Editing.superclass.constructor.call(this, config);
}

BUI.extend(Editing,BUI.Base);

Editing.ATTRS = {
  /**
   * @protected
   * 缂栬緫鍣ㄧ殑瀵归綈璁剧疆
   * @type {Object}
   */
  align : {
    value : {
      points: ['cl','cl']
    }
  },
  /**
   * 鏄惁鐩存帴鍦ㄨ〃鏍间笂鏄剧ず閿欒淇℃伅
   * @type {Boolean}
   */
  showError : {
    value : true
  },
  errorTpl : {
    value : '<span class="x-icon ' + CLS_CELL_ERROR + ' x-icon-mini x-icon-error" title="{error}">!</span>'
  },
  /**
   * 鏄惁鍒濆鍖栬繃缂栬緫鍣�
   * @protected
   * @type {Boolean}
   */
  isInitEditors : {
    value : false
  },
  /**
   * 姝ｅ湪缂栬緫鐨勮褰�
   * @type {Object}
   */
  record : {

  },
  /**
   * 褰撳墠缂栬緫鐨勭紪杈戝櫒
   * @type {Object}
   */
  curEditor : {

  },
  /**
   * 鏄惁鍙戠敓杩囬獙璇�
   * @type {Boolean}
   */
  hasValid : {

  },
  /**
   * 缂栬緫鍣�
   * @protected
   * @type {Object}
   */
  editors : {
    shared:false,
    value : []
  },
  /**
   * 瑙﹀彂缂栬緫鏍峰紡锛屼负绌烘椂榛樿鐐瑰嚮鏁磋閮戒細瑙﹀彂缂栬緫
   * @type {String}
   */
  triggerCls : {

  },
  /**
   * 杩涜缂栬緫鏃舵槸鍚﹁Е鍙戦€変腑
   * @type {Boolean}
   */
  triggerSelected : {
    value : true
  }
  /**
   * @event accept 
   * 纭缂栬緫
   * @param {Object} ev 浜嬩欢瀵硅薄
   * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
   * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
   */
  
  /**
   * @event cancel 
   * 鍙栨秷缂栬緫
   * @param {Object} ev 浜嬩欢瀵硅薄
   * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
   * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
   */
  
  /**
   * @event editorshow 
   * editor 鏄剧ず
   * @param {Object} ev 浜嬩欢瀵硅薄
   * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
   * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
   */
  
  /**
   * @event editorready
   * editor 鍒涘缓瀹屾垚锛屽洜涓篹ditor寤惰繜鍒涘缓锛屾墍浠ュ垱寤哄畬鎴恎rid锛岀瓑寰卐ditor鍒涘缓鎴愬姛
   */
  
  /**
   * @event beforeeditorshow
   * editor鏄剧ず鍓嶏紝鍙互鏇存敼editor鐨勪竴浜涘睘鎬�
   * @param {Object} ev 浜嬩欢瀵硅薄
   * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
   * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
   */

};

BUI.augment(Editing,{
  /**
   * 鍒濆鍖�
   * @protected
   */
  initializer : function (grid) {
    var _self = this;
    _self.set('grid',grid);
    _self.initEditing(grid);
    
  },
  renderUI : function(){
    var _self = this,
      grid = _self.get('grid');
    //寤惰繜鍔犺浇 editor妯″潡
    require.async('bui/editor',function(Editor){
      _self.initEditors(Editor);
      _self._initGridEvent(grid);
      _self.set('isInitEditors',true);
      _self.fire('editorready');
    });
  },
  /**
   * 鍒濆鍖栨彃浠�
   * @protected
   */
  initEditing : function(grid){

  },
  _getCurEditor : function(){
    return this.get('curEditor');
  },
  _initGridEvent : function(grid){
    var _self = this,
      header = grid.get('header');

    grid.on('cellclick',function(ev){

      var editor = null,
        domTarget = ev.domTarget,
        triggerCls = _self.get('triggerCls'),
        curEditor = _self._getCurEditor();
      if(curEditor && curEditor.get('acceptEvent')){
        curEditor.accept();
        curEditor.hide();
      }else{
        curEditor && curEditor.cancel();
      }

      //if(ev.field){
        editor = _self.getEditor(ev.field);
      //}
      if(editor && $(domTarget).closest('.' + triggerCls).length){
        _self.showEditor(editor,ev);
        //if(curEditor && curEditor.get('acceptEvent')){
        if(!_self.get('triggerSelected')){
          return false; //姝ゆ椂涓嶈Е鍙戦€変腑浜嬩欢
        }
          
        //}
      }
    });

    grid.on('rowcreated',function(ev){
      validRow(ev.record,ev.row);
    });

    grid.on('rowremoved',function(ev){
      if(_self.get('record') == ev.record){
        _self.cancel();
      }
    });

    grid.on('rowupdated',function(ev){
      validRow(ev.record,ev.row);
    });

    grid.on('scroll',function(ev){
      var editor = _self._getCurEditor();
      if(editor){

        var align = editor.get('align'),
          node = align.node,
          pos = node.position();
        if(pos.top < 0 || pos.top > ev.bodyHeight){
          editor.hide();
        }else{
          editor.set('align',align);
          editor.show();
        }
        
      }
    });

    header.on('afterVisibleChange',function(ev){
      if(ev.target && ev.target != header){
        var column = ev.target;
        _self.onColumnVisibleChange(column);
      }
    });

    function validRow(record,row){
      if(_self.get('hasValid')){
        _self.validRecord(record,_self.getFields(),$(row));
      }
    }

  },
  /**
   * 鍒濆鍖栨墍鏈�
   * @protected
   */
  initEditors : function(Editor){
    var _self = this,
      grid = _self.get('grid'),
      fields = [],
      columns = grid.get('columns');
    BUI.each(columns,function(column){
      var field = _self.getFieldConfig(column);
      if(field){
        field.name = column.get('dataIndex');
        field.colId = column.get('id');
        if(field.validator){
          field.validator = _self.wrapValidator(field.validator);
        }
        fields.push(field);
      }
    });
    var cfgs = _self.getEditorCfgs(fields);
    BUI.each(cfgs,function(cfg){
      _self.initEidtor(cfg,Editor);
    });
  },
  /**
   * @protected
   * 鑾峰彇鍒楀畾涔変腑鐨勫瓧娈靛畾涔変俊鎭�
   * @param  {BUI.Grid.Column} column 鍒楀畾涔�
   * @return {Object}  瀛楁瀹氫箟
   */
  getFieldConfig : function(column){
    return column.get('editor');
  },
  /**
   * 灏佽楠岃瘉鏂规硶
   * @protected
   */
  wrapValidator : function(validator){
    var _self = this;
    return function(value){
      var record = _self.get('record');
      return validator(value,record);
    };
  },
  /**
   * @protected
   * 鍒楁樉绀洪殣钘忔椂
   */
  onColumnVisibleChange : function(column){

  },
  /**
   * @protected
   * 鑾峰彇缂栬緫鍣ㄧ殑閰嶇疆
   * @template
   * @param  {Array} fields 瀛楁閰嶇疆
   * @return {Array} 缂栬緫鍣ㄧ殑閰嶇疆椤�
   */
  getEditorCfgs : function(fields){

  },
  /**
   * 鑾峰彇缂栬緫鍣ㄧ殑鏋勯€犲嚱鏁�
   * @param  {Object} Editor 鍛藉悕绌洪棿
   * @return {Function}       鏋勯€犲嚱鏁�
   */
  getEditorConstructor : function(Editor){
    return Editor.Editor;
  },
  /**
   * 鍒濆鍖栫紪杈戝櫒
   * @private
   */
  initEidtor : function(cfg,Editor){
    var _self = this,
      con = _self.getEditorConstructor(Editor),
      editor = new con(cfg);
    editor.render();
    _self.get('editors').push(editor);
    _self.bindEidtor(editor);
    return editor;
  },
  /**
   * @protected
   * 缁戝畾缂栬緫鍣ㄤ簨浠�
   * @param  {BUI.Editor.Editor} editor 缂栬緫鍣�
   */
  bindEidtor : function(editor){
    var _self = this,
      grid = _self.get('grid'),
      store = grid.get('store');
    editor.on('accept',function(){
      var record = _self.get('record');
      _self.updateRecord(store,record,editor);
      _self.fire('accept',{editor : editor,record : record});
      _self.set('curEditor',null);

    });

    editor.on('cancel',function(){
      _self.fire('cancel',{editor : editor,record : _self.get('record')});
      _self.set('curEditor',null);
    });
  },
  /**
   * 鑾峰彇缂栬緫鍣�
   * @protected
   * @param  {String} field 瀛楁鍊�
   * @return {BUI.Editor.Editor}  缂栬緫鍣�
   */
  getEditor : function(options){

  },
  /**
   * @protected
   * 鑾峰彇瀵归綈鐨勮妭鐐�
   * @template
   * @param  {Object} options 鐐瑰嚮鍗曞厓鏍肩殑浜嬩欢瀵硅薄
   * @return {jQuery} 
   */
  getAlignNode : function(options){

  },
  /**
   * @protected
   * 鑾峰彇缂栬緫鐨勫€�
   * @param  {Object} options 鐐瑰嚮鍗曞厓鏍肩殑浜嬩欢瀵硅薄
   * @return {*}   缂栬緫鐨勫€�
   */
  getEditValue : function(options){

  },
  /**
   * 鏄剧ず缂栬緫鍣�
   * @protected
   * @param  {BUI.Editor.Editor} editor 
   */
  showEditor : function(editor,options){
    var _self = this,
      value = _self.getEditValue(options),
      alignNode = _self.getAlignNode(options);

    _self.beforeShowEditor(editor,options);
    _self.set('record',options.record);
    _self.fire('beforeeditorshow',{editor : editor,record : options.record});

    editor.setValue(value);
    if(alignNode){
      var align = _self.get('align');
      align.node = alignNode;
      editor.set('align',align);
    }

    editor.show();
    _self.focusEditor(editor,options.field);
    _self.set('curEditor',editor);
    _self.fire('editorshow',{editor : editor,record : options.record});
  },
  /**
   * @protected
   * 缂栬緫鍣ㄥ瓧娈靛畾浣�
   */
  focusEditor : function(editor,field){
    editor.focus();
  },
  /**
   * 鏄剧ず缂栬緫鍣ㄥ墠
   * @protected
   * @template
   * @param  {BUI.Editor.Editor} editor 
   * @param  {Object} options
   */
  beforeShowEditor : function(editor,options){

  },
  //鍒涘缓缂栬緫鐨勯厤缃」
  _createEditOptions : function(record,field){
    var _self = this,
      grid = _self.get('grid'),
      rowEl = grid.findRow(record),
      column = grid.findColumnByField(field),
      cellEl = grid.findCell(column.get('id'),rowEl);
    return {
      record : record,
      field : field,
      cell : cellEl[0],
      row : rowEl[0]
    };
  },
  /**
   * 楠岃瘉琛ㄦ牸鏄惁閫氳繃楠岃瘉
   */
  valid : function(){
    var _self = this,
      grid = _self.get('grid'),
      store = grid.get('store');

    if(store){
      var records = store.getResult();
      BUI.each(records,function(record){
        _self.validRecord(record,_self.getFields());
      });
    }
    _self.set('hasValid',true);
  },
  isValid : function(){
    var _self = this,
      grid = _self.get('grid');
    if(!_self.get('hasValid')){
      _self.valid();
    }
    return !grid.get('el').find('.' + CLS_CELL_ERROR).length;
  },
  /**
   * 娓呯悊閿欒
   */
  clearErrors : function(){
    var _self = this,
      grid = _self.get('grid');
    grid.get('el').find('.' + CLS_CELL_ERROR).remove();
  },
  /**
   * 鑾峰彇缂栬緫鐨勫瓧娈�
   * @protected
   * @param  {Array} editors 缂栬緫鍣�
   * @return {Array}  瀛楁闆嗗悎
   */
  getFields : function(editors){
    
  },
  /**
   * 鏍￠獙璁板綍
   * @protected
   * @param  {Object} record 鏍￠獙鐨勮褰�
   * @param  {Array} fields 瀛楁鐨勯泦鍚�
   */
  validRecord : function(record,fields,row){
    var _self = this,
      errors = [];
    _self.setInternal('record',record);
    fields = fields || _self.getFields();
    BUI.each(fields,function(field){
      var name = field.get('name'),
        value = record[name] || '',
        error = field.getValidError(value);
      if(error){
        errors.push({name : name,error : error,id : field.get('colId')});
      }
    });
    _self.showRecordError(record,errors,row);
  },
  showRecordError : function(record,errors,row){
    var _self = this,
      grid = _self.get('grid');
    row = row || grid.findRow(record);
    if(row){
      _self._clearRowError(row);
      BUI.each(errors,function(item){
        var cell = grid.findCell(item.id,row);
        _self._showCellError(cell,item.error);
      });
    }
  },
  /**
   * 鏇存柊鏁版嵁
   * @protected
   * @param  {Object} record 缂栬緫鐨勬暟鎹�
   * @param  {*} value  缂栬緫鍊�
   */
  updateRecord : function(store,record,editor){
   
  },
  _clearRowError : function(row){
    row.find('.' + CLS_CELL_ERROR).remove();
  },
  _showCellError : function(cell,error){
    var _self = this,
      errorTpl = BUI.substitute(_self.get('errorTpl'),{error : error}),
      innerEl = cell.find('.' + CLS_CELL_INNER);
    $(errorTpl).appendTo(innerEl);
  },
  /**
   * 缂栬緫璁板綍
   * @param  {Object} record 闇€瑕佺紪杈戠殑璁板綍
   * @param  {String} field 缂栬緫鐨勫瓧娈�
   */
  edit : function(record,field){
    var _self = this,
      options = _self._createEditOptions(record,field),
      editor = _self.getEditor(field);
    _self.showEditor(editor,options);
  },
  /**
   * 鍙栨秷缂栬緫
   */
  cancel : function(){
    var _self = this,
      editors = _self.get('editors');
    BUI.each(editors,function(editor){
      if(editor.get('visible')){
        editor.cancel();
      }
    });
    _self.set('curEditor',null);
    _self.set('record',null);
  },  
  /**
   * 鏋愭瀯鍑芥暟
   * @protected
   */
  destructor:function () {
    var _self = this,
      editors = _self.get('editors');
    
    BUI.each(editors,function(editor){
      editor.destroy && editor.destroy();
    });
    _self.off();
    _self.clearAttrVals();
  }

});

module.exports = Editing;

});
define("bui/grid/plugins/rowediting", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸琛岀紪杈�
 * @ignore
 */

 var $ = require("jquery"),
  BUI = require("bui/common"),
  Editing = require("bui/grid/plugins/editing"),
  CLS_ROW = BUI.prefix + 'grid-row';

/**
 * @class BUI.Grid.Plugins.RowEditing
 * @extends BUI.Grid.Plugins.Editing
 * 鍗曞厓鏍肩紪杈戞彃浠�
 *
 *  ** 娉ㄦ剰 **
 *
 *  - 缂栬緫鍣ㄧ殑瀹氫箟鍦╟olumns涓紝editor灞炴€�
 *  - editor閲岄潰鐨勫畾涔夊搴攆orm-field鐨勫畾涔夛紝xtype浠ｈ〃 form-field + xtype
 *  - validator 鍑芥暟鐨勫嚱鏁板師鍨� function(value,newRecord,originRecord){} //缂栬緫鐨勫綋鍓嶅€硷紝姝ｅ湪缂栬緫鐨勮褰曪紝鍘熷璁板綍
 */
var RowEditing = function(config){
  RowEditing.superclass.constructor.call(this, config);
};

RowEditing.ATTRS = {
   /**
   * 鏄惁鑷姩淇濆瓨鏁版嵁鍒版暟鎹簮锛岄€氳繃store鐨剆ave鏂规硶瀹炵幇
   * @cfg {Object} [autoSave=false]
   */
  autoSave : {
    value : false
  },
   /**
   * @protected
   * 缂栬緫鍣ㄧ殑瀵归綈璁剧疆
   * @type {Object}
   */
  align : {
    value : {
      points: ['tl','tl'],
      offset : [-2,0]
    }
  },
  /**
   * 瑙﹀彂缂栬緫鏍峰紡锛屼负绌烘椂榛樿鐐瑰嚮鏁磋閮戒細瑙﹀彂缂栬緫
   * @cfg {String} [triggerCls = 'bui-grid-row']
   */
  triggerCls : {
    value : CLS_ROW
  },
  /**
   * 缂栬緫鍣ㄧ殑榛樿閰嶇疆淇℃伅
   * @type {Object}
   */
  editor : {

  }
};

BUI.extend(RowEditing,Editing);

BUI.augment(RowEditing,{

  /**
   * @protected
   * 鑾峰彇缂栬緫鍣ㄧ殑閰嶇疆椤�
   * @param  {Array} fields 瀛楁閰嶇疆
   */ 
  getEditorCfgs : function(fields){
    var _self = this,
      editor = _self.get('editor'),
      rst = [],
      cfg = BUI.mix(true,{
        changeSourceEvent : null,
        autoUpdate : false,
        form : {
          children : fields,
          buttonBar : {
            elCls : 'centered toolbar'
          }
        }
      },editor);
      
    rst.push(cfg);
    return rst;
  },
  /**
   * 灏佽楠岃瘉鏂规硶
   * @protected
   */
  wrapValidator : function(validator){
    var _self = this;
    return function(value){
      var editor = _self.get('curEditor'),
        origin = _self.get('record'),
        record = editor ? editor.getValue() : origin;
      if(record){
        return validator(value,record,origin);
      }
    };
  },
  /**
   * @protected
   * 缂栬緫鍣ㄥ瓧娈靛畾浣�
   */
  focusEditor : function(editor,field){
    var form = editor.get('form'),
      control = form.getField(field);
    if(control){
      control.focus();
    }
  },
  /**
   * @protected
   * 鑾峰彇鍒楀畾涔変腑鐨勫瓧娈靛畾涔変俊鎭�
   * @param  {BUI.Grid.Column} column 鍒楀畾涔�
   * @return {Object}  瀛楁瀹氫箟
   */
  getFieldConfig : function(column){
    var editor = column.get('editor');
    if(editor){
      if(editor.xtype === 'checkbox'){
        editor.innerValueField = 'checked';
      }
      return editor;
    }
    var cfg = {xtype : 'plain'};
    if(column.get('dataIndex') && column.get('renderer')){
      cfg.renderer = column.get('renderer');
      //cfg.id = column.get('id');
    }
    return cfg;
  },
  /**
   * 鏇存柊鏁版嵁
   * @protected
   * @param  {Object} record 缂栬緫鐨勬暟鎹�
   * @param  {*} value  缂栬緫鍊�
   */
  updateRecord : function(store,record,editor){
    var _self = this,
        value = editor.getValue();
      BUI.each(value,function(v,k){
        if(BUI.isDate(v)){
          value[k] = v.getTime();
        }
      });
      BUI.mix(record,value);
      
      store.update(record);
      if(_self.get('autoSave')){
        store.save(record);
      }
  },
   /**
   * 鑾峰彇缂栬緫姝よ鐨勭紪杈戝櫒
   * @protected
   * @param  {String} field 鐐瑰嚮鍗曞厓鏍肩殑瀛楁
   * @return {BUI.Editor.Editor}  缂栬緫鍣�
   */
  getEditor : function(field){
    var _self = this,
      editors = _self.get('editors');
    return editors[0];
  },
  /**
   * @override
   * 鍒楀彂鐢熸敼鍙�
   */
  onColumnVisibleChange : function(column){
    var _self = this,
      id = column.get('id'),
      editor = _self.getEditor(),
      field = editor.getChild(id,true);
    if(field){
      field.set('visible',column.get('visible'));
    }
  },
  /**
   * 鏄剧ず缂栬緫鍣ㄥ墠
   * @protected
   * @template
   * @param  {BUI.Editor.Editor} editor 
   * @param  {Object} options
   */
  beforeShowEditor : function(editor,options){
    var _self = this,
      grid = _self.get('grid'),
      columns = grid.get('columns'),
      form = editor.get('form'),
      row = $(options.row);
    editor.set('width',row.width());
    BUI.each(columns,function(column){
      var fieldName = column.get('dataIndex'),
        field = form.getField(fieldName)
      if(!column.get('visible')){
        field && field.set('visible',false);
      }else{
        var 
          width = column.get('el').outerWidth() - field.getAppendWidth();
        field.set('width',width);
      }
    });
  },
  /**
   * @protected
   * 鑾峰彇瑕佺紪杈戠殑鍊�
   * @param  {Object} options 鐐瑰嚮鍗曞厓鏍肩殑浜嬩欢瀵硅薄
   * @return {*}   缂栬緫鐨勫€�
   */
  getEditValue : function(options){
    return options.record;
  },
  /**
   * 鑾峰彇缂栬緫鍣ㄧ殑鏋勯€犲嚱鏁�
   * @param  {Object} Editor 鍛藉悕绌洪棿
   * @return {Function}       鏋勯€犲嚱鏁�
   */
  getEditorConstructor : function(Editor){
    return Editor.RecordEditor;
  },
   /**
   * @protected
   * 鑾峰彇瀵归綈鐨勮妭鐐�
   * @override
   * @param  {Object} options 鐐瑰嚮鍗曞厓鏍肩殑浜嬩欢瀵硅薄
   * @return {jQuery} 
   */
  getAlignNode : function(options){
    return $(options.row);
  },
  /**
   * 鑾峰彇缂栬緫鐨勫瓧娈�
   * @protected
   * @return {Array}  瀛楁闆嗗悎
   */
  getFields : function(){
    var _self = this,
      editors = _self.get('editors');
    return editors[0].get('form').get('children');
  }
});
module.exports = RowEditing;

});
define("bui/grid/plugins/dialog", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸璺熻〃鍗曡仈鐢�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  TYPE_ADD = 'add',
  TYPE_EDIT = 'edit';

/**
 * 琛ㄦ牸鐨勭紪杈戞彃浠�
 * @class BUI.Grid.Plugins.DialogEditing
 */
function Dialog(config){
   Dialog.superclass.constructor.call(this, config);
}

Dialog.ATTRS = {
  /**
   * 鏄惁鑷姩淇濆瓨鏁版嵁鍒版暟鎹簮锛岄€氳繃store鐨剆ave鏂规硶瀹炵幇
   * @cfg {Object} [autoSave=false]
   */
  autoSave : {
    value : false
  },
  /**
   * 缂栬緫鐨勮褰�
   * @type {Object}
   * @readOnly
   */
  record : {

  },
  /**
   * @private
   * 缂栬緫璁板綍鐨刬ndex
   * @type {Object}
   */
  curIndex : {

  },
  /**
   * Dialog鐨勫唴瀹癸紝鍐呴儴鍖呭惈琛ㄥ崟(form)
   * @cfg {String} contentId
   */
  /**
   * Dialog鐨勫唴瀹癸紝鍐呴儴鍖呭惈琛ㄥ崟(form)
   * @type {String}
   */
  contentId:{

  },
  /**
   * 缂栬緫鍣�
   * @type {BUI.Editor.DialogEditor}
   * @readOnly
   */
  editor : {

  },
  /**
   * Dialog涓殑琛ㄥ崟
   * @type {BUI.Form.Form}
   * @readOnly
   */
  form : {

  },
  events : {
    value : {
      /**
       * @event
       * 缂栬緫鐨勮褰曞彂鐢熸洿鏀�
       * @param {Object} e 浜嬩欢瀵硅薄
       * @param {Object} e.record 璁板綍
       * @param {Object} e.editType 缂栬緫鐨勭被鍨� add 鎴栬€� edit
       */
      recordchange : false

       /**
       * @event accept 
       * 纭缂栬緫
       * @param {Object} ev 浜嬩欢瀵硅薄
       * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
       * @param {BUI.Form.Form} form 琛ㄥ崟
       * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
       */
      
      /**
       * @event cancel 
       * 鍙栨秷缂栬緫
       * @param {Object} ev 浜嬩欢瀵硅薄
       * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
       * @param {BUI.Form.Form} form 琛ㄥ崟
       * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
       */
      
      /**
       * @event editorshow 
       * editor 鏄剧ず
       * @param {Object} ev 浜嬩欢瀵硅薄
       * @param {Object} ev.record 缂栬緫鐨勬暟鎹�
       * @param {BUI.Editor.Editor} ev.editor 缂栬緫鍣�
       */
      
      /**
       * @event editorready
       * editor 鍒涘缓瀹屾垚锛屽洜涓篹ditor寤惰繜鍒涘缓锛屾墍浠ュ垱寤哄畬鎴恎rid锛岀瓑寰卐ditor鍒涘缓鎴愬姛
       */
    }
  },
  editType : {

  }
};

BUI.extend(Dialog,BUI.Base);

BUI.augment(Dialog,{
  /**
   * 鍒濆鍖�
   * @protected
   */
  initializer : function (grid) {
    var _self = this;
    _self.set('grid',grid);
    //寤惰繜鍔犺浇 editor妯″潡
    require.async('bui/editor',function(Editor){
      _self._initEditor(Editor);
      _self.fire('editorready');
    });
  },
  bindUI : function(grid){
    var _self = this,
      triggerCls = _self.get('triggerCls');
    if(triggerCls){
      grid.on('cellclick',function(ev){
        var sender = $(ev.domTarget),
          editor = _self.get('editor');
        if(sender.hasClass(triggerCls) && editor){

          _self.edit(ev.record);
          if(grid.get('multipleSelect')){
            return false;
          }
        }
      });
    }
  },
  //鍒濆鍖栫紪杈戝櫒
  _initEditor : function(Editor){
    var _self = this,
      contentId = _self.get('contentId'),
      formNode = $('#' + contentId).find('form'),
      editor = _self.get('editor'),
      cfg = BUI.merge(editor,{
          contentId : contentId,
          form : {
            srcNode : formNode
          }
      });

    editor = new Editor.DialogEditor(cfg);
    _self._bindEditor(editor);
    _self.set('editor',editor);
    _self.set('form',editor.get('form'));
  },
  //缁戝畾缂栬緫鍣ㄤ簨浠�
  _bindEditor : function(editor){
    var _self = this;
    editor.on('accept',function(){
      var form = editor.get('form'),
        record = form.serializeToObject();
      _self.saveRecord(record);
      _self.fire('accept',{editor : editor,record : _self.get('record'),form : form});
    });

    editor.on('cancel',function(){
      _self.fire('cancel',{editor : editor,record : _self.get('record'),form : editor.get('form')});
    });
  },
  /**
   * 缂栬緫璁板綍
   * @param  {Object} record 璁板綍
   */
  edit : function(record){
    var _self = this;
    _self.set('editType',TYPE_EDIT);
    _self.showEditor(record);
  },
  /**
   * 娣诲姞璁板綍
   * @param  {Object} record 璁板綍
   * @param {Number} [index] 娣诲姞鍒扮殑浣嶇疆锛岄粯璁ゆ坊鍔犲湪鏈€鍚�
   */
  add : function(record,index){
    var _self = this;
    _self.set('editType',TYPE_ADD);
    _self.set('curIndex',index);
    _self.showEditor(record);
  },
  /**
   * @private
   * 淇濆瓨璁板綍
   */
  saveRecord : function(record){
    var _self = this,
      grid = _self.get('grid'),
      editType = _self.get('editType'),
      curIndex = _self.get('curIndex'),
      store = grid.get('store'),
      curRecord = _self.get('record');

    BUI.mix(curRecord,record);

    if(editType == TYPE_ADD){
      if(curIndex != null){
        store.addAt(curRecord,curIndex);
      }else{
        store.add(curRecord);
      }
    }else{
      store.update(curRecord);
    }
    if(_self.get('autoSave')){
      store.save(curRecord);
    }
  },
  /**
   * @private
   * 鏄剧ず缂栬緫鍣�
   */
  showEditor : function(record){
    var _self = this,
      editor = _self.get('editor');
      
    _self.set('record',record);
    editor.show();
    editor.setValue(record,true); //璁剧疆鍊硷紝骞朵笖闅愯棌閿欒
    
    _self.fire('recordchange',{record : record,editType : _self.get('editType')});
    _self.fire('editorshow',{eidtor : editor,editType : _self.get('editType')});
  },
  /**
   * 鍙栨秷缂栬緫
   */
  cancel : function(){
    var _self = this,
      editor = _self.get('editor');
    editor.cancel();
  },
  destructor : function(){
    var _self = this,
      editor = _self.get('editor');
    editor && editor.destroy();
    _self.off();
    _self.clearAttrVals();
  }

});

module.exports = Dialog;

});
define("bui/grid/plugins/autofit", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鑷姩閫傚簲琛ㄦ牸瀹藉害鐨勬墿灞�
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  UA = BUI.UA;

/**
 * 琛ㄦ牸鑷€傚簲瀹藉害
 * @class BUI.Grid.Plugins.AutoFit
 * @extends BUI.Base
 */
var AutoFit = function(cfg){
  AutoFit.superclass.constructor.call(this,cfg);
};

BUI.extend(AutoFit,BUI.Base);

AutoFit.ATTRS = {

};

BUI.augment(AutoFit,{
  //缁戝畾浜嬩欢
  bindUI : function(grid){
    var _self = this,
      handler;
    $(window).on('resize',function(){

      function autoFit(){
        clearTimeout(handler); //闃叉resize鐭椂闂村唴鍙嶅璋冪敤
        handler = setTimeout(function(){
          _self._autoFit(grid);
        },100);
        _self.set('handler',handler);
      }
      autoFit();
    });
  },
  //鑷€傚簲瀹藉害
  _autoFit : function(grid){
    var _self = this,
      render = $(grid.get('render')),
      docWidth = $(window).width(),//绐楀彛瀹藉害
      width,
      appendWidth = 0,
      parent = grid.get('el').parent();
    while(parent[0] && parent[0] != $('body')[0]){
      appendWidth += parent.outerWidth() - parent.width();
      parent = parent.parent();
    }

    grid.set('width',docWidth - appendWidth);
  }

});

module.exports = AutoFit;

});
define("bui/grid/plugins/gridmenu", ["jquery","bui/common","bui/menu"], function(require, exports, module){
/**
 * @fileOverview Grid 鑿滃崟
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  Menu = require("bui/menu"),
  PREFIX = BUI.prefix,
  ID_SORT_ASC = 'sort-asc',
  ID_SORT_DESC = 'sort-desc',
  ID_COLUMNS_SET = 'column-setting',
  CLS_COLUMN_CHECKED = 'icon-check';

/**
 * @class BUI.Grid.Plugins.GridMenu
 * @extends BUI.Base
 * 琛ㄦ牸鑿滃崟鎻掍欢
 */
var gridMenu = function (config) {
  gridMenu.superclass.constructor.call(this,config);
};

BUI.extend(gridMenu,BUI.Base);

gridMenu.ATTRS = 
{
  /**
   * 寮瑰嚭鑿滃崟
   * @type {BUI.Menu.ContextMenu}
   */
  menu : {

  },
  /**
   * @private
   */
  activedColumn : {

  },
  triggerCls : {
    value : PREFIX + 'grid-hd-menu-trigger'
  },
  /**
   * 鑿滃崟鐨勯厤缃」
   * @type {Array}
   */
  items : {
    value : [
      {
        id:ID_SORT_ASC,
        text:'鍗囧簭',
        iconCls:'icon-arrow-up'
      },
      {
        id:ID_SORT_DESC,
        text:'闄嶅簭',
        iconCls : 'icon-arrow-down'
      },
      {
        xclass:'menu-item-sparator'
      },
      {
        id : ID_COLUMNS_SET,
        text:'璁剧疆鍒�',
        iconCls:'icon-list-alt'
      }
    ]
  }
};

BUI.augment(gridMenu,{
  /**
   * 鍒濆鍖�
   * @protected
   */
  initializer : function (grid) {
    var _self = this;
    _self.set('grid',grid);

  },
  /**
   * 娓叉煋DOM
   */
  renderUI : function(grid){
    var _self = this, 
      columns = grid.get('columns');
    BUI.each(columns,function(column){
      _self._addShowMenu(column);
    });
  },
  /**
   * 缁戝畾琛ㄦ牸
   * @protected
   */
  bindUI : function (grid){
    var _self = this;

    grid.on('columnadd',function(ev){
      _self._addShowMenu(ev.column);
    });
    grid.on('columnclick',function (ev) {
      var sender = $(ev.domTarget),
        column = ev.column,
        menu;

      _self.set('activedColumn',column);
      
      if(sender.hasClass(_self.get('triggerCls'))){
        menu = _self.get('menu') || _self._initMenu();
        menu.set('align',{
          node: sender, // 鍙傝€冨厓绱�, falsy 鎴� window 涓哄彲瑙嗗尯鍩�, 'trigger' 涓鸿Е鍙戝厓绱�, 鍏朵粬涓烘寚瀹氬厓绱�
          points: ['bl','tl'], // ['tr', 'tl'] 琛ㄧず overlay 鐨� tl 涓庡弬鑰冭妭鐐圭殑 tr 瀵归綈
          offset: [0, 0] 
        });
        menu.show();
        _self._afterShow(column,menu);
      }
    });
  },
  _addShowMenu : function(column){
    if(!column.get('fixed')){
      column.set('showMenu',true);
    }
  },
  //鑿滃崟鏄剧ず鍚�
  _afterShow : function (column,menu) {
    var _self = this,
      grid = _self.get('grid');

    menu = menu || _self.get('menu');
    _self._resetSortMenuItems(column,menu);
    _self._resetColumnsVisible(menu);
  },
  //璁剧疆鑿滃崟椤规槸鍚﹂€変腑
  _resetColumnsVisible : function (menu) {
    var _self = this,
      settingItem = menu.findItemById(ID_COLUMNS_SET),
      subMenu = settingItem.get('subMenu') || _self._initColumnsMenu(settingItem),
      columns = _self.get('grid').get('columns');
    subMenu.removeChildren(true);
    $.each(columns,function (index,column) {
      if(!column.get('fixed')){
        var config = {
            xclass : 'context-menu-item',
            text : column.get('title'),
            column : column,
            iconCls : 'icon'
          },
          menuItem = subMenu.addChild(config);
        if(column.get('visible')){
          menuItem.set('selected',true);
        }
      }
    });
  },
  //璁剧疆鎺掑簭鑿滃崟椤规槸鍚﹀彲鐢�
  _resetSortMenuItems : function(column,menu) {
    var ascItem = menu.findItemById(ID_SORT_ASC),
      descItem = menu.findItemById(ID_SORT_DESC);
    if(column.get('sortable')){
      ascItem.set('disabled',false);
      descItem.set('disabled',false);
    }else{
      ascItem.set('disabled',true);
      descItem.set('disabled',true);
    }
  },
  //鍒濆鍖栬彍鍗�
  _initMenu : function () {
    var _self = this,
      menu = _self.get('menu'),
      menuItems;

    if(!menu){
      menuItems = _self.get('items');
      $.each(menuItems,function (index,item) {
        if(!item.xclass){
          item.xclass = 'context-menu-item'
        }
      });
      menu = new Menu.ContextMenu({
        children : menuItems,
        elCls : 'grid-menu'
      });
      _self._initMenuEvent(menu);
      _self.set('menu',menu)
    }
    return menu;
  },
  _initMenuEvent : function  (menu) {
    var _self = this;

    menu.on('itemclick',function(ev) {
      var item = ev.item,
        id = item.get('id'),
        activedColumn = _self.get('activedColumn');
      if(id === ID_SORT_ASC){
        activedColumn.set('sortState','ASC');
      }else if(id === ID_SORT_DESC){
        activedColumn.set('sortState','DESC');
      }
    });

    menu.on('afterVisibleChange',function (ev) {
      var visible = ev.newVal,
        activedColumn = _self.get('activedColumn');
      if(visible && activedColumn){
        activedColumn.set('open',true);
      }else{
        activedColumn.set('open',false);
      }
    });
  },
  _initColumnsMenu : function (settingItem) {
    var subMenu = new Menu.ContextMenu({
        multipleSelect : true,
        elCls : 'grid-column-menu'
      });  
    settingItem.set('subMenu',subMenu);
    subMenu.on('itemclick',function (ev) {
      var item = ev.item,
        column = item.get('column'),
        selected = item.get('selected');
      if(selected){
        column.set('visible',true);
      }else{
        column.set('visible',false);
      }
    });
    return subMenu;
  },
  destructor:function () {
    var _self = this,
      menu = _self.get('menu');
    if(menu){
      menu.destroy();
    }
    _self.off();
    _self.clearAttrVals();
  }

});

module.exports = gridMenu;

});
define("bui/grid/plugins/summary", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 琛ㄦ牸鏁版嵁姹囨€�
 * @author dxq613@gmail.com
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  CLS_GRID_ROW = PREFIX + 'grid-row',
  CLS_GRID_BODY = PREFIX + 'grid-body',
  CLS_SUMMARY_ROW = PREFIX + 'grid-summary-row',
  CLS_GRID_CELL_INNER = PREFIX + 'grid-cell-inner',
  CLS_COLUMN_PREFIX = 'grid-td-',
  CLS_GRID_CELL_TEXT = PREFIX + 'grid-cell-text',
  CLS_GRID_CELL = PREFIX + 'grid-cell';

/**
* @private
* @ignore
*/
function getEmptyCellTemplate(colspan){
  if(colspan > 0) {
    return '<td class="' + CLS_GRID_CELL + '" colspan="' + colspan + '">&nbsp;</td>';
  } 
  return '';
}

/**
 * @private
 * @ignore
 */
function getCellTemplate(text,id){
  return '<td class="' + CLS_GRID_CELL + ' '+ CLS_COLUMN_PREFIX + id + '">' +
    getInnerTemplate(text) +
  '</td>';
}

/**
 * @private
 * @ignore
 */
function getInnerTemplate(text){
  return '<div class="' + CLS_GRID_CELL_INNER + '" >' + 
    '<span class="'+CLS_GRID_CELL_TEXT+' ">' + text + '</span>' + 
    '</div>' ;
}

/**
 * @private
 * @ignore
 */
function getLastEmptyCell(){
  return '<td class="' + CLS_GRID_CELL + ' ' + CLS_GRID_CELL + '-empty">&nbsp;</td>';
}


/**
 * 琛ㄦ牸鑿滃崟鎻掍欢 
 * <pre><code>
 * var store = new Store({
 *      url : 'data/summary.json',
 *      pageSize : 10,
 *      autoLoad:true
 *    }),
 *    grid = new Grid.Grid({
 *      render:'#grid',
 *      columns : columns,
 *      store: store,
 *      bbar : {pagingBar : true},
 *      plugins : [Grid.Plugins.Summary] // 鎻掍欢褰㈠紡寮曞叆鍗曢€夎〃鏍�
 *    });
 *
 *  grid.render();
 * </code></pre>
 * @class BUI.Grid.Plugins.Summary
 */
var summary = function (config) {
  summary.superclass.constructor.call(this,config);
};

summary.ATTRS = 
{

  footerTpl : {
    value : '<tfoot></tfoot>'
  },
  footerEl : {

  },
  /**
   * 鎬绘眹鎬昏鐨勬爣棰�
   * @type {String}
   * @default '鎬绘眹鎬�'
   */
  summaryTitle : {
    value : '鏌ヨ鍚堣'
  },
  /**
   * 鏈〉姹囨€荤殑鏍囬
   * @type {String}
   */
  pageSummaryTitle : {
    value : '鏈〉鍚堣'
  },
  /**
   * 鍦ㄥ垪瀵硅薄涓厤缃殑瀛楁
   * @type {String}
   * @default 'summary'
   */
  field : {
    value : 'summary'
  },
  /**
   * 鏈〉姹囨€诲€肩殑璁板綍
   * @type {String}
   */
  pageSummaryField: {
    value : 'pageSummary'
  },
  /**
   * 鎬绘眹鎬诲€肩殑璁板綍
   * @type {String}
   */
  summaryField : {
    value : 'summary'
  },
  /**
   * @private
   * 鏈〉姹囨€诲€�
   * @type {Object}
   */
  pageSummary : {

  },
  /**
   * @private
   * 鎬绘眹鎬�
   * @type {Object}
   */
  summary : {

  }
};

BUI.extend(summary,BUI.Base);

BUI.augment(summary,{
  //鍒濆鍖�
  initializer : function (grid) {
    var _self = this;
    _self.set('grid',grid);
  },
  //娣诲姞DOM缁撴瀯
  renderUI : function(grid){
    var _self = this,
      bodyEl = grid.get('el').find('.' + CLS_GRID_BODY),
      bodyTable = bodyEl.find('table'),
      footerEl = $(_self.get('footerTpl')).appendTo(bodyTable);
    _self.set('footerEl',footerEl);
  },
  //缁戝畾浜嬩欢
  bindUI : function(grid){
    //缁戝畾鑾峰彇鏁版嵁
    var _self = this,
      store = grid.get('store');
    if(store){
      store.on('beforeprocessload',function(ev){
        _self._processSummary(ev.data);
      });
      store.on('add',function(){
        _self.resetPageSummary();
      });
      store.on('remove',function(){
        _self.resetPageSummary();
      });
      store.on('update',function(){
        _self.resetPageSummary();
      });
    }
    grid.on('aftershow',function(){
      _self.resetSummary();
    });

    grid.get('header').on('afterVisibleChange',function(){
      _self.resetSummary();
    });
  },
  //澶勭悊姹囨€绘暟鎹�
  _processSummary : function(data){
    var _self = this,
      footerEl = _self.get('footerEl');

    footerEl.empty();
    if(!data){
      return;
    }

    var pageSummary = data[_self.get('pageSummaryField')],
      summary = data[_self.get('summaryField')];

    _self.set('pageSummary',pageSummary);
    _self.set('summary',summary);
  },
  /**
   * 閲嶆柊璁剧疆鏈〉姹囨€�
   */
  resetPageSummary : function(){
    var _self = this,
      grid = _self.get('grid'),
      columns = grid.get('columns'),
      pageSummary = _self._calculatePageSummary(),
      pageEl = _self.get('pageEl');
    _self.set('pageSummary',pageSummary);
    if(pageEl){
      BUI.each(columns,function(column){
        if(column.get('summary') && column.get('visible')){
          var id = column.get('id'),
            cellEl = pageEl.find('.' + CLS_COLUMN_PREFIX + id),
            text = _self._getSummaryCellText(column,pageSummary);
          cellEl.find('.' + CLS_GRID_CELL_TEXT).text(text);
        }
      });
      _self._updateFirstRow(pageEl,_self.get('pageSummaryTitle'));
    }
  },
  //閲嶇疆姹囨€绘暟鎹�
  resetSummary : function(pageSummary,summary){
    var _self = this,
      footerEl = _self.get('footerEl'),
      pageEl = null;

    footerEl.empty();

    pageSummary = pageSummary || _self.get('pageSummary');
    if(!pageSummary){
      pageSummary = _self._calculatePageSummary();
      _self.set('pageSummary',pageSummary);
    }
    summary = summary || _self.get('summary');
    pageEl = _self._creatSummaryRow(pageSummary,_self.get('pageSummaryTitle'));
    _self.set('pageEl',pageEl);
    _self._creatSummaryRow(summary,_self.get('summaryTitle'));
  },
  //鍒涘缓姹囨€�
  _creatSummaryRow : function(summary,title){
    if(!summary){
      return null;
    }
    var _self = this,
      footerEl = _self.get('footerEl'),
      tpl = _self._getSummaryTpl(summary),
      rowEl = $(tpl).appendTo(footerEl);
    
    _self._updateFirstRow(rowEl,title);
    return rowEl;
  },
  _updateFirstRow : function(rowEl,title){
    var firstCell = rowEl.find('td').first(),
        textEl = firstCell.find('.' + CLS_GRID_CELL_INNER);
    if(textEl.length){
      var textPrefix = title + ': ';
        text = textEl.text();
      if(text.indexOf(textPrefix) === -1){
        text = textPrefix + text;
      }
      firstCell.html(getInnerTemplate(text));
    }else{
      firstCell.html(getInnerTemplate(title + ': '));
    }
  },
  //鑾峰彇姹囨€绘ā鏉�
  _getSummaryTpl : function(summary){
    var _self = this,
      grid = _self.get('grid'),
      columns = grid.get('columns'),
      cellTempArray = [],
      prePosition = -1, //涓婃姹囨€诲垪鐨勪綅缃�
      currentPosition = -1,//褰撳墠浣嶇疆
      rowTemplate = null;

    $.each(columns, function (colindex,column) {
      if(column.get('visible')){
        currentPosition += 1;
        if(column.get('summary')){
          cellTempArray.push(getEmptyCellTemplate(currentPosition-prePosition - 1));

          var text = _self._getSummaryCellText(column,summary),
            temp = getCellTemplate(text,column.get('id'));
          cellTempArray.push(temp);
          prePosition = currentPosition;
        }
      }
    });
    if(prePosition !== currentPosition){
      cellTempArray.push(getEmptyCellTemplate(currentPosition-prePosition));
    }

    rowTemplate = ['<tr class="', CLS_SUMMARY_ROW,' ', CLS_GRID_ROW, '">', cellTempArray.join(''),getLastEmptyCell(), '</tr>'].join('');
    return rowTemplate;
  },
  //鑾峰彇姹囨€诲崟鍏冩牸鍐呭
  _getSummaryCellText : function(column,summary){
    var _self = this,
      val = summary[column.get('dataIndex')],
      value = val == null ? '' : val,
      renderer = column.get('renderer'),
      text = renderer ? renderer(value,summary) : value;
    return text;
  },
  _calculatePageSummary : function(){
    var _self = this,
      grid = _self.get('grid'),
      store = grid.get('store'),
      columns = grid.get('columns'),
      rst = {};

    BUI.each(columns,function(column){
      if(column.get('summary')){
        var dataIndex = column.get('dataIndex');
        rst[dataIndex] = store.sum(dataIndex);
      }
    });
    
    return rst;
  }
});

module.exports = summary;

});
define("bui/grid/plugins/rownumber", [], function(require, exports, module){
var CLS_NUMBER = 'x-grid-rownumber';
/**
 * @class BUI.Grid.Plugins.RowNumber
 * 琛ㄦ牸鏄剧ず琛屽簭鍙风殑鎻掍欢
 */
function RowNumber(config){
  RowNumber.superclass.constructor.call(this, config);
}

BUI.extend(RowNumber,BUI.Base);

RowNumber.ATTRS = 
{
  /**
  * column's width which contains the row number
  */
  width : {
    value : 40
  },
  /**
  * @private
  */
  column : {
    
  }
};

BUI.augment(RowNumber, 
{
  //鍒涘缓琛�
  createDom : function(grid){
    var _self = this;
    var cfg = {
          title : '',
          width : _self.get('width'),
          fixed : true,
          resizable:false,
          sortable : false,
          renderer : function(value,obj,index){return index + 1;},
          elCls : CLS_NUMBER
      },
      column = grid.addColumn(cfg,0);
    _self.set('column',column);
  }
});

module.exports = RowNumber;

});
define("bui/grid/plugins/columngroup", ["jquery","bui/common"], function(require, exports, module){

var $ = require("jquery"),
  BUI = require("bui/common"),
  PREFIX = BUI.prefix,
  CLS_HD_TITLE = PREFIX + 'grid-hd-title',
  CLS_GROUP = PREFIX + 'grid-column-group',
  CLS_GROUP_HEADER = PREFIX + 'grid-group-header',
  CLS_DOUBLE = PREFIX + 'grid-db-hd';

/**
 * 琛ㄥご鍒楀垎缁勫姛鑳�
 * @class BUI.Grid.Plugins.ColumnGroup
 * @extends BUI.Base
 */
var Group = function (cfg) {
  Group.superclass.constructor.call(this,cfg);
};

Group.ATTRS = {

  /**
   * 鍒嗙粍
   * @type {Array}
   */
  groups : {
    value : []
  },
  /**
   * 鍒楁ā鏉�
   * @type {String}
   */
  columnTpl : {
    value : '<th class="bui-grid-hd center" colspan="{colspan}"><div class="' + PREFIX + 'grid-hd-inner">' +
                      '<span class="' + CLS_HD_TITLE + '">{title}</span>' +
            '</div></th>'
  }
};

BUI.extend(Group,BUI.Base);

BUI.augment(Group,{

  renderUI : function (grid) {
    var _self = this,
      groups = _self.get('groups'),
      header = grid.get('header'),
      headerEl = header.get('el'),
      columns = header.get('children'),
      wraperEl = $('<tr class="'+CLS_GROUP+'"></tr>').prependTo(headerEl.find('thead'));

    headerEl.addClass(CLS_GROUP_HEADER);

    //閬嶅巻鍒嗙粍锛屾爣蹇楀垎缁�
    BUI.each(groups,function (group) {
      var tpl = _self._getGroupTpl(group),
        gEl = $(tpl).appendTo(wraperEl);
      
      group.el = gEl;
      for(var i = group.from; i <= group.to; i++){
        var column = columns[i];
        if(column){
          column.set('group',group);
        }
      }
    });

    var afterEl;
    //淇敼鏈垎缁勭殑rowspan鍜岃皟鏁翠綅缃�
    for(var i = columns.length - 1; i >=0 ; i--){
      var column = columns[i],
        group = column.get('group');
      if(group){
        afterEl = group.el;

      }else{
        var cEl = column.get('el');//$(_self.get('emptyTpl'));
        cEl.addClass(CLS_DOUBLE);
        cEl.attr('rowspan',2);
        if(afterEl){
          cEl.insertBefore(afterEl);
        }else{
          cEl.appendTo(wraperEl);
        }
        afterEl = cEl;
      }
    }
    if(groups[0].from !== 0){ //澶勭悊绗竴涓崟鍏冩牸杈规闂
      var firstCol = columns[groups[0].from];
      if(firstCol){
        firstCol.get('el').css('border-left-width',1);
      }
    }

     //绉婚櫎绌虹櫧鍒�

  },
  _getGroupTpl : function (group) {
    var _self = this,
      columnTpl = _self.get('columnTpl'),
      colspan = group.to - group.from + 1;
    return BUI.substitute(columnTpl,{colspan : colspan,title : group.title});
  }
});

module.exports = Group;

});
define("bui/grid/plugins/rowgroup", ["jquery","bui/common"], function(require, exports, module){

var $ = require("jquery"),
  BUI = require("bui/common"),
  DATA_GROUP = 'data-group',
  PREFIX = BUI.prefix,
  CLS_GROUP = PREFIX + 'grid-row-group',
  CLS_TRIGGER = PREFIX + 'grid-cascade',
  CLS_EXPAND = PREFIX + 'grid-cascade-expand';

//鏂扮殑鍒嗙粍
function newGroup (value,text) {
  return {items : [],value : value,text : text};
}

/**
 * 琛ㄥご鍒楀垎缁勫姛鑳斤紝浠呭鐞嗘暟鎹睍绀猴紝鎺掑簭锛屼笉澶勭悊杩欎釜杩囩▼涓殑澧炲垹鏀癸紝娣诲姞鍒犻櫎鍒�
 * @class BUI.Grid.Plugins.RowGroup
 * @extends BUI.Base
 */
var Group = function (cfg) {
  Group.superclass.constructor.call(this,cfg);
};

Group.ATTRS = {
 
  groups : {
    shared : false,
    value : []
  },
  /**
   * 娓叉煋鍒嗙粍鍐呭锛屽嚱鏁板師鍨� function(text,group){}
   *
   *  - text 鏄垎缁勫瓧娈垫牸寮忓寲鍚庣殑鏂囨湰
   *  - group 鏄綋鍓嶅垎缁勶紝鍖呮嫭,text(鏂囨湰锛�,value锛堝€硷級,items锛堝垎缁勫寘鍚殑椤癸級
   * @type {Function}
   */
  renderer : {

  }
};

BUI.extend(Group,BUI.Base);

BUI.augment(Group,{

  renderUI : function (grid) {
    var _self = this,
      tbodyEl = grid.get('el').find('tbody');
    _self.set('grid',grid);
    _self.set('tbodyEl',tbodyEl);

  },
  bindUI : function (grid) {
    var _self = this,
       groups = [];

    //鏄剧ず瀹屾垚璁板綍鏃�
    grid.on('aftershow',function () {
      var items = grid.getItems(),
        column = _self._getSortColumn();
      _self._clear();
      if(column){
        grid.get('view').getAllElements().hide();
        var field = column.get('dataIndex');
        BUI.each(items,function (item,index) {
          var last = groups[groups.length - 1],
            renderer = column.get('renderer'),
            value = item[field],
            text;
          if(!last || value != last.value){
            text = renderer ? renderer(value,item) : value;
            var current = newGroup(value,text);
            current.begin = index;
            groups.push(current);
            last && _self._createGroup(last);
            last = current;
          }
          
          last.items.push(item);
          
          
        });
        var last = groups[groups.length - 1];
        last && _self._createGroup(last);
        _self.set('groups',groups);
      }
      
    });

    //娓呴櫎鎵€鏈夎褰曟椂
    grid.on('clear',function () {
      _self._clear();
    });

    _self.get('tbodyEl').delegate('.' + CLS_TRIGGER,'click',function (ev) {
      var sender = $(ev.currentTarget),
        group = _self._getGroupData(sender);
      if(sender.hasClass(CLS_EXPAND)){
        _self._collapse(group);
        sender.removeClass(CLS_EXPAND);
      }else{
        _self._expand(group);
        sender.addClass(CLS_EXPAND);
      }

    });
  },
  //鑾峰彇鎺掑簭鐨勫瓧娈靛搴旂殑鍒�
  _getSortColumn: function(){
    var _self = this,
      grid = _self.get('grid'),
      store = grid.get('store'),
      field = store.get('sortField');

    return grid.findColumnByField(field);
  },
  //鑾峰彇鍒嗙粍鐨勬暟鎹�
  _getGroupData : function (el) {
    var _self = this,
      groupEl = el.closest('.' + CLS_GROUP);
    return groupEl.data(DATA_GROUP);
  },
  _createGroup : function (group) {
    var _self = this,
      grid = _self.get('grid'),
      item = group.items[0],
      firstEl = grid.findElement(item),
      count = grid.get('columns').length,
      renderer = _self.get('renderer'),
      text = renderer ? renderer(group.text,group) : group.text,
      tpl = '<tr class="'+CLS_GROUP+'"><td colspan="' + (count + 1) + '"><div class="bui-grid-cell-inner"><span class="bui-grid-cell-text"><span class="bui-grid-cascade"><i class="bui-grid-cascade-icon"></i></span> ' + text + '</span></div></td></tr>',
      node = $(tpl).insertBefore(firstEl);
    node.data(DATA_GROUP,group);
  },
  _getGroupedElements : function(group){
    var _self = this,
      grid = _self.get('grid'),
      elements = grid.get('view').getAllElements(),
      begin = group.begin,
      end = group.items.length + begin,
      rst = [];
    for(var i = begin; i < end; i++){
      rst.push(elements[i]);
    }
    return $(rst);
  },
  _expand : function (group) {
    var _self = this,
      subEls = _self._getGroupedElements(group);
    subEls.show();
  },
  _collapse : function (group) {
     var _self = this,
      subEls = _self._getGroupedElements(group);
    subEls.hide();
  },
  _clear : function () {
    var _self = this,
      groups = _self.get('groups'),
      tbodyEl = _self.get('tbodyEl');

    BUI.Array.empty(groups);
    tbodyEl.find('.' + CLS_GROUP).remove();

  }
});

module.exports = Group;

});
define("bui/grid/plugins/columnresize", ["jquery","bui/common"], function(require, exports, module){
/**
 * @fileOverview 鎷栨嫿鏀瑰彉鍒楃殑瀹藉害
 * @ignore
 */

var $ = require("jquery"),
  BUI = require("bui/common"),
  NUM_DIS = 15,
  NUM_MIN = 30,
  STYLE_CURSOR = 'col-resize';

var Resize = function(cfg){
  Resize.superclass.constructor.call(this,cfg);
};

Resize.ATTRS = {
  /**
   * @private
   * 鏄惁姝ｅ湪鎷栨嫿
   * @type {Boolean}
   */
  resizing : {
    value : false
  },
  //鎷栨嫿灞炴€�
  draging : {

  }
};

BUI.extend(Resize,BUI.Base);

BUI.augment(Resize,{

  renderUI : function(grid){
    this.set('grid',grid);
  },

  bindUI : function(grid){
    var _self = this,
      header = grid.get('header'),
      curCol,
      preCol,
      direction;

    header.get('el').delegate('.bui-grid-hd','mouseenter',function(ev){
      var resizing = _self.get('resizing');
      if(!resizing){
        var sender = ev.currentTarget;
        curCol = _self._getColumn(sender);
        preCol = _self._getPreCol(curCol);
      }
    }).delegate('.bui-grid-hd','mouseleave',function(ev){
      var resizing = _self.get('resizing');
      if(!resizing && curCol){
        curCol.get('el').css('cursor','');
        curCol = null; 
      }
    }).delegate('.bui-grid-hd','mousemove',function(ev){
      var resizing = _self.get('resizing');

      if(!resizing && curCol){
        var el = curCol.get('el'),
          pageX = ev.pageX,
          offset = el.offset(),
          left = offset.left,
          width = el.width();
          
        if(pageX - left < NUM_DIS && preCol){
          el.css('cursor',STYLE_CURSOR);
          direction = -1;
        }else if((left + width) - pageX < NUM_DIS){
          direction = 1;
          el.css('cursor',STYLE_CURSOR);
        }else{
          curCol.get('el').css('cursor','');
        }
      }

      if(resizing){
        ev.preventDefault();
        var draging = _self.get('draging'),
          start = draging.start,
          pageX = ev.pageX,
          dif = pageX - start,
          width = direction > 0 ? curCol.get('width') : preCol.get('width'),
          toWidth = width + dif;
        if(toWidth > NUM_MIN && toWidth < grid.get('el').width()){
          draging.end = pageX;
          _self.moveDrag(pageX);
        }
      }

    }).delegate('.bui-grid-hd','mousedown',function(ev){
      var resizing = _self.get('resizing');
      if(!resizing && curCol && curCol.get('el').css('cursor') == STYLE_CURSOR){
        ev.preventDefault();
        _self.showDrag(ev.pageX);
        bindDraging();
      }
    });

    function callback(ev){
      var draging = _self.get('draging')
      if(curCol && draging){
        var col = direction > 0 ? curCol : preCol,
          width = col.get('width'),
          dif = draging.end - draging.start;

        _self.hideDrag();
        if(grid.get('forceFit')){
          var originWidth = col.get('originWidth'),
            factor = width / originWidth,
            toWidth = (width + dif) / factor;
         // console.log(originWidth + ' ,'+width);
          col.set('originWidth',toWidth);
          col.set('width',toWidth);
          //

        }else{
          col.set('width',width + dif);
        }
        
      }    
      $(document).off('mouseup',callback);
    }

    function bindDraging(){
      $(document).on('mouseup',callback);
    }

  },
  //鏄剧ず鎷栨嫿
  showDrag : function(pageX){
    var _self = this,
      grid = _self.get('grid'),
      header = grid.get('header'),
      bodyEl = grid.get('el').find('.bui-grid-body'),
      height = header.get('el').height() + bodyEl.height(),
      offset = header.get('el').offset(),
      dragEl = _self.get('dragEl');

    if(!dragEl){
      var  tpl = '<div class="bui-drag-line"></div>';
      dragEl = $(tpl).appendTo('body');
      _self.set('dragEl',dragEl);
    }

    dragEl.css({
      top: offset.top,
      left: pageX,
      height : height
    });

    _self.set('resizing',true);

    _self.set('draging',{
      start : pageX,
      end : pageX
    });
    dragEl.show();
  },
  //鍏抽棴鎷栨嫿
  hideDrag : function(){
    var _self = this,
      dragEl = _self.get('dragEl');
    dragEl && dragEl.hide();
    _self.set('draging',null);
    _self.set('resizing',false);
  },
  //绉诲姩drag
  moveDrag : function(pageX){
    var _self = this,
      dragEl = _self.get('dragEl');
    dragEl && dragEl.css('left',pageX);
  },
  //鑾峰彇鐐瑰嚮鐨勫垪
  _getColumn : function(element){
    var _self = this,
      columns = _self.get('grid').get('columns'),
      rst = null;
    BUI.each(columns,function(column){
      if(column.containsElement(element)){
        rst = column;
        return false;
      }
    });

    return rst;
  },
  //鑾峰彇鍓嶄竴涓垪
  _getPreCol : function(col){
    var _self = this,
      columns = _self.get('grid').get('columns'),
      rst = null;
    BUI.each(columns,function(column,index){
      if(column == col){
        return false;
      }else if(column.get('visible')){
        rst = column;
      }
      
    });

    return rst;
  }
});

module.exports = Resize;

});
define("bui/grid/plugins/columnchecked", ["jquery","bui/common"], function(require, exports, module){
var $ = require("jquery"),
  BUI = require("bui/common");


/**
 * 琛ㄦ牸鑷€傚簲瀹藉害
 * @class BUI.Grid.Plugins.ColumnChecked
 * @extends BUI.Base
 */
var Checked = function(cfg){
  Checked.superclass.constructor.call(this,cfg);
};

BUI.extend(Checked,BUI.Base);

Checked.ATTRS = {

  /**
   * 瑙﹀彂鐨勬牱寮忥紝榛樿 锛� x-col-checkbox
   * @type {String}
   */
  triggerCls : {
    value : 'x-col-checkbox'
  },
  /**
   * 鏈€変腑鐨勬ā鏉�
   * @type {String}
   */
  uncheckedTpl : {
    value : '<span class="x-col-checkbox"></span>'
  },
  /**
   * 閫変腑鐨勬ā鏉�
   * @type {String}
   */
  checkedTpl : {
    value : '<span class="x-col-checkbox x-col-checkbox-checked"></span>'
  }
};

BUI.augment(Checked,{

  renderUI : function(grid){
    var _self = this,
      columns = grid.get('columns'),
      uncheckedTpl = _self.get('uncheckedTpl'),
      checkedTpl = _self.get('checkedTpl');

    BUI.each(columns,function(column){
      if(column.get('checkable')){
        var renderer = column.get('renderer');
        var newRender = function(value,obj){
          var text = renderer ? renderer(value,obj) : '';
          if(value){
            text = checkedTpl + text;
          }else{
            text = uncheckedTpl + text;
          }
          return text;
        };

        column.set('renderer',newRender);
      }
    });
  },
  bindUI : function(grid){
    var _self = this,
      triggerCls = _self.get('triggerCls'),
      store = grid.get('store');

    grid.on('cellclick',function(ev){
      var sender = $(ev.domTarget);
      if(sender.hasClass(triggerCls)){
        var  record = ev.record,
          field = ev.field,
          value = record[field];
        store.setValue(record,field,!value);
        return false; //闃绘榛樿琛屼负
      }
    });
  }
});


module.exports = Checked;
});

(function () {
  
  if(BUI.loaderScript.getAttribute('data-auto-use') == 'false'){
    return;
  }
  BUI.use(['bui/common','bui/data','bui/list','bui/picker',
    'bui/menu','bui/toolbar',
    'bui/form','bui/mask','bui/select','bui/tab',
    'bui/calendar','bui/overlay','bui/editor','bui/grid','bui/tooltip'
  ]);
})();