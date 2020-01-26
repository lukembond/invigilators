var gulp = require('gulp'),
  del = require('del'),
  plugins = require('gulp-load-plugins')();

var path = {
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

gulp.task('js-modules', function () {
  return gulp.src([path.modules + '**/*.js'])
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('default'))
    //.pipe(plugins.concat('application.js'))
    .pipe(gulp.dest('js/app'));
});

gulp.task('js-apps', function () {
  return gulp.src([path.apps + '*.js'])
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('default'))
    //.pipe(plugins.concat('appAdmin.js'))
    .pipe(gulp.dest('js'));
});

gulp.task('requirejs', function () {
  return gulp.src([path.libRequire])
    //.pipe(plugins.concat('require.js'))
    .pipe(gulp.dest('js/libs'));
});

gulp.task('js-libs', function () {
  return gulp.src(path.libsFiles())
    .pipe(plugins.concat('libs.min.js'))
    .pipe(gulp.dest('js/libs'));
});

gulp.task('default', ['scss', 'requirejs', 'js-modules', 'js-apps', 'js-libs']);