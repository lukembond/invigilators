const { src, dest, series, parallel } = require('gulp');
const del = require('del');
const scss = require('gulp-sass');
const minifyJS = require('gulp-minify');
const minifyCSS = require('gulp-csso');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');

const path = {
    apps: "src/js/",
    modules: "src/js/app/",
    libRequire: "src/js/lib/requirejs/require.js",
    libs: "src/js/lib/",
    libsFiles: function () {
      return [
        this.libs + 'modernizr-lite/modernizr.js',
        this.libs + 'jquery/dist/jquery.min.js',
        this.libs + 'jquery.easing/js/jquery.easing.min.js',
        this.libs + 'jquery.stellar/jquery.stellar.min.js',
        this.libs + 'waypoints/lib/jquery.waypoints.min.js'
      ]
    }
};

function clean(cb) {
    del([
      'js/**',
      'css/**'
    ], cb);
}

function html() {
    return
//   return src('client/templates/*.pug')
//     .pipe(pug())
//     .pipe(dest('build/html'))
}

function css() {
  return src('src/scss/*.scss')
    .pipe(scss({
        sourcemap: true,
        trace: true,
        loadPath: __dirname + 'src/scss'
    }))
    .pipe(minifyCSS())
    .pipe(dest('css/'))
}

function requirejs() {
  return src([path.libRequire], { sourcemaps: true })
    .pipe(minifyJS())
    .pipe(dest('js/libs'))
}

exports.clean = clean;
exports.css = css;
exports.html = html;
exports.requirejs = requirejs;
exports.default = series(clean, parallel(/*html,*/ css, /*requirejs*/));