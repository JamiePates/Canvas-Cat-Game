package
{
		import flash.display.MovieClip
		import flash.events.Event
		import flash.events.KeyboardEvent
		
		public class Main_Document extends MovieClip
		{
			public var  _StartMarker:StartMarker;
			public var  _Player:Player;
			public var  _Boundaries:Boundaries;
			
			private var _vx:Number;
			private var _vy:Number;
			
			public function Main_Document():void
			{
				//Assign default values.
				_StartMarker.visible = false;
				_vx = 0;
				_vy = 0;
				
				//Set focus for keyboard input.
				stage.focus = stage;
				
				//Add event listeners.
				this.addEventListener(Event.ENTER_FRAME, enterFrameHandler);
				stage.addEventListener(KeyboardEvent.KEY_DOWN, keyDownHandler);
				stage.addEventListener(KeyboardEvent.KEY_UP, keyUpHandler);
			}
			
			private function enterFrameHandler(e:Event):void
			{
				//Gravitate the player.
				_vy += 2;
				
				//Move the player.
				_Player.x += _vx;
				_Player.y += _vy;
				
				//Process collisions
				processCollisions();
				
				//Scroll the stage.
				scrollStage();
			}
			
			private function keyDownHandler(e:KeyboardEvent):void
			{
				switch (e.keyCode)
				{
					case 37: //Left arrow (Move Left)
					_vx = -7;
					break;
					
					case 38: //Up arrow (Jump)
					_vy = -20;
					break;
					
					case 39: //Right arrow (Move Right)
					_vx = 7;
					break;
					
					default:
				}
			}
			
			private function keyUpHandler(e:KeyboardEvent):void
			{
				switch (e.keyCode)
				{
					case 37:
					case 39:
					_vx = 0;
					break;
					
					default:
				}
			}
			
			private function processCollisions():void
			{
				//When the player is falling.
				if (_vy > 0)
				{
					//respawn if player fell off screen.
					if (_Player.y > stage.stageHeight)
					{
						_Player.x = _StartMarker.x;
						_Player.y = _StartMarker.y;
						_Boundaries.x = 0;
						_Boundaries.y = 0;
						_vy = 0;
					}
					//otherwise, process collisions with boundaries.
					else
					{
						var collision:Boolean = false;
						
						if (_Boundaries.hitTestPoint(_Player.x,_Player.y, true))
						{
							collision = true;
						}
						if (collision)
						{
							while (collision)
							{
								_Player.y -= 0.1;
								
								collision = false;
								
								if (_Boundaries.hitTestPoint(_Player.x,_Player.y, true))
								{
								collision = true;
								}
							}
							
							_vy = 0;
						}
					}
				}
			}
			
			private function scrollStage():void
			{
				_Boundaries.x += (stage.stageWidth * 0.5) - _Player.x;
				_Player.x = stage.stageWidth * 0.5;
			}
		}
}