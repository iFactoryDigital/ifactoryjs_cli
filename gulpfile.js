/**
 * Created by Awesome on 1/30/2016.
 */

// use strict
'use strict';

// import dependencies
var gulp       = require('gulp');
var glob       = require('glob');
var rename     = require('gulp-rename');
var sass       = require('gulp-sass');
var through    = require('through2');
var path       = require('path');
var routing    = require('./bin/util/gulp.routing');
var menus      = require('./bin/util/gulp.menus');
var fs         = require('fs');
var del        = require('del');
var server     = require('gulp-express');
var minifyCss  = require('gulp-minify-css');
var sourcemaps = require('gulp-sourcemaps');
var browserify = require('browserify');
var babelify   = require('babelify');
var source     = require('vinyl-source-stream');
var concat     = require('gulp-concat');
var riot       = require('gulp-riot');
var insert     = require('gulp-insert');
var streamify  = require('gulp-streamify');
var uglify     = require('gulp-uglify');

/**
 * GULP TASKS
 */

// gulp sass task
gulp.task('sass', function () {
    var allSass = '';
    gulp.src(['node_modules/bootstrap/scss/bootstrap-flex.scss', './bin/bundles/*/resources/scss/bootstrap.scss', './app/bundles/*/resources/scss/bootstrap.scss'])
        .pipe(through.obj(function(chunk, enc, cb) {
            allSass = allSass + '@import ".' + chunk.path.replace(__dirname, '').split('\\').join('/') + '"; ';

            this.push({ allSass : allSass });
            cb(null, chunk);
        }))
        .on('data', function (data) {
            // do nothing
        })
        .on('end', function () {
            fs.writeFile('./tmp.scss', allSass, function (err) {
                if (err) {
                    return console.log(err);
                }
                gulp.src('./tmp.scss')
                    .pipe(sourcemaps.init())
                    .pipe(sass({outputStyle: 'compressed'}))
                    .pipe(rename('app.min.css'))
                    .pipe(sourcemaps.write('./'))
                    .pipe(gulp.dest('./www/assets/css'))
                    .on('end', function() {
                        fs.unlinkSync('./tmp.scss');
                    });
            });
        })
});

// gulp daemons task
gulp.task('daemons', function() {
    var entries = glob.sync('./bin/bundles/**/*Daemon.js');
        entries = entries.concat(glob.sync('./app/bundles/**/*Daemon.js'));

    for (var key in entries) {
        entries[key] = entries[key].replace('./', '/');
    }

    fs.writeFile('./cache/daemons.json', JSON.stringify(entries), function (err) {
        if (err) {
            return console.log(err);
        }
    });
});

// gulp routes task
gulp.task('routes', function () {
    var allRoutes = {};
    gulp.src('./app/bundles/**/*Controller.js')
        .pipe(through.obj(routing))
        .on('data', function (data) {
            MergeRecursive(allRoutes, data.routes);
        })
        .on('end', function () {
            fs.writeFile('./cache/routes.json', JSON.stringify(allRoutes), function (err) {
                if (err) {
                    return console.log(err);
                }
            });
        });
});

// gulp routes task
gulp.task('menus', function () {
    var allMenus = {};
    gulp.src('./app/bundles/**/*Controller.js')
        .pipe(through.obj(menus))
        .on('data', function (data) {
            MergeRecursive(allMenus, data.menus);
        })
        .on('end', function () {
            fs.writeFile('./cache/menus.json', JSON.stringify(allMenus), function (err) {
                if (err) {
                    return console.log(err);
                }
            });
        });
});

// gulp views task
gulp.task('views', function() {
    gulp.src(['./bin/bundles/*/view/**/*.hbs', './app/bundles/*/view/**/*.hbs'])
        .pipe(rename(function(filePath) {
            var amended = filePath.dirname.split(path.sep);
            amended.shift();
            amended.shift();
            filePath.dirname = amended.join(path.sep);
        }))
        .pipe(gulp.dest('cache/view'));
});

// gulp tags task
gulp.task('tags', function() {
    gulp.src(['./bin/bundles/*/view/**/*.tag', './app/bundles/*/view/**/*.tag'])
        .pipe(rename(function(filePath) {
            var amended = filePath.dirname.split(path.sep);
            amended.shift();
            amended.shift();
            amended.shift();
            filePath.dirname = amended.join(path.sep);
        }))
        .pipe(riot({
            compact: true
        }))
        .pipe(concat('tags.min.js'))
        .pipe(insert.prepend('var riot = require(\'riot\');'))
        .pipe(gulp.dest('./cache/tag'));
});

