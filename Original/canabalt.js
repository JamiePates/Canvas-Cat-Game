// Opera doesn't implement Date.now
if (!Date.now) {
  Date.now = function() {
    return Number(new Date);
  };
}

Canabalt = function(container, options) {
  this.options = options || {};
  this.container = container;
  this.viewportWidth = this.container.offsetWidth;
  this.buildings = [];

  // Milliseconds between frames
  this.mbf = 1000 / this.readOption('fps');

  this.initialize();
};

// Cap game at 90 cycles per second
Canabalt.CYCLES_PER_SECOND = 90;

// Map keys bound to jump action
Canabalt.BIND_JUMP_KEYS = {'88': true, '67': true, '32': true}; // X, C, spacebar

Canabalt.DISTANCE_TO_METERS_COEFFICIENT = 0.055;

Canabalt.PARALAX_BG_1_TOP_OFFSET = '100px';
Canabalt.PARALAX_BG_1_SPEED = 0.3;

Canabalt.PARALAX_BG_2_TOP_OFFSET = '100px';
Canabalt.PARALAX_BG_2_SPEED = 0.2;

Canabalt.PARALAX_FG_SPEED = 3;
Canabalt.PARALAX_FG_INITIAL_WAIT = 3000;

Canabalt.SHAKE_START = 3000;
Canabalt.SHAKE_AMPLITUDE = 20;

Canabalt.RUNNER_WIDTH = 24;
Canabalt.RUNNER_HEIGHT = 38;

Canabalt.RUNNER_JUMPING_WIDTH = 28;
Canabalt.RUNNER_FALLING_ANIMATION_FREQ = 6; // Change falling frame every n cycles

Canabalt.RUNNER_X_OFFSET_COEFFICIENT = 100;
Canabalt.RUNNER_RUNNING_FRAMECOUNT = 16;
Canabalt.RUNNER_RUNNING_CHANGE_FRAME_DISTANCE = 15;

Canabalt.defaultOptions = {
  fps: 50,
  initialSpeed: 0.2,
  acceleration: 0.0001,
  jumpImpulse: 5.5,
  gravity: 0.15
};

Canabalt.prototype.readOption = function(option) {
  return this.options[option] || Canabalt.defaultOptions[option];
};

Canabalt.prototype.initialize = function() {
  // Reset cycle counter
  this.cycles = 0;

  // Reset speed and traveled distance
  this.speed = this.readOption('initialSpeed');
  this.distance = 0;

  this.shakeDuration = Canabalt.SHAKE_START;
  
  // Runner variables
  this.airborne = false;
  this.jumping = false;
  this.ySpeed = 0;
  this.y = 0;

  // Copy some options to object space for quicker access
  this.acceleration = this.readOption('acceleration');
  this.jumpImpulse = this.readOption('jumpImpulse');
  this.gravity = this.readOption('gravity');

  // Pointer to the building the runner is currently "stepping" on
  this.currentBuilding = null;

  // Create runner DIV
  if (!this.runner) {
    this.runner = this.createDiv('runner');
  }

  this.runnerFrame = 0;
  this.runnerRunAnimationDistance = 0;

  // First paralax background
  if (!this.paralaxBg1) {
    this.paralaxBg1 = this.createDiv('paralaxbg1');
  }
  this.paralaxBg1Offset = 0;

  // Second paralax background
  if (!this.paralaxBg2) {
    this.paralaxBg2 = this.createDiv('paralaxbg2');
  }
  this.paralaxBg2Offset = 0;

  this.removeParalaxBeam();
  this.scheduleParalaxBeam(Canabalt.PARALAX_FG_INITIAL_WAIT);

  // Distance counter
  if (!this.distanceCounter) {
    this.distanceCounter = this.createDiv('distance');
  }

  // Remove all buildings
  while (this.buildings.length) this.removeFirstBuilding();

  // Place the first building
  this.addBuilding(new Canabalt.Building(this));

  // Provide the viewport with an actual height property so that
  // absolute elements within it are positioned relative to its height
  // rather than its ancestor container
  this.container.style.height = String(this.container.offsetHeight) + 'px';

  return this;
};

Canabalt.prototype.createDiv = function(className, skipInsert) {
  var div = document.createElement('div');
  div.className = className;
  if (!skipInsert) this.container.appendChild(div);
  return div;
};

Canabalt.prototype.paused = function() {
  return !this.interval;
};

Canabalt.prototype.start = function() {
  if (this.paused()) {
    // Initialize cycle clock and timer
    this.lastCycle = Date.now();
    this.elapsed = 0;

    this.startInputCapture();

    // Create game interval
    var me = this;
    this.interval = setInterval(function() { me.cycle(); }, 1000 / Canabalt.CYCLES_PER_SECOND);
  }
  return this;
};

Canabalt.prototype.stop = function() {
  if (!this.paused()) {
    this.stopInputCapture();

    // Stop game interval
    clearInterval(this.interval);
    delete this.interval;
  }
  return this;
};

Canabalt.prototype.addBuilding = function(building) {
  this.buildings.unshift(building);
  this.container.appendChild(building.element);
};

