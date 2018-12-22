// Require environment
require('./lib/env');

// Require dependencies
const fs       = require('fs-extra');
const gulp     = require('gulp');
const path     = require('path');
const glob     = require('globby');
const server   = require('gulp-develop-server');

// Require local dependencies
const config = require('config');
const parser = require('lib/utilities/parser');

/**
 * Create Loader class
 */
class Loader {
  /**
   * Construct Loader class
   */
  constructor() {
    // Check cache exists
    if (!fs.existsSync(`${global.appRoot}/data/cache`)) {
      // Create cache
      fs.mkdirSync(`${global.appRoot}/data/cache`);
    }

    // Bind public methods
    this.build = this.build.bind(this);
    this.files = this.files.bind(this);
    this.merge = this.merge.bind(this);
    this.restart = this.restart.bind(this);

    // Bind private methods
    this._task = this._task.bind(this);
    this._watch = this._watch.bind(this);

    // Run build
    this.build();

    // Add dev server task
    gulp.task('server', gulp.series('install', () => {
      // Run server task
      server.listen({
        env : {
          NODE_ENV : 'development',
        },
        args : [
          'run',
        ],
        path : `${__dirname}/index.js`,
      });

      // Set server
      this.server = true;
    }, 'watch'));

    // Build default task
    gulp.task('default', gulp.series('server'));
  }

  /**
   * Build Loader
   *
   * This has to be a sync method because gulp won't change core to allow async task loading
   */
  build() {
    // Glob tasks
    let done = [];

    // Get files
    const tasks      = glob.sync(this.files('tasks/*.js'));
    const watchers   = [];
    const installers = [];

    // Loop tasks
    for (let i = 0; i < tasks.length; i += 1) {
      // Load task
      const task = parser.task(tasks[i]);

      // Create task
      const Task = this._task(task);

      // Add to default task
      if (done.indexOf(task.task) === -1) installers.push(task.task);

      // Push to done
      done.push(task.task);

      // Check befores
      if (task.before) {
        // Push to dones
        done = done.concat(task.before);

        // Remove before from defaults
        for (let a = 0; a < task.before.length; a += 1) {
          // Set index
          const index = installers.indexOf(task.before[a]);

          // Check defaults
          if (index > -1) installers.splice(index, 1);
        }
      }

      // Check afters
      if (task.after) {
        // Push to dones
        done = done.concat(task.after);

        // Remove after from defaults
        for (let b = 0; b < task.after.length; b += 1) {
          // Set index
          const index = installers.indexOf(task.after[b]);

          // Check defaults
          if (index > -1) installers.splice(index, 1);
        }
      }

      // Add watch to watchers
      if (Task.watch) watchers.push(`${task.task}.watch`);
    }

    // Create tasks
    if (watchers.length) gulp.task('watch', gulp.series(...watchers));
    if (installers.length) gulp.task('install', gulp.series(...installers));
  }

  /**
   * Restarts dev server
   *
   * @private
   */
  restart() {
    // Check if running
    if (!this.server) return;

    // Restart server
    server.restart();
  }

  /**
   * Writes config file
   *
   * @param {string} name
   * @param {object} obj
   */
  write(name, obj) {
    // Write file
    fs.writeFile(`${global.appRoot}/data/cache/${name}.json`, JSON.stringify(obj), (err) => {
      // Check if error
      if (err) console.error(err); // eslint-disable-line no-console
    });
  }

  /**
   * Merges two objects
   *
   * @param   {object} obj1
   * @param   {object} obj2
   *
   * @returns {object}
   */
  merge(obj1, obj2) {
    // Loop object
    for (const p of Object.keys(obj2)) {
      try {
        // Property in destination object set; update its value.
        if (obj2[p].constructor === Object) {
          obj1[p] = this.merge(obj1[p], obj2[p]); // eslint-disable-line no-param-reassign
        } else if (obj2[p].constructor === Array) {
          obj1[p] = obj1[p].concat(obj2[p]); // eslint-disable-line no-param-reassign
        } else {
          obj1[p] = obj2[p]; // eslint-disable-line no-param-reassign
        }
      } catch (e) {
        // Property in destination object not set; create it and set its value.
        obj1[p] = obj2[p]; // eslint-disable-line no-param-reassign
      }
    }

    return obj1;
  }

  /**
   * Returns files
   *
   * @param  {string[]|string} files
   *
   * @return {string[]}
   */
  files(files) {
    // Check array
    const filesArr = !Array.isArray(files) ? [files] : files;

    // Let filtered files
    let filtered = [];

    // Get config
    const locals = [].concat(...((config.get('modules') || []).map((p) => {
      // Get paths
      const fullP = path.resolve(p);

      // Return path
      return [
        `${fullP}/node_modules/*/bundles/*/`,
        `${fullP}/node_modules/*/*/bundles/*/`,

        `${fullP}/bundles/node_modules/*/bundles/*/`,
        `${fullP}/bundles/node_modules/*/*/bundles/*/`,

        `${fullP}/bundles/*/`,
      ];
    })));

    // Loop files
    [
      `${global.edenRoot}/node_modules/*/bundles/*/`,
      `${global.edenRoot}/node_modules/*/*/bundles/*/`,

      `${global.appRoot}/bundles/node_modules/*/bundles/*/`,
      `${global.appRoot}/bundles/node_modules/*/*/bundles/*/`,

      `${global.appRoot}/node_modules/*/bundles/*/`,
      `${global.appRoot}/node_modules/*/*/bundles/*/`,

      ...locals,

      `${global.appRoot}/bundles/*/`,
    ].forEach((loc) => {
      // Loop files
      filesArr.forEach((file) => {
        // Push to newFiles
        filtered.push(loc + file);
      });
    });

    // fix and reduce
    filtered = (filtered.reverse().reduce((accum, loc) => {
      // check exists already
      if (accum.includes(loc)) return accum;

      // push loc
      accum.push(loc);

      // return accum
      return accum;
    }, []));

    filtered.reverse();

    // Return new files
    return filtered;
  }

  /**
   * Runs gulp task
   *
   * @param   {object} task
   *
   * @returns {*}
   *
   * @private
   */
  _task(task) {
    // Create task
    let Task = require(task.file); // eslint-disable-line global-require, import/no-dynamic-require

    // New task
    Task = new Task(this);

    // Create gulp task
    gulp.task(`${task.task}.run`, gulp.series(() => {
      // return task
      return Task.run(Task.watch ? this.files(Task.watch()) : undefined);
    }));

    // Create task args
    let args = [];

    // Check before
    if (task.before && task.before.length) {
      // Push to args
      args = args.concat(task.before);
    }

    // Push actual function
    args.push(`${task.task}.run`);

    // Check after
    if (task.after && task.after.length) {
      // Push to args
      args = args.concat(task.after);
    }

    // Create task
    gulp.task(task.task, gulp.series(...args));

    // Check watch
    if (Task.watch) {
      // Create watch task
      this._watch(task.task, Task);
    }

    // Return task
    return Task;
  }

  /**
   * Creates watch task
   *
   * @param {string} task
   * @param {*} Task
   *
   * @private
   */
  _watch(task, Task) {
    // Create watch task
    gulp.task(`${task}.watch`, gulp.series(() => {
      // return watch
      return gulp.watch(this.files(Task.watch()), gulp.series(task));
    }));
  }
}

/**
 * Export new Loader instance
 *
 * @type {Loader}
 */
module.exports = new Loader();
