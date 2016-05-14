var exec = require('child_process').exec,
    EventEmitter = require('events').EventEmitter,
    util = require('util');

var defaults = ['-o hdmi'];

var STATES = {
    PLAYING: 0,
    PAUSED: 1,
    IDLE: 2,
    STOPPING: 3
};

var keys = {
    decreaseSpeed: '1',
    increaseSpeed: '2',
    previousAudioStream: 'j',
    nextAudioStream: 'k',
    previousChapter: 'i',
    nextChapter: 'o',
    previousSubtitleStream: 'n',
    nextSubtitleStream: 'm',
    toggleSubtitles: 's',
    decreaseSubtitleDelay: 'd',
    increaseSubtitleDelay: 'f',
//    pause: 'p', // toggle between pause and play
//    stop: 'q',
    decreaseVolume: '-',
    increaseVolume: '+',
    seekForward: "\x5b\x43",
    seekBackward: "\x5b\x44",
    seekFastForward: "\x5b\x41",
    seekFastBackward: "\x5B\x42"
};

var omx = function() {
    if (!(this instanceof omx)) return new omx();
    this.state = STATES.IDLE;
    this.media = {};
};

util.inherits(omx, EventEmitter);

// start playing.. before make sure to
// shutdown any existing instance
omx.prototype.play = function(file, opts) {
    // toggle between play and pause if no file
    // was passed in.
    // if (!file) return this.pause();
    this.media.file = file;
    this.media.opts = opts;

    if (this.state === STATES.IDLE) {
        this.init(file, opts);
    } else {
        if (this.state === STATES.STOPPING ) return;
        // quit any existing instance
        this.stop();
        // init asap
        this.once('init', function(media) {
            this.init(media.file, media.opts);
        }.bind(this));        
    }
};

// fire up omxplayer
omx.prototype.init = function(file, opts) {
    var cmdOptions = (opts || defaults).join(' ');

    this.player = exec('sudo omxplayer ' + cmdOptions + ' ' + file);
    //, function(error, stdout, stderr) {
    //     console.log('exec stdout: ' + stdout);
    //     console.log('exec stderr: ' + stderr);
    //     if (error !== null) {
    //         console.log('exec error: ' + error);
    //     }
    // });
    this.state = STATES.PLAYING;
    this.emit('playing', file);

    this.player.on('exit', function(code) {
        this.state = STATES.IDLE;
        this.player = null;
        this.emit('ended', code);
        this.emit('init', this.media);
    }.bind(this));

    this.player.on('message', function(data) {
      this.emit('message', data);
    }.bind(this));
    
    this.player.on('disconnect', function() {
      this.emit('disconnect');
    }.bind(this));

    this.player.on('close', function(code) {
      this.emit('close', code);
    }.bind(this));

    this.player.stdout.on('data', function(data) {
      this.emit('stdout', data);
    }.bind(this));

    this.player.stderr.on('data', function(data) {
      this.emit('stderr', data);
    }.bind(this));

    this.player.on('error', function(e) {
      this.emit('error', e.message);
    }.bind(this));
};

// send a key command to omxplayer
omx.prototype.send = function(key) {
    if (!this.player || this.state === STATES.IDLE || this.state === STATES.STOPPING  ) return;
    try {
        this.player.stdin.write(key);
    } catch (e) {
      this.emit('error', e);
    }
};

// check the current state
omx.prototype.getState = function() {
    return this.state;
};

omx.prototype.pause = function() {
    if (this.state === STATES.IDLE || this.state === STATES.STOPPING ) return;
    this.state = (this.state === STATES.PAUSED) ? STATES.PLAYING : STATES.PAUSED;
    this.send('p');
};

omx.prototype.stop = function() {
  if (this.state === STATES.IDLE || this.state === STATES.STOPPING ) return;

  this.send('q');
  this.state = STATES.STOPPING;
};

// build some nice methods for interacting
// with the player
for (var method in keys) {
    (function(key) {
        omx.prototype[method] = function() {
            this.send(key);
        };
    })(keys[method]);
}

module.exports = omx();