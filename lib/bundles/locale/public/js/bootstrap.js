
// create built
let built = null;

// require dependencies
const i18n     = require ('i18next');
const xhrBE    = require ('i18next-xhr-backend');
const localBE  = require ('i18next-localstorage-backend');
const backend  = require ('i18next-chained-backend');
const events   = require ('events');
const detector = require ('i18next-browser-languagedetector');

// load riot store
const store  = require ('default/public/js/store');
const socket = require ('socket/public/js/bootstrap');

/**
 * create locale store
 */
class localeStore extends events {

  /**
   * construct riot store
   */
  constructor () {
    // set observable
    super (...arguments);

    // set i18n
    this.i18n = i18n;

    // bind i18n methods
    this.t = this.i18n.t.bind (this.i18n);

    // bind methods
    this.lang  = this.lang.bind (this);
    this.build = this.build.bind (this);

    // bind variables
    this.loaded      = false;
    this.initialized = false;

    // build store
    this.build ();
  }

  /**
   * build locale store
   */
  build () {
    // load i18n
    let load = store.get ('i18n');

    // pre user
    store.pre ('set', (data) => {
      // check key
      if (data.key !== 'i18n') return;

      // set val
      data.val = this;
    });

    // set defaults
    this.defaults = load.defaults || {};

    // set backends
    load.backend.backends = [localBE, xhrBE];

    // use functions
    this.i18n
      .use (detector)
      .use (backend);

    // init
    this.i18n.init (load);

    // on load
    this.i18n.on ('loaded', () => {
      // trigger update
      if (this.initialized) this.emit ('update');
    });

    // on initialized
    this.i18n.on ('initialized', () => {
      // set initialized
      this.initialized = true;

      // send language to socket
      if (this.i18n.language) socket.call ('lang', this.i18n.language);

      // trigger update
      this.emit ('update');
    });

    // on connect
    socket.on ('connect', () => {
      // send language to socket
      if (this.i18n.language) socket.call ('lang', this.i18n.language);
    });

    // set translate function
    this.t = this.i18n.t.bind (this.i18n);
  }

  /**
   * sets language
   *
   * @param {String} lang
   *
   * @return {String}
   */
  lang (lang) {
    // check language
    if (!lang) {
      // load language
      if (!this.i18n.language) return store.get ('i18n').lng;

      // load only one
      if (this.i18n.language.includes (' ')) {
        return this.i18n.language.split (' ')[this.i18n.language.split (' ').length - 1];
      }

      // return language
      return this.i18n.language;
    }

    // log changing
    console.log ('[eden] changing language to ' + lang);

    // change language
    this.i18n.changeLanguage (lang, () => {
      // changed language
      console.log ('[eden] changed language to ' + lang);

      // trigger update
      if (this.initialized) {
        // trigger update
        this.emit ('update');

        // send language to socket
        socket.call ('lang', this.i18n.language);
      }
    });
  }
}

/**
 * build alert class
 *
 * @type {edenAlert}
 */
built = new localeStore ();

/**
 * export locale store class
 *
 * @type {localeStore}
 */
exports = module.exports = built;

/**
 * add locale to window.eden
 */
window.eden.i18n = localeStore;