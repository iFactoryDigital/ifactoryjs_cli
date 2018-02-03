
// create built
let built = null;

// require riot
const events = require ('events');

// require dependencies
const acl    = require ('user/public/js/acl');
const store  = require ('riot/public/js/store');
const socket = require ('socket/public/js/bootstrap');

/**
 * build alert class
 */
class user extends events {
  /**
   * construct edenAlert class
   */
  constructor () {
    // run super
    super (...arguments);

    // set fields
    this.fields = [];

    // set private fields
    this._user = null;

    // set acl
    this.acl = acl;

    // bind methods
    this.get    = this.get.bind (this);
    this.set    = this.set.bind (this);
    this.build  = this.build.bind (this);
    this.exists = this.exists.bind (this);

    // bind private methods
    this._event = this._event.bind (this);

    // build user
    this.building = this.build ();
  }

  /**
   * sets key value
   *
   * @param {String} key
   */
  get (key) {
    // set key/value
    return this[key];
  }

  /**
   * sets key value
   *
   * @param {String} key
   * @param {*}      value
   */
  set (key, value) {
    // set key/value
    this[key]       = value;
    this._user[key] = value;

    // check in fields
    if (this.fields.indexOf (key) === -1) this.fields.push (key);

    // trigger key
    this.emit (key, value);
  }

  /**
   * builds user
   */
  build () {
    // set values
    let User = store.get ('user');

    // set user
    this._user = User;

    // check user
    for (let key in User) {
      // set value
      this[key] = User[key];

      // check in fields
      if (this.fields.indexOf (key) === -1) this.fields.push (key);
    }

    // on user socket
    store.on ('user', this._event);
    socket.on ('user', this._event);
  }

  /**
   * return exists
   *
   * @return {Boolean}
   */
  exists () {
    // return this.id
    return !!this.id;
  }

  /**
   * sets user
   *
   * @param  {Object} User
   */
  _event (User) {
    // set built
    window.eden.user = built;

    // set user
    this._user = User;

    // check no user
    if (!User) {
      // loop fields
      this.fields.forEach ((field) => {
        // delete key
        delete this[field];
      });

      // reset fields
      this.fields = [];

      // return
      return;
    }

    // emit stuff
    for (let key in User) {
      // set value
      if (this[key] !== User[key]) {
        // set value
        this.set (key, User[key]);
      }

      // check in fields
      if (this.fields.indexOf (key) === -1) this.fields.push (key);
    }

    // update user
    this.emit ('update');
  }
}

/**
 * build alert class
 *
 * @type {edenAlert}
 */
built = new user ();

/**
 * export alert class
 *
 * @type {user}
 */
exports = module.exports = built;

/**
 * add user to window.eden
 */
window.eden.user = built;