Canabalt.prototype.removeFirstBuilding = function() {
  var building = this.buildings.pop();
  this.container.removeChild(building.element);
};

Canabalt.prototype.startInputCapture = function() {
  var me = this;

  this.oldOnKeyDown = document.onkeydown;
  this.oldOnKeyUp = document.onkeyup;

  // Use DOM-0-style event listener registration
  // for easier cross-browser compatibility
  // No need for anything fancy anyway
  
  document.onkeydown = function(event) {
    if (Canabalt.BIND_JUMP_KEYS[String(event.keyCode)]) {
      me.startJump();
    }
  };

  document.onkeyup = function(event) {
    if (Canabalt.BIND_JUMP_KEYS[String(event.keyCode)]) {
      me.endJump();
    }
  };
};

Canabalt.prototype.stopInputCapture = function() {
  document.onkeydown = this.oldOnKeyDown;
  document.onkeyup = this.oldOnKeyUp;
};

Canabalt.prototype.startJump = function() {
  if (!this.airborne && !this.jumping) {
    this.airborne = true;
    this.jumping = true;
    this.ySpeed = this.jumpImpulse;
  }
};

Canabalt.prototype.endJump = function() {
  if (this.airborne && this.jumping) {
    this.jumping = false;
    if (this.ySpeed > 0) this.ySpeed = 0;
  } else if (this.jumping) {
    this.jumping = false;
  }
};

Canabalt.prototype.scheduleParalaxBeam = function(wait) {
  var me = this;
  this.paralaxBeamTimeout = setTimeout(function() { me.spawnParalaxBeam(); }, wait);
};

Canabalt.prototype.spawnParalaxBeam = function() {
  // Choose one of two possible beam styles
  var style = Math.round(1 + Math.random());

  this.paralaxBeam = this.createDiv('paralaxbeam' + style, true);
  this.paralaxBeamOffset = this.viewportWidth;
  this.paralaxBeam.style.left = this.paralaxBeamOffset + 'px';

  // Insert paralax element
  this.container.appendChild(this.paralaxBeam);

  // Now obtain its width
  this.paralaxBeamWidth = this.paralaxBeam.offsetWidth;
};

Canabalt.prototype.removeParalaxBeam = function() {
  if (this.paralaxBeam) {
    this.container.removeChild(this.paralaxBeam);
  }

  if (this.paralaxBeamTimeout) {
    clearTimeout(this.paralaxBeamTimeout);
  }

  this.paralaxBeam = null;
  this.paralaxBeamWidth = null;
  this.paralaxBeamOffset = null;
  this.paralaxBeamTimeout = null;
};

Canabalt.prototype.shake = function(duration) {
  this.shakeDuration = duration;
};

// In order to prevent setting the top offset of the viewport in each
// frame in which there is no shaking, this is a separate method from draw()
// and only called when the shaking stops
Canabalt.prototype.staightenViewport = function() {
  this.container.style.top = null;
};

Canabalt.prototype.draw = function() {
  // Draw buildings
  for (var i = 0; i < this.buildings.length; ++i) {
    this.buildings[i].draw();
  }

  // Draw runner
  this.runner.style.bottom = String(Math.round(this.y)) + 'px';
  this.runner.style.left = String(Math.round(this.x)) + 'px';

  // NOTE: it kinda sucks that we're changing the guy's width for every frame here...
  if (this.airborne) {
    this.runner.style.width = String(Canabalt.RUNNER_JUMPING_WIDTH) + 'px';
    this.runner.style.backgroundPosition = String(-this.runnerFrame * Canabalt.RUNNER_JUMPING_WIDTH) + 'px bottom';
  } else {
    this.runner.style.width = String(Canabalt.RUNNER_WIDTH) + 'px';
    this.runner.style.backgroundPosition = String(-this.runnerFrame * Canabalt.RUNNER_WIDTH) + 'px top';
  }

  // Draw paralax
  this.paralaxBg1.style.backgroundPosition = String(Math.round(this.paralaxBg1Offset)) + 'px ' + Canabalt.PARALAX_BG_1_TOP_OFFSET;
  this.paralaxBg2.style.backgroundPosition = String(Math.round(this.paralaxBg2Offset)) + 'px ' + Canabalt.PARALAX_BG_2_TOP_OFFSET;

  if (this.paralaxBeam) {
    this.paralaxBeam.style.left = String(Math.round(this.paralaxBeamOffset)) + 'px';
  }

  // Draw distance counter
  this.distanceCounter.innerHTML = String(Math.round(this.distance * Canabalt.DISTANCE_TO_METERS_COEFFICIENT)) + 'm';

  // Since shaking the screen is mostly a random process that doesn't affect gameplay,
  // calculate the shaking offset when drawing a frame instead of each cycle
  if (this.shakeDuration) {
    this.container.style.top = String(Math.round(Math.random() * Canabalt.SHAKE_AMPLITUDE)) + 'px';
  }
};

