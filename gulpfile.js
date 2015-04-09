var gulp = require('gulp'),
    plugins = require('gulp-load-plugins')();

var path = {
  libs:         "src/js/lib/",
  libsFiles:    function(){ return [
                  this.libs + 'modernizr-lite/modernizr.js',
                  this.libs + 'jquery/dist/jquery.min.js',
                  this.libs + 'jquery.easing/js/jquery.easing.min.js',
                  this.libs + 'jquery.stellar/jquery.stellar.min.js',
                  this.libs + 'waypoints/lib/jquery.waypoints.min.js'
  ]}
};

gulp.task('js', function () {
   return gulp.src(['src/js/**/*.js', '!src/js/lib/**/*.js'])
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('default'))
      //.pipe(plugins.uglify())
      .pipe(plugins.concat('application.js'))
      .pipe(gulp.dest('js'));
});

gulp.task('jslibs', function () {
   return gulp.src(path.libsFiles())
      .pipe(plugins.concat('libs.js'))
      .pipe(gulp.dest('js'));
});

gulp.task('bower', function(){
  return plugins.bower()
      .pipe(gulp.dest('src/js/lib'));
});

gulp.task('scss', function() {
  return gulp.src('src/scss/*.scss')
    .pipe(plugins.sass({
      sourcemap: true,
      trace: true,
      loadPath: __dirname + 'src/scss'
    }))
    .pipe(gulp.dest('css/'));
});

gulp.task('default', ['scss', 'bower', 'jslibs', 'js']);
