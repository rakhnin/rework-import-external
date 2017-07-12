'use strict'

const url = require('url')
const request = require('request')
const iconv = require('iconv')
const eachSeries = require('async').eachSeries
const parseImport = require('parse-import')
const rework = require('rework')
const reworkPluginUrl = require('rework-plugin-url')

/**
 * Load content by an external source URL
 *
 * @param {String|URL}   source   URL
 * @param {Object}       options
 * @param {Function}     next     callback
 * @api private
 * @return null
 */
function load (source, options, next) {
  // dependency injection for tests
  const requestObj = (options.request && options.request.obj) || request
  requestObj.get({
    url: source,
    headers: (options.request && options.request.headers) || {}
  }, function (err, res, _) {
    if (err) {
      return next(err)
    } else {
      next(null, rework(decodeBody(res).toString(), Object.assign({}, options.rework || {}, {
        source: res.headers.location || source
      })).use(reworkPluginUrl(function (uri) {
        return url.resolve(source, uri)
      })))
    }
  })
}

/**
 * Detect charset encoding by response headers and body
 * @param  {Object} headers response headers
 * @param  {Buffer|String} body    [description]
 * @return {String|null}
 */
function detectCharsetEncoding (headers, body) {
  let encoding = null
  const httpCharsetRegex = /charset=([a-z0-9\-_]+)/i
  if (headers && headers['content-type']) {
    let matches = httpCharsetRegex.exec(headers['content-type'])
    encoding = (matches && matches[1]) || encoding
  }
  if (!encoding) {
    // TODO detect by using stream of bytes that begins the style sheet. See table at https://www.w3.org/TR/CSS2/syndata.html#x57
    const cssCharsetRegex = /^@charset "([a-z0-9\-_]+)"/i
    var matches = cssCharsetRegex.exec(body.slice(0, 256).toString())
    encoding = (matches && matches[1]) || encoding
  }
  return encoding
}

/**
 * decode body by detected encoding
 * @param  {Object} res of Response interface
 * @return {Buffer}
 */
function decodeBody (res) {
  try {
    const encoding = detectCharsetEncoding(res.headers, res.body)
    return (encoding) ? iconv.decode(res.body, encoding) : res.body
  } catch (e) {
    return res.body
  }
}

/**
 * Run plugin
 *
 * @param {Object}    style
 * @param {Object}    options
 * @param {Function}  next     callback
 * @api private
 * @return null
 */

function run (stylesheet, options, next) {
  options = Object.assign({
    rework: {
      silent: false
    },
    // TODO implement
    formatter: function (val) { return val },
    skipToImportList: []
  }, options || {})

  let rules = stylesheet.rules || []
  let ret = []

  eachSeries(rules, function (rule, cb) {
    switch (rule.type) {
      case 'import':
        var importRule = '@import ' + rule.import + ';'
        var data = parseImport(importRule)[0]
        if (!data) {
          return setTimeout(cb, 0)
        }
        options.source = url.resolve(rule.position.source, data.path)
        if (options.skipToImportList.indexOf(options.source) >= 0) {
          return setTimeout(cb, 0)
        }
        options.skipToImportList.push(options.source)
        load(options.source, options, function (err, content) {
          if (err) {
            return setTimeout(cb, 0)
          }
          run(content.obj.stylesheet, options, function (_, __) {
            if (!data.condition || !data.condition.length) {
              ret = ret.concat(content.obj.stylesheet.rules)
            } else {
              ret.push({
                media: data.condition,
                rules: content.obj.stylesheet.rules,
                type: 'media'
              })
            }
            return setTimeout(cb, 0)
          })
        })
        break

      case 'charset':
        return setTimeout(cb, 0)

      case 'rule':
        rule.declarations = rule.declarations || []
        ret.push(rule)
        return setTimeout(cb, 0)

      default:
        ret.push(rule)
        return setTimeout(cb, 0)
    }
  }, function (err) {
    stylesheet.rules = ret
    next(err, stylesheet)
  })
}

/**
 * Module exports
 */
module.exports = function (options, next) {
  return function (style) {
    run(style, options, next)
  }
}

// export private methods for unit tests
if (process.env.NODE_ENV === 'test') {
  module.exports.__test__ = {
    load: load,
    detectCharsetEncoding: detectCharsetEncoding
  }
}
