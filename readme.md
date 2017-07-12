# rework-import-external

> A rework plugin to download and inline CSS for external source via \@import


## Install

```bash
$ npm install --save rework-import-external
```


## Usage

```js
const rework = require('rework');
const plugin = require('rework-import-external');

let css = rework(`
\@import "style1.css" (min-width: 100px);
\@import "/root/path/style2.css";
\@import "../style3.css";
`, {
  // base URL
  source: 'http://some.domain/base/path/'
}).use(plugin({}, (err, ast) => {
  css.toString()
}))
```

## License

MIT © [Andriy Rakhnin](https://github.com/rakhnin)