// This is where most the game logic happens
Canabalt.prototype.cycle = function() {
  // Increment cycles counter
  this.cycles++;

  // Calculate time elapsed since last game cycle
  var elapsed = Date.now() - this.lastCycle;

  // Keep track of time elapsed since last frame
  this.elapsed += elapsed;

  // Calculate how much we moved this cycle
  var distance = Math.round(elapsed * this.speed);

  // Increment the total distance ran
  this.distance += distance;

  // Increase speed
  this.speed += this.acceleration;

  // Runner's x offset is square root of the speed times a multiplier
  this.x = Math.sqrt(this.speed) * Canabalt.RUNNER_X_OFFSET_COEFFICIENT;

  // Check jump
  if (this.airborne) {
    // Calculate which jumping frame to display based on
    // vertical speed
    if (this.ySpeed > this.jumpImpulse * 0.66) {
      this.runnerFrame = 0;
    } else if (this.ySpeed > this.jumpImpulse * 0.33) {
      this.runnerFrame = 1;
    } else if (this.ySpeed > this.jumpImpulse * 0.1) {
      this.runnerFrame = 2;
    } else if (!this.falling && this.ySpeed <= 0) {
      this.falling = true;
      this.runnerFrame = 3;
    } else if (this.cycles % Canabalt.RUNNER_FALLING_ANIMATION_FREQ == 0) {
      this.runnerFrame++;
      if (this.runnerFrame == 11) this.runnerFrame = 3;
    }

    this.y += this.ySpeed;
    this.ySpeed -= this.gravity;

    var h = this.currentBuilding ? this.currentBuilding.height : 0;

    if (this.y <= h) {
      this.y = h;
      this.ySpeed = 0;
      this.airborne = false;
      this.falling = false;
    }
  } else {

    this.runnerRunAnimationDistance += distance;

    // Set runner animation frame
    if (this.runnerRunAnimationDistance > Canabalt.RUNNER_RUNNING_CHANGE_FRAME_DISTANCE) {
      this.runnerRunAnimationDistance = 0;
      ++this.runnerFrame;
    }
  }

  // Move buildings
  for (var i = 0; i < this.buildings.length; ++i) {
    this.buildings[i].move(distance);
  }

  // Move paralax
  this.paralaxBg1Offset -= distance * Canabalt.PARALAX_BG_1_SPEED;
  this.paralaxBg2Offset -= distance * Canabalt.PARALAX_BG_2_SPEED;

  if (this.paralaxBeam) {
    this.paralaxBeamOffset -= distance * Canabalt.PARALAX_FG_SPEED;
    if (this.paralaxBeamOffset <= -this.paralaxBeamWidth) {
      this.removeParalaxBeam();
      this.scheduleParalaxBeam(Math.round(Math.random() * (5000 / this.speed)))
    }
  }

  // Shake it baby
  if (this.shakeDuration) {
    this.shakeDuration -= elapsed;
    if (this.shakeDuration < 0) {
      this.shakeDuration = 0;
      this.staightenViewport();
    }
  }

  // Check if we need to redraw
  if (this.elapsed > this.mbf) {
    this.elapsed = 0;
    this.draw();
  }

  this.lastCycle = Date.now();
};

Canabalt.Building = function(game, options) {
  this.game = game;

  this.type = Canabalt.Building.TYPE_NORMAL;

  this.width = 300 + Math.round(Math.random() * 1000);
  this.height = 30 + Math.round(Math.random() * 100);
  this.gap = Math.round(this.game.speed * 300);
  this.totalWidth = this.width + this.gap;

  this.left = this.game.viewportWidth;

  this.endReached = false;
  this.expired = false;

  this.isIn = false;
  this.isOut = false;

  this.element = document.createElement('div');
  this.element.className = 'building';
  this.element.style.height = String(this.height) + 'px';
  this.element.style.width = String(this.width) + 'px';

  this.draw();
};

Canabalt.Building.TYPE_NORMAL= 1;
Canabalt.Building.TYPE_CRANE = 2;
Canabalt.Building.TYPE_DEMOLITION = 3;
Canabalt.Building.TYPE_INDOORS = 4;

Canabalt.Building.prototype.move = function(distance) {
  this.left -= distance;

  // Check if this is now the current building
  if (this.isIn) {
    if (!this.isOut && this.left + this.width < this.game.x) {
      this.game.currentBuilding = null;
      this.game.airborne = true;
      this.isOut = true;
    }
  } else if (this.left <= this.game.x) {
    this.game.currentBuilding = this;
    this.isIn = true;
  }

  // Check if the end of the building + gap was reached and call
  // an appropiate action (spawn a new building?)
  if (!this.endReached && (this.left + this.totalWidth <= this.game.viewportWidth)) {
    this.game.addBuilding(new Canabalt.Building(this.game));
    this.endReached = true;
  }

  // If the building leaves the left side of the screen then
  // it has expired and has to be removed
  if (!this.expired && (this.totalWidth + this.left <= 0)) {
    this.game.removeFirstBuilding();
    this.expired = true;
  }

  return this;
};

Canabalt.Building.prototype.draw = function() {
  if (!this.expired) {
    this.element.style.left = String(this.left) + 'px';
  }
  return this;
};