// gulp routes task
gulp.task('javascript', function () {
    var entries = glob.sync('./bin/bundles/*/resources/js/bootstrap.js');
        entries = entries.concat(glob.sync('./app/bundles/*/resources/js/bootstrap.js'));

    browserify({
        entries : entries
    })
        .transform(babelify)
        .bundle()
        .pipe(source('app.min.js'))
        .pipe(insert.prepend(fs.readFileSync('./node_modules/bootstrap/dist/js/bootstrap.js')))
        .pipe(insert.prepend(fs.readFileSync('./node_modules/jquery/dist/jquery.min.js')))
        .pipe(streamify(uglify()))
        .pipe(gulp.dest('./www/assets/js'));
});

/**
 * GULP WATCH TASKS
 */

// gulp sass watch task
gulp.task('sass:watch', function () {
    gulp.watch('./app/bundles/**/*.scss', ['sass']);
});

// gulp daemons watch task
gulp.task('daemons:watch', function () {
    gulp.watch('./app/bundles/**/*Daemon.js', ['daemons']);
});

// gulp routes watch task
gulp.task('routes:watch', function () {
    gulp.watch('./app/bundles/**/*Controller.js', ['routes']);
});

// gulp routes watch task
gulp.task('menus:watch', function () {
    gulp.watch('./app/bundles/**/*Controller.js', ['menus']);
});

// gulp routes watch task
gulp.task('views:watch', function () {
    gulp.watch('./app/bundles/**/*.hbs', ['views']);
});

// gulp routes watch task
gulp.task('javascript:watch', function () {
    gulp.watch('./app/bundles/*/resources/js/**/*.js', ['javascript']);
});

// gulp routes watch task
gulp.task('tags:watch', function () {
    gulp.watch('./app/bundles/*/view/**/*.tag', ['tags']);
});

// main gulp watch task
gulp.task('watch', ['sass:watch', 'routes:watch', 'menus:watch', 'views:watch', 'tags:watch', 'javascript:watch']);
gulp.task('install', ['sass', 'routes', 'menus', 'views', 'tags', 'javascript']);

// full server task
gulp.task('devServer', function () {
    // Start the server at the beginning of the task
    server.run(['./bin/server.js']);

    // watch sass pipe
    gulp.watch(['./app/bundles/**/*.scss'], function(event){
        gulp.run('sass');
        server.notify(event);
    });

    // watch daemons pipe
    gulp.watch(['./app/bundles/**/*Daemon.js'], function(event){
        gulp.run('daemons');
        server.notify(event);
    });

    // watch routes pipe
    gulp.watch(['./app/bundles/**/*Controller.js'], function(event){
        gulp.run('routes');
        server.notify(event);
    });

    // watch menus pipe
    gulp.watch(['./app/bundles/**/*Controller.js'], function(event){
        gulp.run('menus');
        server.notify(event);
    });

    // watch views pipe
    gulp.watch(['./app/bundles/**/*.hbs'], function(event) {
        gulp.run('views');
        server.notify(event);
    });

    // watch tags pipe
    gulp.watch(['./app/bundles/**/*.tag'], function(event) {
        gulp.run('tags');
        gulp.run('javascript');
        server.notify(event);
    });

    // watch javascript
    gulp.watch(['./app/bundles/*/resources/js/**/*.js'], function(event) {
        gulp.run('javascript');
        server.notify(event);
    });
});

// set default task devServer
gulp.task('default', ['devServer']);

/**
 * recursively merge object
 * @param obj1
 * @param obj2
 * @returns {*}
 * @constructor
 */
function MergeRecursive(obj1, obj2) {
    for (var p in obj2) {
        try {
            // Property in destination object set; update its value.
            if (obj2[p].constructor == Object) {
                obj1[p] = MergeRecursive(obj1[p], obj2[p]);
            } else {
                obj1[p] = obj2[p];
            }
        } catch (e) {
            // Property in destination object not set; create it and set its value.
            obj1[p] = obj2[p];
        }
    }

    return obj1;
}