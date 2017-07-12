/* eslint-env mocha */

const request = require('request')
const sinon = require('sinon')
const expect = require('chai').expect
const rework = require('rework')
const plugin = require('../')

describe('charset detection', function () {
  it('detectCharsetEncoding is exported for testing', function () {
    expect(plugin.__test__).to.be.a('object')
    expect(plugin.__test__).have.property('detectCharsetEncoding')
  })

  it('no charset info presents', function () {
    let charset = plugin.__test__.detectCharsetEncoding({}, Buffer.from('no charset present'))
    expect(charset).to.be.a('null')
  })

  it('HTTP header charset detection method is prefered', function () {
    let charset = plugin.__test__.detectCharsetEncoding({'content-type': 'text/html; charset=ISO-8859-4'}, Buffer.from('@charset "UTF-8"'))
    expect(charset).to.equal('ISO-8859-4')
  })

  it('@charset detection method ok', function () {
    let charset = plugin.__test__.detectCharsetEncoding({}, Buffer.from('@charset "UTF-8"'))
    expect(charset).to.equal('UTF-8')
  })

  it('@charset detection method wrong case', function () {
    let charset = plugin.__test__.detectCharsetEncoding({}, Buffer.from('@charset  "UTF-8"'))
    expect(charset).to.be.a('null')
  })
})

const baseUrl = 'http://some.domain/base/path/'
let requestStub

describe('@import stylesheet', function () {
  before(function () {
    const body = Buffer.from('')
    requestStub = sinon
      .stub(request, 'get')
      .yields(new Error('test error'), {
        headers: {
          location: ''
        },
        body: body
      }, body)
  })

  after(function () {
    request.get.restore()
  })

  it('should process simple @import rule', function (done) {
    const testUrl = baseUrl + 'test.css'
    const testCSSBody = Buffer.from(`h1 {color: #000;}`)

    requestStub.withArgs({
      url: testUrl,
      headers: {}
    }).yields(null, {
      headers: {
        location: testUrl
      },
      body: testCSSBody
    }, testCSSBody)

    let indexCSS = `@import "test.css"; body {background: #fff;}`

    var css = rework(indexCSS, {
      source: baseUrl
    }).use(plugin({
      request: {
        obj: request
      }
    }, (err, _) => {
      let cssString = css.toString()
      expect(err).to.be.a('null')
      expect(cssString).to.be.a('string')
      expect(cssString).to.equal(`h1 {
  color: #000;
}

body {
  background: #fff;
}`)
      done()
    }))
  })

  it('should process recursive @import rule', function (done) {
    const test1Url = baseUrl + 'test1.css'
    const test1CSSBody = Buffer.from(`h1 {color: #000;} @import "test2.css";`)
    requestStub.withArgs({
      url: test1Url,
      headers: {}
    }).yields(null, {
      headers: {
        location: test1Url
      },
      body: test1CSSBody
    }, test1CSSBody)

    const test2Url = baseUrl + 'test2.css'
    const test2CSSBody = Buffer.from(`h2 {color: #000;}`)
    requestStub.withArgs({
      url: test2Url,
      headers: {}
    }).yields(null, {
      headers: {
        location: test2Url
      },
      body: test2CSSBody
    }, test2CSSBody)

    let indexCSS = `@import "test1.css"; body {background: #fff;}`

    var css = rework(indexCSS, {
      source: baseUrl
    }).use(plugin({
      request: {
        obj: request
      }
    }, (err, _) => {
      let cssString = css.toString()
      expect(err).to.be.a('null')
      expect(cssString).to.be.a('string')
      expect(cssString).to.equal(`h1 {
  color: #000;
}

h2 {
  color: #000;
}

body {
  background: #fff;
}`)
      done()
    }))
  })

  it('should deal/ignore circle @import rule', function (done) {
    const testUrl = baseUrl + 'test.css'
    const testCSSBody = Buffer.from(`@import "test.css"; h1 {color: #000;}`)

    requestStub.withArgs({
      url: testUrl,
      headers: {}
    }).yields(null, {
      headers: {
        location: testUrl
      },
      body: testCSSBody
    }, testCSSBody)

    let indexCSS = `@import "test.css"; body {background: #fff;}`

    var css = rework(indexCSS, {
      source: baseUrl
    }).use(plugin({
      request: {
        obj: request
      }
    }, (err, _) => {
      let cssString = css.toString()
      expect(err).to.be.a('null')
      expect(cssString).to.be.a('string')
      expect(cssString).to.equal(`h1 {
  color: #000;
}

body {
  background: #fff;
}`)
      done()
    }))
  })

  // TODO add some additional tricky tests
  // import form full URL (another domain)
  // missing import file
})
