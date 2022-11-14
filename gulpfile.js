var gulp = require('gulp'),
    del = require('del'),
    sass = require('gulp-sass')(require('sass')),
    plugins = require('gulp-load-plugins')();

var path = {
  apps:         "src/js/",
  modules:      "src/js/app/",
  libRequire:   "src/js/lib/requirejs/require.js",
  libs:         "src/js/lib/",
  libsFiles:    function(){ return [
                  this.libs + 'modernizr-lite/modernizr.js',
                  this.libs + 'jquery/dist/jquery.min.js',
                  this.libs + 'jquery.easing/js/jquery.easing.min.js',
                  this.libs + 'jquery.stellar/jquery.stellar.min.js',
                  this.libs + 'waypoints/lib/jquery.waypoints.min.js',
                  this.libs + 'lozad/dist/lozad.min.js',
  ]}
};

gulp.task('clean', function(cb) {
  del([
    'js/**',
    'css/**'
  ], cb);
});

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

gulp.task('bower', function(){
  return plugins.bower()
      .pipe(gulp.dest('src/js/lib'));
});

gulp.task('scss', function() {
  return gulp.src('src/scss/*.scss')
    .pipe(sass({
      sourcemap: true,
      trace: true,
      loadPath: __dirname + 'src/scss'
    }))
    .pipe(gulp.dest('css/'));
});

gulp.task('default', gulp.series('scss', 'bower', 'requirejs', 'js-modules', 'js-apps', 'js-libs'));
