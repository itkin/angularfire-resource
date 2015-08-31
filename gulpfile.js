var gulp = require('gulp'),
    gutil = require('gulp-util'),
    concat = require('gulp-concat'),
    coffee = require('gulp-coffee'),
    gulpFilter = require('gulp-filter'),
    sourcemaps = require('gulp-sourcemaps'),
    connect = require('gulp-connect'),
    nodemon = require('gulp-nodemon'),
    order = require("gulp-order");

gulp.task('firebase-server', function () {
  nodemon({
    script: 'demo/firebase-server.js'
    //, ext: 'js html'
    , env: { 'NODE_ENV': 'development' }
  })
});

gulp.task('coffee', function(done) {
  //var coffeeFilter = gulpFilter('**/*.coffee',{restore: true});
  return gulp.src('src/**/*.coffee')
    //.pipe(coffeeFilter)
    .pipe(coffee({bare: true}).on('error', gutil.log))
    //  .on('error', gutil.log))
    //.pipe(coffeeFilter.restore)
    .pipe(concat('angularfire-resource.js'))
    .pipe(gulp.dest('dist'))
    .pipe(gulp.dest('demo'))
    .pipe(connect.reload())

    //.pipe(gulp.dest('tmp'));
    //.pipe()
});



gulp.task('html', function(){
  gulp.src('demo/*.html')
    .pipe(connect.reload())
});

gulp.task('watch', function () {
  gulp.watch(['demo/*'], ['html']);
  gulp.watch('src/**/*.coffee', ['coffee']);
});

gulp.task('connect', function() {
  connect.server({
    root: 'demo',
    livereload: true
  });
});

// Default Task
//gulp.task('default', ['firebase-server', 'connect', 'coffee', 'watch']);
gulp.task('default', ['connect', 'coffee', 'watch']);
